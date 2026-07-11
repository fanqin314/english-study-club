// HistoryManager.js - 历史记录管理器
(function() {
    const STORAGE_KEY = 'analysis_history';
    const MAX_HISTORY = 50;
    
    let history = [];
    
    // 加载历史记录
    function loadHistory() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            history = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn('加载历史记录失败:', e);
            history = [];
        }
    }
    
    // 保存历史记录到 localStorage
    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('保存历史记录失败:', e);
        }
    }
    
    // 保存历史记录项
    function saveHistory(data) {
        if (!data || !data.originalText) {
            console.warn('保存历史记录失败：缺少原始文本');
            return false;
        }
        
        // 创建历史记录项
        const historyItem = {
            id: Date.now().toString(),
            originalText: data.originalText,
            fullTranslation: data.fullTranslation || '',
            sentences: data.sentences || [],
            sentenceData: data.sentenceData || {},
            savedAt: new Date().toISOString()
        };
        
        // 添加到开头
        history.unshift(historyItem);
        
        // 限制数量
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }
        
        // 保存到 localStorage
        saveToStorage();
        return true;
    }
    
    // 获取所有历史记录
    function getHistory() {
        return [...history];
    }
    
    // 删除指定历史记录项
    function deleteHistoryItem(id) {
        const index = history.findIndex(item => item.id === id);
        if (index !== -1) {
            history.splice(index, 1);
            saveToStorage();
            return true;
        }
        return false;
    }
    
    // 清空所有历史记录
    function clearHistory() {
        history = [];
        saveToStorage();
    }
    
    // 根据文本查找历史记录
    function findByText(text) {
        return history.find(item => item.originalText === text) || null;
    }
    
    // 初始化加载
    loadHistory();
    
    // 导出接口
    window.HistoryManager = {
        saveHistory,
        getHistory,
        deleteHistoryItem,
        clearHistory,
        findByText
    };
    
    console.log('[HistoryManager] 初始化完成，共', history.length, '条记录');
})();