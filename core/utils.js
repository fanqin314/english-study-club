// utils.js - 通用工具类

(function() {
    ModuleRegistry.register('Utils', [], function() {
        /**
         * 通用工具类，提供各种辅助函数
         */
        const Utils = {
            /**
             * 安全的HTML转义，处理特殊情况
             * @param {string} text - 待转义的文本
             * @param {boolean} preserveTags - 是否保留某些标签
             * @returns {string} 转义后的文本
             */
            safeEscapeHtml: function(text, preserveTags = false) {
                if (!text || typeof text !== 'string') return '';
                
                let escaped = text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                
                if (preserveTags) {
                    // 恢复特定标签
                    escaped = escaped
                        .replace(/&lt;strong&gt;/g, '<strong>')
                        .replace(/&lt;\/strong&gt;/g, '</strong>')
                        .replace(/&lt;br&gt;/g, '<br>');
                }
                
                return escaped;
            },
            
            /**
             * 格式化文本，处理换行和特殊格式
             * @param {string} text - 待格式化的文本
             * @returns {string} 格式化后的文本
             */
            formatText: function(text) {
                if (!text || typeof text !== 'string') return '';
                
                let formatted = text;
                // 替换分号为换行
                formatted = formatted.replace(/[；;]\s*/g, '<br>');
                // 强调重点
                formatted = formatted.replace(/(重点搭配|金句|写作建议|短语|句型)：/g, '<strong>$1</strong>');
                // 处理换行
                formatted = formatted.replace(/\n/g, '<br>');
                // 移除冒号
                formatted = formatted.replace(/：/g, '');
                
                return formatted;
            },
            
            /**
             * 处理API错误，根据错误类型提供具体的错误信息
             * @param {Error} error - 错误对象
             * @returns {string} 错误信息
             */
            handleApiError: function(error) {
                if (!error) return '未知错误';
                
                if (error.message.includes('401')) {
                    return 'API Key 无效或已过期，请重新配置';
                } else if (error.message.includes('403')) {
                    return 'API 访问被拒绝，请检查权限设置';
                } else if (error.message.includes('429')) {
                    return 'API 请求过于频繁，请稍后再试';
                } else if (error.message.includes('500')) {
                    return 'API 服务器内部错误，请稍后再试';
                } else if (error.message.includes('timeout')) {
                    return 'API 请求超时，请检查网络连接';
                } else {
                    return error.message || 'API 请求失败，请检查网络连接或 API 配置';
                }
            },
            
            /**
             * 检查API配置是否有效
             * @param {Object} apiConfig - API配置对象
             * @returns {boolean} 配置是否有效
             */
            checkApiConfig: function(apiConfig) {
                return apiConfig && apiConfig.apiKey && apiConfig.apiKey.length > 0;
            },
            
            /**
             * 获取句子内容
             * @param {number} idx - 句子索引
             * @param {Object} cacheManager - 缓存管理器
             * @param {Object} sentenceRenderer - 句子渲染器
             * @returns {string|null} 句子内容
             */
            getSentence: function(idx, cacheManager, sentenceRenderer) {
                try {
                    if (cacheManager) {
                        const sentences = cacheManager.getSentences();
                        if (sentences && sentences[idx]) {
                            return sentences[idx];
                        }
                    } else if (sentenceRenderer) {
                        const data = sentenceRenderer.getSentencesData();
                        if (data.sentences && data.sentences[idx]) {
                            return data.sentences[idx];
                        }
                    }
                } catch (e) {
                    console.error('获取句子内容失败:', e);
                }
                return null;
            },
            
            /**
             * 生成唯一ID
             * @param {string} prefix - ID前缀
             * @returns {string} 唯一ID
             */
            generateId: function(prefix = 'id') {
                return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
            },
            
            /**
             * 防抖函数
             * @param {Function} func - 要执行的函数
             * @param {number} wait - 等待时间（毫秒）
             * @returns {Function} 防抖后的函数
             */
            debounce: function(func, wait = 300) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },
            
            /**
             * 节流函数
             * @param {Function} func - 要执行的函数
             * @param {number} limit - 时间限制（毫秒）
             * @returns {Function} 节流后的函数
             */
            throttle: function(func, limit = 300) {
                let inThrottle;
                return function(...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },
            
            /**
             * 深度克隆对象
             * @param {Object} obj - 要克隆的对象
             * @returns {Object} 克隆后的对象
             */
            deepClone: function(obj) {
                if (obj === null || typeof obj !== 'object') return obj;
                if (obj instanceof Date) return new Date(obj.getTime());
                if (obj instanceof Array) return obj.map(item => this.deepClone(item));
                if (typeof obj === 'object') {
                    const clonedObj = {};
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            clonedObj[key] = this.deepClone(obj[key]);
                        }
                    }
                    return clonedObj;
                }
            },
            
            /**
             * 检查对象是否为空
             * @param {Object} obj - 要检查的对象
             * @returns {boolean} 是否为空
             */
            isEmpty: function(obj) {
                if (obj === null || obj === undefined) return true;
                if (typeof obj === 'string') return obj.trim() === '';
                if (Array.isArray(obj)) return obj.length === 0;
                if (typeof obj === 'object') return Object.keys(obj).length === 0;
                return false;
            },
            
            /**
             * 安全地获取对象属性
             * @param {Object} obj - 对象
             * @param {string} path - 属性路径，如 'a.b.c'
             * @param {*} defaultValue - 默认值
             * @returns {*} 属性值或默认值
             */
            get: function(obj, path, defaultValue = undefined) {
                const travel = (regexp) => {
                    const value = path.split(regexp)
                        .filter(Boolean)
                        .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
                    return value === undefined || value === null ? defaultValue : value;
                };
                return travel(/[\[\]\.]+/);
            }
        };
        
        return Utils;
    });
})();