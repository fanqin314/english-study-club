// 第二行按钮UI.js - 生成第二行按钮（加载示例、保存当前分析、词性高亮）
(function() {
    ModuleRegistry.register('SecondRowButtons', ['ErrorHandler'], function(ErrorHandler) {
        // 容器
        let container = null;
        
        // 按钮配置
        // 注意：highlightToggleBtn 的事件绑定由 highlight_switch.js 统一处理
        // parseBtn 的事件绑定由 event_delegation.js 统一处理，避免重复绑定
        const buttons = [
            { id: 'parseBtn', text: '解析', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>', onClick: null },
            { id: 'highlightToggleBtn', text: '词性高亮', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3 3-3 3" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8" /><path d="M12 6h8" /><path d="M12 12h8" /><path d="M12 18h8" /></svg>', onClick: null },
            { id: 'saveAnalysisBtn', text: '保存当前分析', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>', onClick: null },
            { id: 'loadExampleBtn', text: '加载示例', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>', onClick: null }
        ];
        
        // 初始化：获取容器
        function init(containerId = 'secondRowContainer') {
            container = document.getElementById(containerId);
            if (!container) {
                console.warn(`第二行按钮容器 #${containerId} 未找到`);
                return;
            }
            
            generateButtons();
        }
        
        // 生成按钮
        function generateButtons() {
            if (!container) return;
            
            container.innerHTML = '';
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.id = btn.id;
                button.classList.add('secondary');
                
                // 创建图标和文本容器
                const buttonContent = document.createElement('span');
                buttonContent.style.display = 'flex';
                buttonContent.style.alignItems = 'center';
                buttonContent.style.gap = '8px';
                
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
                
                // 绑定点击事件（通过全局回调）
                // 如果 onClick 为 null，跳过绑定（由其他模块处理）
                if (btn.onClick && window[btn.onClick]) {
                    button.addEventListener('click', window[btn.onClick]);
                } else if (btn.onClick !== null && !window[btn.onClick]) {
                    console.warn(`回调函数 ${btn.onClick} 未找到`);
                }
                
                container.appendChild(button);
            });
        }
        
        // 获取高亮按钮元素
        function getHighlightButton() {
            return document.getElementById('highlightToggleBtn');
        }
        
        // 设置高亮按钮样式（激活/未激活）
        function setHighlightButtonStyle(active) {
            const btn = getHighlightButton();
            if (btn) {
                if (active) {
                    btn.style.background = 'var(--accent)';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = '#e2e8f0';
                    btn.style.color = 'var(--text)';
                }
            }
        }
        
        // 监听添加新按钮的事件
        EventBus.on('addSecondRowButton', function(button) {
            buttons.push(button);
            generateButtons();
        });
        
        // 监听深度解析模式激活事件，重新初始化按钮（处理容器被重新创建的情况）
        EventBus.on('showAnalysisMode', function() {
            // 延迟一下确保 DOM 已经更新
            setTimeout(() => {
                container = document.getElementById('secondRowContainer');
                if (container) {
                    generateButtons();
                    // 通知其他模块按钮已重新生成
                    if (EventBus && EventBus.emit) {
                        EventBus.emit('secondRowButtonsGenerated');
                    }
                }
            }, 50);
        });
        
        // 自动初始化（等待 DOM 加载）
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => init());
        } else {
            init();
        }
        
        return {
            init,
            getHighlightButton,
            setHighlightButtonStyle
        };
    });
})();