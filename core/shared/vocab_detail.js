/* ============================================================
   shared/vocab_detail.js — 本地词根拆解工具（两端复用）
   · 为词义气泡的「词根 / 搭配 / 同义反义」辨析区块提供本地兜底。
   · 设计：纯函数，无 DOM / 无 localStorage。
     搭配与同反义因需真实词典，本地规则不伪造——一律交 AI 字段；
     本模块仅在无 AI 数据时，用常见前后缀规则拆词，供「词根」展示；
     无任何命中则返回 null，由调用端隐藏区块。
   · 挂载：window.EnglishStudyShared.VocabDetail / window.VocabDetail
   · 依赖：无
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var VocabDetail = (Shared.VocabDetail = Shared.VocabDetail || {});

  // 常见前缀/后缀（按长度从长到短，优先拆更长的构词成分）
  var PREFIXES = ['inter', 'over', 'under', 'micro', 'super', 'trans', 'auto', 'sub', 'pre', 'anti', 'non', 'mis', 'un', 're', 'dis', 'im', 'in', 'ir', 'il', 'de', 'ex', 'en', 'em', 'pro'];
  var SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'ity', 'tion', 'able', 'ible', 'less', 'ous', 'ship', 'hood', 'ism', 'ist', 'ize', 'ise', 'ify', 'ful', 'ive', 'al', 'er', 'or', 'ly', 'ing', 'ed'];

  /**
   * 本地词根拆解：命中常见前缀/后缀则返回根 + 构词成分
   * @param {string} word 单词
   * @returns {{word:string, root:string, affixes:Array<{type:'prefix'|'suffix',value:string}>}|null}
   *          无可拆解构词成分时返回 null（调用端应隐藏词根区块）
   */
  VocabDetail.localRoot = function (word) {
    if (!word || typeof word !== 'string') return null;
    var lower = word.toLowerCase();
    var root = lower;
    var affixes = [];

    // 只尝试一次前缀
    for (var p = 0; p < PREFIXES.length; p++) {
      var prefix = PREFIXES[p];
      if (root.length > prefix.length + 3 && root.indexOf(prefix) === 0) {
        affixes.push({ type: 'prefix', value: prefix });
        root = root.slice(prefix.length);
        break;
      }
    }
    // 只尝试一次后缀
    for (var s = 0; s < SUFFIXES.length; s++) {
      var suffix = SUFFIXES[s];
      if (root.length > suffix.length + 3 && root.slice(-suffix.length) === suffix) {
        affixes.push({ type: 'suffix', value: suffix });
        root = root.slice(0, root.length - suffix.length);
        break;
      }
    }

    if (!affixes.length) return null;
    return { word: lower, root: root, affixes: affixes };
  };

  // 桌面端便捷别名；移动端另外在 Mobile 命名空间引用同一对象
  if (!global.VocabDetail) global.VocabDetail = VocabDetail;
  if (global.Mobile) global.Mobile.VocabDetail = VocabDetail;
})(typeof window !== 'undefined' ? window : globalThis);