/**
 * ComponentRegistry - 组件注册表
 *
 * 用途：统一管理和发现所有组件，便于AI识别和使用
 * 创建日期：2026-05-02
 */

(function() {
    'use strict';

    class ComponentRegistry {
        constructor() {
            this.components = new Map();
            this.initializers = new Map();
            this.instances = new Map();
        }

        /**
         * 注册组件类
         * @param {string} name - 组件名称（唯一标识）
         * @param {Function} componentClass - 组件类
         * @param {string} description - 组件描述
         */
        register(name, componentClass, description = '') {
            if (this.components.has(name)) {
                console.warn(`[ComponentRegistry] 组件 ${name} 已存在，将被覆盖`);
            }

            this.components.set(name, {
                class: componentClass,
                description
            });

            console.log(`[ComponentRegistry] 已注册组件: ${name}`, description);
        }

        /**
         * 注册组件初始化函数（延迟初始化）
         * @param {string} name - 组件名称
         * @param {Function} initializer - 初始化函数，返回组件实例
         */
        registerLazy(name, initializer, description = '') {
            this.initializers.set(name, {
                initializer,
                description
            });

            console.log(`[ComponentRegistry] 已注册延迟组件: ${name}`);
        }

        /**
         * 获取组件类
         * @param {string} name - 组件名称
         * @returns {Function|null} 组件类
         */
        getClass(name) {
            return this.components.get(name)?.class || null;
        }

        /**
         * 创建并挂载组件
         * @param {string} name - 组件名称
         * @param {HTMLElement|string} container - 容器
         * @param {object} options - 配置选项
         * @returns {object|null} 组件实例
         */
        create(name, container, options = {}) {
            let ComponentClass = this.getClass(name);

            // 如果没有直接注册，尝试延迟初始化
            if (!ComponentClass && this.initializers.has(name)) {
                const { initializer } = this.initializers.get(name);
                const instance = initializer(container, options);
                this.instances.set(name, instance);
                return instance;
            }

            if (!ComponentClass) {
                console.error(`[ComponentRegistry] 组件 ${name} 未注册`);
                return null;
            }

            const instance = new ComponentClass(container, options);
            this.instances.set(name, instance);

            console.log(`[ComponentRegistry] 创建组件: ${name}`);
            return instance;
        }

        /**
         * 获取已创建的组件实例
         * @param {string} name - 组件名称
         * @returns {object|null} 组件实例
         */
        getInstance(name) {
            return this.instances.get(name) || null;
        }

        /**
         * 获取所有注册的组件列表
         * @returns {Array} 组件信息列表
         */
        list() {
            const result = [];

            this.components.forEach((info, name) => {
                result.push({
                    name,
                    type: 'registered',
                    description: info.description
                });
            });

            this.initializers.forEach((info, name) => {
                result.push({
                    name,
                    type: 'lazy',
                    description: info.description
                });
            });

            return result;
        }

        /**
         * 销毁组件实例
         * @param {string} name - 组件名称
         */
        destroy(name) {
            const instance = this.instances.get(name);
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
                this.instances.delete(name);
                console.log(`[ComponentRegistry] 已销毁组件: ${name}`);
            }
        }

        /**
         * 销毁所有组件实例
         */
        destroyAll() {
            this.instances.forEach((instance, name) => {
                if (typeof instance.destroy === 'function') {
                    instance.destroy();
                }
            });
            this.instances.clear();
            console.log('[ComponentRegistry] 已销毁所有组件');
        }
    }

    // 创建全局实例
    const componentRegistry = new ComponentRegistry();

    // 注册到模块系统
    if (window.ModuleRegistry) {
        window.ModuleRegistry.register('ComponentRegistry', [], function() {
            return componentRegistry;
        });
    }

    // 暴露到全局
    window.ComponentRegistry = ComponentRegistry;
    window.componentRegistry = componentRegistry;

    console.log('[ComponentRegistry] 组件注册表已加载');
})();
