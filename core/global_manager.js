// global_manager.js - 全局对象管理模块

(function() {
    ModuleRegistry.register('GlobalManager', [], function() {
        // 全局对象存储
        const globalObjects = {
            VocabData: null,
            HistoryManager: null,
            APIRequest: null,
            SentenceRenderer: null,
            CacheManager: null,
            MainButtonManager: null,
            HighlightService: null,
            FlashcardMode: null,
            FlashcardUI: null
        };

        /**
         * 设置全局对象
         * @param {string} name - 对象名称
         * @param {Object} obj - 对象实例
         */
        function setGlobalObject(name, obj) {
            if (name && obj) {
                globalObjects[name] = obj;
                console.log(`[GlobalManager] 已设置全局对象: ${name}`);
            }
        }

        /**
         * 获取全局对象
         * @param {string} name - 对象名称
         * @returns {Object|null} 全局对象实例
         */
        function getGlobalObject(name) {
            const obj = globalObjects[name];
            if (!obj) {
                console.warn(`[GlobalManager] 全局对象 ${name} 未设置`);
            }
            return obj;
        }

        /**
         * 初始化全局对象
         * @param {Object} objects - 全局对象集合
         */
        function initialize(objects) {
            if (objects && typeof objects === 'object') {
                Object.keys(objects).forEach(key => {
                    setGlobalObject(key, objects[key]);
                });
            }
        }

        /**
         * 获取所有全局对象
         * @returns {Object} 所有全局对象
         */
        function getAllGlobalObjects() {
            return { ...globalObjects };
        }

        /**
         * 检查全局对象是否存在
         * @param {string} name - 对象名称
         * @returns {boolean} 是否存在
         */
        function hasGlobalObject(name) {
            return globalObjects[name] !== null && globalObjects[name] !== undefined;
        }

        /**
         * 清除全局对象
         * @param {string} name - 对象名称
         */
        function clearGlobalObject(name) {
            if (name) {
                globalObjects[name] = null;
                console.log(`[GlobalManager] 已清除全局对象: ${name}`);
            }
        }

        /**
         * 清除所有全局对象
         */
        function clearAllGlobalObjects() {
            Object.keys(globalObjects).forEach(key => {
                globalObjects[key] = null;
            });
            console.log('[GlobalManager] 已清除所有全局对象');
        }

        return {
            setGlobalObject,
            getGlobalObject,
            initialize,
            getAllGlobalObjects,
            hasGlobalObject,
            clearGlobalObject,
            clearAllGlobalObjects
        };
    });
})();