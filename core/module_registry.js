// module_registry.js - 模块注册系统
(function() {
    const modules = {};
    
    function register(moduleName, dependencies, factory) {
        console.log(`注册模块: ${moduleName}, 依赖: [${dependencies.join(', ')}]`);
        
        // 验证模块名称
        const moduleNameRegex = /^[A-Z][a-zA-Z0-9]*$/;
        if (!moduleNameRegex.test(moduleName)) {
            console.error(`模块名称 ${moduleName} 不符合命名规范，应该是驼峰命名，首字母大写`);
        }
        
        // 验证依赖列表
        if (!Array.isArray(dependencies)) {
            console.error(`模块 ${moduleName} 的依赖列表应该是数组`);
            dependencies = [];
        }
        
        // 验证工厂函数
        if (typeof factory !== 'function') {
            console.error(`模块 ${moduleName} 的工厂函数应该是一个函数`);
            return;
        }
        
        modules[moduleName] = {
            dependencies,
            factory,
            instance: null,
            initialized: false
        };
        console.log(`模块 ${moduleName} 注册完成，当前模块列表:`, Object.keys(modules));
    }
    
    function initializeModule(moduleName, visited = new Set()) {
        const module = modules[moduleName];
        if (!module) return;
        
        // 检测循环依赖
        if (visited.has(moduleName)) {
            const cycle = [...visited, moduleName].join(' -> ');
            console.error(`检测到循环依赖: ${cycle}`);
            throw new Error(`模块初始化失败: 检测到循环依赖 - ${cycle}`);
        }
        
        // 标记当前模块为正在访问
        visited.add(moduleName);
        
        try {
            // 初始化依赖
            console.log(`初始化模块 ${moduleName} 的依赖: [${module.dependencies.join(', ')}]`);
            const dependencies = module.dependencies.map(dep => {
                // 递归初始化依赖，传递访问记录
                return get(dep, visited);
            });
            
            // 创建模块实例
            console.log(`执行模块 ${moduleName} 的工厂函数`);
            module.instance = module.factory(...dependencies);
            module.initialized = true;
            
            console.log(`模块 ${moduleName} 初始化完成`);
        } finally {
            // 移除访问标记
            visited.delete(moduleName);
        }
    }
    
    function get(moduleName, visited = new Set()) {
        console.log(`获取模块: ${moduleName}`);
        console.log(`当前模块列表:`, Object.keys(modules));
        if (!modules[moduleName]) {
            console.error(`模块 ${moduleName} 未注册`);
            return null;
        }
        
        if (!modules[moduleName].initialized) {
            console.log(`模块 ${moduleName} 未初始化，开始初始化`);
            try {
                initializeModule(moduleName, visited);
            } catch (error) {
                console.error(`初始化模块 ${moduleName} 失败:`, error);
                return null;
            }
        }
        
        return modules[moduleName].instance;
    }
    
    function initializeAll() {
        console.log('开始初始化所有模块');
        console.log(`当前模块列表:`, Object.keys(modules));
        Object.keys(modules).forEach(moduleName => {
            if (!modules[moduleName].initialized) {
                initializeModule(moduleName);
            }
        });
        console.log('所有模块初始化完成');
    }
    
    // 暴露内部模块列表用于测试
    const registry = {
        register,
        get,
        initializeAll
    };
    
    // 暴露内部模块列表（注意：这只是为了测试，生产环境应该移除）
    Object.defineProperty(registry, '_modules', {
        get: function() {
            return modules;
        },
        enumerable: true
    });
    
    window.ModuleRegistry = registry;
    
    console.log('ModuleRegistry 初始化完成');
    console.log('初始模块列表:', Object.keys(modules));
})();