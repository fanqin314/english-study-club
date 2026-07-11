// 语法按钮.js - 处理句子卡片上语法结构按钮的点击事件

(function() {
    ModuleRegistry.register('SyntaxButton', ['Security', 'ErrorHandler', 'Performance', 'BaseAnalysisButton', 'GlobalManager'], function(Security, ErrorHandler, Performance, BaseAnalysisButton, GlobalManager) {
        
        class SyntaxButton extends BaseAnalysisButton.BaseAnalysisButton {
            constructor(security, errorHandler, performance, globalManager) {
                super({
                    security,
                    errorHandler,
                    performance,
                    cacheType: 'syntax',
                    typeName: '语法结构'
                });
                this.globalManager = globalManager;
            }

            async callApi(sentence) {
                const apiRequest = this.globalManager.getGlobalObject('APIRequest');
                return await apiRequest.requestSyntax(sentence);
            }

            displayInPanel(panel, data) {
                if (!panel) return;
                
                try {
                    panel.innerHTML = '';
                    
                    const title = document.createElement('strong');
                    title.textContent = '语法结构';
                    panel.appendChild(title);
                    
                    const contentDiv = document.createElement('div');
                    
                    let syntaxText = data;
                    
                    if (typeof data === 'string') {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.syntax) {
                                syntaxText = parsed.syntax;
                            }
                        } catch (e) {
                        }
                    } else if (data && typeof data === 'object' && data.syntax) {
                        syntaxText = data.syntax;
                    }
                    
                    contentDiv.textContent = this.security.escapeHtml(syntaxText);
                    
                    panel.appendChild(contentDiv);
                    panel.classList.add('show');
                } catch (e) {
                    console.error('显示语法结构数据失败:', e);
                    panel.innerHTML = '<strong>语法结构</strong><div>数据格式错误</div>';
                    panel.classList.add('show');
                }
            }
        }
        
        const syntaxButton = new SyntaxButton(Security, ErrorHandler, Performance, GlobalManager);
        
        window.SyntaxButton = {
            loadAndDisplay: syntaxButton.loadAndDisplay.bind(syntaxButton)
        };
        
        window.onLoadSyntax = window.SyntaxButton.loadAndDisplay;
    });
})();