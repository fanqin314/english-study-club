/* ============================================================
   shared/study_stats.js — 学习统计 / 学习计划 纯计算核心（两端复用）
   · 面向桌面端 features/stats_tracker.js、memory_mode/stats_detail_ui.js、
     memory_mode/plan_detail_ui.js 与移动端 views/memory.js 的统计/计划逻辑。
   · 设计：统计计数与计划所需的目标/提醒均读写「相同 localStorage 键」
     （stats_* / dailyWordGoal / enableReminder …），故本模块直接以
     localStorage 为唯一数据源；仅结构与访问路径不同的数据
     （生词本 wordStats、历史文章）通过参数注入，由调用端归一化。
   · 挂载：window.EnglishStudyShared.Stats
   · 纯计算，不操作 DOM；依赖：无（仅 globalThis.locks 不需要）。
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var Stats = (Shared.Stats = Shared.Stats || {});

  // 记忆模块元数据（对齐桌面端 stats_tracker.js MODULE_META；含 icon）
  var MODULE_META = {
    flashcard:      { label: '闪卡模式',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M9 12h12"/></svg>', color: '#3b82f6', type: 'word' },
    fillPractice:   { label: '填空练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>', color: '#10b981', type: 'word' },
    spelling:       { label: '听写练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', color: '#8b5cf6', type: 'word' },
    choicePractice: { label: '选词练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>', color: '#f59e0b', type: 'word' },
    listening:      { label: '听力练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>', color: '#06b6d4', type: 'word' },
    cloze:          { label: '语境填空',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', color: '#10b981', type: 'article' },
    fullReview:     { label: '全文回顾',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', color: '#3b82f6', type: 'article' },
    sentenceReview: { label: '逐句精读',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>', color: '#8b5cf6', type: 'article' },
    vocabQuiz:      { label: '生词测验',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>', color: '#ef4444', type: 'article' }
  };
  Stats.MODULE_META = MODULE_META;

  // 生词本默认配色（生词本未存 color 时按顺序取）
  var NB_COLORS = Shared.NB_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];

  var DAYS = ['一', '二', '三', '四', '五', '六', '日'];

  function readNum(key, fb) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fb == null ? 0 : fb;
      var n = parseInt(raw, 10);
      return isNaN(n) ? (fb == null ? 0 : fb) : n;
    } catch (e) { return fb == null ? 0 : fb; }
  }

  function readJSON(key, fb) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fb : JSON.parse(raw);
    } catch (e) { return fb; }
  }

  // 读取 stats_module_data → { {dateStr}: { {moduleKey}: count } }
  function moduleData() {
    return readJSON('stats_module_data', {});
  }

  /**
   * 归一化生词本列表
   * @param {Array<{id:string,name:string,count:number,color?:string}>} notebooks
   *        调用端传入归一化后的 [{id,name,count,color}]；未含 color 用 NB_COLORS 兜底。
   */
  function normalizeNotebooks(notebooks) {
    return (notebooks || []).map(function (nb, i) {
      return {
        id: nb.id,
        name: nb.name || '未命名',
        count: nb.count == null ? 0 : nb.count,
        color: nb.color || NB_COLORS[i % NB_COLORS.length]
      };
    });
  }

  /* ---------------- 学习统计（单词） ---------------- */
  /**
   * @param {Array<{id,name,count,color}>} notebooks 生词本列表
   * @returns {object}
   */
  Stats.wordStats = function (notebooks) {
    var nbs = normalizeNotebooks(notebooks);
    var totalWords = 0;
    nbs.forEach(function (nb) { totalWords += nb.count; });

    var masteredCount = readNum('stats_mastered_words', 0);
    var totalLearned = readNum('stats_total_learned', totalWords);
    var todayLearned = readNum('stats_today_learned', 0);
    var streak = readNum('stats_streak_days', 0);
    var masteryRate = totalWords > 0 ? Math.min(100, Math.round((masteredCount / totalWords) * 100)) : 0;

    return {
      totalWords: totalWords,
      masteredCount: masteredCount,
      totalLearned: Math.max(totalLearned, totalWords),
      todayLearned: todayLearned,
      streak: streak,
      masteryRate: masteryRate,
      notebooks: nbs
    };
  };

  /* ---------------- 学习统计（文章） ---------------- */
  /**
   * 归一化历史文章列表（调用端注入）
   * @param {Array<{id:string,title?:string,originalText?:string,text?:string,savedAt?:string}>} history
   * @returns {object}
   */
  Stats.articleStats = function (history) {
    var list = history || [];
    var totalArticles = Math.max(readNum('stats_total_articles_learned', list.length), list.length);
    var todayArticles = readNum('stats_today_articles', 0);
    var articleStreak = readNum('stats_article_streak_days', 0);

    // 由注入的生词本集合计算文章内生词数（可选）
    var recent = list.slice(0, 5).map(function (h) {
      var raw = h.originalText || h.text || '';
      var words = raw.split(/[^a-zA-Z'-]+/).filter(function (w) { return w.length > 0; });
      return {
        id: h.id,
        title: ((h.title || raw).split('\n')[0] || '(无标题)').substring(0, 40),
        savedAt: h.savedAt,
        wordCount: words.length
      };
    });

    return {
      totalArticles: totalArticles,
      todayArticles: todayArticles,
      articleStreak: articleStreak,
      recent: recent
    };
  };

  /* ---------------- 模块明细 / 趋势（共 moduleData） ---------------- */
  // 最近 7 天数组：{label:'周一', value:number, dateStr}
  function last7days() {
    var now = new Date();
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push({ label: '周' + DAYS[(d.getDay() + 6) % 7], dateStr: d.toDateString() });
    }
    return out;
  }

  /** 某模块最近 7 天每日量 */
  Stats.moduleDaily = function (moduleKey) {
    var data = moduleData();
    return last7days().map(function (o) {
      var day = data[o.dateStr] || {};
      return { label: o.label, value: day[moduleKey] || 0, dateStr: o.dateStr };
    });
  };

  /** 最近 7 天总学习量（type: 'word'|'article'|null 全部） */
  Stats.trend = function (type) {
    var data = moduleData();
    var typeKeys = null;
    if (type) {
      typeKeys = [];
      for (var k in MODULE_META) {
        if (MODULE_META[k].type === type) typeKeys.push(k);
      }
    }
    return last7days().map(function (o) {
      var day = data[o.dateStr] || {};
      var total = 0;
      for (var mk in day) {
        if (!typeKeys || typeKeys.indexOf(mk) >= 0) total += day[mk];
      }
      return { label: o.label, value: total, dateStr: o.dateStr };
    });
  };

  /** 各模块累计活动量（act.all）与今日（act.today）+ meta 附表 */
  Stats.moduleStats = function () {
    var data = moduleData();
    var today = new Date().toDateString();
    var todayMap = data[today] || {};
    var allMap = {};
    for (var day in data) {
      for (var mk in data[day]) {
        allMap[mk] = (allMap[mk] || 0) + (data[day][mk] || 0);
      }
    }
    var list = [];
    for (var key in MODULE_META) {
      var c = allMap[key] || 0;
      if (c > 0) {
        list.push({ key: key, meta: MODULE_META[key], count: c });
      }
    }
    list.sort(function (a, b) { return b.count - a.count; });
    return { today: todayMap, all: allMap, list: list };
  };

  /**
   * 最近 days 天活动序列（每日所有模块计数之和，供热力图使用）
   * @param {number} [days=84] 天数
   * @returns {{days:Array<{dateStr:string,value:number}>, max:number}}
   *          days 按时间从旧到新排列；max 为序列中最大值
   */
  Stats.activitySeries = function (days) {
    if (!days || days <= 0) days = 84;
    var data = moduleData();
    var now = new Date();
    var out = [];
    var max = 0;
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      var dateStr = d.toDateString();
      var day = data[dateStr] || {};
      var total = 0;
      for (var mk in day) {
        total += day[mk] || 0;
      }
      if (total > max) max = total;
      out.push({ dateStr: dateStr, value: total });
    }
    return { days: out, max: max };
  };

  /**
   * 最近 weeks 周活动序列（热力图数据源）
   * @param {number} [weeks=12] 周数
   * @returns {{days:Array<{dateStr:string,value:number}>, max:number}}
   */
  Stats.heatmap = function (weeks) {
    if (!weeks || weeks <= 0) weeks = 12;
    return Stats.activitySeries(weeks * 7);
  };

  /* ---------------- 学习计划 ---------------- */
  /** 单词计划数据（生词本列表注入） */
  Stats.wordPlan = function (notebooks) {
    var nbs = normalizeNotebooks(notebooks);
    var totalWords = 0;
    nbs.forEach(function (nb) { totalWords += nb.count; });
    var dailyWordGoal = readNum('dailyWordGoal', 10);
    var dailyTimeGoal = readNum('dailyTimeGoal', 15);
    var todayLearned = readNum('stats_today_learned', 0);
    var streak = readNum('stats_streak_days', 0);
    var enable = localStorage.getItem('enableReminder') === 'true';
    var time = localStorage.getItem('reminderTime') || '09:00';
    return {
      dailyWordGoal: dailyWordGoal,
      dailyTimeGoal: dailyTimeGoal,
      todayLearned: todayLearned,
      streak: streak,
      totalWords: totalWords,
      wordProgressPct: dailyWordGoal > 0 ? Math.min(100, Math.round((todayLearned / dailyWordGoal) * 100)) : 0,
      enableReminder: enable,
      reminderTime: time
    };
  };

  /** 文章计划数据（历史列表注入） */
  Stats.articlePlan = function (history) {
    var list = history || [];
    var dailyArticleGoal = readNum('dailyArticleGoal', 1);
    var dailyArticleTimeGoal = readNum('dailyArticleTimeGoal', 20);
    var todayArticles = readNum('stats_today_articles', 0);
    var articleStreak = readNum('stats_article_streak_days', 0);
    var interval = readNum('articleReviewInterval', 3);
    var enable = localStorage.getItem('enableArticleReminder') === 'true';
    var time = localStorage.getItem('articleReminderTime') || '20:00';
    return {
      dailyArticleGoal: dailyArticleGoal,
      dailyArticleTimeGoal: dailyArticleTimeGoal,
      todayArticles: todayArticles,
      articleStreak: articleStreak,
      reviewInterval: interval,
      totalArticles: list.length,
      articleProgressPct: dailyArticleGoal > 0 ? Math.min(100, Math.round((todayArticles / dailyArticleGoal) * 100)) : 0,
      enableReminder: enable,
      reminderTime: time
    };
  };

  /** 待复习文章数（历史列表注入；超间隔 or 无记录则待复习） */
  Stats.pendingReview = function (history) {
    var list = history || [];
    var interval = readNum('articleReviewInterval', 3);
    var now = Date.now();
    var ms = interval * 24 * 60 * 60 * 1000;
    var count = 0;
    list.forEach(function (h) {
      var last = readNum('article_last_review_' + h.id, 0);
      if (!last || (now - last) > ms) count++;
    });
    return count;
  };
})(typeof window !== 'undefined' ? window : globalThis);