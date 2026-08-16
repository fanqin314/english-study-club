// event_delegation.js - 事件委托模块
// 使用事件委托模式解决页面切换后按钮点击无响应的问题
// 绑定到稳定的父容器，DOM 重新创建后事件仍然有效

(function() {
    'use strict';
    
    // 稳定的父容器选择器 - 使用 document.body 确保页面切换后事件委托仍然有效
    // 原使用 #inputPanelContent，但页面切换时该容器会被重新创建导致事件失效
    const CONTAINER_SELECTOR = 'body';
    
    // 按钮处理函数映射
    // 每个处理函数接收事件对象作为参数
    const buttonHandlers = {
        // 解析按钮（始终执行解析，不做折叠切换）
        parseBtn: async function(e) {
            if (e) e.preventDefault();
            if (window.deepParse) {
                await window.deepParse();
            } else if (window.ModuleRegistry) {
                const ErrorHandler = window.ModuleRegistry.get('ErrorHandler');
                if (ErrorHandler) {
                    ErrorHandler.handleValidationError('深度解析功能未准备好，请先配置 API Key 并刷新页面。');
                }
            }
        },
        
        // 词性高亮按钮 - 左键点击
        highlightToggleBtn: async function(e) {
            // 使用 HighlightSwitch 统一处理
            if (window.HighlightSwitch && window.HighlightSwitch.handleClick) {
                window.HighlightSwitch.handleClick(e);
            } else if (window.toggleHighlight) {
                await window.toggleHighlight();
            }
        },
        
        // 词性高亮按钮 - 右键点击（打开设置）
        highlightToggleBtnContextMenu: function(e) {
            // 获取按钮元素
            const target = e.target.closest('button');
            if (target) {
                // 使用 HighlightSwitch 统一处理
                if (window.HighlightSwitch && window.HighlightSwitch.handleContextMenu) {
                    window.HighlightSwitch.handleContextMenu(e, target);
                }
            }
        },
        
        // 保存当前分析按钮
        saveAnalysisBtn: function(e) {
            if (e) e.preventDefault();
            if (window.onSaveAnalysis) {
                window.onSaveAnalysis();
            }
        },
        
        // 加载示例按钮
        loadExampleBtn: function(e) {
            if (e) e.preventDefault();
            if (window.onLoadExample) {
                window.onLoadExample();
            }
        },
        
        // 面板切换按钮
        panelToggleBtn: function(e) {
            if (e) e.preventDefault();
            if (window.toggleInputPanel) {
                window.toggleInputPanel();
            }
        },
        
        // 历史记录单词高亮按钮
        historyHighlightBtn: function(e) {
            if (window.HistoryHighlight && window.HistoryHighlight.handleClick) {
                window.HistoryHighlight.handleClick(e);
            }
        },
        
        // 历史记录单词高亮按钮 - 右键（打开词性设置）
        historyHighlightBtnContextMenu: function(e) {
            const target = e.target.closest('button');
            if (target && window.HighlightSwitch && window.HighlightSwitch.openSettings) {
                const rect = target.getBoundingClientRect();
                window.HighlightSwitch.openSettings(rect);
            }
        }
    };
    
    // 初始化事件委托
    function initEventDelegation() {
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) {
            // 如果容器不存在，等待 DOM 加载完成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initEventDelegation);
            } else {
                setTimeout(initEventDelegation, 100);
            }
            return;
        }
        
        // 绑定点击事件到父容器
        container.addEventListener('click', function(e) {
            // 查找被点击的按钮
            const target = e.target.closest('button');
            if (!target || !target.id) {
                return;
            }
            
            // 获取按钮 ID
            const buttonId = target.id;
            
            // 查找对应的处理函数
            const handler = buttonHandlers[buttonId];
            if (handler) {
                // 阻止事件冒泡
                e.stopPropagation();
                
                // 执行处理函数，传递事件对象
                try {
                    const result = handler(e);
                    // 如果是 Promise，等待完成
                    if (result && typeof result.then === 'function') {
                        result.catch(function(err) {
                            console.error('按钮处理函数执行失败:', err);
                        });
                    }
                } catch (err) {
                    console.error('按钮处理函数执行失败:', err);
                }
            }
        });
        
        // 绑定右键菜单事件到父容器（处理右键点击）
        container.addEventListener('contextmenu', function(e) {
            // 查找被点击的按钮
            const target = e.target.closest('button');
            if (!target || !target.id) {
                return;
            }
            
            // 获取按钮 ID
            const buttonId = target.id;
            
            // 查找对应的右键处理函数（按钮ID + 'ContextMenu'）
            const handler = buttonHandlers[buttonId + 'ContextMenu'];
            if (handler) {
                // 阻止默认右键菜单
                e.preventDefault();
                // 阻止事件冒泡
                e.stopPropagation();
                
                // 执行处理函数，传递事件对象
                try {
                    handler(e);
                } catch (err) {
                    console.error('右键菜单处理函数执行失败:', err);
                }
            }
        });
        
        // 绑定单词点击事件（处理句子中单词的点击）
        container.addEventListener('click', function(e) {
            // 查找被点击的单词 span
            const wordSpan = e.target.closest('.word-span');
            if (!wordSpan) {
                return;
            }
            
            // 获取单词和句子索引
            const word = wordSpan.dataset.word;
            if (!word) {
                return;
            }
            
            // 从句子卡片获取句子索引
            const card = wordSpan.closest('.sentence-card');
            if (!card) {
                return;
            }
            const sentenceIndex = parseInt(card.dataset.index);
            if (isNaN(sentenceIndex)) {
                return;
            }
            
            // 阻止事件冒泡
            e.stopPropagation();
            
            // 调用单词点击处理函数
            handleWordClick(word, sentenceIndex, wordSpan);
        });
        
        /**
         * 处理单词点击
         * @param {string} word - 单词
         * @param {number} sentenceIndex - 句子索引
         * @param {HTMLElement} targetElement - 点击的元素
         */
        function handleWordClick(word, sentenceIndex, targetElement) {
            // 获取词性数据
            let pos = '';
            let meaning = '';
            
            // 从缓存获取词性数据
            if (window.CacheManager) {
                const posCache = window.CacheManager.getSentenceCache(sentenceIndex, 'pos');
                if (posCache) {
                    try {
                        const posData = typeof posCache === 'string' ? JSON.parse(posCache) : posCache;
                        if (posData.pos && Array.isArray(posData.pos)) {
                            const wordData = posData.pos.find(p => p.word && p.word.toLowerCase() === word.toLowerCase());
                            if (wordData) {
                                pos = wordData.pos || '';
                                meaning = wordData.meaning || '';
                            }
                        }
                    } catch (e) {
                        console.warn('[EventDelegation] 解析词性数据失败:', e);
                    }
                }
            }
            
            // 直接调用 PosButton 的 openAddWordBubble 函数
            if (window.PosButton && typeof window.PosButton.openAddWordBubble === 'function') {
                window.PosButton.openAddWordBubble(word, pos, meaning, targetElement);
            }
        }
        
        console.log('[EventDelegation] 事件委托已初始化');
    }
    
    // 导出接口
    window.EventDelegation = {
        init: initEventDelegation,
        registerHandler: function(buttonId, handler) {
            buttonHandlers[buttonId] = handler;
        },
        unregisterHandler: function(buttonId) {
            delete buttonHandlers[buttonId];
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEventDelegation);
    } else {
        initEventDelegation();
    }
})();