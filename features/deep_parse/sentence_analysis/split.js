// 分句.js - 本地分句规则（处理常见缩写）
(function() {
    ModuleRegistry.register('SentenceSplitter', [], function() {
        // 常见缩写列表（不会被当作句子结束）
        const abbreviations = [
            'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'St', 'Jr', 'Sr', 'etc',
            'vs', 'i.e', 'e.g', 'Inc', 'Corp', 'Ltd', 'Co', 'Ave', 'Blvd',
            'Rd', 'St', 'Sgt', 'Capt', 'Lt', 'Col', 'Gen', 'Sen', 'Rep',
            'Rev', 'Hon', 'Pres', 'Gov', 'Amb', 'Univ', 'Dept'
        ];

        // 将缩写中的点暂时替换为占位符
        function protectAbbreviations(text) {
            let protectedText = text;
            abbreviations.forEach(abbr => {
                // 匹配缩写后跟点号，且后面跟空格或结尾
                const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
                protectedText = protectedText.replace(regex, match => match.replace(/\./, '@@@'));
            });
            return protectedText;
        }

        // 恢复被保护的缩写
        function restoreAbbreviations(text) {
            return text.replace(/@@@/g, '.');
        }

        // 主分句函数
        function splitIntoSentences(text) {
            if (!text || typeof text !== 'string') return [];
            
            // 1. 保护缩写
            let processed = protectAbbreviations(text);
            
            // 2. 按句号、问号、感叹号分割
            // 匹配句子结束符，并保留结束符
            const sentences = processed.match(/[^.!?]+[.!?]+/g) || [processed];
            
            // 3. 清理并恢复缩写
            const cleaned = sentences
                .map(s => restoreAbbreviations(s.trim()))
                .filter(s => s.length > 0);
            
            return cleaned;
        }

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
    });
})();