// security.js - 安全性模块
(function() {
    ModuleRegistry.register('Security', [], function() {
        // API Key存储键名（使用混淆的键名）
        const API_KEY_STORAGE_KEY = 'encrypted_api_key';
        const API_BASE_STORAGE_KEY = 'encrypted_api_base';
        const MODEL_NAME_STORAGE_KEY = 'encrypted_model_name';

        // 简单的加密/解密函数（使用Base64编码）
        function encrypt(text) {
            try {
                return btoa(encodeURIComponent(text));
            } catch (e) {
                console.error('加密失败:', e);
                return text;
            }
        }

        function decrypt(text) {
            try {
                return decodeURIComponent(atob(text));
            } catch (e) {
                console.error('解密失败:', e);
                return text;
            }
        }

        // 安全存储API Key
        function setApiKey(apiKey) {
            if (!apiKey || typeof apiKey !== 'string') {
                throw new Error('API Key格式不正确');
            }
            const encrypted = encrypt(apiKey);
            localStorage.setItem(API_KEY_STORAGE_KEY, encrypted);
        }

        // 安全获取API Key
        function getApiKey() {
            const encrypted = localStorage.getItem(API_KEY_STORAGE_KEY);
            if (!encrypted) return '';
            return decrypt(encrypted);
        }

        // 清除API Key
        function clearApiKey() {
            localStorage.removeItem(API_KEY_STORAGE_KEY);
        }

        // 安全存储API配置
        function setApiConfig(baseUrl, modelName) {
            if (baseUrl) {
                localStorage.setItem(API_BASE_STORAGE_KEY, encrypt(baseUrl));
            }
            if (modelName) {
                localStorage.setItem(MODEL_NAME_STORAGE_KEY, encrypt(modelName));
            }
        }

        // 安全获取API配置
        function getApiConfig() {
            const encryptedBaseUrl = localStorage.getItem(API_BASE_STORAGE_KEY);
            const encryptedModelName = localStorage.getItem(MODEL_NAME_STORAGE_KEY);
            
            return {
                baseUrl: encryptedBaseUrl ? decrypt(encryptedBaseUrl) : 'https://api.deepseek.com',
                apiKey: getApiKey(),
                model: encryptedModelName ? decrypt(encryptedModelName) : 'deepseek-chat'
            };
        }

        // 清除所有API配置
        function clearApiConfig() {
            clearApiKey();
            localStorage.removeItem(API_BASE_STORAGE_KEY);
            localStorage.removeItem(MODEL_NAME_STORAGE_KEY);
        }

        // 输入验证 - 验证URL
        function validateUrl(url) {
            if (!url || typeof url !== 'string') {
                return { valid: false, error: 'URL不能为空' };
            }
            try {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return { valid: false, error: 'URL必须使用HTTP或HTTPS协议' };
                }
                return { valid: true };
            } catch (e) {
                return { valid: false, error: 'URL格式不正确' };
            }
        }

        // 输入验证 - 验证API Key格式
        function validateApiKey(apiKey) {
            if (!apiKey || typeof apiKey !== 'string') {
                return { valid: false, error: 'API Key不能为空' };
            }
            if (apiKey.length < 10) {
                return { valid: false, error: 'API Key长度不足' };
            }
            return { valid: true };
        }

        // 输入验证 - 验证文本输入
        function validateText(text, maxLength = 10000) {
            if (!text || typeof text !== 'string') {
                return { valid: false, error: '文本不能为空' };
            }
            if (text.length > maxLength) {
                return { valid: false, error: `文本长度不能超过${maxLength}个字符` };
            }
            return { valid: true };
        }

        // HTML转义 - 防止XSS攻击
        function escapeHtml(text) {
            if (!text || typeof text !== 'string') return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // 安全的innerHTML设置
        function safeSetInnerHTML(element, html) {
            if (!element || !html) return;
            // 使用DOMPurify或简单的过滤
            const filteredHtml = filterHtml(html);
            element.innerHTML = filteredHtml;
        }

        // 简单的HTML过滤
        function filterHtml(html) {
            if (!html || typeof html !== 'string') return '';
            // 移除危险标签和属性
            let filtered = html;
            
            // 移除script标签
            filtered = filtered.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            // 移除on事件属性
            filtered = filtered.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
            
            // 移除javascript:协议
            filtered = filtered.replace(/javascript:/gi, '');
            
            return filtered;
        }

        // 过滤敏感信息
        function filterSensitiveInfo(text) {
            if (!text || typeof text !== 'string') return '';
            let filtered = text;
            
            // 过滤API Key
            filtered = filtered.replace(/sk-[a-zA-Z0-9]{32,}/g, '***');
            
            // 过滤token
            filtered = filtered.replace(/token["\s:]+["']?[^"'\s]+["']?/gi, 'token=***');
            
            return filtered;
        }

        // 生成安全的随机ID
        function generateSecureId() {
            return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }

        // 检查CORS支持
        function checkCorsSupport() {
            return typeof fetch !== 'undefined' && 
                   typeof Request !== 'undefined' && 
                   typeof Headers !== 'undefined';
        }

        // 初始化
        function init() {
            console.log('安全性模块初始化完成');
        }

        // 获取模块名称
        function getName() {
            return 'Security';
        }

        return {
            init,
            getName,
            setApiKey,
            getApiKey,
            clearApiKey,
            setApiConfig,
            getApiConfig,
            clearApiConfig,
            validateUrl,
            validateApiKey,
            validateText,
            escapeHtml,
            safeSetInnerHTML,
            filterHtml,
            filterSensitiveInfo,
            generateSecureId,
            checkCorsSupport
        };
    });
})();