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

        // 输入框是否已有文章内容：空则视为"未解析/已清空"，不显示翻译区
        function hasArticleText() {
            const el = document.getElementById('articleInput');
            return !!(el && String(el.value || '').trim());
        }

        // 将 AI 返回的翻译段对齐到原文句子数：
        // 模型常把分号/冒号子句也当作句子边界多拆（段数 > 句子数），导致逐句翻译错位。
        // 优先按原文子句数贪婪归并（分号/冒号场景）；若 AI 任意多拆仍有多余段，
        // 改为轮转分摊到各句，避免全部塞进最后一条造成异常臃肿（长文章尤为明显）。
        function alignTranslationsToSentences(translations, sentences) {
            const m = sentences.length;
            if (m === 0 || translations.length === m) return translations;
            if (translations.length < m) return translations; // 段数不足无法补全，保留原样由上层告警
            const clauseCounts = sentences.map(s =>
                Math.max(1, (String(s).match(/;/g) || []).length + (String(s).match(/:/g) || []).length + 1));
            const merged = [];
            let p = 0;
            for (let i = 0; i < m && p < translations.length; i++) {
                // 为剩余句子至少各留一段，避免吞掉后续句子的翻译
                const maxTake = translations.length - p - (m - i - 1);
                const take = Math.max(1, Math.min(clauseCounts[i], maxTake));
                merged.push(translations.slice(p, p + take).join('；'));
                p += take;
            }
            // 仍有零头（AI 任意多拆、非分号/冒号场景）：轮转分摊到各条，
            // 不让最后一条翻译异常臃肿，各句长度大致均衡
            if (p < translations.length && merged.length > 0) {
                const leftover = translations.slice(p);
                for (let j = 0; j < leftover.length; j++) {
                    merged[j % merged.length] += '；' + leftover[j];
                }
            }
            return merged;
        }

        function init() {
            translationArea = document.getElementById('fullTranslationArea');
            translationTextSpan = document.getElementById('fullTranslationText');
            if (window.CacheManager) {
                const cached = window.CacheManager.getFullTranslation();
                if (cached) {
                    currentTranslation = cached;
                    renderNumberedTranslation(cached);
                    // 输入框为空时不自动显示（缓存数据保留，待输入内容后经 input 监听恢复显示）
                    if (translationArea) translationArea.style.display = hasArticleText() ? 'block' : 'none';
                }
            }
        }

        // 在全文翻译区域显示加载状态（旋转指示 + 段落骨架），等待 AI 翻译返回
        function showTranslationLoading() {
            if (!translationTextSpan) return;
            translationTextSpan.innerHTML =
                '<div class="translation-loading"><span class="translation-loading-spinner"></span><span>正在翻译全文…</span></div>' +
                '<div class="translation-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';
            if (translationArea) translationArea.style.display = 'block';
        }

        // 翻译失败时清除加载骨架，避免动画残留
        function clearTranslationLoading() {
            if (!translationTextSpan) return;
            if (translationTextSpan.querySelector('.translation-loading, .translation-skeleton')) {
                translationTextSpan.innerHTML = '';
            }
            if (translationArea) translationArea.style.display = 'none';
        }

        // 从 AI 原始输出中提取翻译段：
        // 模型在长文章翻译时常漏掉部分 [SENTENCE_END]（每段内换行分隔多句），
        // 按换行进一步拆分可恢复逐句翻译，再交给 alignTranslationsToSentences 对齐。
        function extractTranslations(rawTranslation) {
            const DELIMITER = '[SENTENCE_END]';
            let parts = String(rawTranslation || '').split(DELIMITER)
                .map(s => s.trim())
                .filter(s => s.length > 0);
            const finer = [];
            parts.forEach(p => {
                p.split(/\n+/).forEach(seg => {
                    const t = seg.trim();
                    if (t) finer.push(t);
                });
            });
            if (finer.length > parts.length) parts = finer;
            return parts;
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
                // 翻译期间显示加载动画
                showTranslationLoading();
                const rawTranslation = await window.APIRequest.requestFullTranslation(text);
                if (rawTranslation) {
                    const DELIMITER = '[SENTENCE_END]';
                    let displayTranslation = rawTranslation;
                    let sentenceTranslations = [];

                    if (rawTranslation.includes(DELIMITER) || rawTranslation.includes('\n')) {
                        sentenceTranslations = extractTranslations(rawTranslation);
                        // 对齐到原文句子数：AI 常把分号/冒号子句当句子边界多拆，
                        // 按原文子句数贪婪归并，保证编号列表与逐句翻译和句子卡片对齐
                        const alignedSentences = window.CacheManager ? window.CacheManager.getSentences() : [];
                        if (alignedSentences.length > 0) {
                            sentenceTranslations = alignTranslationsToSentences(sentenceTranslations, alignedSentences);
                        }
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
                    clearTranslationLoading();
                    return null;
                }
            } catch (error) {
                // API 错误已在 requestFullTranslation 中通过 handleApiError 记录
                // 不再重复抛出，避免误导性错误信息
                clearTranslationLoading();
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

        // 输入框内容变化时联动翻译区显隐：空（清空/未解析）→ 隐藏；有内容且有已缓存翻译 → 恢复显示
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'articleInput') {
                if (translationArea) {
                    translationArea.style.display =
                        (String(e.target.value || '').trim() && currentTranslation) ? 'block' : 'none';
                }
            }
        });

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