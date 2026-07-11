// API设置.js - API配置界面及逻辑
(function() {
    ModuleRegistry.register('APIConfig', ['Security', 'ErrorHandler', 'Performance'], function(Security, ErrorHandler, Performance) {
        // 获取存储的API配置
        let apiConfig = Security.getApiConfig();

        // 更新页面上的API状态显示
        function updateApiStatus() {
            const dot = document.getElementById('apiStatusDot');
            const text = document.getElementById('apiStatusText');
            if (apiConfig.apiKey && apiConfig.apiKey.trim() !== '') {
                dot.className = 'status-dot status-green';
                text.innerText = '已配置';
            } else {
                dot.className = 'status-dot status-red';
                text.innerText = '未配置';
            }
        }

        // 保存API配置
        function saveApiConfig() {
            const baseUrlInput = document.getElementById('apiBaseInput');
            const apiKeyInput = document.getElementById('apiKeyInput');
            const modelInput = document.getElementById('modelInput');
            
            let baseUrl = baseUrlInput ? baseUrlInput.value.trim() : '';
            let apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
            let model = modelInput ? modelInput.value.trim() : '';
            
            // 验证输入
            if (baseUrl) {
                const urlValidation = Security.validateUrl(baseUrl);
                if (!urlValidation.valid) {
                    ErrorHandler.handleValidationError(urlValidation.error);
                    return;
                }
            }
            
            if (apiKey) {
                const keyValidation = Security.validateApiKey(apiKey);
                if (!keyValidation.valid) {
                    ErrorHandler.handleValidationError(keyValidation.error);
                    return;
                }
            }
            
            // 安全存储
            try {
                Security.setApiConfig(baseUrl, model);
                if (apiKey) {
                    Security.setApiKey(apiKey);
                }
                
                apiConfig = Security.getApiConfig();
                updateApiStatus();
                ErrorHandler.showSuccess('API配置已保存');
            } catch (error) {
                ErrorHandler.handleUnknownError('保存API配置失败');
            }
        }

        // 测试API连接
        async function testApiConnection() {
            if (!apiConfig.apiKey) {
                ErrorHandler.handleValidationError('请先填写API Key');
                return;
            }
            
            ErrorHandler.showError('测试中...', 'info');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            try {
                const res = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: apiConfig.model,
                        messages: [{ role: 'user', content: 'Hello' }],
                        max_tokens: 5
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const successToast = document.getElementById('toast');
                    if (successToast) {
                        successToast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> API连接成功`;
                        successToast.style.background = '#10b981';
                        successToast.style.opacity = '1';
                        setTimeout(() => successToast.style.opacity = '0', 3000);
                    }
                } else {
                    const err = await res.text();
                    ErrorHandler.handleApiError({ status: res.status, message: err });
                }
            } catch(e) {
                clearTimeout(timeoutId);
                if (e.name === 'AbortError') {
                    ErrorHandler.handleNetworkError(new Error('请求超时'));
                } else {
                    ErrorHandler.handleNetworkError(e);
                }
            }
        }

        // 填充API设置界面到弹窗
        function fillAPISettings(modalContainer) {
            // 创建API设置区域的HTML
            const apiSection = document.createElement('div');
            apiSection.innerHTML = `
                <style>
                    [data-theme="dark"] #apiBaseInput,
                    [data-theme="dark"] #apiKeyInput,
                    [data-theme="dark"] #modelInput {
                        background-color: rgba(30, 41, 59, 0.6);
                        border-color: #334155;
                        color: #f1f5f9;
                    }
                </style>
                <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> API 配置</h3>
                <label>Base URL</label>
                <input type="text" id="apiBaseInput" placeholder="https://api.deepseek.com" style="box-shadow: inset 0px 2px 10px -2px rgba(0, 0, 0, 0.25); background-color: rgba(245, 245, 245, 0.6); border-width: 1px; border-style: solid; border-color: #ededed; opacity: 0.9;">
                <label>API Key</label>
                <input type="password" id="apiKeyInput" placeholder="sk-..." style="box-shadow: inset 0px 2px 10px -2px rgba(0, 0, 0, 0.25); background-color: rgba(245, 245, 245, 0.6); border-width: 1px; border-style: solid; border-color: #ededed; opacity: 0.9;">
                <label>模型名称</label>
                <input type="text" id="modelInput" placeholder="deepseek-chat" style="box-shadow: inset 0px 2px 10px -2px rgba(0, 0, 0, 0.25); background-color: rgba(245, 245, 245, 0.6); border-width: 1px; border-style: solid; border-color: #ededed; opacity: 0.9;">
                <div class="button-group">
                    <button id="saveApiBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> 保存</button>
                    <button id="testApiBtn" class="secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg> 测试连接</button>
                </div>
            `;
            
            Security.safeSetInnerHTML(modalContainer, apiSection.innerHTML);
            
            // 在JavaScript中设置值，避免在HTML中直接暴露API Key
            const apiBaseInput = document.getElementById('apiBaseInput');
            const apiKeyInput = document.getElementById('apiKeyInput');
            const modelInput = document.getElementById('modelInput');
            
            // 更新输入框样式以支持深色模式
            function updateInputStyles() {
                const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
                const inputs = [apiBaseInput, apiKeyInput, modelInput];
                
                inputs.forEach(input => {
                    if (input) {
                        if (isDarkMode) {
                            input.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                            input.style.borderColor = '#334155';
                            input.style.color = '#f1f5f9';
                        } else {
                            input.style.backgroundColor = 'rgba(245, 245, 245, 0.6)';
                            input.style.borderColor = '#ededed';
                            input.style.color = 'var(--text)';
                        }
                    }
                });
            }
            
            // 初始更新样式
            updateInputStyles();
            
            // 监听主题变化
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'data-theme') {
                        updateInputStyles();
                    }
                });
            });
            
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
            
            if (apiBaseInput && apiConfig.baseUrl) {
                apiBaseInput.value = apiConfig.baseUrl;
            }
            if (apiKeyInput && apiConfig.apiKey) {
                apiKeyInput.value = apiConfig.apiKey;
            }
            if (modelInput && apiConfig.model) {
                modelInput.value = apiConfig.model;
            }
            
            // 绑定事件
            const saveBtn = document.getElementById('saveApiBtn');
            const testBtn = document.getElementById('testApiBtn');
            
            if (saveBtn) saveBtn.addEventListener('click', saveApiConfig);
            if (testBtn) testBtn.addEventListener('click', testApiConnection);
        }

        // 暴露接口
        window.fillAPISettings = fillAPISettings;
        window.getApiConfig = function() {
            return Security.getApiConfig();
        };
        
        // 更新API状态（页面加载时调用）
        document.addEventListener('DOMContentLoaded', updateApiStatus);
    });
})();