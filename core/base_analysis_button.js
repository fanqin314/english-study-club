// base_analysis_button.js - 分析按钮基类，用于消除重复代码

(function() {
    ModuleRegistry.register('BaseAnalysisButton', ['Security', 'ErrorHandler', 'Performance', 'Utils'], function(Security, ErrorHandler, Performance, Utils) {
        /**
         * 基础分析按钮类
         * 
         * 提供通用的按钮逻辑，子类只需实现特定的 API 调用和显示逻辑
         */
        class BaseAnalysisButton {
            constructor(config) {
                this.security = config.security;
                this.errorHandler = config.errorHandler;
                this.performance = config.performance;
                this.cacheType = config.cacheType;
                this.typeName = config.typeName;
            }

            /**
             * 加载并显示分析数据
             * 
             * @param {number} idx - 句子索引
             * @param {HTMLElement} panel - 显示面板
             */
            async loadAndDisplay(idx, panel) {
                if (!this.checkApiConfig()) return;
                
                const cached = this.checkCache(idx);
                if (cached) {
                    this.displayInPanel(panel, cached);
                    return;
                }
                
                const sentence = this.getSentence(idx);
                if (!sentence) return;
                
                this.showLoading(idx);
                
                try {
                    const result = await this.callApi(sentence);
                    this.saveToCache(idx, result);
                    this.displayInPanel(panel, result);
                    this.showSuccess();
                } catch (error) {
                    this.handleError(error);
                }
            }

            /**
             * 检查 API 配置
             * 
             * @returns {boolean} 配置是否有效
             */
            checkApiConfig() {
                const apiConfig = this.security.getApiConfig();
                if (!Utils.checkApiConfig(apiConfig)) {
                    this.errorHandler.handleValidationError('请先配置 API Key');
                    return false;
                }
                return true;
            }

            /**
             * 检查缓存
             * 
             * @param {number} idx - 句子索引
             * @returns {*} 缓存数据或 null
             */
            checkCache(idx) {
                if (!window.CacheManager) return null;
                return window.CacheManager.getSentenceCache(idx, this.cacheType);
            }

            /**
             * 获取句子文本
             * 
             * @param {number} idx - 句子索引
             * @returns {string} 句子文本或 null
             */
            getSentence(idx) {
                const cacheManager = window.CacheManager;
                const sentenceRenderer = window.SentenceRenderer;
                const sentence = Utils.getSentence(idx, cacheManager, sentenceRenderer);
                if (!sentence) {
                    this.errorHandler.handleValidationError('无法获取句子内容');
                }
                return sentence;
            }

            /**
             * 显示加载提示
             * 
             * @param {number} idx - 句子索引
             */
            showLoading(idx) {
                this.errorHandler.showError(`正在解析第 ${idx + 1} 句的${this.typeName}...`, 'info');
            }

            /**
             * 保存到缓存
             * 
             * @param {number} idx - 句子索引
             * @param {*} result - 分析结果
             */
            saveToCache(idx, result) {
                if (window.CacheManager) {
                    window.CacheManager.setSentenceCache(idx, this.cacheType, result);
                }
            }

            /**
             * 显示成功提示
             */
            showSuccess() {
                this.errorHandler.showSuccess(`${this.typeName}解析完成`);
            }

            /**
             * 处理错误
             * 
             * @param {Error} error - 错误对象
             */
            handleError(error) {
                console.error(`${this.typeName}解析失败:`, error);
                this.errorHandler.handleApiError(error);
            }

            /**
             * 子类需要实现：调用 API
             * 
             * @param {string} sentence - 句子文本
             * @returns {Promise<*>} API 返回结果
             */
            async callApi(sentence) {
                throw new Error('callApi must be implemented by subclass');
            }

            /**
             * 子类需要实现：在面板中显示数据
             * 
             * @param {HTMLElement} panel - 显示面板
             * @param {*} data - 分析数据
             */
            displayInPanel(panel, data) {
                throw new Error('displayInPanel must be implemented by subclass');
            }
        }

        return {
            BaseAnalysisButton
        };
    });
})();