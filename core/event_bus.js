// event_bus.js - 事件总线系统
(function() {
    if (typeof ModuleRegistry !== 'undefined') {
        try {
            ModuleRegistry.register('EventBus', [], function() {
                const events = {};
                
                function on(eventName, callback) {
                    if (!events[eventName]) {
                        events[eventName] = [];
                    }
                    events[eventName].push(callback);
                }
                
                function off(eventName, callback) {
                    if (events[eventName]) {
                        events[eventName] = events[eventName].filter(cb => cb !== callback);
                    }
                }
                
                function emit(eventName, data) {
                    if (events[eventName]) {
                        events[eventName].forEach(callback => callback(data));
                    }
                }
                
                // 初始化方法
                function init() {
                    console.log('EventBus 模块初始化完成');
                }
                
                // 获取模块名称
                function getName() {
                    return 'EventBus';
                }
                
                // 导出全局接口（保持向后兼容）
                window.EventBus = {
                    init,
                    getName,
                    on,
                    off,
                    emit
                };
                
                return {
                    init,
                    getName,
                    on,
                    off,
                    emit
                };
            });
        } catch (error) {
            console.error('EventBus 模块注册失败:', error);
        }
    } else {
        console.error('ModuleRegistry 未定义，EventBus 模块注册失败');
    }
})();