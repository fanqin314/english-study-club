// 高亮渲染.js - 给单词添加词性颜色高亮

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
        const container = document.getElementById('deepParseSentencesContainer') || 
                         document.getElementById('secondarySentencesContainer') ||
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
    
    window.HighlightRenderer = {
        clearAllHighlight,
        highlightSentenceWords,
        applyHighlightToAll,
        getHighlightPosMap: getHighlightPosMapConfig,
        updateHighlightPosMap
    };
})();
