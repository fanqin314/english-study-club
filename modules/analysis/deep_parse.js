// deep_parse.js - 深度解析功能
(function() {
    ModuleRegistry.register('DeepParse', ['ErrorHandler', 'Performance', 'EventBus', 'Security'], function(ErrorHandler, Performance, EventBus, Security) {
        // 注意：不再使用模块级变量存储展开状态
        // 改为基于 DOM 查询，确保页面切换后状态正确
        
        // 防抖标志：防止连续点击触发多次异步操作
        let isToggling = false;
        const TOGGLE_DEBOUNCE_MS = 300;
        
        /**
         * 检查句子区域是否展开
         * 基于 DOM 状态而非内存变量，避免页面切换后状态不一致
         */
        function isSentencesSectionExpanded() {
            const twoColumnContainer = document.querySelector('.two-column-container');
            if (!twoColumnContainer) {
                console.warn('[isSentencesSectionExpanded] twoColumnContainer 未找到');
                return false;
            }
            const isExpanded = twoColumnContainer.classList.contains('show-right');
            console.log('[isSentencesSectionExpanded] 状态:', isExpanded, 'classes:', twoColumnContainer.className);
            return isExpanded;
        }
        
        // 搜索图标
        const SEARCH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
        
        // 向右箭头图标（收起时显示）
        const BACK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        
        // 更新解析按钮：始终保持“解析”状态（不再做折叠切换）
        function updateParseButtonIcon() {
            const parseBtn = document.getElementById('parseBtn');
            if (!parseBtn) return;
            
            const iconSpan = parseBtn.querySelector('span span:first-child');
            if (iconSpan) {
                iconSpan.innerHTML = SEARCH_ICON;
            }
            
            const textSpan = parseBtn.querySelector('span span:last-child');
            if (textSpan) {
                textSpan.textContent = '解析';
            }
        }
        
        // 切换句子区域显示状态
        function toggleSentencesSection() {
            // 防抖：如果正在执行切换操作，忽略后续点击
            if (isToggling) {
                console.log('[toggleSentencesSection] 操作进行中，忽略重复点击');
                return;
            }
            
            const twoColumnContainer = document.querySelector('.two-column-container');
            const sentencesContainer = document.getElementById('deepParseSentencesContainer');

            // 基于 DOM 状态判断，而非内存变量
            const isExpanded = isSentencesSectionExpanded();
            
            if (isExpanded) {
                // 折叠（同步操作）
                console.log('[toggleSentencesSection] 执行折叠操作');
                isToggling = true; // 设置标志防止并发
                try {
                    if (twoColumnContainer) {
                        console.log('[toggleSentencesSection] 移除 show-right, has-sentences');
                        twoColumnContainer.classList.remove('show-right', 'has-sentences');
                        const rightColumn = twoColumnContainer.querySelector('.right-column');
                        if (rightColumn) rightColumn.classList.remove('visible');
                    }
                    if (sentencesContainer) {
                        sentencesContainer.style.display = 'none';
                    }
                    updateParseButtonIcon(false);
                    console.log('[toggleSentencesSection] 折叠完成');
                } finally {
                    isToggling = false; // 同步操作完成，重置标志
                }
            } else {
                // 展开 - 需要重新解析（异步操作）
                isToggling = true;
                deepParse().then(() => {
                    // 操作成功完成
                }).catch((err) => {
                    console.error('[toggleSentencesSection] 展开失败:', err);
                    // 失败时也要重置标志
                    isToggling = false;
                    // 恢复按钮状态
                    updateParseButtonIcon(false);
                }).finally(() => {
                    // 延迟重置，确保 UI 更新完成
                    setTimeout(() => {
                        isToggling = false;
                    }, TOGGLE_DEBOUNCE_MS);
                });
            }
        }

        // 折叠图标（向上箭头：收起输入面板）
        const COLLAPSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
        
        // 展开图标（向下箭头：展开输入面板）
        const EXPAND_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

        // 切换输入面板显示状态
        function toggleInputPanel() {
            const twoColumnContainer = document.querySelector('.two-column-container');
            const toggleBtn = document.getElementById('panelToggleBtn');
            
            if (!twoColumnContainer) return;
            
            const isCollapsed = twoColumnContainer.classList.contains('collapsed');
            
            if (isCollapsed) {
                twoColumnContainer.classList.remove('collapsed');
                if (toggleBtn) {
                    toggleBtn.innerHTML = COLLAPSE_ICON;
                    toggleBtn.setAttribute('aria-label', '折叠输入面板');
                    toggleBtn.setAttribute('data-tooltip', '折叠输入面板');
                }
            } else {
                twoColumnContainer.classList.add('collapsed');
                if (toggleBtn) {
                    toggleBtn.innerHTML = EXPAND_ICON;
                    toggleBtn.setAttribute('aria-label', '展开输入面板');
                    toggleBtn.setAttribute('data-tooltip', '展开输入面板');
                }
            }
        }

        // 绑定折叠按钮事件 - 已迁移到 event_delegation.js 统一处理
        // 注意：panelToggleBtn 的点击事件由 ui/event_delegation.js 处理
        function bindCollapseButton() {
            // 按钮事件已由事件委托处理，此处无需重复绑定
            console.log('[DeepParse] panelToggleBtn 事件由 event_delegation.js 统一处理');
        }

        // 文章难度徽标（B2）：解析后本地计算 Flesch 分数并展示；数据缺失/原文空白时优雅隐藏
        function renderReadabilityBadge(text, container) {
            const badgeId = 'deepParseReadability';
            const old = document.getElementById(badgeId);
            if (old && old.parentNode) old.parentNode.removeChild(old);

            let data = null;
            const Stats = window.EnglishStudyShared && window.EnglishStudyShared.Stats;
            if (Stats && Stats.estimateReadability) {
                try { data = Stats.estimateReadability(text); } catch (e) { data = null; }
            }
            if (!data || !data.score) return;

            const parent = (container && container.parentNode) || document.getElementById('contentArea');
            if (!parent) return;

            const tone = data.score >= 60 ? '#10b981' : (data.score >= 40 ? '#f59e0b' : '#ef4444');
            const badge = document.createElement('div');
            badge.id = badgeId;
            badge.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;border:1px solid var(--study-border,#e5e7eb);border-radius:12px;background:var(--study-card,#fff);font-size:13px;color:var(--study-muted,#6b7280);line-height:1.5;';
            badge.innerHTML =
                '<span style="font-weight:600;color:var(--study-text,#1f2937)">难度 · <b style="color:' + tone + '">' + String(data.level) + '</b></span>' +
                '<span>Flesch ' + String(data.score) + '</span>' +
                '<span style="color:var(--study-accent,#2563eb);font-weight:600">' + String(data.cefr || '') + '</span>' +
                '<span style="flex:1;min-width:140px">' + String(data.advice || '') + '</span>';
            parent.insertBefore(badge, container || parent.firstChild);
        }
        
        function deepParse() {
            return ErrorHandler.wrapAsyncFunction(async function() {
                const textarea = document.getElementById('articleInput');
                if (!textarea) {
                    throw new Error('未找到文本输入框');
                }
                const text = textarea.value.trim();
                if (!text) {
                    ErrorHandler.handleValidationError('请输入文章');
                    return;
                }
                if (!window.SentenceSplitter) {
                    throw new Error('分句模块未加载，请刷新页面重试');
                }
                if (!window.SentenceRenderer) {
                    throw new Error('渲染模块未加载，请刷新页面重试');
                }
                
                const sentences = window.SentenceSplitter.split(text);
                console.log('[deepParse] 分句结果:', sentences.length);
                
                // 保存句子数据和原始文本到缓存管理器
                if (window.CacheManager) {
                    // 换文（新文章）时清除旧文章的逐句分析缓存：sentenceData 按句索引进位缓存，
                    // 换文后同索引句子会命中上一篇文章的分析数据，导致词性/语法等面板显示残留内容。
                    // 仅文本变化时清除，保证同一文章的解析结果在界面切换间得以保留。
                    if (typeof window.CacheManager.getOriginalText === 'function'
                        && window.CacheManager.getOriginalText() !== text) {
                        window.CacheManager.clearAllSentenceCache();
                    }
                    window.CacheManager.setSentences(sentences);
                    window.CacheManager.setOriginalText(text);
                }
                
                // 词典后台预热：提前把本文涉及的分片拉入内存/IndexedDB，
                // 让用户点击「词性分析」时零等待（冷启动 ~1s 转移到阅读期间，fire-and-forget）
                if (window.DictLookup && typeof window.DictLookup.warmupForText === 'function') {
                    window.DictLookup.warmupForText(text);
                }
                
                // 深度解析模式：使用新的容器
                let container = document.getElementById('deepParseSentencesContainer');
                if (!container) {
                    // 降级处理
                    container = document.getElementById('sentencesContainer');
                }
                if (container) {
                    window.SentenceRenderer.setContainer(container);
                    container.style.display = '';
                } else {
                    throw new Error('sentencesContainer 元素未找到');
                }
                window.SentenceRenderer.setSentencesData(sentences, {});
                window.SentenceRenderer.renderAll();

                // 文章难度徽标（B2）：在句子列表上方展示难度等级 + Flesch 分数 + CEFR
                renderReadabilityBadge(text, container);

                // 显示右栏（句子卡片）
                const twoColumnContainer = document.querySelector('.two-column-container');
                if (twoColumnContainer) {
                    twoColumnContainer.classList.add('show-right', 'has-sentences');
                    const rightColumn = twoColumnContainer.querySelector('.right-column');
                    if (rightColumn) rightColumn.classList.add('visible');
                }

                // 调用全文翻译
                if (window.FullTranslation) {
                    await window.FullTranslation.fetch(text);
                }
                
                // 更新按钮图标为向左箭头
                updateParseButtonIcon(true);
                
                // 绑定折叠按钮事件
                bindCollapseButton();
                
                // 不再触发 analysisCompleted 事件，避免自动保存历史记录
                // EventBus.emit('analysisCompleted', { text });
            })();
        }

        // 句子详情加载处理
        function onLoadSentenceDetail(idx, type) {
            const panel = document.getElementById(`${type}-panel-${idx}`);
            if (!panel) {
                console.error(`面板 ${type}-panel-${idx} 未找到`);
                return;
            }
            
            // 触发 EventBus 事件
            if (typeof EventBus !== 'undefined' && EventBus && EventBus.emit) {
                EventBus.emit('loadSentenceDetail', { idx, type, panel });
            }
        }

        // 导出全局接口（保持向后兼容）
        window.deepParse = deepParse;
        window.toggleSentencesSection = toggleSentencesSection;
        window.toggleInputPanel = toggleInputPanel;
        window.onLoadSentenceDetail = onLoadSentenceDetail;

        // 监听分析模式切换事件，重新绑定按钮事件
        if (typeof EventBus !== 'undefined' && EventBus && EventBus.on) {
            EventBus.on('showAnalysisMode', function() {
                // 延迟确保 DOM 已更新
                setTimeout(function() {
                    bindCollapseButton();
                }, 50);
            });
        }

        return {
            deepParse,
            toggleSentencesSection,
            toggleInputPanel,
            onLoadSentenceDetail
        };
    });
})();