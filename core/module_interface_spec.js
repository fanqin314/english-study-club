// module_interface_spec.js - 模块接口规范

(function() {
    ModuleRegistry.register('ModuleInterfaceSpec', [], function() {
        /**
         * 模块接口规范
         * 定义统一的模块接口标准，确保模块间的一致性和可预测性
         */
        const ModuleInterfaceSpec = {
            /**
             * 模块命名规范
             * @param {string} moduleName - 模块名称
             * @returns {boolean} 是否符合命名规范
             */
            validateModuleName: function(moduleName) {
                // 模块名称应该是驼峰命名，首字母大写
                const regex = /^[A-Z][a-zA-Z0-9]*$/;
                return regex.test(moduleName);
            },
            
            /**
             * 模块依赖规范
             * @param {Array} dependencies - 依赖列表
             * @returns {boolean} 是否符合依赖规范
             */
            validateDependencies: function(dependencies) {
                // 依赖列表应该是数组，且每个元素都是字符串
                if (!Array.isArray(dependencies)) return false;
                return dependencies.every(dep => typeof dep === 'string' && dep.length > 0);
            },
            
            /**
             * 模块工厂函数规范
             * @param {Function} factory - 工厂函数
             * @returns {boolean} 是否符合工厂函数规范
             */
            validateFactory: function(factory) {
                // 工厂函数应该是一个函数
                return typeof factory === 'function';
            },
            
            /**
             * 模块接口规范
             * 每个模块应该暴露以下接口：
             * - init(): 初始化模块
             * - destroy(): 销毁模块（可选）
             * - getName(): 获取模块名称（可选）
             * @param {Object} moduleInstance - 模块实例
             * @returns {boolean} 是否符合接口规范
             */
            validateModuleInterface: function(moduleInstance) {
                if (!moduleInstance || typeof moduleInstance !== 'object') return false;
                // 至少应该有init方法
                return typeof moduleInstance.init === 'function';
            },
            
            /**
             * 标准化模块注册
             * @param {string} moduleName - 模块名称
             * @param {Array} dependencies - 依赖列表
             * @param {Function} factory - 工厂函数
             * @returns {boolean} 是否注册成功
             */
            registerModule: function(moduleName, dependencies, factory) {
                // 验证模块名称
                if (!this.validateModuleName(moduleName)) {
                    console.error(`模块名称 ${moduleName} 不符合命名规范`);
                    return false;
                }
                
                // 验证依赖列表
                if (!this.validateDependencies(dependencies)) {
                    console.error(`模块 ${moduleName} 的依赖列表不符合规范`);
                    return false;
                }
                
                // 验证工厂函数
                if (!this.validateFactory(factory)) {
                    console.error(`模块 ${moduleName} 的工厂函数不符合规范`);
                    return false;
                }
                
                // 注册模块
                try {
                    ModuleRegistry.register(moduleName, dependencies, factory);
                    return true;
                } catch (error) {
                    console.error(`注册模块 ${moduleName} 失败:`, error);
                    return false;
                }
            },
            
            /**
             * 标准化模块初始化
             * @param {string} moduleName - 模块名称
             * @returns {Object|null} 模块实例
             */
            initializeModule: function(moduleName) {
                try {
                    const moduleInstance = ModuleRegistry.get(moduleName);
                    if (moduleInstance && typeof moduleInstance.init === 'function') {
                        moduleInstance.init();
                    }
                    return moduleInstance;
                } catch (error) {
                    console.error(`初始化模块 ${moduleName} 失败:`, error);
                    return null;
                }
            },
            
            /**
             * 标准化模块销毁
             * @param {string} moduleName - 模块名称
             * @returns {boolean} 是否销毁成功
             */
            destroyModule: function(moduleName) {
                try {
                    const moduleInstance = ModuleRegistry.get(moduleName);
                    if (moduleInstance && typeof moduleInstance.destroy === 'function') {
                        moduleInstance.destroy();
                    }
                    return true;
                } catch (error) {
                    console.error(`销毁模块 ${moduleName} 失败:`, error);
                    return false;
                }
            },
            
            /**
             * 获取模块信息
             * @param {string} moduleName - 模块名称
             * @returns {Object|null} 模块信息
             */
            getModuleInfo: function(moduleName) {
                try {
                    const registry = ModuleRegistry;
                    if (registry._modules && registry._modules[moduleName]) {
                        const module = registry._modules[moduleName];
                        return {
                            name: moduleName,
                            dependencies: module.dependencies,
                            initialized: module.initialized,
                            instance: module.instance
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`获取模块信息失败:`, error);
                    return null;
                }
            },
            
            /**
             * 获取所有模块信息
             * @returns {Array} 模块信息列表
             */
            getAllModulesInfo: function() {
                try {
                    const registry = ModuleRegistry;
                    if (registry._modules) {
                        return Object.keys(registry._modules).map(moduleName => {
                            return this.getModuleInfo(moduleName);
                        });
                    }
                    return [];
                } catch (error) {
                    console.error(`获取所有模块信息失败:`, error);
                    return [];
                }
            },
            
            /**
             * 验证所有模块的接口规范
             * @returns {Object} 验证结果
             */
            validateAllModules: function() {
                const modulesInfo = this.getAllModulesInfo();
                const results = {
                    valid: [],
                    invalid: []
                };
                
                modulesInfo.forEach(moduleInfo => {
                    if (moduleInfo.instance) {
                        if (this.validateModuleInterface(moduleInfo.instance)) {
                            results.valid.push(moduleInfo.name);
                        } else {
                            results.invalid.push(moduleInfo.name);
                        }
                    }
                });
                
                return results;
            }
        };
        
        return ModuleInterfaceSpec;
    });
})();