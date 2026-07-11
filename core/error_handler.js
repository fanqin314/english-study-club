// error_handler.js - 统一错误处理模块
(function() {
    ModuleRegistry.register('ErrorHandler', [], function() {
        // 错误类型定义
        const ERROR_TYPES = {
            API_ERROR: 'api_error',
            VALIDATION_ERROR: 'validation_error',
            NETWORK_ERROR: 'network_error',
            UNKNOWN_ERROR: 'unknown_error',
            SUCCESS: 'success' // 添加成功类型
        };

        // 显示错误提示
        function showError(message, type = ERROR_TYPES.UNKNOWN_ERROR) {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.innerText = message;
                toast.style.opacity = '1';
                toast.style.background = getErrorColor(type);
                setTimeout(() => toast.style.opacity = '0', 3000);
            } else {
                alert(message);
            }
        }

        // 根据错误类型获取颜色
        function getErrorColor(type) {
            switch (type) {
                case ERROR_TYPES.API_ERROR:
                    return '#ef4444'; // 红色
                case ERROR_TYPES.VALIDATION_ERROR:
                    return '#f59e0b'; // 橙色
                case ERROR_TYPES.NETWORK_ERROR:
                    return '#3b82f6'; // 蓝色
                case ERROR_TYPES.SUCCESS:
                    return '#10b981'; // 绿色
                default:
                    return '#6b7280'; // 灰色
            }
        }

        // 显示成功提示
        function showSuccess(message) {
            showError(message, ERROR_TYPES.SUCCESS);
        }

        // 处理API错误
        function handleApiError(error) {
            let message = 'API请求失败';
            if (error.message) {
                message = error.message;
            } else if (error.status) {
                message = `API请求失败: ${error.status}`;
            }
            showError(message, ERROR_TYPES.API_ERROR);
            console.error('API错误:', error);
        }

        // 处理验证错误
        function handleValidationError(message) {
            showError(message, ERROR_TYPES.VALIDATION_ERROR);
            console.warn('验证错误:', message);
        }

        // 处理网络错误
        function handleNetworkError(error) {
            let message = '网络连接失败，请检查网络设置';
            if (error.message) {
                message = error.message;
            }
            showError(message, ERROR_TYPES.NETWORK_ERROR);
            console.error('网络错误:', error);
        }

        // 处理未知错误
        function handleUnknownError(error) {
            let message = '发生未知错误';
            if (error.message) {
                message = error.message;
            }
            showError(message, ERROR_TYPES.UNKNOWN_ERROR);
            console.error('未知错误:', error);
        }

        // 全局错误处理
        function setupGlobalErrorHandler() {
            window.addEventListener('error', function(event) {
                handleUnknownError(event.error);
            });

            window.addEventListener('unhandledrejection', function(event) {
                handleUnknownError(event.reason);
            });
        }

        // 包装异步函数，自动处理错误
        function wrapAsyncFunction(fn) {
            return async function(...args) {
                try {
                    return await fn(...args);
                } catch (error) {
                    if (error.message && error.message.includes('API')) {
                        handleApiError(error);
                    } else if (error.message && error.message.includes('网络')) {
                        handleNetworkError(error);
                    } else if (error.message && (error.message.includes('未找到') || error.message.includes('请输入'))) {
                        handleValidationError(error.message);
                    } else {
                        handleUnknownError(error);
                    }
                    throw error;
                }
            };
        }

        // 初始化
        function init() {
            setupGlobalErrorHandler();
            console.log('错误处理模块初始化完成');
        }

        // 获取模块名称
        function getName() {
            return 'ErrorHandler';
        }
        
        return {
            init,
            getName,
            showError,
            showSuccess,
            handleApiError,
            handleValidationError,
            handleNetworkError,
            handleUnknownError,
            wrapAsyncFunction,
            ERROR_TYPES
        };
    });
})();