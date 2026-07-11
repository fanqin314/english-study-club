// dom_helper.js - DOM操作工具类
// 提供标准化的DOM操作方法，遵循相对查询和作用域限定原则

(function() {
    'use strict';
    
    /**
     * DOM帮助类
     * 提供标准化的DOM操作方法
     */
    class DomHelper {
        /**
         * 查找最近的匹配祖先元素
         * @param {Element} element - 起始元素
         * @param {string} selector - CSS选择器
         * @returns {Element|null} 找到的元素或null
         */
        static closest(element, selector) {
            if (!element || !selector) return null;
            
            if (typeof element.closest === 'function') {
                return element.closest(selector);
            }
            
            // 兼容旧版浏览器
            let current = element;
            while (current && current !== document.body) {
                if (DomHelper.matches(current, selector)) {
                    return current;
                }
                current = current.parentElement;
            }
            return null;
        }
        
        /**
         * 检查元素是否匹配选择器
         * @param {Element} element - 要检查的元素
         * @param {string} selector - CSS选择器
         * @returns {boolean} 是否匹配
         */
        static matches(element, selector) {
            if (!element) return false;
            
            if (typeof element.matches === 'function') {
                return element.matches(selector);
            }
            
            // 兼容旧版浏览器
            if (typeof element.msMatchesSelector === 'function') {
                return element.msMatchesSelector(selector);
            }
            
            return false;
        }
        
        /**
         * 在指定范围内查询元素
         * @param {Element|string} context - 父元素或选择器
         * @param {string} selector - CSS选择器
         * @returns {NodeList} 匹配的元素列表
         */
        static queryAll(context, selector) {
            const parent = typeof context === 'string' 
                ? document.querySelector(context) 
                : context;
            
            if (!parent) return [];
            return parent.querySelectorAll(selector);
        }
        
        /**
         * 在指定范围内查询单个元素
         * @param {Element|string} context - 父元素或选择器
         * @param {string} selector - CSS选择器
         * @returns {Element|null} 找到的元素或null
         */
        static query(context, selector) {
            const parent = typeof context === 'string' 
                ? document.querySelector(context) 
                : context;
            
            if (!parent) return null;
            return parent.querySelector(selector);
        }
        
        /**
         * 从触发元素获取上下文索引
         * @param {Element} target - 触发事件的元素
         * @param {string} containerSelector - 容器选择器
         * @param {string} indexAttr - 索引属性名
         * @returns {number|null} 索引值或null
         */
        static getContextIndex(target, containerSelector, indexAttr = 'data-index') {
            const container = DomHelper.closest(target, containerSelector);
            if (!container) return null;
            
            const index = container.getAttribute(indexAttr);
            return index !== null ? parseInt(index, 10) : null;
        }
        
        /**
         * 安全移除元素
         * @param {Element} element - 要移除的元素
         */
        static remove(element) {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        
        /**
         * 创建元素
         * @param {string} tag - 标签名
         * @param {Object} attributes - 属性对象
         * @param {string|Array} children - 子元素或文本
         * @returns {Element} 创建的元素
         */
        static create(tag, attributes = {}, children = null) {
            const element = document.createElement(tag);
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'dataset') {
                    Object.entries(value).forEach(([dataKey, dataValue]) => {
                        element.dataset[dataKey] = dataValue;
                    });
                } else if (key.startsWith('on') && typeof value === 'function') {
                    const eventName = key.slice(2).toLowerCase();
                    element.addEventListener(eventName, value);
                } else {
                    element.setAttribute(key, value);
                }
            });
            
            if (children) {
                if (typeof children === 'string') {
                    element.textContent = children;
                } else if (Array.isArray(children)) {
                    children.forEach(child => {
                        if (typeof child === 'string') {
                            element.appendChild(document.createTextNode(child));
                        } else if (child instanceof Node) {
                            element.appendChild(child);
                        }
                    });
                }
            }
            
            return element;
        }
        
        /**
         * 替换元素（保持父元素引用）
         * @param {Element} oldElement - 要替换的元素
         * @param {Element} newElement - 新元素
         */
        static replace(oldElement, newElement) {
            if (oldElement && oldElement.parentNode && newElement) {
                oldElement.parentNode.replaceChild(newElement, oldElement);
            }
        }
        
        /**
         * 克隆元素（带事件解绑）
         * @param {Element} element - 要克隆的元素
         * @returns {Element} 克隆的新元素（无事件监听器）
         */
        static clone(element) {
            if (!element) return null;
            return element.cloneNode(true);
        }
        
        /**
         * 检查元素是否在视口内
         * @param {Element} element - 要检查的元素
         * @returns {boolean} 是否在视口内
         */
        static isInViewport(element) {
            if (!element) return false;
            
            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }
    }
    
    // 导出全局接口
    window.DomHelper = DomHelper;
    
    console.log('[DomHelper] DOM工具类已初始化');
})();
