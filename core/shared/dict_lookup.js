/* ============================================================
   shared/dict_lookup.js — 本地词典查词（两级缓存 + 按需分片 + 热度升温）
   · 职责：本地查词，避免对句子内单词频繁调用 AI 翻译。
   · 查词顺序：
       1) 核心词表（内存，VocabLibrary.findWord 二分查找）— 考试核心词即时命中
       2) 内存热缓存（LRU）— 高频词零延迟
       3) 已载分片（内存 / IndexedDB 持久缓存）
       4) 按索引定位分片 → 拉取 → 写入 IndexedDB
   · 热度升温：查询计数持久化于 IndexedDB（防抖批量写），计数超阈值 → 升入内存热缓存。
   · 文件说明：data/dict/index.json（词→分片）+ data/dict/shard_XXX.json（分片数据）
   · 降级：file:// 等 fetch 受限场景下索引/分片加载失败时，核心词查词仍可用，未命中走 AI 兜底。
   · 挂载：EnglishStudyShared.DictLookup（桌面 window.DictLookup，移动 Mobile.DictLookup）
   · 依赖：VocabLibrary（同 Shared 命名空间）；IndexedDB（不可用时自动降级为纯内存缓存）
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var DictLookup = (Shared.DictLookup = Shared.DictLookup || {});
  var VocabLibrary = Shared.VocabLibrary || global.VocabLibrary;

  var DICT_VERSION = 2;   // 词库结构版本，变化时使 IndexedDB 缓存整体失效
  var INDEX_URL = global.Mobile ? '../data/dict/index.json' : 'data/dict/index.json';
  var SHARD_PREFIX = global.Mobile ? '../data/dict/shard_' : 'data/dict/shard_';

  var HOT_THRESHOLD = 3;  // 查询计数达到该值 → 升入内存热缓存
  var HOT_CAP = 500;      // 内存热缓存 LRU 容量上限
  var DB_NAME = 'esc-dict';
  var DB_VER = 1;

  var _index = null;        // { n, map:{word:shard} }；null 表示未加载/加载失败
  var _indexStatus = 'idle'; // idle | loading | ready | error
  var _coreReady = false;   // 核心词表是否已尝试加载（惰性 init，幂等）
  var _shards = {};         // 内存分片缓存 { shardIndex: { words } }
  var _hot = new Map();     // 内存热缓存 word -> entry（LRU）
  var _counts = {};         // 内存查询计数 word -> n（防抖批量写 IndexedDB）
  var _countTimer = null;
  var _db = null;           // IndexedDB 实例

  // 内置高频功能词兜底：极小静态表，弥补核心词表（考试词库）漏收的功能词
  //（如 the/an/is/are 等），确保 file:// 等 fetch 受限场景下查词稳定命中，不依赖分片。
  // 仅收录高频虚词/功能词及常见缩写（pos 归其为类，如助动词缩写统一 v），格式同核心词表 {pos, meaning}。
  var _STATIC_WORDS = {
    the: { pos: 'art', meaning: '这，那（定冠词）' },
    an: { pos: 'art', meaning: '一个（用于元音音素前）' },
    be: { pos: 'v', meaning: '是；存在；成为' },
    am: { pos: 'v', meaning: '是（be 的第一人称单数现在式）' },
    is: { pos: 'v', meaning: '是（be 的第三人称单数现在式）' },
    are: { pos: 'v', meaning: '是（be 的复数现在式）' },
    was: { pos: 'v', meaning: '是（be 的第一/三人称单数过去式）' },
    were: { pos: 'v', meaning: '是（be 的复数过去式）' },
    been: { pos: 'v', meaning: 'be 的过去分词' },
    has: { pos: 'v', meaning: '有（have 的第三人称单数）' },
    had: { pos: 'v', meaning: '有（have/has 的过去式与过去分词）' },
    does: { pos: 'v', meaning: '做（do 的第三人称单数）' },
    doing: { pos: 'v', meaning: '做、干（do 的现在分词）' },
    did: { pos: 'v', meaning: '做（do 的过去式）' },
    not: { pos: 'adv', meaning: '不，没有' },

    /* 常见缩写/缩约词（tokenize 会按整词匹配，静态收录以避免 file:// 分片缺失时空白） */
    "don't": { pos: 'v', meaning: '不（do not 的缩写）' },
    "doesn't": { pos: 'v', meaning: '不（does not 的缩写）' },
    "didn't": { pos: 'v', meaning: '不（did not 的缩写）' },
    "won't": { pos: 'v', meaning: '将不（will not 的缩写）' },
    "can't": { pos: 'v', meaning: '不能（can not 的缩写）' },
    "cannot": { pos: 'v', meaning: '不能' },
    "isn't": { pos: 'v', meaning: '不是（is not 的缩写）' },
    "aren't": { pos: 'v', meaning: '不是（are not 的缩写）' },
    "wasn't": { pos: 'v', meaning: '不是（was not 的缩写）' },
    "weren't": { pos: 'v', meaning: '不是（were not 的缩写）' },
    "hasn't": { pos: 'v', meaning: '没有（has not 的缩写）' },
    "haven't": { pos: 'v', meaning: '没有（have not 的缩写）' },
    "hadn't": { pos: 'v', meaning: '没有（had not 的缩写）' },
    "i'm": { pos: 'v', meaning: '我是（I am 的缩写）' },
    "i've": { pos: 'v', meaning: '我已经（I have 的缩写）' },
    "i'll": { pos: 'v', meaning: '我将要（I will 的缩写）' },
    "you're": { pos: 'v', meaning: '你是（you are 的缩写）' },
    "you've": { pos: 'v', meaning: '你已经（you have 的缩写）' },
    "you'll": { pos: 'v', meaning: '你将（you will 的缩写）' },
    "we're": { pos: 'v', meaning: '我们是（we are 的缩写）' },
    "we'll": { pos: 'v', meaning: '我们将（we will 的缩写）' },
    "they're": { pos: 'v', meaning: '他们是（they are 的缩写）' },
    "they'll": { pos: 'v', meaning: '他们将（they will 的缩写）' },
    "it's": { pos: 'v', meaning: '它是（it is 的缩写）' },
    "that's": { pos: 'v', meaning: '那是（that is 的缩写）' },
    "there's": { pos: 'v', meaning: '有（there is 的缩写）' },
    "let's": { pos: 'v', meaning: '让我们（let us 的缩写）' }
  };

  /* ---------- IndexedDB ---------- */
  function idbOpen() {
    return new Promise(function (resolve) {
      if (_db) return resolve(_db);
      if (!global.indexedDB) return resolve(null);
      var req;
      try { req = global.indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('shards')) db.createObjectStore('shards', { keyPath: 'n' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
  }

  function idbGet(store, key) {
    return new Promise(function (resolve) {
      idbOpen().then(function (db) {
        if (!db) return resolve(null);
        var tx, req;
        try {
          tx = db.transaction(store, 'readonly');
          req = tx.objectStore(store).get(key);
        } catch (e) { return resolve(null); }
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  function idbPut(store, val) {
    return new Promise(function (resolve) {
      idbOpen().then(function (db) {
        if (!db) return resolve(false);
        var tx, req;
        try {
          tx = db.transaction(store, 'readwrite');
          req = tx.objectStore(store).put(val);
        } catch (e) { return resolve(false); }
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { resolve(false); };
      });
    });
  }

  function idbClear(store) {
    return new Promise(function (resolve) {
      idbOpen().then(function (db) {
        if (!db) return resolve(false);
        try { db.transaction(store, 'readwrite').objectStore(store).clear(); }
        catch (e) { return resolve(false); }
        resolve(true);
      });
    });
  }

  /* ---------- 索引加载（懒加载 + IndexedDB 缓存 + 版本失效） ---------- */
  async function ensureIndex() {
    if (_index) return _index;
    if (_indexStatus === 'loading') { while (_indexStatus === 'loading') await new Promise((r) => setTimeout(r, 20)); return _index; }
    _indexStatus = 'loading';
    // 1) 内存/会话内已缓存
    // 2) IndexedDB 缓存（校验版本）
    var cached = await idbGet('meta', 'index');
    if (cached && cached.v === DICT_VERSION) { _index = cached.data; _indexStatus = 'ready'; return _index; }
    // 缓存缺失或版本不匹配：清空旧分片缓存，避免与新索引错配（分片缓存不带版本，须随索引整体失效）
    if (cached) { try { await idbClear('shards'); } catch (e) { /* 清理失败不影响主流程 */ } }
    // 3) fetch
    try {
      var res = await fetch(INDEX_URL + '?v=' + DICT_VERSION);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var idx = await res.json();
      if (!idx || !idx.n || !idx.map) throw new Error('索引结构异常');
      _index = idx;
      _indexStatus = 'ready';
      idbPut('meta', { k: 'index', v: DICT_VERSION, data: idx });
      return _index;
    } catch (e) {
      _index = null;
      _indexStatus = 'error';
      console.warn('[DictLookup] 索引加载失败：', (e && e.message) ? e.message : String(e));
      return null;
    }
  }

  /* ---------- 分片拉取（内存 → IndexedDB → fetch；并发去重） ---------- */
  var _shardLoading = {}; // shardIndex -> Promise，同一分片并发只拉一次
  function getShard(n) {
    if (_shards[n]) return Promise.resolve(_shards[n]);
    if (_shardLoading[n]) return _shardLoading[n];
    var p = (async () => {
      var cached = await idbGet('shards', n);
      if (cached && cached.words) { _shards[n] = cached; return cached; }
      try {
        var res = await fetch(SHARD_PREFIX + String(n).padStart(3, '0') + '.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        if (!data || !data.words) throw new Error('分片结构异常');
        _shards[n] = data;
        idbPut('shards', data);
        return data;
      } catch (e) {
        console.warn('[DictLookup] 分片 ' + n + ' 加载失败：', (e && e.message) ? e.message : String(e));
        return null;
      }
    })();
    _shardLoading[n] = p;
    var done = function () { if (_shardLoading[n] === p) delete _shardLoading[n]; };
    p.then(done, done);
    return p;
  }

  /* ---------- 词性前缀解析 ----------
     ECDICT 部分词条 pos 列为空，词性缩写嵌在释义前缀（如 "n. 苹果"、"art. 那"）。
     分片词缺失独立 pos 时，从释义前缀解析并剥离，供气泡单独展示词性。
     仅认白名单内的词性缩写，避免 "vs."/"pl." 等非词性前缀被误判。 */
  var POS_WHITELIST = {
    n: 1, v: 1, vt: 1, vi: 1, aux: 1, vbl: 1, ving: 1, vpast: 1,
    pron: 1, adj: 1, a: 1, adv: 1, ad: 1, prep: 1, conj: 1,
    interj: 1, int: 1, art: 1, num: 1, det: 1, abbr: 1, pl: 1, pp: 1
  };
  var POS_RE = /^([a-z]{2,8})\.\s*/i;
  function splitPos(m) {
    if (!m) return { pos: '', meaning: '' };
    var s = String(m);
    var mm = s.match(POS_RE);
    if (mm && POS_WHITELIST[mm[1].toLowerCase()]) {
      return { pos: mm[1].toLowerCase(), meaning: s.slice(mm[0].length) };
    }
    return { pos: '', meaning: s };
  }

  /* ---------- 热度升温 ---------- */
  function touch(word) {
    _counts[word] = (_counts[word] || 0) + 1;
    if (_counts[word] >= HOT_THRESHOLD) scheduleFlush();
  }

  function promote(word, entry) {
    if (_hot.has(word)) _hot.delete(word);
    _hot.set(word, entry);
    delete _counts[word]; // 已升温进热缓存，清除计数避免 _counts 无界累积
    if (_hot.size > HOT_CAP) {
      var oldest = _hot.keys().next().value;
      if (oldest != null) _hot.delete(oldest);
    }
  }

  function scheduleFlush() {
    if (_countTimer) return;
    _countTimer = setTimeout(function () {
      _countTimer = null;
      idbPut('meta', { k: 'counts', v: DICT_VERSION, data: _counts });
    }, 5000);
  }

  /* ---------- 核心 API ---------- */
  /**
   * 确保依赖就绪（核心词表已加载）。幂等。
   */
  DictLookup.init = async function () {
    if (VocabLibrary && typeof VocabLibrary.load === 'function') {
      try { await VocabLibrary.load(); } catch (e) { /* 忽略 */ }
      // 无论成败都视为已尝试；成功则后续 lookup 不再重复 init（幂等）
      _coreReady = true;
    }
    return true;
  };

  /**
   * 本地查词。返回统一词条或 null（未命中 → 调用方走 AI 兜底）。
   * @param {string} word
   * @returns {Promise<object|null>} { word, pos?, meaning?, phonetic?, example?, exampleCn?, source }
   */
  DictLookup.lookup = async function (word) {
    if (!word) return null;
    // 惰性确保核心词表已加载（VocabLibrary.load 内部幂等防重）
    // 仅在成功后才置位 _coreReady，失败时下次查询自动重试，避免一次瞬态失败导致永久跳过核心词表
    if (!_coreReady) {
      try { await DictLookup.init(); _coreReady = true; } catch (e) { /* 忽略，下次重试 */ }
    }
    var key = String(word).toLowerCase();
    // 归一化撇号：弯引号 ’‘ 统一为直撇号 '，保证缩约词（don’t/don't/can’t）命中静态表或常规数据
    if (key.indexOf('\u2019') >= 0 || key.indexOf('\u2018') >= 0) {
      key = key.replace(/[\u2019\u2018]/g, "'");
    }
    // 1) 核心词表（内存二分查找）
    if (VocabLibrary && typeof VocabLibrary.findWord === 'function') {
      var cw = VocabLibrary.findWord(key);
      if (cw) {
        return { word: cw.word, pos: cw.pos, meaning: cw.meaning, phonetic: cw.phonetic, example: cw.example, exampleCn: cw.exampleCn, source: 'core' };
      }
    }
    // 2) 内存热缓存（LRU）
    if (_hot.has(key)) {
      var he = _hot.get(key);
      _hot.delete(key); _hot.set(key, he); // 触达末尾
      return he;
    }
    // 2.5) 内置高频功能词兜底：不依赖网络/IndexedDB，file:// 也稳定命中。
    // 核心词表明明遗漏 the/an/is/are 等，此表保证此类词始终有词性与释义。
    // 静态命中不 touch()/不升温：命中即 O(1) 常量，无需热缓存，也避免 _counts 无界累积。
    var sw = _STATIC_WORDS[key];
    if (sw && (sw.pos || sw.meaning)) {
      return { word: key, pos: sw.pos || '', meaning: sw.meaning || '', source: 'static' };
    }
    // 3) 分片（需索引）
    var idx = await ensureIndex();
    if (idx) {
      var sn = idx.map[key];
      if (sn != null) {
        var shard = await getShard(sn);
        var se = shard && shard.words ? shard.words[key] : null;
        if (se) {
          // 分片词 pos 可能为空，从释义前缀解析并剥离（ECDICT "n. 苹果" → pos=n, meaning=苹果）
          var sp = splitPos(se.m);
          var entry = {
            word: se.w,
            pos: se.pos || sp.pos,
            meaning: sp.pos ? sp.meaning : se.m,
            phonetic: se.p, example: se.ex, exampleCn: se.exCn, source: 'shard'
          };
          touch(key);
          if (_counts[key] >= HOT_THRESHOLD) promote(key, entry);
          return entry;
        }
      }
    }
    return null;
  };

  /**
   * 重启/清除本地词典缓存（测试与排障用）
   */
  DictLookup.reset = async function () {
    _index = null; _indexStatus = 'idle'; _shards = {}; _hot = new Map(); _counts = {};
    if (_countTimer) { clearTimeout(_countTimer); _countTimer = null; }
    await idbClear('shards');
    await idbClear('meta');
  };

  if (!global.DictLookup) global.DictLookup = DictLookup;
  if (global.Mobile) global.Mobile.DictLookup = DictLookup;

  // 调试/测试钩子：暴露内存热缓存与查询计数（生产代码不使用）
  DictLookup._hot = _hot;
  DictLookup._counts = _counts;
})(typeof window !== 'undefined' ? window : globalThis);
