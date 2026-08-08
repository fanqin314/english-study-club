// history_highlight.js - 历史记录专属的单词高亮功能
// 独立于深度解析高亮系统，不受其设置影响
(function() {
    'use strict';

    let highlightEnabled = false;
    let isAnalyzing = false;
    let abortController = null;

    const posClassMap = {
        'n': 'pos-n', 'v': 'pos-v', 'adj': 'pos-adj', 'adv': 'pos-adv',
        'pron': 'pos-pron', 'prep': 'pos-prep', 'conj': 'pos-conj',
        'interj': 'pos-interj', 'art': 'pos-art', 'num': 'pos-num'
    };

    // 从 localStorage 读取词性高亮设置（与设置弹窗共享同一配置）
    function getHighlightMap() {
        var saved = localStorage.getItem('highlightPosMap');
        if (saved) {
            try { return JSON.parse(saved); } catch(e) { /* ignore */ }
        }
        // 默认高亮所有词性
        return {
            n: true, v: true, adj: true, adv: true, pron: true,
            prep: true, conj: true, interj: true, art: true, num: true
        };
    }

    function getButton() {
        return document.getElementById('historyHighlightBtn');
    }

    function updateButtonStyle() {
        const btn = getButton();
        if (!btn) return;
        if (isAnalyzing) {
            btn.classList.add('active');
            btn.style.opacity = '0.7';
            return;
        }
        if (highlightEnabled) {
            btn.classList.add('active');
            btn.style.opacity = '1';
        } else {
            btn.classList.remove('active');
            btn.style.opacity = '';
        }
    }

    function getContainer() {
        return document.getElementById('secondarySentencesContainer');
    }

    function clearHighlight() {
        const container = getContainer();
        if (!container) return;
        container.querySelectorAll('.word-span').forEach(span => {
            Object.values(posClassMap).forEach(cls => span.classList.remove(cls));
        });
    }

    function applyHighlight() {
        if (!highlightEnabled) return;

        const container = getContainer();
        if (!container) return;

        // 从 CacheManager 获取历史记录的 pos 数据
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
                        // 忽略解析错误
                    }
                }
            }
        }

        // 对每个句子应用高亮
        for (let idx in sentenceData) {
            const data = sentenceData[idx];
            if (!data || !data.pos) continue;

            let posList = [];
            if (Array.isArray(data.pos)) {
                posList = data.pos;
            } else if (data.pos.pos) {
                posList = data.pos.pos;
            }
            if (posList.length === 0) continue;

            const sentenceDiv = document.getElementById('sentence-' + idx);
            if (!sentenceDiv) continue;

            const spans = sentenceDiv.querySelectorAll('.word-span');
            spans.forEach(span => {
                const word = span.dataset.word;
                if (!word) return;
                const posItem = posList.find(function(p) {
                    return p.word && p.word.toLowerCase() === word.toLowerCase();
                });
                var currentMap = getHighlightMap();
                if (posItem && currentMap[posItem.pos]) {
                    var className = posClassMap[posItem.pos];
                    if (className) span.classList.add(className);
                }
            });
        }
    }

    // 自动分析未缓存的词性数据
    async function autoAnalyzeAllSentences() {
        if (!window.CacheManager || !window.PosButton) {
            console.warn('[HistoryHighlight] CacheManager 或 PosButton 未加载');
            return;
        }

        const sentences = window.CacheManager.getSentences();
        if (!sentences || sentences.length === 0) {
            console.warn('[HistoryHighlight] 没有句子数据');
            return;
        }

        abortController = new AbortController();
        const signal = abortController.signal;

        for (let i = 0; i < sentences.length; i++) {
            if (signal.aborted) {
                console.log('[HistoryHighlight] 分析操作已取消');
                return;
            }

            const sentence = sentences[i];
            if (!sentence) continue;

            // 跳过已有缓存的数据
            const existingPosData = window.CacheManager.getSentenceCache(i, 'pos');
            if (existingPosData) continue;

            try {
                if (window.PosButton && window.PosButton.loadAndDisplay) {
                    var tempPanel = document.createElement('div');
                    tempPanel.id = 'history-pos-panel-' + i;
                    await window.PosButton.loadAndDisplay(i, tempPanel);
                }
            } catch (error) {
                if (signal.aborted) return;
                console.error('[HistoryHighlight] 分析句子 ' + i + ' 的词性失败:', error);
            }
        }

        abortController = null;
    }

    async function toggleHighlight() {
        // 如果正在分析中，不响应
        if (isAnalyzing) return;

        var willEnable = !highlightEnabled;

        if (willEnable) {
            // 开启高亮
            highlightEnabled = true;
            isAnalyzing = true;
            updateButtonStyle();

            try {
                // 先分析未缓存的词性数据
                await autoAnalyzeAllSentences();
            } catch (e) {
                console.error('[HistoryHighlight] 分析出错:', e);
            } finally {
                isAnalyzing = false;
                // 分析完成后应用高亮
                if (highlightEnabled) {
                    applyHighlight();
                }
                updateButtonStyle();
            }
        } else {
            // 关闭高亮
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
            highlightEnabled = false;
            isAnalyzing = false;
            clearHighlight();
            updateButtonStyle();
        }

        localStorage.setItem('historyHighlightEnabled', highlightEnabled);
    }

    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        // 异步执行，但不阻塞事件
        toggleHighlight().catch(function(err) {
            console.error('[HistoryHighlight] toggleHighlight 出错:', err);
        });
    }

    function init() {
        var saved = localStorage.getItem('historyHighlightEnabled');
        if (saved === 'true') {
            highlightEnabled = true;
            updateButtonStyle();
            // 延迟应用，确保容器已渲染
            setTimeout(function() {
                if (highlightEnabled) applyHighlight();
            }, 200);
        }
    }

    window.HistoryHighlight = {
        init: init,
        toggle: toggleHighlight,
        enable: function() { if (!highlightEnabled) toggleHighlight(); },
        disable: function() { if (highlightEnabled) toggleHighlight(); },
        isEnabled: function() { return highlightEnabled; },
        handleClick: handleClick,
        applyHighlight: applyHighlight,
        clearHighlight: clearHighlight
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();