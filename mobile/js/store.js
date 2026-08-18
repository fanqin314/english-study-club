/* ============================================================
   store.js — 移动端本地数据层（localStorage 支撑）
   提供 vocab / history / settings / progress 的读写与事件订阅。
   设计要点：所有写操作都会触发对应事件（'vocab'/'history'/
   'settings'/'progress'），视图层订阅后自动刷新，保证状态一致。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});

  const PREFIX = 'esc.';                 // english-study-club 移动端键前缀
  const KEYS = {
    vocab: PREFIX + 'vocab',
    history: PREFIX + 'history',
    settings: PREFIX + 'settings',
    progress: PREFIX + 'progress'
  };

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
    profileName: '英语学习者',
    profileEmail: 'learner@example.com'
  };

  const PROGRESS_DEFAULT = {
    streak: 7,
    lastStudyDate: '',
    todayCount: 12,
    masteredCount: 89,
    correctRate: 78,
    reviewDue: 15
  };

  // ---- 简易事件总线 ----
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

  // ---- 底层读写 ----
  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[store] read fail', key, e);
      return fallback;
    }
  }
  function _write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('[store] write fail', key, e);
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---- 生词本 ----
  function getVocab() { return _read(KEYS.vocab, []); }
  function addWord(w) {
    const list = getVocab();
    // 同一单词（忽略大小写）不重复添加
    const exists = list.find((x) => x.word && w.word && x.word.toLowerCase() === w.word.toLowerCase());
    if (exists) {
      if (w.example && !exists.example) { exists.example = w.example; exists.exampleZh = w.exampleZh; }
      _write(KEYS.vocab, list);
      emit('vocab', list);
      return exists;
    }
    const item = Object.assign({
      id: uid(),
      status: 'learning',     // 'learning' | 'mastered'
      createdAt: Date.now()
    }, w);
    list.unshift(item);
    _write(KEYS.vocab, list);
    emit('vocab', list);
    return item;
  }
  function removeWord(id) {
    const list = getVocab().filter((x) => x.id !== id);
    _write(KEYS.vocab, list);
    emit('vocab', list);
  }
  function toggleWordStatus(id) {
    const list = getVocab();
    const item = list.find((x) => x.id === id);
    if (!item) return;
    item.status = item.status === 'mastered' ? 'learning' : 'mastered';
    _write(KEYS.vocab, list);
    emit('vocab', list);
  }
  function getWord(id) { return getVocab().find((x) => x.id === id) || null; }

  // ---- 历史记录 ----
  function getHistory() { return _read(KEYS.history, []); }
  function addHistory(rec) {
    const list = getHistory();
    const item = Object.assign({ id: uid(), date: todayStr() }, rec);
    list.unshift(item);
    _write(KEYS.history, list);
    emit('history', list);
    return item;
  }
  function getHistoryItem(id) { return getHistory().find((x) => x.id === id) || null; }
  function removeHistory(id) {
    const list = getHistory().filter((x) => x.id !== id);
    _write(KEYS.history, list);
    emit('history', list);
  }

  // ---- 设置 ----
  function getSettings() {
    return Object.assign({}, SETTINGS_DEFAULT, _read(KEYS.settings, {}));
  }
  function updateSettings(partial) {
    const next = Object.assign(getSettings(), partial);
    _write(KEYS.settings, next);
    emit('settings', next);
    return next;
  }

  // ---- 进度 ----
  function getProgress() {
    return Object.assign({}, PROGRESS_DEFAULT, _read(KEYS.progress, {}));
  }
  function updateProgress(partial) {
    const next = Object.assign(getProgress(), partial);
    _write(KEYS.progress, next);
    emit('progress', next);
    return next;
  }

  // ---- 导出 / 清除 / 重置 ----
  function exportAll() {
    return {
      vocab: getVocab(),
      history: getHistory(),
      settings: getSettings(),
      progress: getProgress(),
      exportedAt: new Date().toISOString()
    };
  }
  function clearCache() {
    // 保留设置与进度，仅清生词/历史（演示用"缓存"）
    _write(KEYS.vocab, []);
    _write(KEYS.history, []);
    emit('vocab', []);
    emit('history', []);
  }
  function resetAll() {
    [KEYS.vocab, KEYS.history, KEYS.settings, KEYS.progress].forEach((k) => localStorage.removeItem(k));
    emit('vocab', []);
    emit('history', []);
    emit('settings', getSettings());
    emit('progress', getProgress());
  }

  Mobile.Store = {
    on, off, emit,
    uid, todayStr,
    getVocab, addWord, removeWord, toggleWordStatus, getWord,
    getHistory, addHistory, getHistoryItem, removeHistory,
    getSettings, updateSettings,
    getProgress, updateProgress,
    exportAll, clearCache, resetAll
  };
})(window);
