// history_module.js - 历史记录模块
(function() {
    ModuleRegistry.register('HistoryModule', [], function() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('analysis_history') || '[]');
        } catch (e) {
            console.warn('加载历史记录失败:', e);
            history = [];
        }

        function addHistory(text, timestamp) {
            try {
                // 使用 HistoryManager 来保存历史记录，确保数据结构和数量限制一致
                if (window.HistoryManager) {
                    window.HistoryManager.saveHistory({
                        originalText: text,
                        fullTranslation: '',
                        sentences: [],
                        sentenceData: {}
                    });
                } else {
                    // 降级方案
                    history.unshift({ text, timestamp });
                    if (history.length > 20) {
                        history = history.slice(0, 20);
                    }
                    localStorage.setItem('analysis_history', JSON.stringify(history));
                }
            } catch (e) {
                console.error('保存历史记录失败:', e);
            }
        }

        function getHistory() {
            // 使用 HistoryManager 来获取历史记录
            if (window.HistoryManager) {
                const historyData = window.HistoryManager.getHistory();
                return historyData.map(item => ({
                    text: item.originalText,
                    timestamp: item.id
                }));
            }
            return [...history];
        }

        function clearHistory() {
            try {
                // 使用 HistoryManager 来清空历史记录
                if (window.HistoryManager) {
                    window.HistoryManager.clearHistory();
                } else {
                    history = [];
                    localStorage.setItem('analysis_history', '[]');
                }
            } catch (e) {
                console.error('清空历史记录失败:', e);
            }
        }

        // 监听分析完成事件
        if (typeof EventBus !== 'undefined' && EventBus) {
            EventBus.on('analysisCompleted', function(data) {
                addHistory(data.text, Date.now());
            });
        }

        return {
            addHistory,
            getHistory,
            clearHistory
        };
    });
})();