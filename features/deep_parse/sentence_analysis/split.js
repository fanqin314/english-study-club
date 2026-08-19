// split.js - 本地分句规则（处理常见缩写）
// 逻辑已迁移到共享核心 core/shared/sentence_split.js，此处仅做兼容封装
// 保持原 ModuleRegistry 注册与 window.SentenceSplitter 全局接口不变
(function() {
    "use strict";
    const Shared = (window.EnglishStudyShared = window.EnglishStudyShared || {});
    if (!Shared.splitSentences) {
        // 若共享核心未加载（顺序异常），内联一个最简降级，避免分句模块为空
        console.warn('[split.js] shared/sentence_split.js 未加载，使用内联降级分句');
        Shared.splitSentences = Shared.splitSentences || function(t){ return (t||'').match(/[^.!?。！？]+[.!?。！？]+/g) || [(t||'')]; };
    }

    const splitIntoSentences = Shared.splitSentences;

    // 辅助函数：检查句子数量
    function getSentenceCount(text) {
        return splitIntoSentences(text).length;
    }

    // 辅助函数：获取第 n 句
    function getNthSentence(text, n) {
        const sentences = splitIntoSentences(text);
        if (n >= 0 && n < sentences.length) {
            return sentences[n];
        }
        return null;
    }

    // 导出全局接口（保持向后兼容）
    window.SentenceSplitter = {
        split: splitIntoSentences,
        getCount: getSentenceCount,
        getNth: getNthSentence
    };

    return {
        split: splitIntoSentences,
        getCount: getSentenceCount,
        getNth: getNthSentence
    };
})();