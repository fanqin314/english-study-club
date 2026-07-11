// service_registration.js - 服务注册配置
// 集中注册所有核心服务，替代分散的全局变量定义

(function() {
    'use strict';
    
    // 等待 DIContainer 初始化
    if (!window.DIContainer) {
        console.error('[ServiceRegistration] DIContainer 未加载');
        return;
    }
    
    const { registerSingleton, registerValue } = window.DIContainer;
    
    /**
     * 注册核心工具服务
     */
    function registerCoreServices() {
        // 安全服务 - 单例
        registerSingleton('Security', () => {
            return window.Security || {};
        });
        
        // 错误处理服务 - 单例
        registerSingleton('ErrorHandler', () => {
            return window.ErrorHandler || {};
        });
        
        // 性能监控服务 - 单例
        registerSingleton('Performance', () => {
            return window.Performance || {};
        });
        
        // 事件总线 - 单例
        registerSingleton('EventBus', () => {
            return window.EventBus || {};
        });
        
        console.log('[ServiceRegistration] 核心服务已注册');
    }
    
    /**
     * 注册数据服务
     */
    function registerDataServices() {
        // 缓存管理服务 - 单例
        registerSingleton('CacheService', () => {
            if (!window.CacheManager) {
                console.warn('[ServiceRegistration] CacheManager 未定义');
                return null;
            }
            // 包装 CacheManager 提供更清晰的接口
            return {
                getSentences: () => window.CacheManager.getSentences(),
                getSentenceCache: (idx, type) => window.CacheManager.getSentenceCache(idx, type),
                setSentenceCache: (idx, type, data) => window.CacheManager.setSentenceCache(idx, type, data),
                clear: () => window.CacheManager.clear && window.CacheManager.clear()
            };
        });
        
        // 生词本数据服务 - 单例
        registerSingleton('VocabService', () => {
            if (!window.VocabData) {
                console.warn('[ServiceRegistration] VocabData 未定义');
                return null;
            }
            return {
                getAllNotebooks: () => window.VocabData.getAllNotebooks(),
                getCurrentNotebookId: () => window.VocabData.getCurrentNotebookId(),
                getNotebook: (id) => window.VocabData.getNotebook(id),
                createNotebook: (name) => window.VocabData.createNotebook(name),
                addWord: (notebookId, wordData) => window.VocabData.addWord(notebookId, wordData),
                deleteWord: (notebookId, word) => window.VocabData.deleteWord(notebookId, word),
                exportData: () => window.VocabData.exportData(),
                importData: (json) => window.VocabData.importData(json)
            };
        });
        
        // 词典服务 - 单例
        registerSingleton('DictService', () => {
            if (!window.DictService) {
                console.warn('[ServiceRegistration] DictService 未定义');
                return null;
            }
            return {
                getWordMeaning: (word) => window.DictService.getWordMeaningFromDict(word),
                loadExternalDict: (path) => window.DictService.loadExternalDict(path),
                addToSupplement: (word, meaning, pos) => window.DictService.addToSupplementDict(word, meaning, pos)
            };
        });
        
        console.log('[ServiceRegistration] 数据服务已注册');
    }
    
    /**
     * 注册 API 服务
     */
    function registerApiServices() {
        // API 请求服务 - 单例
        registerSingleton('ApiService', () => {
            if (!window.APIRequest) {
                console.warn('[ServiceRegistration] APIRequest 未定义');
                return null;
            }
            return {
                requestPos: (sentence) => window.APIRequest.requestPos(sentence),
                requestSyntax: (sentence) => window.APIRequest.requestSyntax(sentence),
                requestKnowledge: (sentence) => window.APIRequest.requestKnowledge(sentence),
                requestTranslation: (sentence) => window.APIRequest.requestTranslation(sentence),
                requestWordMeaning: (word) => window.APIRequest.requestWordMeaning(word),
                requestFullTranslation: (text) => window.APIRequest.requestFullTranslation(text)
            };
        });
        
        console.log('[ServiceRegistration] API 服务已注册');
    }
    
    /**
     * 注册渲染服务
     */
    function registerRenderServices() {
        // 句子渲染服务 - 单例
        registerSingleton('RenderService', () => {
            if (!window.SentenceRenderer) {
                console.warn('[ServiceRegistration] SentenceRenderer 未定义');
                return null;
            }
            return {
                setContainer: (container) => window.SentenceRenderer.setContainer(container),
                setSentencesData: (sentences, data) => window.SentenceRenderer.setSentencesData(sentences, data),
                getSentencesData: () => window.SentenceRenderer.getSentencesData(),
                renderAll: () => window.SentenceRenderer.renderAll()
            };
        });
        
        console.log('[ServiceRegistration] 渲染服务已注册');
    }
    
    /**
     * 注册所有服务
     */
    function registerAll() {
        try {
            registerCoreServices();
            registerDataServices();
            registerApiServices();
            registerRenderServices();
            console.log('[ServiceRegistration] 所有服务注册完成');
        } catch (error) {
            console.error('[ServiceRegistration] 服务注册失败:', error);
        }
    }
    
    // 立即注册
    registerAll();
    
    // 导出注册函数供后续使用
    window.ServiceRegistration = {
        registerAll,
        registerCoreServices,
        registerDataServices,
        registerApiServices,
        registerRenderServices
    };
})();
