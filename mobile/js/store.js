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
   · stats_streak_days / stats_today_learned / stats_total_learned / stats_mastered_words —— 进度统计
     （与桌面端 StatsTracker 对齐：均为「计数器累加」，不是按单词 status 重算）
   · stats_module_data —— 各记忆模式活动量（对齐桌面端 MODULE_META，供统计页读取）
   · dailyWordGoal    —— 每日目标（对齐桌面端 learning_plan_ui.js 的键名）
   · esc.settings     —— 仅移动端独有偏好（解析模式/自动发音/自动收藏/字号/资料；日目标已改用 dailyWordGoal）
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
    statTotal: 'stats_total_learned',
    statMastered: 'stats_mastered_words',
    statModule: 'stats_module_data',
    dailyWordGoal: 'dailyWordGoal'
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
    parseMethod: 'perSentence', // 'perSentence' 网页端逐句调用（默认）| 'fullText' 单次全文
    autoPronounce: true,
    autoCollect: false,
    darkMode: false,
    fontSize: 'medium',       // 'small' | 'medium' | 'large'
    themeNeutral: null,
    themePrimary: null,
    themeAccent: null,
    themePlugin: '',          // 主题插件 id（'' = 默认，对应 themes/index.json 清单）
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
  // 与桌面端 StatsTracker 完全一致的日期格式（toDateString），保证 stats_word_date 跨端可比对
  function _dateStr() {
    return new Date().toDateString();
  }

  /* ============================================================
     生词本（对齐桌面端 vocabData：多生词本结构）
     ============================================================ */
  // 生词本标签色盘（与桌面端环形选色器同款，8 色，跨端一致）
  const NOTEBOOK_COLORS = ['#506080', '#E07B5A', '#C8A87C', '#5A8A6E', '#10B981', '#3B82F6', '#8B5A2B', '#A855F7', '#EC4899', '#F59E0B'];
  function _randColor() {
    return NOTEBOOK_COLORS[Math.floor(Math.random() * NOTEBOOK_COLORS.length)];
  }
  function _getVocabData() {
    const d = _readJSON(D.vocab, null);
    if (!d || !d.notebooks) return { notebooks: {}, currentNotebookId: null };
    // 惰性迁移：早期生词本无 color 字段，读取时补默认色并落盘一次
    let touched = false;
    Object.keys(d.notebooks).forEach((id) => {
      if (!d.notebooks[id].color) { d.notebooks[id].color = _randColor(); touched = true; }
    });
    if (touched) _writeJSON(D.vocab, d);
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
      d.notebooks[id] = { name: '默认生词本', words: [], createdDate: new Date().toISOString(), color: _randColor() };
      d.currentNotebookId = id;
    }
    return d;
  }
  // 桌面端生词 shape：{ word, meaning, pos, context, timestamp }
  // 移动端视图 shape：{ id, notebookId, word, pos, zh, meaning, addedAt, createdAt, example }
  // 注意：不再包含 status（桌面端无按单词的掌握状态）；meaning 为 zh 的别名，供各视图按桌面端字段名直接使用
  // context 兼容两种形状：字符串（移动端）或 { en, zh }（网页版/部分路径），统一规范化为字符串，避免 [object Object]
  function _normExample(ctx) {
    if (!ctx) return '';
    if (typeof ctx === 'string') return ctx;
    if (typeof ctx === 'object') return ctx.en || ctx.zh || ctx.text || '';
    return '';
  }
  function _wordToVM(nbId, w) {
    // 注意：raw 无 timestamp 时保持 undefined（与改动前 raw 行为一致，避免误判"今日新增/新学"）
    const ts = w.timestamp;
    const exObj = (w.context && typeof w.context === 'object') ? w.context : null;
    return {
      id: nbId + '::' + (w.word || '').toLowerCase(),
      notebookId: nbId,
      word: w.word || '',
      pos: w.pos || '',
      zh: w.meaning || '',
      meaning: w.meaning || '',
      addedAt: ts,
      createdAt: ts,
      example: _normExample(w.context),
      exampleZh: exObj ? (exObj.zh || '') : (w.contextZh || ''),
      // SRS 复习字段透传（对齐 core/shared/srs.js），供记忆队列按 nextReview 排序
      box: w.box,
      interval: w.interval,
      nextReview: w.nextReview
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
    const ph = w.phonetic != null ? w.phonetic : (w.ph != null ? w.ph : '');
    const lower = word.toLowerCase();
    const exists = (nb.words || []).find((x) => (x.word || '').toLowerCase() === lower);
    if (exists) {
      if (example && !exists.context) exists.context = example;
      if (zh && !exists.meaning) exists.meaning = zh;
      if (ph && !exists.phonetic) exists.phonetic = ph;
      _saveVocabData(d);
      emit('vocab', getVocab());
      return exists;
    }
    // 对齐桌面端 SRS 数据层（core/shared/srs.js）：新增单词即初始化
    // box/interval/nextReview 字段（initWord 原地补字段；SRS 未加载时优雅降级）
    const item = {
      word,
      meaning: zh,
      pos: w.pos || '',
      context: example,
      phonetic: ph,
      timestamp: Date.now(),
      ...(window.EnglishStudyShared && window.EnglishStudyShared.SRS ? window.EnglishStudyShared.SRS.initWord({}) : {})
    };
    nb.words.unshift(item);
    _saveVocabData(d);
    emit('vocab', getVocab());
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
  }
  // 更新单词（词性/释义/例句），对齐桌面端 vocab_data.updateWord 语义
  function updateWord(id, updates) {
    const { nbId, word } = _parseId(id);
    if (!nbId) return { success: false, error: '无效的单词标识' };
    const d = _getVocabData();
    const nb = d.notebooks[nbId];
    if (!nb) return { success: false, error: '生词本不存在' };
    const w = (nb.words || []).find((x) => (x.word || '').toLowerCase() === word);
    if (!w) return { success: false, error: '单词不存在' };
    if (updates && typeof updates === 'object') {
      if ('pos' in updates) w.pos = updates.pos || '';
      if ('meaning' in updates) w.meaning = updates.meaning || '';
      if ('context' in updates) w.context = updates.context || '';
      if ('contextZh' in updates) w.contextZh = updates.contextZh || '';
    }
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true };
  }
  // 生词本列表（对齐桌面端 VocabData.getAllNotebooks）：返回 [{id,name,wordCount,color}]
  function getNotebooks() {
    const d = _getVocabData();
    return Object.keys(d.notebooks).map((id) => ({
      id,
      name: d.notebooks[id].name || '未命名',
      wordCount: (d.notebooks[id].words || []).length,
      color: d.notebooks[id].color || '#506080'
    }));
  }
  // 当前生词本 id（返回字符串 id；缺省取第一个）
  function getCurrentNotebookId() {
    const d = _getVocabData();
    if (d.currentNotebookId && d.notebooks[d.currentNotebookId]) return d.currentNotebookId;
    const first = Object.keys(d.notebooks)[0];
    return first || null;
  }
  // 当前生词本的完整单词数组（经 _wordToVM 规范化，example/exampleZh 均为字符串，
  // 避免对象形状的 context/example 被渲染成 [object Object]）
  function getNotebookWords(id) {
    const d = _getVocabData();
    const nb = d.notebooks[id];
    if (!nb) return [];
    return (nb.words || []).map((w) => _wordToVM(id, w));
  }
  // 复习结果写回当前生词本（对齐桌面端 SRS 数据层）：按 word 不区分大小写找到词，
  // 读取其 box/interval，调 SRS.schedule(box, interval, correct) 得新值写回并持久化，
  // 返回更新后的词；未找到词或 SRS 未加载时返回 null。
  function applyReview(word, correct) {
    const d = _getVocabData();
    const nb = _currentNotebook(d);
    if (!nb) return null;
    const lower = String(word || '').toLowerCase();
    const w = (nb.words || []).find((x) => (x.word || '').toLowerCase() === lower);
    if (!w) return null;
    const SRS = window.EnglishStudyShared && window.EnglishStudyShared.SRS;
    if (!SRS) return null;
    const next = SRS.schedule(w.box, w.interval, correct);
    if (next && typeof next === 'object') {
      if ('box' in next) w.box = next.box;
      if ('interval' in next) w.interval = next.interval;
      if ('nextReview' in next) w.nextReview = next.nextReview;
    }
    _saveVocabData(d);
    emit('vocab', getVocab());
    return w;
  }
  // 当前生词本待复习词数（委托共享层 SRS.dueCount）
  function getDueCount() {
    const d = _getVocabData();
    const nb = _currentNotebook(d);
    const SRS = window.EnglishStudyShared && window.EnglishStudyShared.SRS;
    if (!nb || !SRS || typeof SRS.dueCount !== 'function') return 0;
    return SRS.dueCount(nb.words || []);
  }
  // 当前生词本待复习队列（委托共享层 SRS.dueWords，按 nextReview 升序）
  function getReviewQueue() {
    const d = _getVocabData();
    const nb = _currentNotebook(d);
    const SRS = window.EnglishStudyShared && window.EnglishStudyShared.SRS;
    if (!nb || !SRS || typeof SRS.dueWords !== 'function') return [];
    return SRS.dueWords(nb.words || []);
  }
  // 新建生词本（对齐桌面端 VocabData.createNotebook）：重名报错，成功后返回 {success,id}
  function createNotebook(name) {
    const d = _getVocabData();
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, error: '生词本名称不能为空' };
    const exists = Object.values(d.notebooks).some((nb) => nb.name === trimmed);
    if (exists) return { success: false, error: '生词本名称已存在' };
    const id = Date.now().toString();
    d.notebooks[id] = { name: trimmed, words: [], createdDate: new Date().toISOString(), color: _randColor() };
    if (!d.currentNotebookId) d.currentNotebookId = id;
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true, id };
  }
  // 加入指定生词本（对齐桌面端 VocabData.addWord(notebookId, {...})）
  function addWordToNotebook(notebookId, w) {
    const d = _getVocabData();
    const nb = d.notebooks[notebookId];
    if (!nb) return { success: false, error: '生词本不存在' };
    const word = (w.word || '').trim();
    if (!word) return { success: false, error: '单词为空' };
    const zh = w.meaning != null ? w.meaning : (w.zh != null ? w.zh : '');
    const example = w.example != null ? w.example : (w.context != null ? w.context : '');
    const ph = w.phonetic != null ? w.phonetic : (w.ph != null ? w.ph : '');
    const lower = word.toLowerCase();
    const exists = (nb.words || []).find((x) => (x.word || '').toLowerCase() === lower);
    if (exists) {
      if (example && !exists.context) exists.context = example;
      if (zh && !exists.meaning) exists.meaning = zh;
      if (ph && !exists.phonetic) exists.phonetic = ph;
      _saveVocabData(d);
      emit('vocab', getVocab());
      return { success: true, added: false, exists: true };
    }
    nb.words.unshift({ word, meaning: zh, pos: w.pos || '', context: example, phonetic: ph, timestamp: Date.now() });
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true, added: true };
  }
  // 批量加入指定生词本（词库整档导入专用：Set 查重 + 仅保存一次，避免逐词保存/广播导致卡死）
  function addWordsBulk(notebookId, words) {
    const d = _getVocabData();
    const nb = d.notebooks[notebookId];
    if (!nb) return { success: false, added: 0, skipped: 0, error: '生词本不存在' };
    if (!Array.isArray(words)) return { success: false, added: 0, skipped: 0, error: '参数错误' };
    const existing = new Set((nb.words || []).map((x) => (x.word || '').toLowerCase()));
    const toAdd = [];
    let added = 0, skipped = 0;
    for (let i = 0; i < words.length; i++) {
      const wd = words[i] || {};
      const word = String(wd.word || '').trim();
      if (!word) { skipped++; continue; }
      const lower = word.toLowerCase();
      if (existing.has(lower)) { skipped++; continue; }
      toAdd.push({ word, meaning: String(wd.meaning || ''), pos: String(wd.pos || ''), context: String(wd.context || ''), phonetic: String(wd.phonetic || ''), timestamp: Date.now() });
      existing.add(lower);
      added++;
    }
    if (toAdd.length) {
      nb.words = toAdd.concat(nb.words || []);
      _saveVocabData(d);
      emit('vocab', getVocab());
    }
    return { success: true, added: added, skipped: skipped };
  }
  // 判断某词是否已在该生词本（供底部弹层打勾）
  function isWordInNotebook(notebookId, word) {
    const d = _getVocabData();
    const nb = d.notebooks[notebookId];
    if (!nb) return false;
    const lower = (word || '').toLowerCase();
    return (nb.words || []).some((x) => (x.word || '').toLowerCase() === lower);
  }
  // 设置当前生词本（对齐桌面端 VocabData.setCurrentNotebook）
  function setCurrentNotebook(id) {
    const d = _getVocabData();
    if (d.notebooks[id]) { d.currentNotebookId = id; _saveVocabData(d); emit('vocab', getVocab()); }
  }
  // 重命名生词本（重名报错）
  function renameNotebook(id, name) {
    const d = _getVocabData();
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, error: '名称不能为空' };
    if (!d.notebooks[id]) return { success: false, error: '生词本不存在' };
    const dup = Object.keys(d.notebooks).some((k) => k !== id && d.notebooks[k].name === trimmed);
    if (dup) return { success: false, error: '已存在同名生词本' };
    d.notebooks[id].name = trimmed;
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true };
  }
  // 修改生词本标签色（仅接受色盘内颜色，保证跨端一致）
  function updateNotebookColor(id, color) {
    const d = _getVocabData();
    if (!d.notebooks[id]) return { success: false, error: '生词本不存在' };
    if (!NOTEBOOK_COLORS.includes(color)) return { success: false, error: '颜色不在色盘内' };
    d.notebooks[id].color = color;
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true };
  }
  // 合并生词本：fromId 的单词去重并入 toId，随后删除 fromId（至少保留一本）
  function mergeNotebooks(fromId, toId) {
    const d = _getVocabData();
    if (!d.notebooks[fromId] || !d.notebooks[toId]) return { success: false, error: '生词本不存在' };
    if (fromId === toId) return { success: false, error: '不能合并到自身' };
    const exist = new Set((d.notebooks[toId].words || []).map((x) => (x.word || '').toLowerCase()));
    (d.notebooks[fromId].words || []).forEach((w) => {
      if (!exist.has((w.word || '').toLowerCase())) { d.notebooks[toId].words.push(w); exist.add((w.word || '').toLowerCase()); }
    });
    delete d.notebooks[fromId];
    if (d.currentNotebookId === fromId) d.currentNotebookId = toId;
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true, count: d.notebooks[toId].words.length };
  }
  // 删除生词本（至少保留一本）
  function deleteNotebook(id) {
    const d = _getVocabData();
    if (!d.notebooks[id]) return { success: false, error: '生词本不存在' };
    if (Object.keys(d.notebooks).length <= 1) return { success: false, error: '至少保留一个生词本' };
    delete d.notebooks[id];
    if (d.currentNotebookId === id) d.currentNotebookId = Object.keys(d.notebooks)[0];
    _saveVocabData(d);
    emit('vocab', getVocab());
    return { success: true };
  }
  // 移动端独有偏好：全文回顾阅读风格（仅本地，不写入共享键）
  function getReadingStyle() {
    return localStorage.getItem(ESC + 'readingStyle') || 'book';
  }
  function setReadingStyle(style) {
    localStorage.setItem(ESC + 'readingStyle', style);
    emit('readingStyle', style);
  }
  // 移动端独有偏好：删除生词本前是否跳过确认（勾选「不再提示」后直接删除）
  function getSkipDeleteConfirm() {
    return localStorage.getItem(ESC + 'skipDeleteConfirm') === 'true';
  }
  function setSkipDeleteConfirm(skip) {
    localStorage.setItem(ESC + 'skipDeleteConfirm', skip ? 'true' : 'false');
  }
  // 注意：移动端不再维护「按单词的掌握状态」（桌面端也无此字段）。
  // 「已掌握」是桌面端 StatsTracker 的全局累加计数器（stats_mastered_words），
  // 由记忆模式完成时通过 recordWordsMastered 累加，见下方进度相关函数。

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
  // 逐句精读：把某句的 AI 分析（translation/knowledge/syntax）持久化到该文章 sentenceData[idx]
  function updateSentenceData(id, idx, data) {
    const list = (_readJSON(D.history, []) || []);
    const item = list.find((h) => h.id === id);
    if (!item) return;
    const sd = (item.sentenceData && typeof item.sentenceData === 'object') ? item.sentenceData : {};
    sd[idx] = Object.assign({}, sd[idx], data || {});
    item.sentenceData = sd;
    _writeJSON(D.history, list);
    emit('history', getHistory());
  }
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
    // 每日目标对齐桌面端键 dailyWordGoal（移动端旧 esc.settings.dailyGoal 作为回退）
    const gw = _readNum(D.dailyWordGoal, null);
    const dailyGoal = gw != null ? gw : (local.dailyGoal != null ? local.dailyGoal : SETTINGS_DEFAULT.dailyGoal);
    // 自愈：已保存的非法值（含非 ASCII 字符等）自动回退默认，避免破坏请求
    const rawKey = _secureRead(D.encKey);
    const rawBase = _secureRead(D.encBase);
    const rawModel = _secureRead(D.encModel);
    return Object.assign({}, SETTINGS_DEFAULT, {
      darkMode: dark,
      apiKey: (rawKey && /^[\x20-\x7E]+$/.test(rawKey)) ? rawKey : DEFAULT_API_KEY,
      baseUrl: (rawBase && /^https?:\/\//.test(rawBase)) ? rawBase : SETTINGS_DEFAULT.baseUrl,
      model: (rawModel && /^[A-Za-z0-9/._+-]+$/.test(rawModel)) ? rawModel : SETTINGS_DEFAULT.model,
    }, local, { dailyGoal });
  }
  function updateSettings(partial) {
    const cur = getSettings();
    const next = Object.assign({}, cur, partial);

    if ('darkMode' in partial) localStorage.setItem(D.darkMode, next.darkMode ? 'true' : 'false');
    if ('apiKey' in partial) _secureWrite(D.encKey, next.apiKey);
    if ('baseUrl' in partial) _secureWrite(D.encBase, next.baseUrl);
    if ('model' in partial) _secureWrite(D.encModel, next.model);
    if ('dailyGoal' in partial) localStorage.setItem(D.dailyWordGoal, String(next.dailyGoal));

    // 仅移动端独有偏好写入 esc.settings（每日目标已改用桌面端 dailyWordGoal 键）
    // 主题配色（60-25-15）也必须持久化，否则 getSettings 读回恒为 null，
    // applyPrefs→applyColors 无法生效（选色后界面不变色、刷新即重置）。
    const local = {
      parseMode: next.parseMode,
      autoPronounce: next.autoPronounce,
      autoCollect: next.autoCollect,
      fontSize: next.fontSize,
      profileName: next.profileName,
      profileEmail: next.profileEmail,
      themeNeutral: next.themeNeutral,
      themePrimary: next.themePrimary,
      themeAccent: next.themeAccent,
      themePlugin: next.themePlugin || ''
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
      totalLearned: _readNum(D.statTotal, 0),
      masteredCount: _readNum(D.statMastered, 0),
      correctRate: local.correctRate != null ? local.correctRate : PROGRESS_DEFAULT.correctRate,
      reviewDue: local.reviewDue != null ? local.reviewDue : PROGRESS_DEFAULT.reviewDue
    });
  }
  // 进度：streak/todayCount/totalLearned/masteredCount 均为桌面端 stats_* 键，
  // 由下方 recordWordsLearned / recordWordsMastered 等按桌面端语义「累加」，不再在此覆盖写入。
  // 此处仅维护移动端独有进度（正确率 / 待复习）。
  function updateProgress(partial) {
    const next = Object.assign(getProgress(), partial);
    _writeJSON(KEYS.progress, { correctRate: next.correctRate, reviewDue: next.reviewDue });
    emit('progress', next);
    return next;
  }

  /* ============================================================
     进度记录（对齐桌面端 StatsTracker 语义：计数器累加，非重算覆盖）
     ============================================================ */
  // 每日重置今日学习量并维护连续天数（日期格式与桌面端一致：toDateString）
  function _ensureWordStats() {
    const today = _dateStr();
    const saved = localStorage.getItem('stats_word_date');
    if (saved !== today) {
      localStorage.setItem('stats_word_date', today);
      localStorage.setItem(D.statToday, '0');
      const streak = _readNum(D.statStreak, 0);
      const yStr = new Date(Date.now() - 86400000).toDateString();
      if (saved === yStr) localStorage.setItem(D.statStreak, String(streak + 1));
      else if (saved) localStorage.setItem(D.statStreak, '1');
    }
  }
  // 等价于桌面端 StatsTracker.recordWordsLearned：今日学习量 + 累计学习量 同时累加
  function recordWordsLearned(count) {
    if (!count || count <= 0) return;
    _ensureWordStats();
    const today = _readNum(D.statToday, 0) + count;
    localStorage.setItem(D.statToday, String(today));
    const total = _readNum(D.statTotal, 0) + count;
    localStorage.setItem(D.statTotal, String(total));
    emit('progress', getProgress());
  }
  // 等价于桌面端 StatsTracker.recordWordsMastered：已掌握计数器累加
  function recordWordsMastered(count) {
    if (!count || count <= 0) return;
    const mastered = _readNum(D.statMastered, 0) + count;
    localStorage.setItem(D.statMastered, String(mastered));
    emit('progress', getProgress());
  }
  // 等价于桌面端 StatsTracker.recordModuleActivity：按模块记录今日活动量（对齐 MODULE_META）
  function recordModuleActivity(moduleKey, count) {
    if (!moduleKey || !count || count <= 0) return;
    const today = _dateStr();
    let data;
    try { data = JSON.parse(localStorage.getItem(D.statModule) || '{}'); } catch (e) { data = {}; }
    if (!data[today]) data[today] = {};
    data[today][moduleKey] = (data[today][moduleKey] || 0) + count;
    localStorage.setItem(D.statModule, JSON.stringify(data));
  }
  // 读取各记忆模块活动量（stats_module_data）：返回 { today:{模块:次数}, all:{模块:总次数} }
  function getModuleActivity() {
    let data;
    try { data = JSON.parse(localStorage.getItem(D.statModule) || '{}'); } catch (e) { data = {}; }
    const today = _dateStr();
    const todayMap = data[today] || {};
    const allMap = {};
    Object.keys(data).forEach((day) => {
      Object.keys(data[day]).forEach((k) => {
        allMap[k] = (allMap[k] || 0) + (data[day][k] || 0);
      });
    });
    return { today: todayMap, all: allMap };
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
      context: w.example || '', timestamp: w.addedAt || Date.now()
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
    try { _ensureWordStats(); _migrateVocab(); _migrateHistory(); } catch (e) { console.warn('[store] migrate fail', e); }
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
    getVocab, addWord, removeWord, updateWord, getWord,
    getNotebooks, getCurrentNotebookId, getNotebookWords, createNotebook, addWordToNotebook, addWordsBulk, isWordInNotebook,
    applyReview, getDueCount, getReviewQueue,
    setCurrentNotebook, renameNotebook, updateNotebookColor, mergeNotebooks, deleteNotebook,
    NOTEBOOK_COLORS,
    getReadingStyle, setReadingStyle,
    getSkipDeleteConfirm, setSkipDeleteConfirm,
    getHistory, addHistory, getHistoryItem, updateSentenceData, removeHistory, clearHistory,
    getSettings, updateSettings,
    getProgress, updateProgress,
    recordWordsLearned, recordWordsMastered, recordModuleActivity, getModuleActivity,
    exportAll, clearCache, resetAll, init
  };

  // 启动时执行一次性迁移
  init();
})(window);
