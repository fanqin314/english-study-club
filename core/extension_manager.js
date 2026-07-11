// extension_manager.js - 扩展管理器

(function() {
    ModuleRegistry.register('ExtensionManager', ['EventBus'], function(EventBus) {
        /**
         * 扩展管理器
         * 提供插件化扩展机制，支持动态加载和管理扩展
         */
        const ExtensionManager = {
            // 扩展存储
            extensions: {},
            
            // 扩展点定义
            extensionPoints: {
                // 分析按钮扩展点
                analysisButtons: {
                    name: 'analysisButtons',
                    description: '分析按钮扩展点，用于添加新的分析功能按钮',
                    extensions: []
                },
                // 句子卡片扩展点
                sentenceCard: {
                    name: 'sentenceCard',
                    description: '句子卡片扩展点，用于在句子卡片上添加额外内容',
                    extensions: []
                },
                // 右键菜单扩展点
                contextMenu: {
                    name: 'contextMenu',
                    description: '右键菜单扩展点，用于添加右键菜单选项',
                    extensions: []
                },
                // 设置页面扩展点
                settings: {
                    name: 'settings',
                    description: '设置页面扩展点，用于添加设置选项',
                    extensions: []
                }
            },
            
            /**
             * 注册扩展
             * @param {Object} extension - 扩展对象
             * @returns {boolean} 是否注册成功
             */
            registerExtension: function(extension) {
                if (!extension.id || !extension.name) {
                    console.error('扩展必须包含id和name属性');
                    return false;
                }
                
                if (this.extensions[extension.id]) {
                    console.error(`扩展 ${extension.id} 已存在`);
                    return false;
                }
                
                // 验证扩展结构
                if (!extension.extensionPoints || !Array.isArray(extension.extensionPoints)) {
                    console.error('扩展必须包含extensionPoints数组');
                    return false;
                }
                
                // 注册扩展
                this.extensions[extension.id] = extension;
                
                // 注册到扩展点
                extension.extensionPoints.forEach(point => {
                    if (this.extensionPoints[point]) {
                        this.extensionPoints[point].extensions.push(extension.id);
                    }
                });
                
                console.log(`扩展 ${extension.name} (${extension.id}) 注册成功`);
                
                // 触发扩展注册事件
                EventBus.emit('extensionRegistered', extension);
                
                return true;
            },
            
            /**
             * 注销扩展
             * @param {string} extensionId - 扩展ID
             * @returns {boolean} 是否注销成功
             */
            unregisterExtension: function(extensionId) {
                if (!this.extensions[extensionId]) {
                    console.error(`扩展 ${extensionId} 不存在`);
                    return false;
                }
                
                const extension = this.extensions[extensionId];
                
                // 从扩展点中移除
                extension.extensionPoints.forEach(point => {
                    if (this.extensionPoints[point]) {
                        const index = this.extensionPoints[point].extensions.indexOf(extensionId);
                        if (index !== -1) {
                            this.extensionPoints[point].extensions.splice(index, 1);
                        }
                    }
                });
                
                // 移除扩展
                delete this.extensions[extensionId];
                
                console.log(`扩展 ${extensionId} 注销成功`);
                
                // 触发扩展注销事件
                EventBus.emit('extensionUnregistered', extensionId);
                
                return true;
            },
            
            /**
             * 获取扩展
             * @param {string} extensionId - 扩展ID
             * @returns {Object|null} 扩展对象
             */
            getExtension: function(extensionId) {
                return this.extensions[extensionId] || null;
            },
            
            /**
             * 获取所有扩展
             * @returns {Object} 所有扩展
             */
            getAllExtensions: function() {
                return { ...this.extensions };
            },
            
            /**
             * 获取指定扩展点的所有扩展
             * @param {string} extensionPoint - 扩展点名称
             * @returns {Array} 扩展列表
             */
            getExtensionsByPoint: function(extensionPoint) {
                if (!this.extensionPoints[extensionPoint]) {
                    console.error(`扩展点 ${extensionPoint} 不存在`);
                    return [];
                }
                
                return this.extensionPoints[extensionPoint].extensions.map(id => this.extensions[id]).filter(Boolean);
            },
            
            /**
             * 执行扩展点
             * @param {string} extensionPoint - 扩展点名称
             * @param {Object} context - 上下文对象
             * @returns {Array} 执行结果
             */
            executeExtensionPoint: function(extensionPoint, context) {
                const extensions = this.getExtensionsByPoint(extensionPoint);
                const results = [];
                
                extensions.forEach(extension => {
                    if (extension.execute && typeof extension.execute === 'function') {
                        try {
                            const result = extension.execute(extensionPoint, context);
                            results.push(result);
                        } catch (error) {
                            console.error(`执行扩展 ${extension.id} 时出错:`, error);
                        }
                    }
                });
                
                return results;
            },
            
            /**
             * 注册新的扩展点
             * @param {string} name - 扩展点名称
             * @param {string} description - 扩展点描述
             * @returns {boolean} 是否注册成功
             */
            registerExtensionPoint: function(name, description) {
                if (this.extensionPoints[name]) {
                    console.error(`扩展点 ${name} 已存在`);
                    return false;
                }
                
                this.extensionPoints[name] = {
                    name,
                    description,
                    extensions: []
                };
                
                console.log(`扩展点 ${name} 注册成功`);
                
                return true;
            },
            
            /**
             * 获取所有扩展点
             * @returns {Object} 所有扩展点
             */
            getExtensionPoints: function() {
                return { ...this.extensionPoints };
            },
            
            /**
             * 加载扩展
             * @param {string} url - 扩展URL
             * @returns {Promise<Object>} 加载结果
             */
            loadExtension: function(url) {
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = () => {
                        resolve({ success: true, message: '扩展加载成功' });
                    };
                    script.onerror = () => {
                        reject({ success: false, message: '扩展加载失败' });
                    };
                    document.head.appendChild(script);
                });
            },
            
            /**
             * 初始化方法
             */
            init: function() {
                console.log('ExtensionManager 模块初始化完成');
                console.log('已注册的扩展点:', Object.keys(this.extensionPoints));
            },
            
            /**
             * 获取模块名称
             * @returns {string} 模块名称
             */
            getName: function() {
                return 'ExtensionManager';
            }
        };
        
        return ExtensionManager;
    });
})();