// reload_button.js - 清除句子缓存并重置面板，重新解析该句

(function() {
    // 重新加载指定句子的所有数据
    function reloadSentence(idx) {
        // 清除该句子的所有缓存
        if (window.CacheManager) {
            // 清除该句子的所有类型缓存
            const types = ['pos', 'syntax', 'knowledge', 'translation'];
            types.forEach(type => {
                window.CacheManager.setSentenceCache(idx, type, null);
            });
        }
        
        // 清除面板内容并隐藏
        const panels = ['pos', 'syntax', 'knowledge', 'translation'];
        panels.forEach(type => {
            const panel = document.getElementById(`${type}-panel-${idx}`);
            if (panel) {
                panel.innerHTML = '';
                panel.classList.remove('show');
            }
        });
        
        // 如果该句子有高亮，清除高亮
        const sentenceDiv = document.getElementById(`sentence-${idx}`);
        if (sentenceDiv) {
            const spans = sentenceDiv.querySelectorAll('.word-span');
            spans.forEach(span => {
                span.className = 'word-span';
            });
        }
        
        // 重置该句所有分析按钮的激活状态：否则刷新后按钮仍处于 active，
        // 再次点击「词性」等按钮会走「折叠面板」分支而不重新解析，需连点两次才生效
        const card = (sentenceDiv && sentenceDiv.closest('.sentence-card')) ||
                     document.querySelector(`.sentence-card[data-index="${idx}"]`);
        if (card) {
            card.querySelectorAll('.sentence-buttons button[data-type]').forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = '';
                btn.style.color = '';
            });
        }
        
        // 如果高亮开关是开启状态，且词性数据被清除，需要提示用户
        if (window.HighlightSwitch && window.HighlightSwitch.isEnabled()) {
            showToast(`已清除第 ${idx + 1} 句缓存，高亮已移除。点击"词性"按钮重新解析后高亮会恢复。`);
        } else {
            showToast(`已清除第 ${idx + 1} 句缓存，可重新点击按钮解析`);
        }
        
        // 可选：从 SentenceRenderer 中清除数据
        if (window.SentenceRenderer) {
            // 如果 SentenceRenderer 有清除方法
            if (window.SentenceRenderer.clearPanelContent) {
                window.SentenceRenderer.clearPanelContent(idx);
            }
        }
    }
    
    // 显示提示消息
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    }
    
    // 导出接口
    window.ReloadButton = {
        reload: reloadSentence
    };
    
    // 全局回调（供句子卡片调用）
    window.onRefreshSentence = reloadSentence;
})();