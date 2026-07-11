/**
 * BaseComponent - 统一组件基类
 *
 * 用途：所有 UI 组件的基类，提供统一的生命周期和状态管理
 * 创建日期：2026-05-02
 */

(function() {
    'use strict';

    class BaseComponent {
        /**
         * 构造函数
         * @param {HTMLElement|string} container - 组件挂载容器，可以是元素或选择器
         * @param {object} options - 配置选项
         */
        constructor(container, options = {}) {
            this.container = typeof container === 'string'
                ? document.querySelector(container)
                : container;

            if (!this.container) {
                console.error(`[BaseComponent] 容器找不到: ${container}`);
            }

            this.options = { ...this.getDefaultOptions(), ...options };
            this.state = {};
            this.eventHandlers = [];
            this.isMounted = false;
            this.name = this.constructor.name;

            console.log(`[${this.name}] 组件初始化`);
        }

        /**
         * 获取默认配置选项
         * @returns {object} 默认配置
         */
        getDefaultOptions() {
            return {};
        }

        /**
         * 初始化组件（仅调用一次）
         */
        init() {
            console.log(`[${this.name}] init`);
            this.onInit();
        }

        /**
         * 组件挂载到 DOM 后调用
         */
        mount() {
            console.log(`[${this.name}] mount`);
            this.isMounted = true;
            this.onMount();
            this.render();
        }

        /**
         * 渲染组件内容
         */
        render() {
            console.log(`[${this.name}] render`);
            this.onRender();
        }

        /**
         * 更新组件状态
         * @param {object} newState - 新的状态数据
         */
        update(newState) {
            const oldState = { ...this.state };
            this.state = { ...this.state, ...newState };
            console.log(`[${this.name}] update`, { oldState, newState: this.state });
            this.onUpdate(oldState, this.state);
            this.render();
        }

        /**
         * 销毁组件，清理资源
         */
        destroy() {
            console.log(`[${this.name}] destroy`);
            this.onDestroy();
            this.clearEventHandlers();
            if (this.container) {
                this.container.innerHTML = '';
            }
            this.isMounted = false;
        }

        /**
         * 生命周期钩子：初始化时
         */
        onInit() {}

        /**
         * 生命周期钩子：挂载后
         */
        onMount() {}

        /**
         * 生命周期钩子：渲染时
         */
        onRender() {}

        /**
         * 生命周期钩子：状态更新时
         * @param {object} oldState - 旧状态
         * @param {object} newState - 新状态
         */
        onUpdate(oldState, newState) {}

        /**
         * 生命周期钩子：销毁前
         */
        onDestroy() {}

        /**
         * 绑定事件并自动管理
         * @param {string|HTMLElement} element - 元素或选择器
         * @param {string} event - 事件名称
         * @param {Function} handler - 事件处理函数
         */
        on(element, event, handler) {
            const el = typeof element === 'string'
                ? this.container?.querySelector(element)
                : element;

            if (!el) {
                console.warn(`[${this.name}] 元素找不到: ${element}`);
                return;
            }

            const boundHandler = handler.bind(this);
            el.addEventListener(event, boundHandler);
            this.eventHandlers.push({ el, event, handler: boundHandler });
        }

        /**
         * 清理所有事件监听器
         */
        clearEventHandlers() {
            this.eventHandlers.forEach(({ el, event, handler }) => {
                try {
                    el.removeEventListener(event, handler);
                } catch (e) {
                    console.warn(`[${this.name}] 移除事件监听器失败:`, e);
                }
            });
            this.eventHandlers = [];
        }

        /**
         * 安全地渲染模板到容器
         * @param {string} template - HTML 模板
         * @param {HTMLElement} [target] - 目标容器，默认为组件容器
         */
        renderTemplate(template, target) {
            const container = target || this.container;
            if (container) {
                container.innerHTML = template;
            }
        }

        /**
         * 更新组件状态（别名方法）
         * @param {object} newState - 新状态
         */
        setState(newState) {
            this.update(newState);
        }

        /**
         * 获取当前状态
         * @returns {object} 状态副本
         */
        getState() {
            return { ...this.state };
        }
    }

    // 注册到模块系统
    if (window.ModuleRegistry) {
        window.ModuleRegistry.register('BaseComponent', [], function() {
            return BaseComponent;
        });
    }

    // 同时暴露到全局供直接使用
    window.BaseComponent = BaseComponent;

    console.log('[BaseComponent] 基类已加载');
})();
