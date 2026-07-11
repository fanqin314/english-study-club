// di_container.js - 依赖注入容器
// 提供统一的依赖注册和解析机制，替代全局变量访问

(function() {
    'use strict';
    
    // 服务容器
    const services = new Map();
    const factories = new Map();
    const singletons = new Map();
    
    /**
     * 注册单例服务
     * @param {string} name - 服务名称
     * @param {Function} factory - 工厂函数
     * @param {Array<string>} dependencies - 依赖列表
     */
    function registerSingleton(name, factory, dependencies = []) {
        factories.set(name, { factory, dependencies, type: 'singleton' });
    }
    
    /**
     * 注册瞬态服务（每次创建新实例）
     * @param {string} name - 服务名称
     * @param {Function} factory - 工厂函数
     * @param {Array<string>} dependencies - 依赖列表
     */
    function registerTransient(name, factory, dependencies = []) {
        factories.set(name, { factory, dependencies, type: 'transient' });
    }
    
    /**
     * 注册常量值
     * @param {string} name - 服务名称
     * @param {*} value - 常量值
     */
    function registerValue(name, value) {
        services.set(name, value);
    }
    
    /**
     * 解析依赖
     * @param {string} name - 服务名称
     * @returns {*} 服务实例
     */
    function resolve(name) {
        // 1. 检查是否已注册为值
        if (services.has(name)) {
            return services.get(name);
        }
        
        // 2. 检查是否已创建单例
        if (singletons.has(name)) {
            return singletons.get(name);
        }
        
        // 3. 检查工厂
        const factoryInfo = factories.get(name);
        if (!factoryInfo) {
            throw new Error(`服务 "${name}" 未注册`);
        }
        
        // 4. 解析依赖
        const deps = factoryInfo.dependencies.map(dep => resolve(dep));
        
        // 5. 创建实例
        const instance = factoryInfo.factory(...deps);
        
        // 6. 如果是单例，缓存实例
        if (factoryInfo.type === 'singleton') {
            singletons.set(name, instance);
        }
        
        return instance;
    }
    
    /**
     * 批量解析多个依赖
     * @param {Array<string>} names - 服务名称列表
     * @returns {Array} 服务实例列表
     */
    function resolveMany(names) {
        return names.map(name => resolve(name));
    }
    
    /**
     * 检查服务是否已注册
     * @param {string} name - 服务名称
     * @returns {boolean}
     */
    function has(name) {
        return services.has(name) || factories.has(name) || singletons.has(name);
    }
    
    /**
     * 清空所有注册
     * 主要用于测试
     */
    function clear() {
        services.clear();
        factories.clear();
        singletons.clear();
    }
    
    // 导出全局容器
    window.DIContainer = {
        registerSingleton,
        registerTransient,
        registerValue,
        resolve,
        resolveMany,
        has,
        clear
    };
    
    console.log('[DIContainer] 依赖注入容器已初始化');
})();
