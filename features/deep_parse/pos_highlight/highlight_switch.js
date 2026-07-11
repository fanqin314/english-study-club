// 高亮开关.js - 词性高亮开关功能（功能模块，事件绑定由 event_delegation.js 统一处理）

(function() {
    let highlightEnabled = false;
    let settingsModalLoaded = false;
    let abortController = null;  // 用于取消正在进行的异步操作
    
    function getHighlightButton() {
        return document.getElementById('highlightToggleBtn');
    }
    
    function updateButtonStyle() {
        const btn = getHighlightButton();
        if (btn) {
            if (highlightEnabled) {
                btn.style.background = 'var(--accent)';
                btn.style.color = 'white';
            } else {
                // 检查是否为深色模式
                const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
                btn.style.background = isDarkMode ? '#334155' : '#e2e8f0';
                btn.style.color = 'var(--text)';
            }
        }
    }
    
    async function enableHighlight() {
        if (highlightEnabled) return;
        highlightEnabled = true;
        updateButtonStyle();
        
        await autoAnalyzeAllSentences();
        
        if (window.HighlightRenderer && window.HighlightRenderer.applyHighlightToAll) {
            window.HighlightRenderer.applyHighlightToAll();
        } else {
            console.warn('HighlightRenderer 未加载');
        }
    }
    
    async function autoAnalyzeAllSentences() {
        if (!window.CacheManager) {
            console.warn('CacheManager 未加载');
            return;
        }
        
        const sentences = window.CacheManager.getSentences();
        if (!sentences || sentences.length === 0) {
            console.warn('没有句子数据');
            return;
        }
        
        // 创建新的 AbortController 用于本次操作
        abortController = new AbortController();
        const signal = abortController.signal;
        
        for (let i = 0; i < sentences.length; i++) {
            // 检查是否被取消
            if (signal.aborted) {
                console.log('[HighlightSwitch] 分析操作已取消');
                return;
            }
            
            const sentence = sentences[i];
            if (!sentence) continue;
            
            const existingPosData = window.CacheManager.getSentenceCache(i, 'pos');
            if (existingPosData) continue;
            
            try {
                if (window.PosButton && window.PosButton.loadAndDisplay) {
                    const tempPanel = document.createElement('div');
                    tempPanel.id = `pos-panel-${i}`;
                    await window.PosButton.loadAndDisplay(i, tempPanel);
                }
            } catch (error) {
                // 如果是取消导致的错误，不输出错误日志
                if (signal.aborted) {
                    return;
                }
                console.error(`分析句子 ${i} 的词性失败:`, error);
            }
        }
        
        // 完成后清理
        abortController = null;
    }
    
    function disableHighlight() {
        if (!highlightEnabled) return;
        
        // 取消正在进行的异步分析操作
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        
        highlightEnabled = false;
        updateButtonStyle();
        
        if (window.HighlightRenderer && window.HighlightRenderer.clearAllHighlight) {
            window.HighlightRenderer.clearAllHighlight();
        } else if (window.SentenceRenderer && window.SentenceRenderer.clearHighlight) {
            window.SentenceRenderer.clearHighlight();
        } else {
            document.querySelectorAll('.word-span').forEach(span => {
                span.className = 'word-span';
            });
        }
    }
    
    async function toggleHighlight() {
        if (highlightEnabled) {
            disableHighlight();
        } else {
            await enableHighlight();
        }
        saveState();
    }
    
    function isHighlightEnabled() {
        return highlightEnabled;
    }
    
    function openHighlightSettings(buttonRect) {
        if (!settingsModalLoaded && window.HighlightSettingsModal) {
            window.HighlightSettingsModal.init();
            settingsModalLoaded = true;
        }
        
        if (window.HighlightSettingsModal && window.HighlightSettingsModal.show) {
            window.HighlightSettingsModal.show(buttonRect);
        } else {
            console.warn('HighlightSettingsModal 未加载');
        }
    }
    
    // 处理按钮点击（由事件委托调用）
    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleHighlight();
    }
    
    // 处理右键菜单（由事件委托调用）
    function handleContextMenu(e, target) {
        e.preventDefault();
        e.stopPropagation();
        const rect = target.getBoundingClientRect();
        openHighlightSettings(rect);
    }
    
    function init() {
        // 加载保存的状态
        if (window.CacheManager) {
            const savedState = localStorage.getItem('highlightEnabled');
            if (savedState === 'true') {
                highlightEnabled = true;
                updateButtonStyle();
                setTimeout(() => {
                    if (window.HighlightRenderer && window.HighlightRenderer.applyHighlightToAll) {
                        window.HighlightRenderer.applyHighlightToAll();
                    }
                }, 100);
            }
        }
        
        console.log('[HighlightSwitch] 初始化完成（事件绑定由 event_delegation.js 统一处理）');
    }
    
    function saveState() {
        localStorage.setItem('highlightEnabled', highlightEnabled);
    }
    
    window.HighlightSwitch = {
        init,
        toggle: toggleHighlight,
        enable: enableHighlight,
        disable: disableHighlight,
        isEnabled: isHighlightEnabled,
        openSettings: openHighlightSettings,
        handleClick,
        handleContextMenu
    };
    
    window.onHighlightToggle = toggleHighlight;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
