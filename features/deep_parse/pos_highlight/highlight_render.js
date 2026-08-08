// highlight_render.js - 给单词添加词性颜色高亮

(function() {
    const posClassMap = {
        'n': 'pos-n',
        'v': 'pos-v',
        'adj': 'pos-adj',
        'adv': 'pos-adv',
        'pron': 'pos-pron',
        'prep': 'pos-prep',
        'conj': 'pos-conj',
        'interj': 'pos-interj',
        'art': 'pos-art',
        'num': 'pos-num'
    };
    
    function getHighlightPosMap() {
        const saved = localStorage.getItem('highlightPosMap');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch(e) {
                return null;
            }
        }
        return null;
    }
    
    const defaultHighlightMap = {
        n: true, v: true, adj: true, adv: true, pron: true, 
        prep: true, conj: true, interj: true, art: true, num: true
    };
    
    let highlightPosMap = getHighlightPosMap() || { ...defaultHighlightMap };
    
    function saveHighlightPosMap() {
        localStorage.setItem('highlightPosMap', JSON.stringify(highlightPosMap));
    }
    
    function updateHighlightPosMap(newMap) {
        highlightPosMap = { ...newMap };
        saveHighlightPosMap();
        
        if (window.HighlightSwitch && window.HighlightSwitch.isEnabled()) {
            applyHighlightToAll();
        }
        
        // 同步刷新历史记录高亮
        if (window.HistoryHighlight && window.HistoryHighlight.isEnabled()) {
            window.HistoryHighlight.clearHighlight();
            window.HistoryHighlight.applyHighlight();
        }
    }
    
    function getHighlightPosMapConfig() {
        return { ...highlightPosMap };
    }
    
    /**
     * 清除所有高亮样式
     * 优化：使用容器级别的查询而非全局查询
     */
    function clearAllHighlight() {
        // 优先使用句子容器进行局部查询
        // 注意：不清除 secondarySentencesContainer，避免影响历史记录高亮
        const container = document.getElementById('deepParseSentencesContainer') || 
                         document.getElementById('sentencesContainer');
        
        if (container) {
            // 局部查询，性能更好
            container.querySelectorAll('.word-span').forEach(span => {
                span.className = 'word-span';
            });
        } else {
            // 降级到全局查询
            document.querySelectorAll('.word-span').forEach(span => {
                span.className = 'word-span';
            });
        }
    }
    
    function highlightSentenceWords(sentenceElementId, sentenceData) {
        const sentenceDiv = document.getElementById(sentenceElementId);
        if (!sentenceDiv) return;
        
        let posList = [];
        if (sentenceData && sentenceData.pos) {
            if (Array.isArray(sentenceData.pos)) {
                posList = sentenceData.pos;
            } else if (sentenceData.pos.pos) {
                posList = sentenceData.pos.pos;
            }
        }
        
        if (posList.length === 0) return;
        
        const spans = sentenceDiv.querySelectorAll('.word-span');
        
        spans.forEach(span => {
            const word = span.dataset.word;
            if (!word) return;
            
            const posItem = posList.find(p => 
                p.word && p.word.toLowerCase() === word.toLowerCase()
            );
            
            if (posItem && highlightPosMap[posItem.pos]) {
                const className = posClassMap[posItem.pos];
                if (className) {
                    span.classList.add(className);
                    span.classList.add('global-highlight'); // 标记为全局高亮
                }
            }
        });
    }
    
    function applyHighlightToAll() {
        clearAllHighlight();
        
        let sentenceData = {};
        if (window.CacheManager) {
            const sentences = window.CacheManager.getSentences();
            if (sentences) {
                for (let i = 0; i < sentences.length; i++) {
                    const posCache = window.CacheManager.getSentenceCache(i, 'pos');
                    if (!posCache) continue;
                    try {
                        const parsed = typeof posCache === 'string' ? JSON.parse(posCache) : posCache;
                        sentenceData[i] = { pos: parsed };
                    } catch(e) {
                        console.warn(`解析句子 ${i} 的词性数据失败:`, e);
                    }
                }
            }
        } else if (window.SentenceRenderer) {
            const data = window.SentenceRenderer.getSentencesData();
            sentenceData = data.sentenceData;
        }
        
        for (let idx in sentenceData) {
            const data = sentenceData[idx];
            if (data && data.pos) {
                highlightSentenceWords(`sentence-${idx}`, data);
            }
        }
    }
    
    /**
     * 标准化单词（去除标点符号）
     */
    function normalizeWord(word) {
        if (typeof word !== 'string') return '';
        return word.toLowerCase().replace(/^[,.!?;:\"\']+|[,.!?;:\"\']+$/g, '');
    }

    /**
     * 高亮句子中指定的单词（点击高亮，区别于全局高亮）
     * @param {number} sentenceIndex - 句子索引
     * @param {string} word - 要高亮的单词
     * @param {string} pos - 词性
     */
    function highlightWordInSentence(sentenceIndex, word, pos) {
        if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || !Number.isInteger(sentenceIndex)) {
            console.warn(`[HighlightRenderer] 无效的句子索引: ${sentenceIndex}`);
            return;
        }
        if (typeof word !== 'string' || !word.trim()) {
            console.warn('[HighlightRenderer] 无效的单词');
            return;
        }
        if (typeof pos !== 'string' || !posClassMap[pos]) {
            console.warn(`[HighlightRenderer] 无效的词性: ${pos}`);
            return;
        }

        const sentenceElementId = `sentence-${sentenceIndex}`;
        const sentenceDiv = document.getElementById(sentenceElementId);
        if (!sentenceDiv) {
            console.warn(`[HighlightRenderer] 找不到句子元素: ${sentenceElementId}`);
            return;
        }

        const wordSpans = sentenceDiv.querySelectorAll('.word-span');
        const wordNormalized = normalizeWord(word);

        wordSpans.forEach(span => {
            const spanWord = span.dataset.word;
            const isMatch = spanWord && normalizeWord(spanWord) === wordNormalized;

            if (span.classList.contains('click-highlight')) {
                if (!isMatch) {
                    Object.values(posClassMap).forEach(className => {
                        span.classList.remove(className);
                    });
                }
                span.classList.remove('click-highlight');
            }

            if (isMatch && highlightPosMap[pos]) {
                const className = posClassMap[pos];
                if (className) {
                    span.classList.add(className);
                    span.classList.add('click-highlight');
                }
            }
        });
    }

    /**
     * 清除句子中指定单词的点击高亮（保留全局高亮）
     * @param {number} sentenceIndex - 句子索引
     */
    function clearWordClickHighlight(sentenceIndex) {
        if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || !Number.isInteger(sentenceIndex)) {
            return;
        }

        const sentenceElementId = `sentence-${sentenceIndex}`;
        const sentenceDiv = document.getElementById(sentenceElementId);
        if (!sentenceDiv) return;

        const wordSpans = sentenceDiv.querySelectorAll('.word-span.click-highlight:not(.global-highlight)');
        wordSpans.forEach(span => {
            Object.values(posClassMap).forEach(className => {
                span.classList.remove(className);
            });
            span.classList.remove('click-highlight');
        });
    }

    /**
     * 清除句子中所有单词的高亮（包括全局和点击）
     * @param {number} sentenceIndex - 句子索引
     */
    function clearWordHighlight(sentenceIndex) {
        if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || !Number.isInteger(sentenceIndex)) {
            return;
        }

        const sentenceElementId = `sentence-${sentenceIndex}`;
        const sentenceDiv = document.getElementById(sentenceElementId);
        if (!sentenceDiv) return;

        const wordSpans = sentenceDiv.querySelectorAll('.word-span');
        wordSpans.forEach(span => {
            Object.values(posClassMap).forEach(className => {
                span.classList.remove(className);
            });
            span.classList.remove('click-highlight');
        });
    }

    window.HighlightRenderer = {
        clearAllHighlight,
        highlightSentenceWords,
        applyHighlightToAll,
        getHighlightPosMap: getHighlightPosMapConfig,
        updateHighlightPosMap,
        highlightWordInSentence,
        clearWordClickHighlight,
        clearWordHighlight,
        normalizeWord
    };
})();
