// performance.js - 性能优化模块
(function() {
    ModuleRegistry.register('Performance', [], function() {
        // 缓存存储
        const cache = new Map();
        const CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟过期

        // DOM操作优化 - 使用文档片段
        function createDocumentFragment(html) {
            const fragment = document.createDocumentFragment();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
            }
            return fragment;
        }

        // 批量DOM更新
        function batchDOMUpdates(updates) {
            requestAnimationFrame(() => {
                updates.forEach(update => {
                    update();
                });
            });
        }

        // 防抖函数
        function debounce(func, wait = 300) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // localStorage批量操作
        function batchLocalStorageOperations(operations) {
            const results = {};
            operations.forEach(op => {
                try {
                    if (op.type === 'get') {
                        results[op.key] = localStorage.getItem(op.key);
                    } else if (op.type === 'set') {
                        localStorage.setItem(op.key, op.value);
                        results[op.key] = op.value;
                    } else if (op.type === 'remove') {
                        localStorage.removeItem(op.key);
                        results[op.key] = null;
                    }
                } catch (e) {
                    console.error('localStorage操作失败:', e);
                }
            });
            return results;
        }

        // API请求并行化
        async function parallelAPIRequests(requests) {
            const promises = requests.map(req => req());
            return await Promise.all(promises);
        }

        // API请求缓存 - 双重缓存：localStorage持久化 + 内存缓存
        function cacheAPIRequest(key, requestFn) {
            const localStorageKey = `api_cache_${key}`;
            
            // 1. 优先检查localStorage缓存（跨会话持久化）
            try {
                const localStorageData = localStorage.getItem(localStorageKey);
                if (localStorageData) {
                    const parsed = JSON.parse(localStorageData);
                    if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
                        trackCacheHit();
                        return Promise.resolve(parsed.data);
                    }
                }
            } catch (e) {
                console.warn('localStorage读取失败:', e);
            }

            // 2. 检查内存缓存（更快的访问速度）
            const cached = cache.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
                trackCacheHit();
                return Promise.resolve(cached.data);
            }

            trackCacheMiss();

            // 3. 执行请求并双重缓存
            return requestFn().then(data => {
                // 内存缓存
                cache.set(key, {
                    data,
                    timestamp: Date.now()
                });
                
                // localStorage持久化缓存
                try {
                    localStorage.setItem(localStorageKey, JSON.stringify({
                        data,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    // localStorage 已满，清理旧数据后重试
                    clearOldLocalStorageCache();
                    try {
                        localStorage.setItem(localStorageKey, JSON.stringify({
                            data,
                            timestamp: Date.now()
                        }));
                    } catch (e2) {
                        console.warn('localStorage写入失败，存储空间可能已满:', e2);
                    }
                }
                
                return data;
            });
        }

        // 清理localStorage中过期的缓存
        function clearOldLocalStorageCache() {
            const now = Date.now();
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('api_cache_')) {
                        try {
                            const data = JSON.parse(localStorage.getItem(key));
                            if (data && now - data.timestamp > CACHE_EXPIRY) {
                                localStorage.removeItem(key);
                            }
                        } catch (e) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            } catch (e) {
                console.warn('清理localStorage缓存失败:', e);
            }
        }

        // 清除过期缓存
        function clearExpiredCache() {
            const now = Date.now();
            cache.forEach((value, key) => {
                if (now - value.timestamp > CACHE_EXPIRY) {
                    cache.delete(key);
                }
            });
        }

        // 清除所有缓存
        function clearAllCache() {
            cache.clear();
        }

        // 内存泄漏防护 - 事件监听器管理
        const eventListeners = new Map();

        function addEventListener(element, event, handler, options) {
            if (!element) return;
            element.addEventListener(event, handler, options);
            
            const key = `${element.constructor.name}_${event}`;
            if (!eventListeners.has(key)) {
                eventListeners.set(key, []);
            }
            eventListeners.get(key).push({ element, event, handler, options });
        }

        function removeEventListener(element, event, handler) {
            if (!element) return;
            element.removeEventListener(event, handler);
            
            const key = `${element.constructor.name}_${event}`;
            const listeners = eventListeners.get(key);
            if (listeners) {
                const index = listeners.findIndex(l => l.element === element && l.handler === handler);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            }
        }

        function removeAllEventListeners(element) {
            if (!element) return;
            
            const keys = Array.from(eventListeners.keys());
            keys.forEach(key => {
                const listeners = eventListeners.get(key) || [];
                const toRemove = listeners.filter(l => l.element === element);
                toRemove.forEach(l => {
                    l.element.removeEventListener(l.event, l.handler);
                });
                
                // 更新监听器列表
                const remaining = listeners.filter(l => l.element !== element);
                if (remaining.length === 0) {
                    eventListeners.delete(key);
                } else {
                    eventListeners.set(key, remaining);
                }
            });
        }

        // 图片懒加载
        function setupLazyLoading() {
            const lazyImages = document.querySelectorAll('img[data-src]');
            
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            });
            
            lazyImages.forEach(img => {
                imageObserver.observe(img);
            });
        }

        // 性能监控
        const performanceMetrics = {
            apiRequests: 0,
            domUpdates: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        function trackAPIRequest() {
            performanceMetrics.apiRequests++;
        }

        function trackDOMUpdate() {
            performanceMetrics.domUpdates++;
        }

        function trackCacheHit() {
            performanceMetrics.cacheHits++;
        }

        function trackCacheMiss() {
            performanceMetrics.cacheMisses++;
        }

        function getPerformanceMetrics() {
            return { ...performanceMetrics };
        }

        function resetPerformanceMetrics() {
            performanceMetrics.apiRequests = 0;
            performanceMetrics.domUpdates = 0;
            performanceMetrics.cacheHits = 0;
            performanceMetrics.cacheMisses = 0;
        }

        // 定期清除过期缓存
        setInterval(clearExpiredCache, 60 * 1000); // 每分钟清除一次

        // 初始化
        function init() {
        }

        // 获取模块名称
        function getName() {
            return 'Performance';
        }

        return {
            init,
            getName,
            createDocumentFragment,
            batchDOMUpdates,
            debounce,
            batchLocalStorageOperations,
            parallelAPIRequests,
            cacheAPIRequest,
            clearOldLocalStorageCache,
            clearExpiredCache,
            clearAllCache,
            addEventListener,
            removeEventListener,
            removeAllEventListeners,
            setupLazyLoading,
            trackAPIRequest,
            trackDOMUpdate,
            trackCacheHit,
            trackCacheMiss,
            getPerformanceMetrics,
            resetPerformanceMetrics
        };
    });
})();