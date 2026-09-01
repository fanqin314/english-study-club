/* ============================================================
   shared/srs.js — Leitner 间隔重复调度 纯计算核心（桌面/移动两端复用）
   · 供 features/vocabulary/vocab_data.js、memory_mode/* 与移动端生词本调度。
   · 设计：仅做纯计算，不读写 localStorage、不操作 DOM；
     调度所需的单词对象（box/interval/nextReview）由调用端注入。
   · 挂载：window.EnglishStudyShared.SRS
   · 依赖：无
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var SRS = (Shared.SRS = Shared.SRS || {});

  var DAY = 24 * 60 * 60 * 1000;

  // box 1..5 的复习间隔（天）
  var BOX_INTERVALS = [1, 2, 4, 7, 15];
  // box 0 为空占位，box 1..5 对应中文标签
  var BOX_LABELS = ['', '新词', '熟悉', '熟练', '掌握', '长期'];

  /**
   * 为单词对象回填 SRS 字段（无 box/interval/nextReview 时）
   * @param {object} w 单词对象（会被原地修改）
   * @param {number} [now] 当前时间戳，缺省 Date.now()
   * @returns {object} 同一单词对象
   */
  function initWord(w, now) {
    if (!now) now = Date.now();
    if (w == null) return w;
    if (w.box == null || w.interval == null || w.nextReview == null) {
      w.box = 1;
      w.interval = 1;
      w.nextReview = now;
    }
    return w;
  }

  /**
   * 计算一次评级后的新调度状态
   * @param {number} [box] 旧 box（undefined/非法一律按 1 处理）
   * @param {number} [interval] 旧间隔（计算不依赖，仅保持签名一致）
   * @param {boolean} correct true=正确（升级），false=错误（降级）
   * @param {number} [now] 当前时间戳，缺省 Date.now()
   * @returns {{box:number, interval:number, nextReview:number}}
   */
  function schedule(box, interval, correct, now) {
    if (!now) now = Date.now();
    var b = parseInt(box, 10);
    if (isNaN(b) || b < 1) b = 1;

    var nextBox = correct
      ? Math.min(5, b + 1)
      : Math.max(1, b - 1);

    var nextInterval = BOX_INTERVALS[nextBox - 1];
    // 正确：按新 box 间隔顺延；错误：固定 1 天后再次出现
    var nextReview = now + (correct ? nextInterval : 1) * DAY;

    return { box: nextBox, interval: nextInterval, nextReview: nextReview };
  }

  /**
   * 单词是否到期复习（nextReview 非数字 或 已过期）
   * @param {object} w 单词对象
   * @param {number} [now] 当前时间戳，缺省 Date.now()
   * @returns {boolean}
   */
  function isDue(w, now) {
    if (!now) now = Date.now();
    var nr = w && w.nextReview;
    var valid = typeof nr === 'number' && !isNaN(nr);
    return !valid || nr <= now;
  }

  /**
   * 过滤出到期单词列表
   * @param {Array<object>} words 单词数组
   * @param {number} [now] 当前时间戳，缺省 Date.now()
   * @returns {Array<object>}
   */
  function dueWords(words, now) {
    if (!now) now = Date.now();
    return (words || []).filter(function (w) { return isDue(w, now); });
  }

  /**
   * 到期单词数量
   * @param {Array<object>} words 单词数组
   * @param {number} [now] 当前时间戳，缺省 Date.now()
   * @returns {number}
   */
  function dueCount(words, now) {
    return dueWords(words, now).length;
  }

  /**
   * box 对应的中文标签
   * @param {number} box
   * @returns {string}
   */
  function boxLabel(box) {
    var b = parseInt(box, 10);
    if (isNaN(b) || b < 1) b = 1;
    if (b >= BOX_LABELS.length) b = BOX_LABELS.length - 1;
    return BOX_LABELS[b] || '';
  }

  SRS.DAY = DAY;
  SRS.BOX_INTERVALS = BOX_INTERVALS;
  SRS.BOX_LABELS = BOX_LABELS;
  SRS.initWord = initWord;
  SRS.schedule = schedule;
  SRS.isDue = isDue;
  SRS.dueWords = dueWords;
  SRS.dueCount = dueCount;
  SRS.boxLabel = boxLabel;
})(typeof window !== 'undefined' ? window : globalThis);
