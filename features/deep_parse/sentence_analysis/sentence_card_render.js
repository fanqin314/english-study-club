// sentence_card_render.js - 句子卡片渲染
(function() {
    ModuleRegistry.register('SentenceRenderer', ['Security', 'Performance'], function(Security, Performance) {
        let sentences = [];
        let sentenceData = {};
        let sentencesContainer = null;
        let virtualScrollInstance = null;
        let isDestroyed = false;
        
        /**
         * 清理虚拟滚动实例，防止内存泄漏
         */
        function cleanupVirtualScroll() {
            if (virtualScrollInstance) {
                // 调用销毁方法
                if (typeof virtualScrollInstance.destroy === 'function') {
                    virtualScrollInstance.destroy();
                }
                // 移除引用
                virtualScrollInstance = null;
            }
        }

        function setSentencesData(sentencesArray, dataObject) {
            sentences = sentencesArray;
            sentenceData = dataObject;
            console.log('[render] 句子数据已设置', sentences.length);
        }

        function getSentencesData() {
            return { sentences, sentenceData };
        }

        // 预加载所有句子的AI分析数据
        async function preloadAllSentenceData() {
            if (!window.APIRequest || sentences.length === 0) return;
            
            console.log('[render] 开始预加载句子数据...');
            const startTime = Date.now();
            
            // 分批预加载，每批3句，避免请求过多
            const batchSize = 3;
            const totalSentences = sentences.length;
            
            for (let i = 0; i < totalSentences; i += batchSize) {
                const batch = sentences.slice(i, Math.min(i + batchSize, totalSentences));
                const batchPromises = [];
                
                batch.forEach((sentence, offset) => {
                    const sentenceIndex = i + offset;
                    // 并行请求四种分析类型
                    batchPromises.push(
                        Promise.all([
                            window.APIRequest.requestPos(sentence),
                            window.APIRequest.requestSyntax(sentence),
                            window.APIRequest.requestKnowledge(sentence),
                            window.APIRequest.requestTranslation(sentence)
                        ]).then(() => {
                            console.log(`[render] 句子 ${sentenceIndex + 1} 预加载完成`);
                        }).catch(err => {
                            console.warn(`[render] 句子 ${sentenceIndex + 1} 预加载失败:`, err);
                        })
                    );
                });
                
                await Promise.all(batchPromises);
                
                // 批次之间添加短暂延迟
                if (i + batchSize < totalSentences) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            const duration = Date.now() - startTime;
            console.log(`[render] 预加载完成，耗时 ${duration}ms`);
        }

        function setContainer(container) {
            // 优先使用二级分析界面的容器
            const secondaryAnalysisContainer = document.getElementById('secondaryAnalysisContainer');
            const secondaryContainer = document.getElementById('secondarySentencesContainer');
            if (secondaryAnalysisContainer && secondaryAnalysisContainer.style.display !== 'none' && secondaryContainer) {
                sentencesContainer = secondaryContainer;
                console.log('[render] 容器已设置为二级分析界面容器', secondaryContainer);
            } else {
                sentencesContainer = container;
                console.log('[render] 容器已设置', container);
            }
        }

        function renderAll() {
            // 优先使用二级分析界面的容器
            const secondaryAnalysisContainer = document.getElementById('secondaryAnalysisContainer');
            const secondaryContainer = document.getElementById('secondarySentencesContainer');
            if (secondaryAnalysisContainer && secondaryAnalysisContainer.style.display !== 'none' && secondaryContainer) {
                sentencesContainer = secondaryContainer;
            }
            
            if (!sentencesContainer) {
                console.error('[render] 容器未设置，无法渲染');
                return;
            }
            if (!sentences.length) {
                sentencesContainer.innerHTML = '<div class="card"><div class="card-body">暂无句子，请粘贴文章并点击"解析"。</div></div>';
                return;
            }
            
            // 渲染前清理之前的虚拟滚动实例，防止内存泄漏
            cleanupVirtualScroll();
            
            Performance.trackDOMUpdate();
            
            // 对于大量句子，使用虚拟滚动
            if (sentences.length > 20) {
                renderWithVirtualScroll();
            } else {
                // 对于少量句子，使用常规渲染
                renderWithFragment();
            }
        }

        function renderWithFragment() {
            // 使用文档片段批量更新DOM
            const fragment = document.createDocumentFragment();
            sentences.forEach((sentence, idx) => {
                const card = createSentenceCard(sentence, idx);
                fragment.appendChild(card);
            });
            sentencesContainer.innerHTML = '';
            sentencesContainer.appendChild(fragment);
            
            console.log('[render] 常规渲染完成，共', sentences.length, '句');
        }

        function renderWithVirtualScroll() {
            // 清理之前的虚拟滚动实例（已在 renderAll 中调用，此处为保险起见）
            cleanupVirtualScroll();
            
            // 重置容器样式
            sentencesContainer.style.height = '600px';
            sentencesContainer.style.overflow = 'auto';
            sentencesContainer.style.position = 'relative';
            
            // 卡片高度（估计值）
            const cardHeight = 180;
            
            // 创建虚拟滚动
            virtualScrollInstance = Performance.createVirtualScroll(
                sentencesContainer,
                cardHeight,
                (index) => {
                    // 仅当容器已被销毁时跳过；注意：实例赋值完成前本回调也会被同步调用，
                    // 因此不能以 !virtualScrollInstance 作为判空条件，否则会返回 null 导致崩溃。
                    if (isDestroyed) {
                        return null;
                    }
                    return createSentenceCard(sentences[index], index);
                },
                sentences.length
            );
            
            console.log('[render] 虚拟滚动渲染完成，共', sentences.length, '句');
        }

        function createSentenceCard(sentence, idx) {
            const card = document.createElement('article');
            card.className = 'sentence-card';
            card.dataset.index = idx;
            
            const originalDiv = document.createElement('div');
            originalDiv.className = 'sentence-text';
            originalDiv.id = `sentence-${idx}`;
            const words = sentence.split(/(\s+)/).map(part => part.trim() ? part : ' ');
            originalDiv.innerHTML = words.map(part => {
                if (part.trim() === '') return ' ';
                const wordClean = part.replace(/[^\w']/g, '');
                return `<span class="word-span" data-word="${Security.escapeHtml(wordClean)}">${Security.escapeHtml(part)}</span>`;
            }).join('');
            card.appendChild(originalDiv);
            
            const btnGroup = document.createElement('nav');
            btnGroup.className = 'sentence-buttons';
            const buttons = [
                { type: 'pos', text: '词性', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" /></svg>' },
                { type: 'syntax', text: '语法结构', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
                { type: 'knowledge', text: '知识点', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4v3h-4z" /><path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4.5 3 5.5v1h6v-1c1.5-1 3-3 3-5.5a6 6 0 0 0-6-6z" /></svg>' },
                { type: 'translation', text: '翻译', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' }
            ];
            
            // 按钮点击处理函数 - 优化版本：减少DOM操作
                function handleButtonClick(clickedButton) {
                    const type = clickedButton.dataset.type;
                    const sentenceIndex = idx;
                    const isCurrentlyActive = clickedButton.classList.contains('active');
                    
                    // 快速路径：点击已激活按钮，直接折叠
                    if (isCurrentlyActive) {
                        clickedButton.classList.remove('active');
                        clickedButton.style.background = '';
                        clickedButton.style.color = '';
                        const panel = document.getElementById(`${type}-panel-${sentenceIndex}`);
                        if (panel) panel.classList.remove('show');
                        return;
                    }
                    
                    // 优化：只更新必要的按钮和面板，而非遍历所有
                    const activeBtn = btnGroup.querySelector('button.active');
                    if (activeBtn && activeBtn !== clickedButton) {
                        // 重置之前激活的按钮
                        activeBtn.classList.remove('active');
                        activeBtn.style.background = '';
                        activeBtn.style.color = '';
                        // 隐藏之前的面板
                        const activePanel = document.getElementById(`${activeBtn.dataset.type}-panel-${sentenceIndex}`);
                        if (activePanel) activePanel.classList.remove('show');
                    }
                    
                    // 设置当前按钮为激活状态
                    clickedButton.classList.add('active');
                    clickedButton.style.background = 'var(--accent)';
                    clickedButton.style.color = 'white';
                    
                    // 显示当前面板
                    const panel = document.getElementById(`${type}-panel-${sentenceIndex}`);
                    if (panel) {
                        panel.innerHTML = '<div class="loading">加载中...</div>';
                        panel.classList.add('show');
                    }
                    
                    // 通过 EventBus 触发事件
                    if (typeof EventBus !== 'undefined' && EventBus && EventBus.emit) {
                        EventBus.emit('loadSentenceDetail', { idx: sentenceIndex, type, panel });
                    }
                }
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.dataset.type = btn.type;
                button.dataset.index = idx;
                
                // 创建图标和文本容器
                const buttonContent = document.createElement('span');
                buttonContent.style.display = 'flex';
                buttonContent.style.alignItems = 'center';
                buttonContent.style.gap = '6px';
                
                // 添加图标
                if (btn.icon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.innerHTML = btn.icon;
                    buttonContent.appendChild(iconSpan);
                }
                
                // 添加文本
                const textSpan = document.createElement('span');
                textSpan.textContent = btn.text;
                buttonContent.appendChild(textSpan);
                
                button.appendChild(buttonContent);
                button.ariaLabel = btn.text;
                
                // 使用性能优化的事件监听器
                Performance.addEventListener(button, 'click', () => handleButtonClick(button));
                btnGroup.appendChild(button);
            });
            
            // 刷新按钮放在 nav 容器内的其他按钮后面
            const refreshButton = document.createElement('button');
            refreshButton.className = 'refresh-button';
            refreshButton.title = '重新解析该句所有数据';
            refreshButton.ariaLabel = '重新解析该句';
            refreshButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>`;
            Performance.addEventListener(refreshButton, 'click', () => {
                // 添加旋转动画
                refreshButton.classList.add('spin');
                setTimeout(() => {
                    refreshButton.classList.remove('spin');
                }, 600);
                if (window.onRefreshSentence) window.onRefreshSentence(idx);
            });
            btnGroup.appendChild(refreshButton);
            
            card.appendChild(btnGroup);
            
            const panels = ['pos', 'syntax', 'knowledge', 'translation'];
            panels.forEach(type => {
                const panel = document.createElement('div');
                panel.className = 'detail-panel';
                panel.id = `${type}-panel-${idx}`;
                card.appendChild(panel);
            });
            return card;
        }

        // 导出全局接口（保持向后兼容）
        window.SentenceRenderer = {
            setContainer,
            setSentencesData,
            getSentencesData,
            renderAll,
            preloadAllSentenceData
        };
        console.log('[render] 模块已加载，window.SentenceRenderer 已设置');

        return {
            setContainer,
            setSentencesData,
            getSentencesData,
            renderAll,
            preloadAllSentenceData
        };
    });
})();