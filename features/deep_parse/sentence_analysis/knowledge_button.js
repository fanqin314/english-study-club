// knowledge_button.js - 处理句子卡片上知识点按钮的点击事件

(function() {
    ModuleRegistry.register('KnowledgeButton', ['Security', 'ErrorHandler', 'Performance', 'BaseAnalysisButton', 'GlobalManager', 'Utils'], function(Security, ErrorHandler, Performance, BaseAnalysisButton, GlobalManager, Utils) {
        
        class KnowledgeButton extends BaseAnalysisButton.BaseAnalysisButton {
            constructor(security, errorHandler, performance, globalManager) {
                super({
                    security,
                    errorHandler,
                    performance,
                    cacheType: 'knowledge',
                    typeName: '知识点'
                });
                this.globalManager = globalManager;
            }

            async callApi(sentence) {
                const apiRequest = this.globalManager.getGlobalObject('APIRequest');
                return await apiRequest.requestKnowledge(sentence);
            }

            displayInPanel(panel, data) {
                if (!panel) return;
                
                try {
                    panel.innerHTML = '';
                    
                    const title = document.createElement('strong');
                    title.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>知识点`;
                    panel.appendChild(title);
                    
                    const contentDiv = document.createElement('div');
                    
                    let knowledgeText = data;
                    
                    if (typeof data === 'string') {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.knowledge) {
                                knowledgeText = parsed.knowledge;
                            }
                        } catch (e) {
                        }
                    } else if (data && typeof data === 'object' && data.knowledge) {
                        knowledgeText = data.knowledge;
                    }
                    
                    // 使用Utils进行文本格式化
                    let formatted = Utils.formatText(knowledgeText);
                    // 安全转义HTML，保留特定标签
                    formatted = Utils.safeEscapeHtml(formatted, true);
                    
                    // 移除重复的 <strong> 标签
                    while (formatted.includes('<strong><strong>')) {
                        formatted = formatted.replace(/<strong><strong>/g, '<strong>')
                                           .replace(/<\/strong><\/strong>/g, '</strong>');
                    }
                    
                    contentDiv.innerHTML = formatted;
                    panel.appendChild(contentDiv);
                    panel.classList.add('show');
                } catch (e) {
                    console.error('显示知识点数据失败:', e);
                    panel.innerHTML = '<strong><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>知识点</strong><div>数据格式错误</div>';
                    panel.classList.add('show');
                }
            }
        }
        
        const knowledgeButton = new KnowledgeButton(Security, ErrorHandler, Performance, GlobalManager);
        
        window.KnowledgeButton = {
            loadAndDisplay: knowledgeButton.loadAndDisplay.bind(knowledgeButton)
        };
        
        window.onLoadKnowledge = window.KnowledgeButton.loadAndDisplay;
    });
})();