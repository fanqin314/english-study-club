// history_ui.js - 历史记录界面的HTML渲染和交互
(function() {
    ModuleRegistry.register('HistoryUI', ['GlobalManager'], function(GlobalManager) {
        let currentContainer = null;
        let sentencesContainer = null;
        let historyListContainer = null;
        
        // 获取HistoryManager实例（支持多种方式）
        function getHistoryManager() {
            // 优先从GlobalManager获取
            const fromGlobal = GlobalManager.getGlobalObject('HistoryManager');
            if (fromGlobal) return fromGlobal;
            
            // 其次从window直接获取
            if (window.HistoryManager) return window.HistoryManager;
            
            return null;
        }
        
        // 获取HistoryModule实例
        function getHistoryModule() {
            return ModuleRegistry.get('HistoryModule');
        }
    
    // 显示历史记录界面
    function showHistoryInterface(container, sentencesCont) {
        currentContainer = container;
        sentencesContainer = sentencesCont;
        
        if (!currentContainer) {
            console.warn('showHistoryInterface: 容器为空');
            return;
        }
        
        // 隐藏句子容器
        if (sentencesContainer) {
            sentencesContainer.style.display = 'none';
        }
        
        // 移除已存在的历史记录界面
        const existing = document.getElementById('historyInterface');
        if (existing) existing.remove();
        
        // 创建历史记录界面容器
        const historyDiv = document.createElement('div');
        historyDiv.id = 'historyInterface';
        historyDiv.className = 'history-card';
        
        currentContainer.insertBefore(historyDiv, sentencesContainer);
        
        // 渲染界面
        renderHistoryUI(historyDiv);
    }
    
    // 渲染历史记录界面
    function renderHistoryUI(container) {
        container.innerHTML = '';
        
        // 头部
        const header = document.createElement('div');
        header.className = 'history-header';
        
        const title = document.createElement('h3');
        title.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: -5px; margin-bottom: -5px; margin-left: 2px; margin-right: 2px;">
   <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
   <line x1="16" y1="2" x2="16" y2="6" />
   <line x1="8" y1="2" x2="8" y2="6" />
   <line x1="3" y1="10" x2="21" y2="10" />
 </svg> 历史记录`;
        header.appendChild(title);
        
        // 统计信息
        const statsDiv = document.createElement('div');
        statsDiv.className = 'history-stats';
        
        // 获取历史记录数量（支持多种数据源）
        const historyManager = getHistoryManager();
        const historyModule = getHistoryModule();
        let historyCount = 0;
        
        if (historyManager) {
            historyCount = historyManager.getHistory().length;
        } else if (historyModule) {
            historyCount = historyModule.getHistory().length;
        }
        
        statsDiv.innerHTML = `<span>${historyCount} 条记录</span>`;
        header.appendChild(statsDiv);
        container.appendChild(header);
        
        // 清空历史记录按钮
        const clearBtn = document.createElement('button');
        clearBtn.className = 'button';
        clearBtn.innerHTML = `
            <svg class="svgIcon" viewBox="0 0 24 24">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path>
            </svg>
        `;
        clearBtn.title = '清空历史记录';
        clearBtn.addEventListener('click', handleClearHistory);
        header.appendChild(clearBtn);
        
        // 历史记录列表区域
        historyListContainer = document.createElement('div');
        historyListContainer.id = 'historyList';
        
        // 使用事件委托处理点击事件
        historyListContainer.addEventListener('click', handleHistoryListClick);
        
        container.appendChild(historyListContainer);
        
        // 渲染历史记录列表
        renderHistoryList(historyListContainer);
    }
    
    // 渲染历史记录列表
    function renderHistoryList(container) {
        // 优先使用 HistoryManager 获取完整的历史记录数据
        let history = [];
        const historyManager = getHistoryManager();
        
        if (historyManager) {
            try {
                history = historyManager.getHistory();
            } catch (e) {
                console.error('从 HistoryManager 获取历史记录失败:', e);
            }
        } else {
            const historyModule = getHistoryModule();
            history = historyModule ? historyModule.getHistory() : [];
        }
        
        if (history.length === 0) {
            container.innerHTML = renderEmptyState('暂无历史记录', '完成分析后，结果将自动保存到历史记录中');
            return;
        }
        
        container.innerHTML = '';
        
        history.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            // 使用 data 属性存储数据，而不是硬绑定事件
            div.dataset.historyId = item.id;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'history-content';
            
            // 英文原文
            const textP = document.createElement('p');
            textP.className = 'history-text';
            textP.innerText = item.originalText || item.text;
            contentDiv.appendChild(textP);
            
            // 时间戳
            const timestampP = document.createElement('p');
            timestampP.className = 'history-timestamp';
            timestampP.innerText = formatTimestamp(item.id || item.timestamp);
            contentDiv.appendChild(timestampP);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-delete-btn';
            deleteBtn.innerHTML = `
                <svg class="svgIcon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path>
                </svg>
            `;
            deleteBtn.title = '删除记录';
            // 删除按钮不硬绑定事件，通过事件委托处理
            
            // 创建按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            buttonContainer.appendChild(deleteBtn);
            
            // 设置指针样式（不硬绑定点击事件）
            div.style.cursor = 'pointer';
            
            div.appendChild(contentDiv);
            div.appendChild(buttonContainer);
            container.appendChild(div);
        });
    }
    
    // 事件委托：处理历史列表点击
    function handleHistoryListClick(e) {
        const target = e.target;
        
        // 检查是否点击了删除按钮
        const deleteBtn = target.closest('.history-delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            handleDeleteHistory(e);
            return;
        }
        
        // 检查是否点击了历史记录项
        const historyItem = target.closest('.history-item');
        if (historyItem) {
            handleHistoryItemClick(historyItem);
        }
    }
    
    // 处理历史记录项点击
    function handleHistoryItemClick(historyItem) {
        const historyId = historyItem.dataset.historyId;
        if (!historyId) return;
        
        // 获取完整的历史记录数据
        const historyManager = getHistoryManager();
        let historyItemData = null;
        
        if (historyManager) {
            const history = historyManager.getHistory();
            historyItemData = history.find(item => item.id === historyId);
        }
        
        if (!historyItemData) {
            showToast('无法获取历史记录数据');
            return;
        }
        
        // 加载历史数据到主分析界面
        loadHistoryToAnalysisView(historyItemData);
    }
    
    // 加载历史记录到二级分析界面
    function loadHistoryToAnalysisView(historyItemData) {
        // 1. 填充数据到 CacheManager
        if (window.CacheManager) {
            window.CacheManager.setSentences(historyItemData.sentences || []);
            window.CacheManager.setOriginalText(historyItemData.originalText || '');
            
            // 恢复每个句子的解析缓存
            if (historyItemData.sentenceData) {
                for (let idx in historyItemData.sentenceData) {
                    const sentData = historyItemData.sentenceData[idx];
                    for (let type in sentData) {
                        window.CacheManager.setSentenceCache(parseInt(idx), type, sentData[type]);
                    }
                }
            }
            
            // 恢复全文翻译
            if (historyItemData.fullTranslation) {
                window.CacheManager.setFullTranslation(historyItemData.fullTranslation);
            }
        }
        
        // 2. 隐藏主界面元素，显示二级分析容器
        const header = document.getElementById('app-header');
        if (header) header.style.display = 'none';
        
        const deepParseSection = document.getElementById('deep-parse-section');
        if (deepParseSection) deepParseSection.style.display = 'none';
        
        const contentSection = document.getElementById('content-section');
        if (contentSection) contentSection.style.display = 'none';
        
        const secondaryContainer = document.getElementById('secondaryAnalysisContainer');
        if (secondaryContainer) secondaryContainer.style.display = 'block';
        
        // 3. 填充原文和翻译
        const originalTextContent = document.getElementById('originalTextContent');
        if (originalTextContent && historyItemData.originalText) {
            originalTextContent.textContent = historyItemData.originalText;
        }
        
        const secondaryFullTranslationText = document.getElementById('secondaryFullTranslationText');
        if (secondaryFullTranslationText && historyItemData.fullTranslation) {
            secondaryFullTranslationText.textContent = historyItemData.fullTranslation;
        }
        
        // 4. 使用 SentenceRenderer 渲染句子到二级容器
        const sentences = historyItemData.sentences || [];
        const sentenceData = historyItemData.sentenceData || {};
        const secondarySentencesContainer = document.getElementById('secondarySentencesContainer');
        
        if (secondarySentencesContainer && sentences.length > 0 && window.SentenceRenderer) {
            window.SentenceRenderer.setContainer(secondarySentencesContainer);
            window.SentenceRenderer.setSentencesData(sentences, sentenceData);
            window.SentenceRenderer.renderAll();
        }
        
        // 5. 绑定二级界面的返回按钮
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.onclick = function() {
                // 清除 CacheManager 中的历史数据，避免影响深度解析界面
                if (window.CacheManager) {
                    window.CacheManager.setSentences([]);
                    window.CacheManager.setOriginalText('');
                    window.CacheManager.setFullTranslation('');
                    window.CacheManager.resetAllCache();
                }
                const header = document.getElementById('app-header');
                if (header) header.style.display = '';
                const secondaryContainer = document.getElementById('secondaryAnalysisContainer');
                if (secondaryContainer) secondaryContainer.style.display = 'none';
                const deepParseSection = document.getElementById('deep-parse-section');
                if (deepParseSection) deepParseSection.style.display = '';
                const contentSection = document.getElementById('content-section');
                if (contentSection) contentSection.style.display = '';
                if (window.MainButtonManager && window.MainButtonManager.switchMode) {
                    window.MainButtonManager.switchMode('history');
                }
            };
        }
        
        // 6. 绑定折叠按钮
        const collapseBtn = document.getElementById('collapseInfoBtn');
        if (collapseBtn) {
            collapseBtn.onclick = function() {
                const container = document.getElementById('secondaryAnalysisContainer');
                if (container) {
                    container.classList.toggle('collapsed');
                    collapseBtn.classList.toggle('collapsed');
                }
            };
        }
        
        showToast('已加载历史分析记录');
    }
    
    // 处理删除历史记录
    function handleDeleteHistory(e) {
        const deleteBtn = e.target.closest('.history-delete-btn');
        if (!deleteBtn) return;
        
        const historyItem = deleteBtn.closest('.history-item');
        if (!historyItem) return;
        
        const historyId = historyItem.dataset.historyId;
        if (!historyId) {
            showToast('无法获取记录ID');
            return;
        }
        
        if (confirm('确定删除这条历史记录吗？')) {
            const historyManager = getHistoryManager();
            
            if (historyManager && historyManager.deleteHistoryItem) {
                try {
                    const success = historyManager.deleteHistoryItem(historyId);
                    if (success) {
                        renderHistoryList(historyListContainer);
                        showToast('历史记录已删除');
                    } else {
                        showToast('删除失败，请重试');
                    }
                } catch (e) {
                    console.error('删除历史记录失败:', e);
                    showToast('删除失败: ' + e.message);
                }
            } else {
                showToast('无法删除：历史记录管理器未初始化');
            }
        }
    }
    
    // 处理清空历史记录
    function handleClearHistory() {
        if (confirm('确定清空所有历史记录吗？')) {
            const historyManager = getHistoryManager();
            const historyModule = getHistoryModule();
            
            try {
                if (historyManager && historyManager.clearHistory) {
                    historyManager.clearHistory();
                } else if (historyModule) {
                    historyModule.clearHistory();
                }
                
                const historyDiv = document.getElementById('historyInterface');
                if (historyDiv) {
                    renderHistoryUI(historyDiv);
                }
                showToast('历史记录已清空');
            } catch (e) {
                console.error('清空历史记录失败:', e);
                showToast('清空失败: ' + e.message);
            }
        }
    }
    
    // 格式化时间戳
    function formatTimestamp(timestamp) {
        const date = new Date(Number(timestamp));
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // 渲染空状态
    function renderEmptyState(title, subtitle = '') {
        return `
            <div class="empty-state">
                <div class="empty-icon">📖</div>
                <div class="empty-title">${title}</div>
                ${subtitle ? `<div class="empty-subtitle">${subtitle}</div>` : ''}
            </div>
        `;
    }
    
    // 刷新界面
    function refresh() {
        const historyDiv = document.getElementById('historyInterface');
        if (historyDiv) {
            renderHistoryUI(historyDiv);
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
    window.HistoryInterface = {
        show: showHistoryInterface,
        refresh,
        hide: () => {
            const historyDiv = document.getElementById('historyInterface');
            if (historyDiv) historyDiv.remove();
            if (sentencesContainer) sentencesContainer.style.display = 'block';
        }
    };

    return {
        show: showHistoryInterface,
        refresh
    };
    });
})();