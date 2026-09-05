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

        // 输入框内容是否与「已解析原文」一致：
        // 全文翻译/句子分析等结果属于当初解析的那篇文章，仅当输入仍与该原文一致时才允许展示，
        // 避免在输入框粘贴/输入新文章时残留上一篇文章的翻译结果（仅显隐，不清除缓存数据）。
        function inputMatchesParsed() {
            const el = document.getElementById('articleInput');
            const input = el ? String(el.value || '').trim() : '';
            if (!input) return false;
            const parsed = (window.CacheManager && typeof window.CacheManager.getOriginalText === 'function')
                ? String(window.CacheManager.getOriginalText() || '').trim() : '';
            return input === parsed;
        }

        // 将 AI 返回的翻译段对齐到原文句子数：
        // 模型偶会过度拆分（把一句译文里的分句当多条）或多拆成多于句数的片段。
        // 这里采用「顺序归并」：保持片段原有先后顺序，多余片段并入靠后的句子，
        // 而不是按原文分号/冒号猜测并轮转分散——后者会把不同句子的译文打散串到错误句子（跨句错位）。
        // 段数不足时不做编造，原样返回由上层告警。
        function alignTranslationsToSentences(translations, sentences) {
            const m = sentences.length;
            if (m === 0 || translations.length === m) return translations;
            if (translations.length < m) return translations; // 段数不足：不补全、不编造
            // 段数多于句数：保留前 m 条，多余片段按顺序并入靠后的句子，杜绝跨句串句
            const result = translations.slice(0, m);
            const leftover = translations.slice(m);
            let idx = m - leftover.length;
            for (let j = 0; j < leftover.length; j++) {
                result[idx + j] = (result[idx + j] || '') + '；' + leftover[j];
            }
            return result;
        }

        function init() {
            translationArea = document.getElementById('fullTranslationArea');
            translationTextSpan = document.getElementById('fullTranslationText');
            if (window.CacheManager) {
                const cached = window.CacheManager.getFullTranslation();
                if (cached) {
                    currentTranslation = cached;
                    renderNumberedTranslation(cached);
                    // 自愈：用缓存全译按行回填逐句翻译缓存，修复“全译在、逐句空”的历史遗留不一致状态
                    //（仅当输入与已解析原文一致时执行，避免把旧文翻译写到当前句子上；
                    //  且仅当行数与句子数一致时才回填——数量不一致说明缓存全译本身不可靠/已串句，
                    //  回填会污染逐句缓存，此时跳过并留待用户重新点“全文翻译”刷新。）
                    if (inputMatchesParsed() && window.CacheManager
                        && typeof window.CacheManager.batchSetSentenceCache === 'function') {
                        const lines = String(cached).split('\n').map(s => s.trim()).filter(s => s.length > 0);
                        const sents = window.CacheManager.getSentences() || [];
                        if (lines.length > 0 && lines.length === sents.length) {
                            window.CacheManager.batchSetSentenceCache(
                                lines.map((line, i) => ({ idx: i, type: 'translation', data: line })));
                        }
                    }
                    // 输入框为空或不匹配已解析原文时不自动显示（缓存数据保留，待输入原文一致后经 input 监听恢复显示）
                    if (translationArea) translationArea.style.display = inputMatchesParsed() ? 'block' : 'none';
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
                    let displayTranslation = rawTranslation;
                    let sentenceTranslations = [];

                    // requestFullTranslation 已将模型输出归一为「每条翻译一行」的纯文本。
                    // 优先按行直接对应：行数 == 原文句子数时说明模型按契约逐句输出，
                    // 直接逐行对应即可，避免二次切分（长句译文里的分号/句号被误切）再归并导致的错位。
                    const lines = String(rawTranslation || '').split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    const alignedSentences = window.CacheManager ? window.CacheManager.getSentences() : [];
                    if (alignedSentences.length > 0 && lines.length === alignedSentences.length) {
                        sentenceTranslations = lines;
                    } else if (alignedSentences.length > 0 && lines.length < alignedSentences.length) {
                        // 段数不足（模型把多句译文合并进同一条）：在句子边界处保守补切，
                        // 仅按句末标点（。！？）/分号/换行切分，绝不按中文逗号（句内标点）切分
                        const finer = [];
                        lines.forEach(line => {
                            line.split(/(?<=[。！？])|[\n;；]+/).forEach(seg => {
                                const t = seg.trim();
                                if (t) finer.push(t);
                            });
                        });
                        sentenceTranslations = finer.length > lines.length ? finer : lines;
                    } else {
                        // 段数等于或多于句数：保持顺序直接使用，交由下方对齐做顺序归并
                        sentenceTranslations = lines;
                    }

                    // 统一对齐到原文句子数：数量不一致时按顺序归并（不轮转分散），保证
                    // 编号列表与逐句翻译和句子卡片对齐，杜绝跨句串句错位
                    if (alignedSentences.length > 0 && sentenceTranslations.length > 0
                        && sentenceTranslations.length !== alignedSentences.length) {
                        sentenceTranslations = alignTranslationsToSentences(sentenceTranslations, alignedSentences);
                    }
                    if (sentenceTranslations.length > 0) {
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

        // 输入框内容变化时联动翻译区显隐：
        // 仅当输入与「已解析原文」一致且已有缓存翻译时才恢复显示，
        // 空/未解析/已换成新文章 → 隐藏，防止残留上一篇文章的翻译结果
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'articleInput') {
                if (translationArea) {
                    translationArea.style.display =
                        (inputMatchesParsed() && currentTranslation) ? 'block' : 'none';
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