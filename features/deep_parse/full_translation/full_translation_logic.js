// full_translation_logic.js - 全文翻译功能
(function() {
    ModuleRegistry.register('FullTranslation', ['ErrorHandler', 'Performance', 'EventBus', 'Security'], function(ErrorHandler, Performance, EventBus, Security) {
        let translationArea = null;
        let translationTextSpan = null;
        let currentTranslation = '';

        // 简单的 HTML 转义
        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // 跳转到对应句子并展开翻译
        function jumpToSentence(idx) {
            const container = document.getElementById('deepParseSentencesContainer');
            const card = container && container.querySelector(`.sentence-card[data-index="${idx}"]`);
            if (!card) return;
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const panel = document.getElementById('translation-panel-' + idx);
            if (!panel) return;
            // 重置该卡片内已激活的分析按钮
            card.querySelectorAll('.sentence-buttons button.active').forEach(b => {
                b.classList.remove('active');
                b.style.background = '';
                b.style.color = '';
            });
            // 激活“翻译”按钮
            const btn = card.querySelector('.sentence-buttons button[data-type="translation"]');
            if (btn) {
                btn.classList.add('active');
                btn.style.background = 'var(--accent)';
                btn.style.color = 'white';
            }
            panel.innerHTML = '<div class="loading">加载中...</div>';
            panel.classList.add('show');
            if (typeof EventBus !== 'undefined' && EventBus && EventBus.emit) {
                EventBus.emit('loadSentenceDetail', { idx, type: 'translation', panel });
            }
        }

        // 按行渲染带序号的翻译条目
        function renderNumberedTranslation(text) {
            if (!translationTextSpan) return;
            const lines = String(text).split('\n').map(s => s.trim()).filter(s => s.length > 0);
            if (lines.length === 0) {
                translationTextSpan.innerHTML = '';
                return;
            }
            translationTextSpan.innerHTML = lines.map((line, i) =>
                `<span class="translation-item" data-idx="${i}"><span class="translation-seq">${i + 1}</span><span class="translation-item-text">${escapeHtml(line)}</span></span>`
            ).join('');
        }

        function init() {
            translationArea = document.getElementById('fullTranslationArea');
            translationTextSpan = document.getElementById('fullTranslationText');
            if (window.CacheManager) {
                const cached = window.CacheManager.getFullTranslation();
                if (cached) {
                    currentTranslation = cached;
                    renderNumberedTranslation(cached);
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
                        // 数量不匹配时发出警告，防止静默错位
                        if (sentenceTranslations.length !== sentences.length) {
                            console.warn(`[FullTranslation] 翻译句子数(${sentenceTranslations.length})与原文句子数(${sentences.length})不匹配，可能因AI未按句号分割导致`);
                        }
                        const updates = [];
                        const count = Math.min(sentenceTranslations.length, sentences.length);
                        for (let i = 0; i < count; i++) {
                            updates.push({ idx: i, type: 'translation', data: sentenceTranslations[i] });
                        }
                        if (updates.length > 0) {
                            window.CacheManager.batchSetSentenceCache(updates);
                        }
                    }

                    currentTranslation = displayTranslation;
                    renderNumberedTranslation(displayTranslation);
                    if (translationArea) translationArea.style.display = 'block';
                    if (window.CacheManager) window.CacheManager.setFullTranslation(displayTranslation);
                    ErrorHandler.showSuccess('全文翻译完成');
                    return displayTranslation;
                } else {
                    ErrorHandler.showError('翻译失败，请稍后重试');
                    return null;
                }
            } catch (error) {
                // API 错误已在 requestFullTranslation 中通过 handleApiError 记录
                // 不再重复抛出，避免误导性错误信息
                return null;
            }
        });

        function getCurrentTranslation() { return currentTranslation; }
        function setTranslation(text) {
            currentTranslation = text || '';
            renderNumberedTranslation(currentTranslation);
        }
        function clearTranslation() {
            currentTranslation = '';
            if (translationTextSpan) translationTextSpan.innerHTML = '';
            if (translationArea) translationArea.style.display = 'none';
            if (window.CacheManager) window.CacheManager.clearFullTranslation();
        }
        function hideTranslation() { if (translationArea) translationArea.style.display = 'none'; }
        function showTranslation() { if (translationArea && currentTranslation) translationArea.style.display = 'block'; }

        // 事件委托：点击带序号的翻译条目，跳转到对应句子并展开翻译
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.addEventListener('click', (e) => {
                    const item = e.target.closest && e.target.closest('.translation-item');
                    if (item && translationTextSpan && translationTextSpan.contains(item)) {
                        jumpToSentence(parseInt(item.dataset.idx, 10));
                    }
                });
            });
        } else {
            document.addEventListener('click', (e) => {
                const item = e.target.closest && e.target.closest('.translation-item');
                if (item && translationTextSpan && translationTextSpan.contains(item)) {
                    jumpToSentence(parseInt(item.dataset.idx, 10));
                }
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        // 导出全局接口（保持向后兼容）
        window.FullTranslation = {
            init, fetch: fetchFullTranslation, get: getCurrentTranslation, set: setTranslation,
            clear: clearTranslation, hide: hideTranslation, show: showTranslation
        };

        return {
            init, fetch: fetchFullTranslation, get: getCurrentTranslation, set: setTranslation,
            clear: clearTranslation, hide: hideTranslation, show: showTranslation
        };
    });
})();