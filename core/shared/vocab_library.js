/* ============================================================
   shared/vocab_library.js — 内置分级词库共享加载器（桌面/移动两端复用）
   · 职责：读取 data/vocab_library.json、schema 校验、档位枚举、整档导入、词汇量自测算法。
   · 数据模型：单一去重词表 { version, words:[{word,pos,meaning,tags,cefr}] }
     tags 为多考试标签（exam-cet4|cet6|kaoyan|toefl|sat），「选中某档」= tags ⊇ {该档} 的累计并集。
   · 档位元数据（名称/CEFR/描述）为静态常量，词量由标签聚合实时计算。
   · 导入动作委托调用端注入的 addWord 语义（桌面 VocabData.addWord / 移动 Store.addWordToNotebook）。
   · 挂载：window.EnglishStudyShared.VocabLibrary（桌面可用 window.VocabLibrary 别名，移动挂 Mobile.VocabLibrary）
   · 依赖：无（fetch 由浏览器提供）
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var VocabLibrary = (Shared.VocabLibrary = Shared.VocabLibrary || {});

  // 默认数据相对路径：桌面 index.html（根）→ data/；移动 mobile/index.html → ../data/
  var DEFAULT_URL = global.Mobile ? '../data/vocab_library.json' : 'data/vocab_library.json';

  // 档位元数据（静态），词量由 tags 聚合实时派生
  var LEVEL_META = [
    { id: 'exam-cet4',   name: '大学英语四级 CET-4', cefr: 'B1-B2', description: '四六级核心词汇，覆盖大学基础阶段高频词，难度约 B1–B2' },
    { id: 'exam-cet6',   name: '大学英语六级 CET-6', cefr: 'B2-C1', description: '六级进阶词汇，在四级基础上扩展学术与深度用词，难度约 B2–C1' },
    { id: 'exam-kaoyan', name: '考研英语',           cefr: 'B2-C1', description: '考研核心词汇，覆盖阅读/翻译/写作高频学术词，难度约 B2–C1' },
    { id: 'exam-toefl',  name: '托福 TOEFL',         cefr: 'B2-C2', description: '托福学术词汇，覆盖听力/阅读/写作高频学科词，难度约 B2–C2' },
    { id: 'exam-sat',    name: 'SAT',                cefr: 'C1-C2', description: 'SAT 高阶词汇，覆盖阅读/写作精深词汇，难度约 C1–C2' }
  ];

  var _data = null;       // 已解析的词库 { version, words[] }
  var _status = 'idle';   // idle | loading | ready | error

  /**
   * 加载词库数据（可指定 URL，缺省按平台推断相对路径）
   * 失败/损坏 → status=error 且 _data 置 null，不抛未捕获错误
   */
  async function load(url) {
    if (_status === 'ready' && url == null) return { ok: true, status: _status };
    _status = 'loading';
    // 优先使用已注入的内联数据（避免重复 fetch/动态加载）
    if (!url && global.__VOCAB_LIBRARY_DATA__ && validate(global.__VOCAB_LIBRARY_DATA__).ok) {
      _data = global.__VOCAB_LIBRARY_DATA__;
      _status = 'ready';
      return { ok: true, status: _status, levels: listLevels() };
    }
    try {
      const res = await fetch(url || DEFAULT_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const data = JSON.parse(text);
      const v = validate(data);
      if (!v.ok) throw new Error(v.reason);
      _data = data;
      _status = 'ready';
      return { ok: true, status: _status, levels: listLevels() };
    } catch (e) {
      // fetch 失败（如 file:// 协议下 CORS 阻止）→ 尝试动态加载内联数据 JS 兜底
      if (!url && await loadInlineData()) {
        return { ok: true, status: _status, levels: listLevels() };
      }
      _data = null;
      _status = 'error';
      console.warn('[VocabLibrary] 加载失败：', (e && e.message) ? e.message : String(e));
      return { ok: false, status: _status, reason: e && e.message ? e.message : String(e) };
    }
  }

  /**
   * 动态加载 data/vocab_library.data.js（<script> 不走 fetch CORS，file:// 下可用）
   * 成功且校验通过 → 置 _data/_status 为 ready；否则置 error
   * @returns {Promise<boolean>}
   */
  function loadInlineData() {
    return new Promise(function (resolve) {
      if (global.__VOCAB_LIBRARY_DATA__) { finalize(); resolve(finalize.ok); return; }
      var s = document.createElement('script');
      s.src = DEFAULT_URL.replace(/vocab_library\.json$/, 'vocab_library.data.js');
      s.onload = function () { finalize(); resolve(finalize.ok); };
      s.onerror = function () { _status = 'error'; resolve(false); };
      document.head.appendChild(s);
    });
    function finalize() {
      var v = validate(global.__VOCAB_LIBRARY_DATA__);
      finalize.ok = !!v.ok;
      if (v.ok) { _data = global.__VOCAB_LIBRARY_DATA__; _status = 'ready'; }
      else { _data = null; _status = 'error'; }
    }
  }

  /** schema 校验：返回 { ok, reason? } */
  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, reason: '词库不是对象' };
    if (!Array.isArray(data.words)) return { ok: false, reason: '缺少 words 数组' };
    for (var i = 0; i < data.words.length; i++) {
      var w = data.words[i];
      if (!w || !w.word) return { ok: false, reason: 'words[' + i + '] 缺少 word' };
      if (w.tags !== undefined && !Array.isArray(w.tags)) return { ok: false, reason: 'words[' + i + '] tags 应为数组' };
    }
    return { ok: true };
  }

  /** 档位枚举（含按标签聚合的词量），返回副本避免外部篡改内部 */
  function listLevels() {
    if (!_data) return [];
    return LEVEL_META.map(function (m) {
      return {
        id: m.id,
        name: m.name,
        cefr: m.cefr,
        description: m.description,
        count: countByTag(m.id)
      };
    });
  }

  /** 拥有某标签的词数 */
  function countByTag(tag) {
    if (!_data) return 0;
    var n = 0;
    for (var i = 0; i < _data.words.length; i++) {
      if (hasTag(_data.words[i], tag)) n++;
    }
    return n;
  }

  /** 词是否命中标签（tags 含 tag 或为空数组时视为不属于任何档） */
  function hasTag(w, tag) {
    var t = w && w.tags;
    return !!t && t.indexOf(tag) >= 0;
  }

  /**
   * 取某档聚合视图 { id,name,cefr,description,words[] }
   * words 为该标签累计并集（tags ⊇ {id}），不存在元数据时返回 null
   */
  function getLevel(id) {
    if (!_data) return null;
    for (var i = 0; i < LEVEL_META.length; i++) {
      if (LEVEL_META[i].id === id) {
        var words = [];
        for (var j = 0; j < _data.words.length; j++) {
          if (hasTag(_data.words[j], id)) words.push(_data.words[j]);
        }
        return { id: LEVEL_META[i].id, name: LEVEL_META[i].name, cefr: LEVEL_META[i].cefr, description: LEVEL_META[i].description, words: words };
      }
    }
    return null;
  }

  /** 整档导入到指定生词本（批量写入，避免逐词触发数据层保存导致大数据量卡死主线程）
   * @param {string} levelId 档位 id
   * @param {function} bulkFn (words[]) => Promise<{added:number,skipped:number}> 批量写入回调
   *        （调用端注入：桌面 VocabData.addWordsBulk / 移动 Store.addWordsBulk，
   *         内部 Set 查重 + 仅保存一次，规避 O(n²) 逐词序列化）
   * @returns {Promise<{ok:boolean, added:number, skipped:number, reason?:string}>}
   */
  async function importToNotebook(levelId, bulkFn) {
    if (!_data) return { ok: false, added: 0, skipped: 0, reason: '词库未加载' };
    if (typeof bulkFn !== 'function') return { ok: false, added: 0, skipped: 0, reason: '缺少写入回调' };
    var lv = getLevel(levelId);
    if (!lv) return { ok: false, added: 0, skipped: 0, reason: '档位不存在：' + levelId };
    var words = lv.words.map(function (w) {
      return { word: w.word, pos: w.pos || '', meaning: w.meaning || '', context: '' };
    });
    var r;
    try { r = await bulkFn(words); }
    catch (e) { return { ok: false, added: 0, skipped: words.length, reason: e && e.message ? e.message : String(e) }; }
    r = r || {};
    return { ok: true, added: r.added || 0, skipped: r.skipped || 0 };
  }

  VocabLibrary.load = load;
  VocabLibrary.validate = validate;
  VocabLibrary.listLevels = listLevels;
  VocabLibrary.getLevel = getLevel;
  VocabLibrary.importToNotebook = importToNotebook;

  /**
   * 在核心词表中二分查找单词（words 已按大小写不敏感排序）
   * @param {string} word 任意大小写
   * @returns {object|null} 词条目（含 word/pos/meaning/tags/cefr/可含 phonetic/example）或 null
   */
  VocabLibrary.findWord = function (word) {
    if (!_data || !word) return null;
    var key = String(word).toLowerCase();
    var lo = 0, hi = _data.words.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var wk = _data.words[mid].word.toLowerCase();
      if (wk < key) lo = mid + 1;
      else if (wk > key) hi = mid - 1;
      else return _data.words[mid];
    }
    return null;
  };

  /* ---- 词汇量自测（纯算法，供两端 UI 驱动） ---- */
  var Q_PER_LEVEL = 10;                        // 每档抽样题数
  var LEVEL_BASE = [4000, 8000, 12000, 16000, 20000]; // 各档词汇量代表值（按档位顺序，适配 5 档考试词库）

  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function distinctMeanings(levels) {
    var pool = [];
    levels.forEach(function (lv) {
      lv.words.forEach(function (w) {
        var m = w && w.meaning;
        if (m && pool.indexOf(m) < 0) pool.push(m);
      });
    });
    return pool;
  }

  /**
   * 预生成自测题目集（低→高档位顺序）。每档抽样 Q_PER_LEVEL 词，
   * 每题含四选一释义选项（正确答案随机插入）。
   * @param {Array} [levelsParam] 可选；缺省用当前已加载档位的聚合视图（标签累计并集）
   * @returns {Array<{levelId,name,cefr,questions:Array<{word,pos,meaning,options:string[],answer:number}>}>}
   */
  VocabLibrary.prepareQuiz = function (levelsParam) {
    var levels = levelsParam || (_data ? LEVEL_META.map(function (m) { return getLevel(m.id); }).filter(Boolean) : []);
    if (!levels.length) return [];
    var pool = distinctMeanings(levels);
    return levels.map(function (lv) {
      var words = shuffleArr(lv.words.filter(function (w) { return w && w.meaning; })).slice(0, Q_PER_LEVEL);
      var questions = words.map(function (w) {
        var correct = w.meaning;
        var distractors = shuffleArr(pool.filter(function (m) { return m !== correct; })).slice(0, 3);
        var options = distractors.slice();
        var answer = Math.floor(Math.random() * (options.length + 1));
        options.splice(answer, 0, correct);
        return { word: w.word, pos: w.pos || '', meaning: correct, options: options, answer: answer };
      });
      return { levelId: lv.id, name: lv.name, cefr: lv.cefr, questions: questions };
    });
  };

  function cefrOf(vocab) {
    if (vocab < 4000) return { label: 'A1', level: '入门', advice: '可优先掌握高频基础词，扎实词汇地基' };
    if (vocab < 7000) return { label: 'A2', level: '基础', advice: '具备日常高频交流词汇，可逐步接触短文' };
    if (vocab < 10000) return { label: 'B1', level: '独立', advice: '能独立阅读常见文章，可向精读进阶' };
    if (vocab < 14000) return { label: 'B2', level: '进阶', advice: '足以应付留学生活与工作阅读' };
    if (vocab < 18000) return { label: 'C1', level: '熟练', advice: '接近母语学习者阅读水平' };
    return { label: 'C2', level: '精通', advice: '具备学术与专业阅读能力' };
  }

  /**
   * 依据各档作答结果估算词汇量并映射 CEFR
   * @param {Array<{correct:number,total:number}>} results 低→高档位作答统计
   * @returns {{vocab:number,cefr:string,level:string,advice:string}}
   */
  VocabLibrary.estimateVocabulary = function (results) {
    results = results || [];
    var vocab = 0;
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var total = r && r.total > 0 ? r.total : 1;
      var ratio = ((r && r.correct) || 0) / total;
      var base = LEVEL_BASE[i] || 6000;
      if (ratio >= 0.8) { vocab += base; }
      else { vocab += Math.round(base * ratio); break; }
    }
    vocab = Math.max(0, Math.round(vocab / 100) * 100);
    var c = cefrOf(vocab);
    return { vocab: vocab, cefr: c.label, level: c.level, advice: c.advice };
  };

  // 桌面端便捷别名；移动端另外在 Mobile 命名空间引用同一对象
  if (!global.VocabLibrary) global.VocabLibrary = VocabLibrary;
  if (global.Mobile) global.Mobile.VocabLibrary = VocabLibrary;
})(typeof window !== 'undefined' ? window : globalThis);
