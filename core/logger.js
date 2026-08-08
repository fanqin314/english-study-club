// logger.js - 统一日志服务
// 提供分级日志输出，支持调试/信息/警告/错误级别

(function() {
    'use strict';
    
    // 日志级别枚举
    const LogLevel = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };
    
    // 当前日志级别（默认 INFO）
    let currentLevel = LogLevel.INFO;
    
    // 模块名称前缀映射
    const modulePrefixes = {
        'EventBus': '[EventBus]',
        'DIContainer': '[DI]',
        'PosButton': '[PosBtn]',
        'VocabUI': '[Vocab]',
        'EventDelegation': '[EventDel]',
        'default': '[App]'
    };
    
    /**
     * 获取模块前缀
     * @param {string} moduleName - 模块名称
     * @returns {string} 格式化前缀
     */
    function getPrefix(moduleName) {
        return modulePrefixes[moduleName] || modulePrefixes.default;
    }
    
    /**
     * 格式化日志消息
     * @param {string} moduleName - 模块名称
     * @param {string} message - 日志消息
     * @param {...*} args - 其他参数
     * @returns {Array} 格式化后的参数数组
     */
    function formatMessage(moduleName, message, ...args) {
        const prefix = getPrefix(moduleName);
        return [prefix + ' ' + message, ...args];
    }
    
    /**
     * 调试日志
     * @param {string} moduleName - 模块名称
     * @param {string} message - 日志消息
     * @param {...*} args - 其他参数
     */
    function debug(moduleName, message, ...args) {
        if (currentLevel <= LogLevel.DEBUG) {
            console.debug(...formatMessage(moduleName, message, ...args));
        }
    }
    
    /**
     * 信息日志
     * @param {string} moduleName - 模块名称
     * @param {string} message - 日志消息
     * @param {...*} args - 其他参数
     */
    function info(moduleName, message, ...args) {
        if (currentLevel <= LogLevel.INFO) {
            console.info(...formatMessage(moduleName, message, ...args));
        }
    }
    
    /**
     * 警告日志
     * @param {string} moduleName - 模块名称
     * @param {string} message - 日志消息
     * @param {...*} args - 其他参数
     */
    function warn(moduleName, message, ...args) {
        if (currentLevel <= LogLevel.WARN) {
            console.warn(...formatMessage(moduleName, message, ...args));
        }
    }
    
    /**
     * 错误日志
     * @param {string} moduleName - 模块名称
     * @param {string} message - 日志消息
     * @param {...*} args - 其他参数
     */
    function error(moduleName, message, ...args) {
        if (currentLevel <= LogLevel.ERROR) {
            console.error(...formatMessage(moduleName, message, ...args));
        }
    }
    
    /**
     * 设置日志级别
     * @param {string|number} level - 日志级别 ('debug'|'info'|'warn'|'error'|'none' 或对应数字)
     */
    function setLevel(level) {
        if (typeof level === 'string') {
            const levelMap = {
                'debug': LogLevel.DEBUG,
                'info': LogLevel.INFO,
                'warn': LogLevel.WARN,
                'error': LogLevel.ERROR,
                'none': LogLevel.NONE
            };
            currentLevel = levelMap[level.toLowerCase()] ?? LogLevel.INFO;
        } else if (typeof level === 'number') {
            currentLevel = level;
        }
    }
    
    /**
     * 获取当前日志级别
     * @returns {number} 当前日志级别
     */
    function getLevel() {
        return currentLevel;
    }
    
    /**
     * 创建模块日志实例
     * @param {string} moduleName - 模块名称
     * @returns {Object} 日志实例
     */
    function createLogger(moduleName) {
        return {
            debug: (message, ...args) => debug(moduleName, message, ...args),
            info: (message, ...args) => info(moduleName, message, ...args),
            warn: (message, ...args) => warn(moduleName, message, ...args),
            error: (message, ...args) => error(moduleName, message, ...args)
        };
    }
    
    // 导出全局接口
    window.Logger = {
        // 日志级别常量
        Level: LogLevel,
        
        // 日志方法
        debug,
        info,
        warn,
        error,
        
        // 配置方法
        setLevel,
        getLevel,
        
        // 工厂方法
        create: createLogger
    };
})();
