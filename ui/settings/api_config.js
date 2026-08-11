// api_config.js - API配置界面及逻辑
(function() {
    ModuleRegistry.register('APIConfig', ['Security', 'ErrorHandler', 'Performance'], function(Security, ErrorHandler, Performance) {
        // 获取存储的API配置
        let apiConfig = Security.getApiConfig();

        // 更新页面上的API状态显示
        function updateApiStatus() {
            const dot = document.getElementById('apiStatusDot');
            const text = document.getElementById('apiStatusText');
            if (!dot || !text) return;
            const isDefaultAI = localStorage.getItem('defaultAIMode') !== 'false';
            const hasProxy = apiConfig.proxyUrl && apiConfig.proxyUrl.trim() !== '';
            const hasKey = apiConfig.apiKey && apiConfig.apiKey.trim() !== '';
            if (isDefaultAI || hasKey || hasProxy) {
                dot.className = 'status-dot status-green';
                text.innerText = '已配置';
            } else {
                dot.className = 'status-dot status-red';
                text.innerText = '未配置';
            }
        }

        // 更新用量显示
        function updateUsageDisplay() {
            const usageText = document.getElementById('usageText');
            if (!usageText) return;
            if (window.UsageTracker) {
                const s = window.UsageTracker.summary();
                usageText.textContent = `今日免费次数：已用 ${s.used} / ${s.limit} 次（剩余 ${s.remaining} 次）`;
            } else {
                usageText.textContent = '用量追踪未加载';
            }
        }

        // 保存API配置
        function saveApiConfig() {
            // 默认AI模式下不允许保存
            if (localStorage.getItem('defaultAIMode') !== 'false') {
                return;
            }
            
            const baseUrlInput = document.getElementById('apiBaseInput');
            const apiKeyInput = document.getElementById('apiKeyInput');
            const modelInput = document.getElementById('modelInput');
            const proxyUrlInput = document.getElementById('proxyUrlInput');
            
            let baseUrl = baseUrlInput ? baseUrlInput.value.trim() : '';
            let apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
            let model = modelInput ? modelInput.value.trim() : '';
            let proxyUrl = proxyUrlInput ? proxyUrlInput.value.trim() : '';
            
            // 验证代理地址
            if (proxyUrl) {
                const proxyValidation = Security.validateUrl(proxyUrl);
                if (!proxyValidation.valid) {
                    ErrorHandler.handleValidationError('代理地址格式不正确');
                    return;
                }
            }
            
            // 如果用代理，apiKey 可选；否则必须填
            if (!proxyUrl) {
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
            }
            
            // 安全存储
            try {
                Security.setApiConfig(baseUrl, model);
                Security.setProxyUrl(proxyUrl);
                if (apiKey) {
                    Security.setApiKey(apiKey);
                }
                
                apiConfig = Security.getApiConfig();
                updateApiStatus();
                updateUsageDisplay();
                ErrorHandler.showSuccess('API配置已保存');
            } catch (error) {
                ErrorHandler.handleUnknownError('保存API配置失败');
            }
        }

        // 测试API连接
        async function testApiConnection() {
            const isDefaultAI = localStorage.getItem('defaultAIMode') !== 'false';
            const useProxy = isDefaultAI || (apiConfig.proxyUrl && apiConfig.proxyUrl.trim() !== '');
            
            if (!isDefaultAI && !useProxy && !apiConfig.apiKey) {
                ErrorHandler.handleValidationError('请先填写 API Key 或配置代理地址');
                return;
            }
            
            ErrorHandler.showError('测试中...', 'info');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            try {
                const proxyUrl = isDefaultAI ? 'https://api.fanqin.top' : apiConfig.proxyUrl;
                const url = useProxy ? `${proxyUrl.replace(/\/+$/, '')}/api/v1/chat/completions` : `${apiConfig.baseUrl}/chat/completions`;
                const headers = { 'Content-Type': 'application/json' };
                if (!useProxy) {
                    headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
                }
                
                const res = await fetch(url, {
                    method: 'POST',
                    headers,
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
                    [data-theme="dark"] #modelInput,
                    [data-theme="dark"] #proxyUrlInput {
                        background-color: rgba(30, 41, 59, 0.6);
                        border-color: #334155;
                        color: #f1f5f9;
                    }
                    .default-ai-toggle-btn {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 4px 10px 4px 6px;
                        border: 1.5px solid #d1d5db;
                        border-radius: 20px;
                        background: #f3f4f6;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.25s ease;
                        outline: none;
                        white-space: nowrap;
                    }
                    .default-ai-toggle-btn:hover {
                        border-color: #9ca3af;
                    }
                    .default-ai-toggle-btn .toggle-dot {
                        width: 14px;
                        height: 14px;
                        border-radius: 50%;
                        background: #9ca3af;
                        transition: all 0.25s ease;
                        flex-shrink: 0;
                    }
                    .default-ai-toggle-btn .toggle-label {
                        color: #6b7280;
                        font-weight: 500;
                        transition: color 0.25s ease;
                    }
                    .default-ai-toggle-btn.active {
                        background: #ecfdf5;
                        border-color: #10b981;
                    }
                    .default-ai-toggle-btn.active .toggle-dot {
                        background: #10b981;
                        box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
                    }
                    .default-ai-toggle-btn.active .toggle-label {
                        color: #059669;
                    }
                    [data-theme="dark"] .default-ai-toggle-btn {
                        background: #1e293b;
                        border-color: #475569;
                    }
                    [data-theme="dark"] .default-ai-toggle-btn .toggle-label {
                        color: #94a3b8;
                    }
                    [data-theme="dark"] .default-ai-toggle-btn.active {
                        background: rgba(16, 185, 129, 0.12);
                        border-color: #10b981;
                    }
                    [data-theme="dark"] .default-ai-toggle-btn.active .toggle-label {
                        color: #34d399;
                    }
                </style>
                <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> API 配置</h3>
                <div id="usageStatus" style="margin-bottom: 16px; padding: 10px 14px; border-radius: 10px; background: var(--accent-light); font-size: 13px; color: var(--text-light);">
                    <span id="usageText">加载中...</span>
                </div>
                <label style="display: none;">Base URL</label>
                <input type="text" id="apiBaseInput" placeholder="https://api-inference.modelscope.cn/v1" style="display: none;">
                <label style="display: none;">API Key</label>
                <input type="password" id="apiKeyInput" placeholder="ms-xxxxxx（魔搭SDK Token）" style="display: none;">
                <label style="display: none;">模型名称</label>
                <input type="text" id="modelInput" placeholder="qwen-qwen3-5-35b-a3b" style="display: none;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <label>代理地址（可选，用于保护 API Key）</label>
                    <button id="defaultAIToggle" class="default-ai-toggle-btn" title="切换默认魔搭AI / 自定义API">
                        <span class="toggle-dot"></span>
                        <span class="toggle-label">默认魔搭AI</span>
                    </button>
                </div>
                <input type="text" id="proxyUrlInput" placeholder="留空则直连 API" style="box-shadow: inset 0px 2px 10px -2px rgba(0, 0, 0, 0.25); background-color: rgba(245, 245, 245, 0.6); border-width: 1px; border-style: solid; border-color: #ededed; opacity: 0.9;">
                <div class="button-group">
                    <button id="saveApiBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> 保存</button>
                    <button id="testApiBtn" class="secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg> 测试连接</button>
                </div>
                <div style="margin-top: 12px; text-align: center; font-size: 12px;">
                    <a href="privacy.html" target="_blank" style="color: var(--text-light); text-decoration: none; opacity: 0.7;">隐私政策</a>
                </div>
            `;
            
            Security.safeSetInnerHTML(modalContainer, apiSection.innerHTML);
            
            // 在JavaScript中设置值，避免在HTML中直接暴露API Key
            const apiBaseInput = document.getElementById('apiBaseInput');
            const apiKeyInput = document.getElementById('apiKeyInput');
            const modelInput = document.getElementById('modelInput');
            
            // 更新输入框样式以支持深色模式
            const proxyUrlInput = document.getElementById('proxyUrlInput');
            function updateInputStyles() {
                const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
                const inputs = [apiBaseInput, apiKeyInput, modelInput, proxyUrlInput];
                
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
            if (proxyUrlInput && apiConfig.proxyUrl) {
                proxyUrlInput.value = apiConfig.proxyUrl;
            }
            
            // 更新用量显示
            updateUsageDisplay();
            
            // 绑定事件
            const saveBtn = document.getElementById('saveApiBtn');
            const testBtn = document.getElementById('testApiBtn');
            
            if (saveBtn) saveBtn.addEventListener('click', saveApiConfig);
            if (testBtn) testBtn.addEventListener('click', testApiConnection);

            // === 默认AI切换按钮 ===
            const toggleBtn = document.getElementById('defaultAIToggle');
            const DEFAULT_PROXY_URL = 'https://api.fanqin.top';
            const TOGGLE_KEY = 'defaultAIMode';
            
            function setDefaultAIMode(active) {
                const isActive = active !== undefined ? active : (localStorage.getItem(TOGGLE_KEY) !== 'false');
                localStorage.setItem(TOGGLE_KEY, isActive ? 'true' : 'false');
                
                if (toggleBtn) {
                    if (isActive) {
                        toggleBtn.classList.add('active');
                        toggleBtn.querySelector('.toggle-label').textContent = '默认魔搭AI';
                    } else {
                        toggleBtn.classList.remove('active');
                        toggleBtn.querySelector('.toggle-label').textContent = '自定义API';
                    }
                }
                
                const proxyInput = document.getElementById('proxyUrlInput');
                const baseInput = document.getElementById('apiBaseInput');
                const keyInput = document.getElementById('apiKeyInput');
                const modelInput = document.getElementById('modelInput');
                const sBtn = document.getElementById('saveApiBtn');
                const tBtn = document.getElementById('testApiBtn');
                
                if (isActive) {
                    // 默认AI模式：自动填代理地址，禁用所有输入
                    if (proxyInput) {
                        proxyInput.value = DEFAULT_PROXY_URL;
                        proxyInput.disabled = true;
                        proxyInput.style.opacity = '0.5';
                        proxyInput.style.cursor = 'not-allowed';
                    }
                    if (baseInput) { baseInput.disabled = true; baseInput.style.opacity = '0.5'; baseInput.style.cursor = 'not-allowed'; }
                    if (keyInput) { keyInput.disabled = true; keyInput.style.opacity = '0.5'; keyInput.style.cursor = 'not-allowed'; }
                    if (modelInput) { modelInput.disabled = true; modelInput.style.opacity = '0.5'; modelInput.style.cursor = 'not-allowed'; }
                    if (sBtn) { sBtn.disabled = true; sBtn.style.opacity = '0.5'; sBtn.style.cursor = 'not-allowed'; }
                    if (tBtn) { tBtn.disabled = true; tBtn.style.opacity = '0.5'; tBtn.style.cursor = 'not-allowed'; }
                } else {
                    // 自定义API模式：恢复所有输入
                    if (proxyInput) {
                        if (proxyInput.value === DEFAULT_PROXY_URL) proxyInput.value = '';
                        proxyInput.disabled = false;
                        proxyInput.style.opacity = '';
                        proxyInput.style.cursor = '';
                    }
                    if (baseInput) { baseInput.disabled = false; baseInput.style.opacity = ''; baseInput.style.cursor = ''; }
                    if (keyInput) { keyInput.disabled = false; keyInput.style.opacity = ''; keyInput.style.cursor = ''; }
                    if (modelInput) { modelInput.disabled = false; modelInput.style.opacity = ''; modelInput.style.cursor = ''; }
                    if (sBtn) { sBtn.disabled = false; sBtn.style.opacity = ''; sBtn.style.cursor = ''; }
                    if (tBtn) { tBtn.disabled = false; tBtn.style.opacity = ''; tBtn.style.cursor = ''; }
                }
            }
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentlyActive = toggleBtn.classList.contains('active');
                    setDefaultAIMode(!currentlyActive);
                });
                // 初始化状态
                setDefaultAIMode();
            }
        }

        // 暴露接口
        window.fillAPISettings = fillAPISettings;
        window.getApiConfig = function() {
            return Security.getApiConfig();
        };
        
        // 页面加载时立即更新API状态（factory 在 initializeAll 中调用，此时 DOM 已就绪）
        updateApiStatus();
    });
})();