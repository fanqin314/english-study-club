/* ============================================================
   shared/sentence_split.js — 共享分句核心（两端复用）
   · 纯函数，无 DOM / 无依赖，可在网页端与 mobile 端共同加载。
   · 规则取自 features/deep_parse/sentence_analysis/split.js：
     覆盖常见缩写（Mr./Dr./St./etc./e.g./vs.…），避免误分句；
     同时保留对中文标点、引号内句号等常见边界的稳健处理。
   · 挂载：window.EnglishStudyShared.splitSentences
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});

  // 常见缩写，点号不会被当作句子结束
  var ABBREVIATIONS =
    'Mr Mrs Ms Dr Prof St Jr Sr etc vs i.e e.g Inc Corp Ltd Co Ave Blvd Rd St Sgt Capt Lt Col Gen Sen Rep Rev Hon Pres Gov Amb Univ Dept'.split(' ');

  var ABBR_PLACEHOLDER = '\u2063'; // 不可见分隔符占位（缩写点号）
  var DECIMAL_PLACEHOLDER = '\u2064'; // 不可见分隔符占位（小数点）

  // 将缩写中的点全部替换为占位符
  // 注意：必须用 replace(/\./g) 替换所有点，否则 e.g. / i.e. 等多点缩写的
  // 末尾点仍会被当成句号，导致句子被拦腰切断（如 ", every year or so,..." 残缺句）。
  function protectAbbreviations(text) {
    var out = text || '';
    for (var i = 0; i < ABBREVIATIONS.length; i++) {
      var re = new RegExp('\\b' + ABBREVIATIONS[i] + '\\.', 'gi');
      out = out.replace(re, function (m) { return m.replace(/\./g, ABBR_PLACEHOLDER); });
    }
    return out;
  }

  // 保护小数中的点号（3.5 / 2.0 / 99.9），避免数字被误判为句尾
  function protectDecimals(text) {
    return (text || '').replace(/(\d)\.(\d)/g, '$1' + DECIMAL_PLACEHOLDER + '$2');
  }

  // 恢复被保护的缩写
  function restoreAbbreviations(text) {
    return (text || '').split(ABBR_PLACEHOLDER).join('.');
  }

  // 恢复被保护的小数点
  function restoreDecimals(text) {
    return (text || '').split(DECIMAL_PLACEHOLDER).join('.');
  }

  /**
   * 分句主函数
   * @param {string} text
   * @returns {string[]}
   */
  function splitSentences(text) {
    if (!text || typeof text !== 'string') return [];
    var processed = protectDecimals(protectAbbreviations(text));
    // 按句号/问号/感叹号分割，保留结束符；ok以中文/英文标点结尾的块才进
    var raw = processed.match(/[^.!?。！？]+[.!?。！？]+/g) || [processed];
    var cleaned = [];
    for (var i = 0; i < raw.length; i++) {
      var s = restoreDecimals(restoreAbbreviations(raw[i])).trim();
      if (s.length > 0) cleaned.push(s);
    }
    return cleaned;
  }

  /**
   * 分句并带本地启发式预解析
   * 供 mobile 端在无 AI 时作为降级数据源；
   * 返回与后端 schema 兼容的结构。
   * @param {string} text
   * @returns {Array<{en:string,zh:string,type:string,words:Array,grammar:Array,syntax:Object,knowledge:string}>}
   */
  function fallbackParse(text) {
    var list = splitSentences(text || '');
    if (!list.length) return [];
    return list.map(function (en) {
      var long = en.length > 90;
      return {
        en: en,
        zh: '',
        type: long ? '复合句' : '简单句',
        words: [],
        grammar: [],
        syntax: {
          structure: long ? '复合句' : '简单句',
          function: '',
          pattern: '',
          syntax: '',
          clauses: [],
          constituents: []
        },
        knowledge: ''
      };
    });
  }

  Shared.splitSentences = splitSentences;
  Shared.fallbackParse = fallbackParse;
})(typeof window !== 'undefined' ? window : globalThis);