/* ============================================================
   shared/vocab_library.js — 内置分级词库共享加载器（桌面/移动两端复用）
   · 职责：读取 data/vocab_library.json、schema 校验、档位枚举、整档导入。
   · 设计：与 vocab_data.js / store.js 解耦，只负责数据读取与校验；
     导入动作委托调用端注入的 addWord 语义（桌面 VocabData.addWord / 移动 Store.addWordToNotebook）。
   · 挂载：window.EnglishStudyShared.VocabLibrary（桌面可用 window.VocabLibrary 别名，移动挂 Mobile.VocabLibrary）
   · 依赖：无（fetch 由浏览器提供）
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var VocabLibrary = (Shared.VocabLibrary = Shared.VocabLibrary || {});

  // 默认数据相对路径：桌面 index.html（根）→ data/；移动 mobile/index.html → ../data/
  var DEFAULT_URL = global.Mobile ? '../data/vocab_library.json' : 'data/vocab_library.json';

  var _data = null;       // 已解析的词库 { version, levels[] }
  var _status = 'idle';   // idle | loading | ready | error

  /**
   * 加载词库数据（可指定 URL，缺省按平台推断相对路径）
   * 失败/损坏 → status=error 且 _data 置 null，不抛未捕获错误
   */
  async function load(url) {
    if (_status === 'ready' && url == null) return { ok: true, status: _status };
    _status = 'loading';
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
      _data = null;
      _status = 'error';
      console.warn('[VocabLibrary] 加载失败：', (e && e.message) ? e.message : String(e));
      return { ok: false, status: _status, reason: e && e.message ? e.message : String(e) };
    }
  }

  /** schema 校验：返回 { ok, reason? } */
  function validate(data) {
    if (!data || typeof data !== 'object') return { ok: false, reason: '词库不是对象' };
    if (!Array.isArray(data.levels)) return { ok: false, reason: '缺少 levels 数组' };
    for (var i = 0; i < data.levels.length; i++) {
      var lv = data.levels[i];
      if (!lv || typeof lv !== 'object') return { ok: false, reason: 'levels[' + i + '] 不是对象' };
      if (!lv.id || typeof lv.id !== 'string') return { ok: false, reason: 'levels[' + i + '] 缺少 id' };
      if (!Array.isArray(lv.words)) return { ok: false, reason: 'level(' + lv.id + ') 缺少 words 数组' };
      for (var w = 0; w < lv.words.length; w++) {
        var word = lv.words[w];
        if (!word || !word.word) return { ok: false, reason: 'level(' + lv.id + ') 第' + w + '词缺少 word' };
      }
    }
    return { ok: true };
  }

  /** 档位枚举（含词量），返回副本避免外部篡改内部 */
  function listLevels() {
    if (!_data) return [];
    return _data.levels.map(function (lv) {
      return { id: lv.id, name: lv.name, cefr: lv.cefr, description: lv.description, count: lv.words.length };
    });
  }

  /** 取某档原始数据 { id,name,words[] }，不存在返回 null */
  function getLevel(id) {
    if (!_data) return null;
    for (var i = 0; i < _data.levels.length; i++) {
      if (_data.levels[i].id === id) return _data.levels[i];
    }
    return null;
  }

  /** 整档导入到指定生词本
   * @param {string} levelId 档位 id
   * @param {function} addFn (word) => {success:boolean} 单词写入回调（调用端注入，内置查重）
   * @returns {{ok:boolean, added:number, skipped:number, reason?:string}}
   */
  function importToNotebook(levelId, addFn) {
    if (!_data) return { ok: false, added: 0, skipped: 0, reason: '词库未加载' };
    if (typeof addFn !== 'function') return { ok: false, added: 0, skipped: 0, reason: '缺少写入回调' };
    var lv = getLevel(levelId);
    if (!lv) return { ok: false, added: 0, skipped: 0, reason: '档位不存在：' + levelId };
    var added = 0, skipped = 0;
    var words = lv.words;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var wordData = { word: w.word, pos: w.pos || '', meaning: w.meaning || '', context: '' };
      var r;
      try { r = addFn(wordData); }
      catch (e) { skipped++; continue; }
      if (r && r.success) added++; else skipped++;
    }
    return { ok: true, added: added, skipped: skipped };
  }

  VocabLibrary.load = load;
  VocabLibrary.validate = validate;
  VocabLibrary.listLevels = listLevels;
  VocabLibrary.getLevel = getLevel;
  VocabLibrary.importToNotebook = importToNotebook;

  // 桌面端便捷别名；移动端另外在 Mobile 命名空间引用同一对象
  if (!global.VocabLibrary) global.VocabLibrary = VocabLibrary;
  if (global.Mobile) global.Mobile.VocabLibrary = VocabLibrary;
})(typeof window !== 'undefined' ? window : globalThis);