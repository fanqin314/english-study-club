// 词性按钮.js - 处理句子卡片上词性按钮的点击事件

(function() {
    ModuleRegistry.register('PosButton', ['Security', 'ErrorHandler', 'Performance', 'BaseAnalysisButton', 'GlobalManager'], function(Security, ErrorHandler, Performance, BaseAnalysisButton, GlobalManager) {
        
        // 当前打开的气泡引用
        let currentBubble = null;
        // 当前高亮的单词信息（用于关闭气泡时清除高亮）
        let currentHighlightInfo = {
            sentenceIndex: null,
            word: null,
            pos: null
        };
        
        /**
         * 清除当前高亮状态（仅清除点击高亮，保留全局高亮）
         */
        function clearCurrentHighlight() {
            if (currentHighlightInfo.sentenceIndex !== null && window.DIContainer) {
                try {
                    const highlightService = window.DIContainer.resolve('HighlightService');
                    // 使用新方法仅清除点击高亮，避免影响全局高亮
                    if (highlightService && typeof highlightService.clearWordClickHighlight === 'function') {
                        highlightService.clearWordClickHighlight(currentHighlightInfo.sentenceIndex);
                    }
                } catch (e) {
                    console.warn('[PosButton] 清除高亮失败:', e);
                }
            }
            // 重置状态
            currentHighlightInfo = {
                sentenceIndex: null,
                word: null,
                pos: null
            };
        }
        
        // 打开添加单词气泡
        function openAddWordBubble(word, pos, meaning, targetElement) {
            // 关闭已存在的气泡（会自动清除之前的高亮）
            closeCurrentBubble();
            
            // 从点击的元素向上遍历找到句子卡片，获取正确的句子索引
            let sentenceIndex = null;
            const card = targetElement.closest('.sentence-card');
            if (card) {
                // 从卡片的 data-index 属性获取句子索引
                sentenceIndex = parseInt(card.dataset.index);
            }
            
            // 备用方案：从面板ID获取（兼容旧版）
            if (sentenceIndex === null || isNaN(sentenceIndex)) {
                const panel = targetElement.closest('.detail-panel');
                if (panel) {
                    const match = panel.id.match(/-panel-(\d+)/);
                    if (match) {
                        sentenceIndex = parseInt(match[1]);
                    }
                }
            }
            
            // 保存当前高亮信息
            currentHighlightInfo = {
                sentenceIndex: sentenceIndex,
                word: word,
                pos: pos
            };
            
            // 设置单词高亮（与气泡出现同步）
            if (sentenceIndex !== null && window.DIContainer) {
                try {
                    const highlightService = window.DIContainer.resolve('HighlightService');
                    if (highlightService && typeof highlightService.highlightWordInSentence === 'function') {
                        highlightService.highlightWordInSentence(sentenceIndex, word, pos);
                    }
                } catch (e) {
                    console.warn('[PosButton] 设置高亮失败:', e);
                }
            }
            
            // 在右侧词性列表中高亮对应单词并触发右键菜单效果
            if (sentenceIndex !== null) {
                highlightPosBadge(word, sentenceIndex);
                triggerPosBadgeContextMenu(word, sentenceIndex);
            }
            
            // 获取所有生词本
            const vocabData = GlobalManager.getGlobalObject('VocabData');
            const notebooks = vocabData ? vocabData.getAllNotebooks() : {};
            
            // 创建气泡元素
            const bubble = document.createElement('div');
            bubble.className = 'word-bubble';
            bubble.id = 'addWordBubble';
            
            // 构建气泡内容（安全方式）
            const bubbleHTML = `
                <div class="bubble-arrow"></div>
                <div class="bubble-inner">
                    <div class="bubble-title">添加到生词本</div>
                    <div class="bubble-notebooks">
                        ${Object.entries(notebooks).map(([id, nb]) => `
                            <button class="bubble-nb-btn" data-id="${Security.escapeHtml(id)}" data-name="${Security.escapeHtml(nb.name)}">${Security.escapeHtml(nb.name)}</button>
                        `).join('')}
                    </div>
                    <div class="bubble-new-link-container">
                        <div class="bubble-new-link" id="bubbleNewNotebookLink">新建生词本 <svg class="bubble-arrow-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>
                        <div class="bubble-new-form" id="bubbleNewNotebookForm">
                            <input type="text" id="newNotebookName" class="bubble-new-input" placeholder="生词本名称">
                            <div class="bubble-new-actions">
                                <button class="bubble-new-create-btn">创建并添加</button>
                                <button class="bubble-new-cancel-btn">取消</button>
                            </div>
                            <div class="bubble-new-error" id="bubbleNewNotebookError" style="display: none;"></div>
                        </div>
                    </div>
                </div>
            `;
            
            // 设置气泡HTML（使用安全方法）
            Security.safeSetInnerHTML(bubble, bubbleHTML);
            
            // 添加到body
            document.body.appendChild(bubble);
            currentBubble = bubble;
            
            // 计算位置
            positionBubble(bubble, targetElement);
            
            // 绑定关闭事件
            bindCloseEvents(bubble);
            
            // 绑定生词本按钮事件
            const nbButtons = bubble.querySelectorAll('.bubble-nb-btn');
            nbButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const notebookId = btn.dataset.id;
                    const notebookName = btn.dataset.name;
                    handleAddToNotebook(notebookId, notebookName, word, pos, meaning, btn, bubble);
                });
            });
            
            // 绑定新建生词本链接事件
            const newLink = bubble.querySelector('#bubbleNewNotebookLink');
            const newForm = bubble.querySelector('#bubbleNewNotebookForm');
            const newInput = bubble.querySelector('#newNotebookName');
            const createBtn = bubble.querySelector('.bubble-new-create-btn');
            const cancelBtn = bubble.querySelector('.bubble-new-cancel-btn');
            const errorDiv = bubble.querySelector('#bubbleNewNotebookError');
            
            // 切换表单显示/隐藏
            newLink.addEventListener('click', (e) => {
                e.stopPropagation();
                const arrowIcon = newLink.querySelector('.bubble-arrow-icon');
                if (newForm.classList.contains('collapsed')) {
                    // 收起表单
                    newForm.classList.remove('collapsed');
                    // 显示下箭头
                    if (arrowIcon) {
                        arrowIcon.style.transform = 'rotate(0deg)';
                    }
                } else {
                    // 展开表单
                    newForm.classList.add('collapsed');
                    // 下次展开时清空输入框
                    if (!newInput.value) {
                        newInput.value = '';
                    }
                    errorDiv.style.display = 'none';
                    // 显示下箭头
                    if (arrowIcon) {
                        arrowIcon.style.transform = 'rotate(180deg)';
                    }
                }
            });
            
            // 取消按钮事件
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                newForm.classList.remove('collapsed');
                // 显示上箭头
                const arrowIcon = newLink.querySelector('.bubble-arrow-icon');
                if (arrowIcon) {
                    arrowIcon.style.transform = 'rotate(0deg)';
                }
            });
            
            // 创建并添加按钮事件
            createBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = newInput.value.trim();
                
                // 验证输入
                if (!name) {
                    errorDiv.textContent = '请输入生词本名称';
                    errorDiv.style.display = 'block';
                    return;
                }
                
                // 检查是否重名
                const vocabData = GlobalManager.getGlobalObject('VocabData');
                const notebooks = vocabData.getAllNotebooks();
                const exists = Object.values(notebooks).some(nb => nb.name === name);
                if (exists) {
                    errorDiv.textContent = '生词本名称已存在';
                    errorDiv.style.display = 'block';
                    return;
                }
                
                // 创建生词本
                const result = vocabData.createNotebook(name);
                if (result.success) {
                    // 获取新创建的生词本ID
                    const newNotebooks = vocabData.getAllNotebooks();
                    const newNotebookId = Object.keys(newNotebooks).find(id => newNotebooks[id].name === name);
                    
                    if (newNotebookId) {
                        // 自动添加单词
                        const addResult = vocabData.addWord(newNotebookId, {
                            word: word,
                            pos: pos,
                            meaning: meaning,
                            context: '',
                            timestamp: Date.now()
                        });
                        
                        if (addResult.success) {
                            showToast(`已创建生词本"${name}"并添加单词`);
                            setTimeout(() => {
                                closeCurrentBubble();
                            }, 600);
                        } else {
                            errorDiv.textContent = addResult.error;
                            errorDiv.style.display = 'block';
                        }
                    }
                } else {
                    errorDiv.textContent = result.error;
                    errorDiv.style.display = 'block';
                }
            });
        }
        
        // 定位气泡
        function positionBubble(bubble, targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const bubbleRect = bubble.getBoundingClientRect();
            
            // 默认显示在单词右下方
            let left = rect.left;
            let top = rect.bottom + 8;
            
            // 检查是否超出视口右边界
            const viewportWidth = window.innerWidth;
            if (left + 260 > viewportWidth) {
                left = viewportWidth - 270;
            }
            
            // 检查是否超出视口底部
            const viewportHeight = window.innerHeight;
            const bubbleHeight = bubbleRect.height || 200;
            if (top + bubbleHeight > viewportHeight) {
                // 如果下方空间不足，显示在上方
                top = rect.top - bubbleHeight - 8;
                bubble.classList.add('bubble-top');
            }
            
            bubble.style.left = `${left + window.scrollX}px`;
            bubble.style.top = `${top + window.scrollY}px`;
        }
        
        // 绑定关闭事件
        function bindCloseEvents(bubble) {
            // 点击外部关闭
            const closeHandler = (e) => {
                if (!bubble.contains(e.target)) {
                    closeCurrentBubble();
                }
            };
            
            // ESC键关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeCurrentBubble();
                }
            };
            
            // 延迟绑定，避免立即触发
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('keydown', escHandler);
            }, 10);
            
            // 保存处理器引用以便移除
            bubble._closeHandler = closeHandler;
            bubble._escHandler = escHandler;
        }
        
        // 关闭当前气泡
        function closeCurrentBubble() {
            if (currentBubble) {
                // 移除事件监听
                if (currentBubble._closeHandler) {
                    document.removeEventListener('click', currentBubble._closeHandler);
                }
                if (currentBubble._escHandler) {
                    document.removeEventListener('keydown', currentBubble._escHandler);
                }
                // 移除元素
                currentBubble.remove();
                currentBubble = null;
            }
            
            // 清除当前单词高亮（与气泡消失逻辑同步）
            clearCurrentHighlight();
            
            // 清除右侧词性列表的蓝光高亮
            document.querySelectorAll('.pos-badge.highlighted').forEach(badge => {
                badge.classList.remove('highlighted');
                badge.style.animation = '';
            });
        }
        
        // 处理添加到生词本
        async function handleAddToNotebook(notebookId, notebookName, word, pos, meaning, btn, bubble) {
            // 检查单词是否已存在
            const vocabData = GlobalManager.getGlobalObject('VocabData');
            const notebook = vocabData.getNotebook(notebookId);
            if (notebook) {
                const exists = notebook.words.some(w => w.word.toLowerCase() === word.toLowerCase());
                if (exists) {
                    showToast('单词已存在');
                    return;
                }
            }
            
            // 按钮变蓝
            btn.style.backgroundColor = '#3b82f6';
            btn.style.color = 'white';
            
            // 添加单词
            const result = vocabData.addWord(notebookId, {
                word: word,
                pos: pos,
                meaning: meaning,
                context: '',
                timestamp: Date.now()
            });
            
            if (result.success) {
                showToast(`已添加 ${word} 到 ${notebookName}`);
                // 延迟关闭气泡
                setTimeout(() => {
                    closeCurrentBubble();
                }, 600);
            } else {
                showToast(result.error);
                // 恢复按钮样式
                btn.style.backgroundColor = '';
                btn.style.color = '';
            }
        }
        
        // 处理创建新生词本
        async function handleCreateNewNotebook(word, pos, meaning, bubble) {
            const name = prompt('请输入新生词本名称:');
            if (!name || !name.trim()) return;
            
            const trimmedName = name.trim();
            
            // 验证输入
            if (trimmedName.length > 50) {
                showToast('生词本名称过长，请使用50个字符以内');
                return;
            }
            
            // 创建生词本
            const vocabData = GlobalManager.getGlobalObject('VocabData');
            const result = vocabData.createNotebook(trimmedName);
            if (result.success) {
                showToast(`已创建生词本"${trimmedName}"`);
                
                // 获取新创建的生词本ID
                const notebooks = vocabData.getAllNotebooks();
                const newNotebookId = Object.keys(notebooks).find(id => notebooks[id].name === trimmedName);
                
                if (newNotebookId) {
                    // 直接添加到新生词本
                    const addResult = vocabData.addWord(newNotebookId, {
                        word: word,
                        pos: pos,
                        meaning: meaning,
                        context: '',
                        timestamp: Date.now()
                    });
                    
                    if (addResult.success) {
                        showToast(`已添加 ${word} 到 ${trimmedName}`);
                        setTimeout(() => {
                            closeCurrentBubble();
                        }, 600);
                    } else {
                        showToast(addResult.error);
                    }
                }
            } else {
                showToast(result.error);
            }
        }
        
        /**
         * 在右侧词性列表中高亮对应的单词
         * @param {string} word - 单词
         * @param {number} sentenceIndex - 句子索引
         */
        function highlightPosBadge(word, sentenceIndex) {
            // 清除之前的高亮
            document.querySelectorAll('.pos-badge.highlighted').forEach(badge => {
                badge.classList.remove('highlighted');
            });
            
            // 找到对应的词性面板
            const panel = document.getElementById(`pos-panel-${sentenceIndex}`);
            if (!panel) return;
            
            // 找到对应的词性标签
            const badges = panel.querySelectorAll('.pos-badge');
            badges.forEach(badge => {
                const wordSpan = badge.querySelector('span:first-child');
                if (wordSpan && wordSpan.textContent.trim().toLowerCase() === word.toLowerCase()) {
                    badge.classList.add('highlighted');
                    // 触发蓝光动画
                    badge.style.animation = 'blueGlow 0.5s ease-out';
                    setTimeout(() => {
                        badge.style.animation = '';
                    }, 500);
                }
            });
        }
        
        /**
         * 模拟右键点击词性列表项
         * @param {string} word - 单词
         * @param {number} sentenceIndex - 句子索引
         */
        function triggerPosBadgeContextMenu(word, sentenceIndex) {
            const panel = document.getElementById(`pos-panel-${sentenceIndex}`);
            if (!panel) return;
            
            const badges = panel.querySelectorAll('.pos-badge');
            badges.forEach(badge => {
                const wordSpan = badge.querySelector('span:first-child');
                if (wordSpan && wordSpan.textContent.trim().toLowerCase() === word.toLowerCase()) {
                    // 创建并触发右键菜单事件
                    const event = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        clientX: badge.getBoundingClientRect().left + 10,
                        clientY: badge.getBoundingClientRect().top + 10
                    });
                    badge.dispatchEvent(event);
                }
            });
        }
        
        /**
         * 显示提示消息
         * @param {string} msg - 消息内容
         * @param {string} type - 消息类型: 'success' | 'error' | 'warning' | 'info'
         * @param {number} duration - 显示时长(毫秒)
         */
        function showToast(msg, type = 'info', duration = 2000) {
            const toast = document.getElementById('toast');
            if (!toast) {
                // 降级处理：使用 alert
                console.warn('[PosButton] Toast 元素未找到:', msg);
                return;
            }
            
            // 设置消息内容
            toast.innerText = msg;
            
            // 设置样式
            toast.style.opacity = '1';
            toast.style.backgroundColor = type === 'error' ? '#ef4444' : 
                                          type === 'success' ? '#22c55e' : 
                                          type === 'warning' ? '#f59e0b' : '#3b82f6';
            
            // 自动隐藏
            setTimeout(() => {
                toast.style.opacity = '0';
            }, duration);
        }
        
        /**
         * 处理 API 请求错误
         * @param {Error} error - 错误对象
         * @param {string} context - 错误上下文
         */
        function handleApiError(error, context) {
            console.error(`[PosButton] ${context}:`, error);
            
            let errorMsg = '操作失败，请稍后重试';
            
            if (error.message) {
                if (error.message.includes('network') || error.message.includes('fetch')) {
                    errorMsg = '网络连接失败，请检查网络';
                } else if (error.message.includes('timeout')) {
                    errorMsg = '请求超时，请稍后重试';
                } else if (error.message.includes('API key')) {
                    errorMsg = 'API Key 无效，请检查配置';
                }
            }
            
            showToast(errorMsg, 'error', 3000);
        }
        
        class PosButton extends BaseAnalysisButton.BaseAnalysisButton {
            constructor(security, errorHandler, performance, globalManager) {
                super({
                    security,
                    errorHandler,
                    performance,
                    cacheType: 'pos',
                    typeName: '词性'
                });
                this.globalManager = globalManager;
            }

            async callApi(sentence) {
                const apiRequest = this.globalManager.getGlobalObject('APIRequest');
                return await apiRequest.requestPos(sentence);
            }

            displayInPanel(panel, data) {
                if (!panel) return;
                
                try {
                    panel.innerHTML = '';
                    
                    let posData = data;
                    if (typeof data === 'string') {
                        posData = JSON.parse(data);
                    }
                    
                    let posList = posData.pos || [];
                    
                    // 去重处理：保留第一个出现的单词
                    const seenWords = new Set();
                    posList = posList.filter(p => {
                        const word = p.word && p.word.toLowerCase();
                        if (word && seenWords.has(word)) {
                            return false;
                        }
                        if (word) {
                            seenWords.add(word);
                        }
                        return true;
                    });
                    
                    const title = document.createElement('strong');
                    title.textContent = '词性列表';
                    panel.appendChild(title);
                    
                    const contentDiv = document.createElement('div');
                    
                    if (posList.length === 0) {
                        contentDiv.textContent = '暂无数据';
                        panel.appendChild(contentDiv);
                    } else {
                        contentDiv.className = 'pos-list';
                        
                        posList.forEach(p => {
                            const badge = this.createPosBadge(p);
                            contentDiv.appendChild(badge);
                        });
                        
                        panel.appendChild(contentDiv);
                    }
                    
                    panel.classList.add('show');
                } catch (e) {
                    console.error('显示词性数据失败:', e);
                    panel.innerHTML = '<strong>词性列表</strong><div>数据格式错误</div>';
                    panel.classList.add('show');
                }
            }

            createPosBadge(p) {
                const badge = document.createElement('span');
                badge.className = 'pos-badge';
                
                const wordSpan = document.createElement('span');
                wordSpan.textContent = this.security.escapeHtml(p.word) + ' ';
                badge.appendChild(wordSpan);
                
                const posSpan = document.createElement('span');
                posSpan.style.color = '#3b82f6';
                posSpan.textContent = `[${this.security.escapeHtml(p.pos)}]`;
                badge.appendChild(posSpan);
                
                if (p.meaning) {
                    const meaningSpan = document.createElement('span');
                    meaningSpan.textContent = '· ' + this.security.escapeHtml(p.meaning);
                    badge.appendChild(meaningSpan);
                }
                
                // 添加点击事件监听器
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // 打开气泡（高亮逻辑已在 openAddWordBubble 中处理）
                    openAddWordBubble(p.word, p.pos, p.meaning || '', badge);
                });
                
                return badge;
            }
        }
        
        const posButton = new PosButton(Security, ErrorHandler, Performance, GlobalManager);
        
        window.PosButton = {
            loadAndDisplay: posButton.loadAndDisplay.bind(posButton),
            openAddWordBubble: openAddWordBubble
        };
        
        window.onLoadPos = window.PosButton.loadAndDisplay;
    });
})();