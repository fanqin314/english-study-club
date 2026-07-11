// full_translation.js - 全文翻译功能
(function() {
    ModuleRegistry.register('FullTranslation', ['ErrorHandler', 'Performance', 'EventBus', 'Security'], function(ErrorHandler, Performance, EventBus, Security) {
        let translationArea = null;
        let translationTextSpan = null;
        let currentTranslation = '';

        function init() {
            translationArea = document.getElementById('fullTranslationArea');
            translationTextSpan = document.getElementById('fullTranslationText');
            if (window.CacheManager) {
                const cached = window.CacheManager.getFullTranslation();
                if (cached) {
                    currentTranslation = cached;
                    if (translationTextSpan) translationTextSpan.innerText = cached;
                    if (translationArea) translationArea.style.display = 'block';
                }
            }
        }

        const fetchFullTranslation = ErrorHandler.wrapAsyncFunction(async function(text) {
            if (!text || text.trim() === '') {
                ErrorHandler.handleValidationError('请输入文章内容');
                return null;
            }
            const apiConfig = Security.getApiConfig();
            if (!apiConfig || !apiConfig.apiKey) {
                ErrorHandler.handleValidationError('请先配置 API Key');
                return null;
            }
            try {
                const rawTranslation = await window.APIRequest.requestFullTranslation(text);
                if (rawTranslation) {
                    const DELIMITER = '[SENTENCE_END]';
                    let displayTranslation = rawTranslation;
                    let sentenceTranslations = [];

                    if (rawTranslation.includes(DELIMITER)) {
                        sentenceTranslations = rawTranslation.split(DELIMITER)
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        displayTranslation = sentenceTranslations.join('\n');
                    }

                    if (window.CacheManager && sentenceTranslations.length > 0) {
                        const sentences = window.CacheManager.getSentences();
                        const updates = [];
                        for (let i = 0; i < Math.min(sentenceTranslations.length, sentences.length); i++) {
                            updates.push({ idx: i, type: 'translation', data: sentenceTranslations[i] });
                        }
                        if (updates.length > 0) {
                            window.CacheManager.batchSetSentenceCache(updates);
                        }
                    }

                    currentTranslation = displayTranslation;
                    if (translationTextSpan) translationTextSpan.innerText = displayTranslation;
                    if (translationArea) translationArea.style.display = 'block';
                    if (window.CacheManager) window.CacheManager.setFullTranslation(displayTranslation);
                    ErrorHandler.showSuccess('全文翻译完成');
                    return displayTranslation;
                } else {
                    throw new Error('翻译结果为空');
                }
            } catch (error) {
                throw error;
            }
        });

        function getCurrentTranslation() { return currentTranslation; }
        function clearTranslation() {
            currentTranslation = '';
            if (translationTextSpan) translationTextSpan.innerText = '';
            if (translationArea) translationArea.style.display = 'none';
            if (window.CacheManager) window.CacheManager.clearFullTranslation();
        }
        function hideTranslation() { if (translationArea) translationArea.style.display = 'none'; }
        function showTranslation() { if (translationArea && currentTranslation) translationArea.style.display = 'block'; }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        // 导出全局接口（保持向后兼容）
        window.FullTranslation = {
            init, fetch: fetchFullTranslation, get: getCurrentTranslation,
            clear: clearTranslation, hide: hideTranslation, show: showTranslation
        };

        return {
            init, fetch: fetchFullTranslation, get: getCurrentTranslation,
            clear: clearTranslation, hide: hideTranslation, show: showTranslation
        };
    });
})();