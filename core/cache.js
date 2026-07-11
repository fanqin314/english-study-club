// 缓存管理.js - 统一管理句子解析缓存、全文翻译等

(function() {
    if (typeof ModuleRegistry !== 'undefined') {
        ModuleRegistry.register('CacheManager', [], function() {
            // 缓存键名
            const SENTENCE_DATA_KEY = 'sentenceDataCache';
            const FULL_TRANSLATION_KEY = 'fullTranslationCache';
            const SAVE_TIMEOUT_DELAY = 1000; // 提取魔法数字为常量
            
            let saveTimeout = null;
            let isDirty = false; // 标记数据是否已修改

            // 内存缓存（用于当前会话）
            let memoryCache = {
                sentences: [],
                sentenceData: {},
                fullTranslation: '',
                originalText: ''
            };

    // 从 localStorage 加载缓存（初始化时调用）
    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(SENTENCE_DATA_KEY);
            if (saved) {
                memoryCache.sentenceData = JSON.parse(saved);
            } else {
                memoryCache.sentenceData = {};
            }
            const trans = localStorage.getItem(FULL_TRANSLATION_KEY);
            if (trans) {
                memoryCache.fullTranslation = trans;
            } else {
                memoryCache.fullTranslation = '';
            }
            const original = localStorage.getItem('originalTextCache');
            if (original) {
                memoryCache.originalText = original;
            } else {
                memoryCache.originalText = '';
            }
        } catch(e) {
            console.warn('加载缓存失败', e);
            memoryCache.sentenceData = {};
            memoryCache.fullTranslation = '';
            memoryCache.originalText = '';
            // 显示友好的错误提示
            if (typeof showToast === 'function') {
                showToast('加载缓存失败，将使用新的缓存');
            }
        }
    }

    // 保存所有缓存到 localStorage
    function saveToLocalStorage() {
        try {
            // 检查存储空间
            if (localStorage.length >= 50) { // 简单的存储项数量检查
                // 清理旧缓存
                clearOldCache();
            }
            
            localStorage.setItem(SENTENCE_DATA_KEY, JSON.stringify(memoryCache.sentenceData));
            localStorage.setItem(FULL_TRANSLATION_KEY, memoryCache.fullTranslation);
            localStorage.setItem('originalTextCache', memoryCache.originalText);
            isDirty = false;
        } catch(e) {
            console.warn('保存缓存失败', e);
            // 显示友好的错误提示
            if (typeof showToast === 'function') {
                if (e.name === 'QuotaExceededError') {
                    // 尝试清理所有缓存
                    resetAllCache();
                    showToast('存储空间不足，已清理缓存');
                } else if (e.name === 'SecurityError') {
                    showToast('安全错误：无法访问存储');
                } else {
                    showToast('保存缓存失败，请重试');
                }
            }
        }
    }

    // 清理旧缓存
    function clearOldCache() {
        try {
            // 只保留最近使用的缓存
            const keys = Object.keys(memoryCache.sentenceData);
            if (keys.length > 20) {
                // 按时间排序（假设键是索引）
                const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
                // 删除最早的一半缓存
                const keysToRemove = sortedKeys.slice(0, Math.floor(keys.length / 2));
                keysToRemove.forEach(key => {
                    delete memoryCache.sentenceData[key];
                });
                console.log(`已清理 ${keysToRemove.length} 个旧缓存项`);
            }
        } catch (e) {
            console.warn('清理旧缓存失败:', e);
        }
    }

    // 防抖保存
    function debouncedSave() {
        isDirty = true;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (isDirty) {
                saveToLocalStorage();
            }
        }, SAVE_TIMEOUT_DELAY);
    }

    // 获取句子解析缓存（某一句的某一项）
    function getSentenceCache(idx, type) {
        if (!memoryCache.sentenceData[idx]) return null;
        return memoryCache.sentenceData[idx][type] || null;
    }

    // 获取所有句子的解析缓存
    function getAllSentenceData() {
        return memoryCache.sentenceData;
    }

    // 设置句子解析缓存（某一句的某一项）
    function setSentenceCache(idx, type, data) {
        if (!memoryCache.sentenceData[idx]) memoryCache.sentenceData[idx] = {};
        memoryCache.sentenceData[idx][type] = data;
        debouncedSave();
    }

    // 批量设置句子解析缓存（减少写入次数）
    function batchSetSentenceCache(updates) {
        updates.forEach(({ idx, type, data }) => {
            if (!memoryCache.sentenceData[idx]) memoryCache.sentenceData[idx] = {};
            memoryCache.sentenceData[idx][type] = data;
        });
        debouncedSave();
    }

    // 清除某一句的所有缓存
    function clearSentenceCache(idx) {
        if (memoryCache.sentenceData[idx]) {
            delete memoryCache.sentenceData[idx];
            debouncedSave();
        }
    }

    // 清除所有句子缓存（但保留全文翻译）
    function clearAllSentenceCache() {
        memoryCache.sentenceData = {};
        debouncedSave();
    }

    // 获取全文翻译
    function getFullTranslation() {
        return memoryCache.fullTranslation;
    }

    // 设置全文翻译
    function setFullTranslation(translation) {
        memoryCache.fullTranslation = translation;
        debouncedSave();
    }

    // 清除全文翻译
    function clearFullTranslation() {
        memoryCache.fullTranslation = '';
        debouncedSave();
    }

    // 获取句子数组（仅内存，不持久化）
    function getSentences() {
        return memoryCache.sentences;
    }

    function setSentences(sentencesArray) {
        memoryCache.sentences = sentencesArray;
    }

    // 获取原始文本
    function getOriginalText() {
        return memoryCache.originalText;
    }

    // 设置原始文本
    function setOriginalText(text) {
        memoryCache.originalText = text;
        debouncedSave();
    }

    // 重置所有缓存（清空所有）
    function resetAllCache() {
        memoryCache.sentences = [];
        memoryCache.sentenceData = {};
        memoryCache.fullTranslation = '';
        memoryCache.originalText = '';
        debouncedSave();
    }

    // 强制立即保存（用于页面卸载前）
    function forceSave() {
        if (isDirty) {
            clearTimeout(saveTimeout);
            saveToLocalStorage();
        }
    }

            // 初始化方法
            function init() {
                loadFromLocalStorage();
                // 页面卸载前强制保存
                window.addEventListener('beforeunload', forceSave);
                console.log('CacheManager 模块初始化完成');
            }

            // 获取模块名称
            function getName() {
                return 'CacheManager';
            }

            // 导出全局对象（保持向后兼容）
            window.CacheManager = {
                init,
                getName,
                loadFromLocalStorage,
                getSentenceCache,
                getAllSentenceData,
                setSentenceCache,
                batchSetSentenceCache,
                clearSentenceCache,
                clearAllSentenceCache,
                getFullTranslation,
                setFullTranslation,
                clearFullTranslation,
                getSentences,
                setSentences,
                getOriginalText,
                setOriginalText,
                resetAllCache,
                forceSave
            };

            return {
                init,
                getName,
                loadFromLocalStorage,
                getSentenceCache,
                getAllSentenceData,
                setSentenceCache,
                batchSetSentenceCache,
                clearSentenceCache,
                clearAllSentenceCache,
                getFullTranslation,
                setFullTranslation,
                clearFullTranslation,
                getSentences,
                setSentences,
                getOriginalText,
                setOriginalText,
                resetAllCache,
                forceSave
            };
        });
    } else {
        // 降级处理，当ModuleRegistry不可用时
        console.warn('ModuleRegistry 不可用，使用全局对象模式');
        
        // 缓存键名
        const SENTENCE_DATA_KEY = 'sentenceDataCache';
        const FULL_TRANSLATION_KEY = 'fullTranslationCache';
        const SAVE_TIMEOUT_DELAY = 1000; // 提取魔法数字为常量
        
        let saveTimeout = null;
        let isDirty = false; // 标记数据是否已修改

        // 内存缓存（用于当前会话）
        let memoryCache = {
            sentences: [],
            sentenceData: {},
            fullTranslation: '',
            originalText: ''
        };

        // 从 localStorage 加载缓存（初始化时调用）
        function loadFromLocalStorage() {
            try {
                const saved = localStorage.getItem(SENTENCE_DATA_KEY);
                if (saved) {
                    memoryCache.sentenceData = JSON.parse(saved);
                } else {
                    memoryCache.sentenceData = {};
                }
                const trans = localStorage.getItem(FULL_TRANSLATION_KEY);
                if (trans) {
                    memoryCache.fullTranslation = trans;
                } else {
                    memoryCache.fullTranslation = '';
                }
                const original = localStorage.getItem('originalTextCache');
                if (original) {
                    memoryCache.originalText = original;
                } else {
                    memoryCache.originalText = '';
                }
            } catch(e) {
                console.warn('加载缓存失败', e);
                memoryCache.sentenceData = {};
                memoryCache.fullTranslation = '';
                memoryCache.originalText = '';
                // 显示友好的错误提示
                if (typeof showToast === 'function') {
                    showToast('加载缓存失败，将使用新的缓存');
                }
            }
        }

        // 保存所有缓存到 localStorage
        function saveToLocalStorage() {
            try {
                // 检查存储空间
                if (localStorage.length >= 50) { // 简单的存储项数量检查
                    // 清理旧缓存
                    clearOldCache();
                }
                
                localStorage.setItem(SENTENCE_DATA_KEY, JSON.stringify(memoryCache.sentenceData));
                localStorage.setItem(FULL_TRANSLATION_KEY, memoryCache.fullTranslation);
                localStorage.setItem('originalTextCache', memoryCache.originalText);
                isDirty = false;
            } catch(e) {
                console.warn('保存缓存失败', e);
                // 显示友好的错误提示
                if (typeof showToast === 'function') {
                    if (e.name === 'QuotaExceededError') {
                        // 尝试清理所有缓存
                        resetAllCache();
                        showToast('存储空间不足，已清理缓存');
                    } else if (e.name === 'SecurityError') {
                        showToast('安全错误：无法访问存储');
                    } else {
                        showToast('保存缓存失败，请重试');
                    }
                }
            }
        }

        // 清理旧缓存
        function clearOldCache() {
            try {
                // 只保留最近使用的缓存
                const keys = Object.keys(memoryCache.sentenceData);
                if (keys.length > 20) {
                    // 按时间排序（假设键是索引）
                    const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
                    // 删除最早的一半缓存
                    const keysToRemove = sortedKeys.slice(0, Math.floor(keys.length / 2));
                    keysToRemove.forEach(key => {
                        delete memoryCache.sentenceData[key];
                    });
                    console.log(`已清理 ${keysToRemove.length} 个旧缓存项`);
                }
            } catch (e) {
                console.warn('清理旧缓存失败:', e);
            }
        }

        // 防抖保存
        function debouncedSave() {
            isDirty = true;
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (isDirty) {
                    saveToLocalStorage();
                }
            }, SAVE_TIMEOUT_DELAY);
        }

        // 获取句子解析缓存（某一句的某一项）
        function getSentenceCache(idx, type) {
            if (!memoryCache.sentenceData[idx]) return null;
            return memoryCache.sentenceData[idx][type] || null;
        }

        // 获取所有句子的解析缓存
        function getAllSentenceData() {
            return memoryCache.sentenceData;
        }

        // 设置句子解析缓存（某一句的某一项）
        function setSentenceCache(idx, type, data) {
            if (!memoryCache.sentenceData[idx]) memoryCache.sentenceData[idx] = {};
            memoryCache.sentenceData[idx][type] = data;
            debouncedSave();
        }

        // 批量设置句子解析缓存（减少写入次数）
        function batchSetSentenceCache(updates) {
            updates.forEach(({ idx, type, data }) => {
                if (!memoryCache.sentenceData[idx]) memoryCache.sentenceData[idx] = {};
                memoryCache.sentenceData[idx][type] = data;
            });
            debouncedSave();
        }

        // 清除某一句的所有缓存
        function clearSentenceCache(idx) {
            if (memoryCache.sentenceData[idx]) {
                delete memoryCache.sentenceData[idx];
                debouncedSave();
            }
        }

        // 清除所有句子缓存（但保留全文翻译）
        function clearAllSentenceCache() {
            memoryCache.sentenceData = {};
            debouncedSave();
        }

        // 获取全文翻译
        function getFullTranslation() {
            return memoryCache.fullTranslation;
        }

        // 设置全文翻译
        function setFullTranslation(translation) {
            memoryCache.fullTranslation = translation;
            debouncedSave();
        }

        // 清除全文翻译
        function clearFullTranslation() {
            memoryCache.fullTranslation = '';
            debouncedSave();
        }

        // 获取句子数组（仅内存，不持久化）
        function getSentences() {
            return memoryCache.sentences;
        }

        function setSentences(sentencesArray) {
            memoryCache.sentences = sentencesArray;
        }

        // 获取原始文本
        function getOriginalText() {
            return memoryCache.originalText;
        }

        // 设置原始文本
        function setOriginalText(text) {
            memoryCache.originalText = text;
            debouncedSave();
        }

        // 重置所有缓存（清空所有）
        function resetAllCache() {
            memoryCache.sentences = [];
            memoryCache.sentenceData = {};
            memoryCache.fullTranslation = '';
            memoryCache.originalText = '';
            debouncedSave();
        }

        // 强制立即保存（用于页面卸载前）
        function forceSave() {
            if (isDirty) {
                clearTimeout(saveTimeout);
                saveToLocalStorage();
            }
        }

        // 导出全局对象
        window.CacheManager = {
            loadFromLocalStorage,
            getSentenceCache,
            setSentenceCache,
            batchSetSentenceCache,
            clearSentenceCache,
            clearAllSentenceCache,
            getAllSentenceData,
            getFullTranslation,
            setFullTranslation,
            clearFullTranslation,
            getSentences,
            setSentences,
            getOriginalText,
            setOriginalText,
            resetAllCache,
            forceSave
        };

        // 页面加载时自动加载已有缓存
        loadFromLocalStorage();

        // 页面卸载前强制保存
        window.addEventListener('beforeunload', forceSave);
    }
})();