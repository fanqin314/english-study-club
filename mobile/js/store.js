/* ============================================================
   store.js — 移动端数据层（与桌面端共享同一份 localStorage 数据）
   ------------------------------------------------------------
   设计目标：移动端只是桌面端的「另一种界面」，两者读写完全相同的
   存储键，设置与数据天然一致。

   存储键对齐（与桌面端保持一致）：
   · vocabData        —— 生词本 { notebooks:{[id]:{name,words:[...]}}, currentNotebookId }
   · analysis_history —— 历史记录 [{id,originalText,fullTranslation,sentences,sentenceData,savedAt}]
   · darkMode         —— 'true' | 'false'（明文）
   · encrypted_api_key / encrypted_api_base / encrypted_model_name —— base64(encodeURIComponent(x))
   · stats_streak_days / stats_today_learned / stats_mastered_words —— 进度统计
   · esc.settings     —— 仅移动端独有偏好（日目标/解析模式/自动发音/自动收藏/字号/资料）
   · esc.progress     —— 仅移动端独有进度（正确率/待复习，桌面端无对应字段）

   所有写操作触发对应事件（'vocab'/'history'/'settings'/'progress'），
   视图层订阅后自动刷新，保证跨界面状态一致。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});

  /* ---------- 与桌面端对齐的存储键 ---------- */
  const D = {
    vocab: 'vocabData',
    history: 'analysis_history',
    darkMode: 'darkMode',
    encKey: 'encrypted_api_key',
    encBase: 'encrypted_api_base',
    encModel: 'encrypted_model_name',
    statStreak: 'stats_streak_days',
    statToday: 'stats_today_learned',
    statMastered: 'stats_mastered_words'
  };
  // 移动端独有偏好 / 进度（桌面端没有，独立保存）
  const ESC = 'esc.';
  const KEYS = {
    settings: ESC + 'settings',
    progress: ESC + 'progress'
  };

  // 桌面端内置默认 API Key（与 core/security.js 中混淆常量一致，
  // 用户未自定义时移动端同样走内置默认，行为与桌面端保持一致）
  const _k = ['bXMtODIzOWQ1NGMtYz', 'Y0Mi00MjU2LWI4NzktM', 'DRkYmVjMTUwYzEw'];
  const DEFAULT_API_KEY = atob(_k.join(''));

  const SETTINGS_DEFAULT = {
    apiKey: '',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    model: 'Qwen/Qwen3.5-35B-A3B',
    dailyGoal: 20,
    parseMode: 'deep',        // 'deep' | 'fast'
    autoPronounce: true,
    autoCollect: true,
    darkMode: false,
    fontSize: 'medium',       // 'small' | 'medium' | 'large'
    themeNeutral: null,
    themePrimary: null,
    themeAccent: null,
    profileName: '英语学习者',
    profileEmail: 'learner@example.com'
  };

  const PROGRESS_DEFAULT = {
    streak: 0,
    todayCount: 0,
    masteredCount: 0,
    correctRate: 0,
    reviewDue: 0
  };

  /* ---------- 简易事件总线 ---------- */
  const listeners = {};
  function on(evt, cb) {
    (listeners[evt] = listeners[evt] || []).push(cb);
    return () => off(evt, cb);
  }
  function off(evt, cb) {
    if (!listeners[evt]) return;
    listeners[evt] = listeners[evt].filter((f) => f !== cb);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach((cb) => {
      try { cb(payload); } catch (e) { console.error('[store] listener error', evt, e); }
    });
  }

  /* ---------- 底层读写 ---------- */
  function _readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[store] read fail', key, e);
      return fallback;
    }
  }
  function _writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error('[store] write fail', key, e); }
  }
  function _readNum(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = parseInt(raw, 10);
    return isNaN(n) ? fallback : n;
  }
  // 加密方案与桌面端 core/security.js 完全一致：btoa(encodeURIComponent(x))
  function _secureRead(key) {
    const r = localStorage.getItem(key);
    if (!r) return '';
    try { return decodeURIComponent(atob(r)); } catch (e) { return r; }
  }
  function _secureWrite(key, val) {
    if (!val) { localStorage.removeItem(key); return; }
    try { localStorage.setItem(key, btoa(encodeURIComponent(val))); } catch (e) { console.error('[store] secure write fail', e); }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ============================================================
     生词本（对齐桌面端 vocabData：多生词本结构）
     ============================================================ */
  function _getVocabData() {
    const d = _readJSON(D.vocab, null);
    if (!d || !d.notebooks) return { notebooks: {}, currentNotebookId: null };
    return d;
  }
  function _saveVocabData(d) { _writeJSON(D.vocab, d); }
  function _currentNotebook(d) {
    if (d.currentNotebookId && d.notebooks[d.currentNotebookId]) return d.notebooks[d.currentNotebookId];
    const first = Object.keys(d.notebooks)[0];
    return first ? d.notebooks[first] : null;
  }
  function _ensureDefault(d) {
    if (Object.keys(d.notebooks).length === 0) {
      const id = Date.now().toString();
      d.notebooks[id] = { name: '默认生词本', words: [], createdDate: new Date().toISOString() };
      d.currentNotebookId = id;
    }
    return d;
  }
  // 桌面端生词 shape：{ word, meaning, pos, context, timestamp }
  // 移动端视图 shape：{ id, notebookId, word, pos, zh, status, addedAt, example }
  function _wordToVM(nbId, w) {
    return {
      id: nbId + '::' + (w.word || '').toLowerCase(),
      notebookId: nbId,
      word: w.word || '',
      pos: w.pos || '',
      zh: w.meaning || '',
      status: w.status === 'mastered' ? 'mastered' : 'learning',
      addedAt: w.timestamp || Date.now(),
      example: w.context || ''
    };
  }
  function _parseId(id) {
    const i = (id || '').indexOf('::');
    if (i < 0) return { nbId: null, word: id || '' };
    return { nbId: id.slice(0, i), word: id.slice(i + 2) };
  }

  function getVocab() {
    const d = _getVocabData();
    const out = [];
    for (const nbId in d.notebooks) {
      (d.notebooks[nbId].words || []).forEach((w) => out.push(_wordToVM(nbId, w)));
    }
    return out;
  }
  function getWord(id) {
    const { nbId, word } = _parseId(id);
    if (!nbId) return null;
    const nb = _getVocabData().notebooks[nbId];
    if (!nb) return null;
    const w = (nb.words || []).find((x) => (x.word || '').toLowerCase() === word);
    return w ? _wordToVM(nbId, w) : null;
  }
  function addWord(w) {
    const d = _ensureDefault(_getVocabData());
    const nb = _currentNotebook(d);
    const word = (w.word || '').trim();
    if (!word) return null;
    // 兼容两种字段命名：移动端旧式 { zh } 与首页 { meaning }
    const zh = w.zh != null ? w.zh : (w.meaning != null ? w.meaning : '');
    const example = w.example != null ? w.example : (w.context != null ? w.context : '');
    const lower = word.toLowerCase();
    const exists = (nb.words || []).find((x) => (x.word || '').toLowerCase() === lower);
    if (exists) {
      if (example && !exists.context) exists.context = example;
      if (zh && !exists.meaning) exists.meaning = zh;
      _saveVocabData(d);
      emit('vocab', getVocab());
      return exists;
    }
    const item = {
      word,
      meaning: zh,
      pos: w.pos || '',
      context: example,
      timestamp: Date.now(),
      status: w.status || 'learning',
      id: uid()
    };
    nb.words.unshift(item);
    _saveVocabData(d);
    emit('vocab', getVocab());
    _syncMastered();
    return item;
  }
  function removeWord(id) {
    const { nbId, word } = _parseId(id);
    const d = _getVocabData();
    const nb = d.notebooks[nbId];
    if (!nb) return;
    nb.words = (nb.words || []).filter((x) => (x.word || '').toLowerCase() !== word);
    _saveVocabData(d);
    emit('vocab', getVocab());
    _syncMastered();
  }
  function toggleWordStatus(id) {
    const { nbId, word } = _parseId(id);
    const d = _getVocabData();
    const nb = d.notebooks[nbId];
    if (!nb) return;
    const item = (nb.words || []).find((x) => (x.word || '').toLowerCase() === word);
    if (!item) return;
    item.status = item.status === 'mastered' ? 'learning' : 'mastered';
    _saveVocabData(d);
    emit('vocab', getVocab());
    _syncMastered();
  }
  function _syncMastered() {
    const mastered = getVocab().filter((w) => w.status === 'mastered').length;
    localStorage.setItem(D.statMastered, String(mastered));
  }

  /* ============================================================
     历史记录（对齐桌面端 analysis_history）
     ============================================================ */
  function _fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function _deriveTitle(text) {
    const line = (text || '').split('\n').find((l) => l.trim());
    const t = (line || '').trim().slice(0, 40);
    return t || '未命名文章';
  }
  function _deriveSnippet(text) {
    const flat = (text || '').replace(/\s+/g, ' ').trim();
    return flat.slice(0, 80);
  }
  function _wordCount(text) {
    const arr = (text || '').trim().split(/\s+/).filter(Boolean);
    return arr.length;
  }
  function getHistory() {
    const list = _readJSON(D.history, []) || [];
    return list.map((h) => {
      const text = h.originalText || '';
      const sentences = h.sentences || [];
      return {
        id: h.id,
        text: text,
        title: _deriveTitle(text),
        date: _fmtDate(h.savedAt || (h.id ? new Date(parseInt(h.id)).toISOString() : new Date().toISOString())),
        snippet: _deriveSnippet(text),
        words: _wordCount(text),
        sentences: sentences.length,
        fullTranslation: h.fullTranslation || '',
        sentenceData: h.sentenceData || {},
        result: {
          fullTranslation: h.fullTranslation || '',
          sentences: sentences,
          sentenceData: h.sentenceData || {}
        },
        createdAt: h.savedAt || (h.id ? new Date(parseInt(h.id)).toISOString() : new Date().toISOString())
      };
    });
  }
  function addHistory(rec) {
    const list = _readJSON(D.history, []) || [];
    const result = rec.result || {};
    let sentences = result.sentences || rec.sentences || [];
    if (typeof sentences === 'number') sentences = []; // 旧移动端传入的是数量而非数组
    const item = {
      id: Date.now().toString(),
      originalText: rec.text || rec.originalText || '',
      fullTranslation: result.fullTranslation || rec.fullTranslation || '',
      sentences: sentences,
      sentenceData: result.sentenceData || rec.sentenceData || {},
      savedAt: new Date().toISOString()
    };
    list.unshift(item);
    if (list.length > 50) list.length = 50;
    _writeJSON(D.history, list);
    emit('history', getHistory());
    return item;
  }
  function getHistoryItem(id) { return getHistory().find((h) => h.id === id) || null; }
  function removeHistory(id) {
    const list = (_readJSON(D.history, []) || []).filter((h) => h.id !== id);
    _writeJSON(D.history, list);
    emit('history', getHistory());
  }
  function clearHistory() {
    _writeJSON(D.history, []);
    emit('history', getHistory());
  }

  /* ============================================================
     设置（darkMode / API 键与桌面端共享；移动端独有偏好存 esc.settings）
     ============================================================ */
  function getSettings() {
    const dark = localStorage.getItem(D.darkMode) === 'true';
    const local = _readJSON(KEYS.settings, {}) || {};
    return Object.assign({}, SETTINGS_DEFAULT, {
      darkMode: dark,
      apiKey: _secureRead(D.encKey) || DEFAULT_API_KEY,
      baseUrl: _secureRead(D.encBase) || SETTINGS_DEFAULT.baseUrl,
      model: _secureRead(D.encModel) || SETTINGS_DEFAULT.model
    }, local);
  }
  function updateSettings(partial) {
    const cur = getSettings();
    const next = Object.assign({}, cur, partial);

    if ('darkMode' in partial) localStorage.setItem(D.darkMode, next.darkMode ? 'true' : 'false');
    if ('apiKey' in partial) _secureWrite(D.encKey, next.apiKey);
    if ('baseUrl' in partial) _secureWrite(D.encBase, next.baseUrl);
    if ('model' in partial) _secureWrite(D.encModel, next.model);

    // 仅移动端独有偏好写入 esc.settings
    const local = {
      dailyGoal: next.dailyGoal,
      parseMode: next.parseMode,
      autoPronounce: next.autoPronounce,
      autoCollect: next.autoCollect,
      fontSize: next.fontSize,
      profileName: next.profileName,
      profileEmail: next.profileEmail
    };
    _writeJSON(KEYS.settings, local);
    emit('settings', next);
    return next;
  }

  /* ============================================================
     进度（streak/todayCount/mastered 与桌面端 stats_* 共享）
     ============================================================ */
  function getProgress() {
    const local = _readJSON(KEYS.progress, {}) || {};
    return Object.assign({}, PROGRESS_DEFAULT, {
      streak: _readNum(D.statStreak, 0),
      todayCount: _readNum(D.statToday, 0),
      masteredCount: _readNum(D.statMastered, 0),
      correctRate: local.correctRate != null ? local.correctRate : PROGRESS_DEFAULT.correctRate,
      reviewDue: local.reviewDue != null ? local.reviewDue : PROGRESS_DEFAULT.reviewDue
    });
  }
  function updateProgress(partial) {
    const next = Object.assign(getProgress(), partial);
    if ('streak' in partial) localStorage.setItem(D.statStreak, String(next.streak));
    if ('todayCount' in partial) localStorage.setItem(D.statToday, String(next.todayCount));
    if ('masteredCount' in partial) localStorage.setItem(D.statMastered, String(next.masteredCount));
    _writeJSON(KEYS.progress, { correctRate: next.correctRate, reviewDue: next.reviewDue });
    emit('progress', next);
    return next;
  }

  /* ============================================================
     一次性迁移：旧移动端 esc.* 数据 → 桌面端键（仅当桌面端为空时）
     ============================================================ */
  function _migrateVocab() {
    const d = _getVocabData();
    if (Object.keys(d.notebooks || {}).length > 0) return; // 已有桌面端数据
    const old = _readJSON(ESC + 'vocab', null);
    if (!old || !old.length) return;
    _ensureDefault(d);
    const nb = _currentNotebook(d);
    old.forEach((w) => nb.words.push({
      word: w.word, meaning: w.zh || '', pos: w.pos || '',
      context: w.example || '', timestamp: w.addedAt || Date.now(),
      status: w.status || 'learning', id: uid()
    }));
    _saveVocabData(d);
  }
  function _migrateHistory() {
    const list = _readJSON(D.history, null);
    if (list && list.length) return;
    const old = _readJSON(ESC + 'history', null);
    if (!old || !old.length) return;
    const mapped = old.map((h) => ({
      id: h.id || Date.now().toString(),
      originalText: h.text || '',
      fullTranslation: (h.result && h.result.fullTranslation) || '',
      sentences: (h.result && h.result.sentences) || [],
      sentenceData: (h.result && h.result.sentenceData) || {},
      savedAt: h.createdAt || new Date().toISOString()
    }));
    _writeJSON(D.history, mapped);
  }
  function init() {
    try { _migrateVocab(); _migrateHistory(); } catch (e) { console.warn('[store] migrate fail', e); }
  }

  /* ============================================================
     导出 / 清除 / 重置
     ============================================================ */
  function exportAll() {
    return {
      vocab: getVocab(),
      history: getHistory(),
      settings: getSettings(),
      progress: getProgress(),
      exportedAt: new Date().toISOString()
    };
  }
  // 清除「缓存」= 清空共享的生词与历史（与桌面端一致）
  function clearCache() {
    const d = _ensureDefault(_getVocabData());
    Object.keys(d.notebooks).forEach((id) => { d.notebooks[id].words = []; });
    _saveVocabData(d);
    clearHistory();
    localStorage.setItem(D.statMastered, '0');
    emit('vocab', getVocab());
  }
  // 彻底重置：清掉共享数据与移动端独有偏好
  function resetAll() {
    localStorage.removeItem(D.vocab);
    localStorage.removeItem(D.history);
    localStorage.removeItem(D.darkMode);
    localStorage.removeItem(D.encKey);
    localStorage.removeItem(D.encBase);
    localStorage.removeItem(D.encModel);
    localStorage.removeItem(D.statStreak);
    localStorage.removeItem(D.statToday);
    localStorage.removeItem(D.statMastered);
    localStorage.removeItem(KEYS.settings);
    localStorage.removeItem(KEYS.progress);
    emit('vocab', getVocab());
    emit('history', getHistory());
    emit('settings', getSettings());
    emit('progress', getProgress());
  }

  Mobile.Store = {
    on, off, emit,
    uid, todayStr,
    getVocab, addWord, removeWord, toggleWordStatus, getWord,
    getHistory, addHistory, getHistoryItem, removeHistory, clearHistory,
    getSettings, updateSettings,
    getProgress, updateProgress,
    exportAll, clearCache, resetAll, init
  };

  // 启动时执行一次性迁移
  init();
})(window);
