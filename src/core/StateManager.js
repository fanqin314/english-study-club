/**
 * StateManager - 状态管理器
 *
 * 用途：统一管理应用状态，支持订阅和通知
 * 创建日期：2026-05-02
 */

(function() {
    'use strict';

    class StateManager {
        /**
         * 构造函数
         * @param {object} initialState - 初始状态
         */
        constructor(initialState = {}) {
            this.state = { ...initialState };
            this.listeners = new Set();
            this.history = [{ ...this.state }];
            this.maxHistory = 50;
        }

        /**
         * 获取当前状态副本
         * @returns {object} 当前状态
         */
        getState() {
            return { ...this.state };
        }

        /**
         * 获取状态的某个字段
         * @param {string} key - 状态键
         * @returns {any} 状态值
         */
        get(key) {
            return this.state[key];
        }

        /**
         * 更新状态
         * @param {object} newState - 新状态（部分更新）
         */
        setState(newState) {
            const oldState = { ...this.state };
            this.state = { ...this.state, ...newState };

            // 记录历史
            this.history.push({ ...this.state });
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }

            console.log('[StateManager] State updated:', {
                old: oldState,
                new: this.state
            });

            this.notifyListeners(oldState, this.state);
        }

        /**
         * 订阅状态变更
         * @param {Function} callback - 状态变更时的回调函数 (newState, oldState)
         * @returns {Function} 取消订阅的函数
         */
        subscribe(callback) {
            this.listeners.add(callback);
            console.log('[StateManager] Subscribed listener');

            // 返回取消订阅函数
            return () => {
                this.listeners.delete(callback);
                console.log('[StateManager] Unsubscribed listener');
            };
        }

        /**
         * 通知所有监听器
         * @param {object} oldState - 旧状态
         * @param {object} newState - 新状态
         */
        notifyListeners(oldState, newState) {
            this.listeners.forEach(callback => {
                try {
                    callback(newState, oldState);
                } catch (error) {
                    console.error('[StateManager] 监听器执行出错:', error);
                }
            });
        }

        /**
         * 回退到前一个状态
         */
        undo() {
            if (this.history.length > 1) {
                this.history.pop(); // 移除当前状态
                const previous = this.history[this.history.length - 1];
                this.state = { ...previous };
                console.log('[StateManager] Undo:', this.state);
                this.notifyListeners(null, this.state);
            }
        }

        /**
         * 获取状态历史
         * @returns {Array} 状态历史记录
         */
        getHistory() {
            return [...this.history];
        }

        /**
         * 清空所有监听
         */
        destroy() {
            this.listeners.clear();
            this.history = [];
            console.log('[StateManager] 已销毁');
        }
    }

    // 创建全局状态管理器实例
    const globalStateManager = new StateManager({
        theme: 'light',
        currentModule: 'deep-parse',
        vocabExpanded: true,
        historyExpanded: true
    });

    // 注册到模块系统
    if (window.ModuleRegistry) {
        window.ModuleRegistry.register('StateManager', [], function() {
            return globalStateManager;
        });
    }

    // 暴露到全局
    window.StateManager = StateManager;
    window.globalState = globalStateManager;

    console.log('[StateManager] 状态管理器已加载');
})();
