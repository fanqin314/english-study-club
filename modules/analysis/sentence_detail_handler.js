// sentence_detail_handler.js - 主界面句子详情处理
(function() {
    ModuleRegistry.register('SentenceDetailHandler', ['ErrorHandler', 'Performance', 'EventBus', 'Security'], function(ErrorHandler, Performance, EventBus, Security) {
        // 处理句子详情加载
        async function handleSentenceDetail(sentenceIndex, type, panel) {
            // 检查是否在二级分析界面
            if (window.HistoryAnalysisRenderer && window.HistoryAnalysisRenderer.isSecondaryAnalysis()) {
                // 二级分析界面由 HistoryAnalysisRenderer 处理
                return;
            }
            
            // 主界面处理逻辑
            switch (type) {
                case 'pos':
                    if (window.onLoadPos) {
                        window.onLoadPos(sentenceIndex, panel);
                    } else {
                        showError(panel, '词性分析功能未加载');
                    }
                    break;
                case 'syntax':
                    if (window.onLoadSyntax) {
                        window.onLoadSyntax(sentenceIndex, panel);
                    } else {
                        showError(panel, '语法结构功能未加载');
                    }
                    break;
                case 'knowledge':
                    if (window.onLoadKnowledge) {
                        window.onLoadKnowledge(sentenceIndex, panel);
                    } else {
                        showError(panel, '知识点功能未加载');
                    }
                    break;
                case 'translation':
                    if (window.SentenceTranslation && window.SentenceTranslation.onLoad) {
                        window.SentenceTranslation.onLoad(sentenceIndex, panel);
                    } else {
                        showError(panel, '翻译功能未加载');
                    }
                    break;
                default:
                    console.warn('未知按钮类型:', type);
                    showError(panel, '未知的分析类型');
            }
        }
        
        // 显示错误信息
        function showError(panel, message) {
            panel.innerHTML = `<div class="error-message">${message}</div>`;
            panel.classList.add('show');
        }
        
        // 初始化
        function init() {
            // 监听句子详情加载事件
            if (EventBus && EventBus.on) {
                EventBus.on('loadSentenceDetail', async function(data) {
                    const { idx, type, panel } = data;
                    if (!panel) {
                        console.error(`面板 ${type}-panel-${idx} 未找到`);
                        return;
                    }
                    
                    await handleSentenceDetail(idx, type, panel);
                });
            }
        }
        
        // 初始化模块
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        return {
            init,
            handleSentenceDetail
        };
    });
})();