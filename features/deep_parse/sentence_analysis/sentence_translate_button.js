// sentence_translate_button.js - 句子翻译功能
(function() {
    ModuleRegistry.register('SentenceTranslation', ['ErrorHandler', 'Performance', 'EventBus', 'Security', 'GlobalManager', 'Utils'], function(ErrorHandler, Performance, EventBus, Security, GlobalManager, Utils) {
        function translateSentence(sentence) {
            return ErrorHandler.wrapAsyncFunction(async function() {
                const apiConfig = Security.getApiConfig();
                if (!Utils.checkApiConfig(apiConfig)) {
                    ErrorHandler.handleValidationError('请先配置 API Key');
                    return null;
                }
                
                if (!sentence) {
                    ErrorHandler.handleValidationError('无法获取句子内容');
                    return null;
                }
                
                try {
                    const apiRequest = GlobalManager.getGlobalObject('APIRequest');
                    if (!apiRequest) {
                        ErrorHandler.handleValidationError('API请求服务未初始化');
                        return null;
                    }
                    
                    if (!apiRequest.requestTranslation) {
                        ErrorHandler.handleValidationError('API请求服务功能不完整');
                        return null;
                    }
                    
                    const translation = await apiRequest.requestTranslation(sentence);
                    return translation;
                } catch (error) {
                    console.error('翻译失败:', error);
                    const errorMessage = Utils.handleApiError(error);
                    ErrorHandler.handleApiError(errorMessage);
                    return null;
                }
            })();
        }

        // 是否处于历史/精读（二级分析）视图：该视图的句子来自历史记录项，
        // 与当前 CacheManager 缓存未必同文，翻译只能读逐句缓存，不能拿全译兜底
        function isSecondaryAnalysis() {
            return !!(
                (window.HistoryDetail && window.HistoryDetail.isSecondaryAnalysis && window.HistoryDetail.isSecondaryAnalysis()) ||
                (window.HistoryAnalysisRenderer && window.HistoryAnalysisRenderer.isSecondaryAnalysis && window.HistoryAnalysisRenderer.isSecondaryAnalysis())
            );
        }

        function onLoadTranslation(idx, panel) {
            return ErrorHandler.wrapAsyncFunction(async function() {
                const cacheManager = GlobalManager.getGlobalObject('CacheManager');
                let translation = null;

                if (cacheManager) {
                    translation = cacheManager.getSentenceCache(idx, 'translation');
                    // 兜底：逐句翻译缓存缺失时（历史遗留/换文后未重生成），
                    // 从全文翻译缓存按行号取该句译文——全文翻译编号列表与句子卡片序号一一对应。
                    // 仅主视图启用：历史/精读视图的句子来自历史记录项，与当前 CacheManager 的
                    // 全文翻译未必同文，不能拿它兜底，否则会把别的文章的译文显示到历史句子上。
                    if (!translation && !isSecondaryAnalysis()
                        && typeof cacheManager.getFullTranslation === 'function') {
                        const lines = String(cacheManager.getFullTranslation() || '')
                            .split('\n').map(s => s.trim()).filter(s => s.length > 0);
                        if (lines[idx]) translation = lines[idx];
                    }
                }

                if (panel) {
                    if (translation) {
                        panel.innerHTML = `<strong><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>翻译</strong><div>${Security.escapeHtml(translation)}</div>`;
                    } else {
                        panel.innerHTML = `<strong><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>翻译</strong><div>暂无翻译，请先使用全文翻译</div>`;
                    }
                    panel.classList.add('show');
                }
            })();
        }

        // 导出全局接口（保持向后兼容）
        window.SentenceTranslation = {
            translate: translateSentence,
            onLoad: onLoadTranslation
        };

        return {
            translate: translateSentence,
            onLoad: onLoadTranslation
        };
    });
})();