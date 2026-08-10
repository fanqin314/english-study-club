// HistoryManager.js - 历史记录管理器
(function() {
    const STORAGE_KEY = 'analysis_history';
    const FILE_NAME = 'analysis_history.json';
    const MAX_HISTORY = 50;
    const TS_KEY = 'analysis_history_ts';  // 时间戳键，用于比较新旧
    
    let history = [];
    
    // 加载历史记录（比较本地文件与 localStorage 时间戳，取最新的）
    async function loadHistory() {
        const LFS = window.LocalFileStorage;
        const localData = _loadFromLocalStorage();
        const localTs = parseInt(localStorage.getItem(TS_KEY) || '0');
        
        if (LFS && LFS.isActive()) {
            try {
                const fileData = await LFS.readJSON(FILE_NAME);
                if (fileData && Array.isArray(fileData)) {
                    // 比较时间戳：本地文件更新则用它，否则用 localStorage
                    const fileTs = parseInt(localStorage.getItem(TS_KEY + '_file') || '0');
                    if (fileTs >= localTs) {
                        history = fileData;
                        _saveToLocalStorage(true);
                        console.log('[HistoryManager] 从本地文件加载，共', history.length, '条记录');
                        return;
                    }
                    // localStorage 更新，用 localStorage 并同步到本地文件
                    console.log('[HistoryManager] localStorage 数据更新，使用 localStorage');
                    _saveToLocalFile();
                    return;
                }
            } catch (e) {
                console.warn('[HistoryManager] 本地文件加载失败，使用 localStorage:', e.message);
            }
        }
        // 没有本地文件或加载失败，用 localStorage
        if (localData.length > 0) {
            history = localData;
            console.log('[HistoryManager] 从 localStorage 加载，共', history.length, '条记录');
            // 如果本地文件夹已连接，同步过去
            if (LFS && LFS.isActive()) _saveToLocalFile();
        }
    }
    
    // 从 localStorage 加载（返回数据，不修改 history）
    function _loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn('加载历史记录失败:', e);
            return [];
        }
    }
    
    // 保存到 localStorage（skipTs 跳过时间戳更新，用于同步）
    function _saveToLocalStorage(skipTs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            if (!skipTs) {
                localStorage.setItem(TS_KEY, Date.now().toString());
            }
        } catch (e) {
            console.error('保存历史记录到 localStorage 失败:', e);
        }
    }
    
    // 保存到本地文件
    async function _saveToLocalFile() {
        const LFS = window.LocalFileStorage;
        if (LFS && LFS.isActive()) {
            try {
                await LFS.writeJSON(FILE_NAME, history);
                localStorage.setItem(TS_KEY + '_file', Date.now().toString());
            } catch (e) {
                console.error('保存历史记录到本地文件失败:', e);
            }
        }
    }
    
    // 保存历史记录（双写：localStorage + 本地文件）
    async function saveToStorage() {
        _saveToLocalStorage();
        await _saveToLocalFile();
    }
    
    // 保存历史记录项
    async function saveHistory(data) {
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
        
        // 保存到 localStorage + 本地文件
        await saveToStorage();
        return true;
    }
    
    // 获取所有历史记录
    function getHistory() {
        return [...history];
    }
    
    // 删除指定历史记录项
    async function deleteHistoryItem(id) {
        const index = history.findIndex(item => item.id === id);
        if (index !== -1) {
            history.splice(index, 1);
            await saveToStorage();
            return true;
        }
        return false;
    }
    
    // 清空所有历史记录
    async function clearHistory() {
        history = [];
        await saveToStorage();
    }
    
    // 根据文本查找历史记录
    function findByText(text) {
        return history.find(item => item.originalText === text) || null;
    }

    // 导出历史记录为 JSON
    function exportJSON() {
        return JSON.stringify(history, null, 2);
    }

    // 导出历史记录为 TXT
    function exportTXT() {
        let txt = '英语阅读实验室 - 历史记录\n';
        txt += '='.repeat(40) + '\n';
        txt += `导出时间: ${new Date().toLocaleString()}\n`;
        txt += `共 ${history.length} 条记录\n\n`;
        history.forEach((item, i) => {
            txt += `--- 第 ${i + 1} 条 ---\n`;
            txt += `时间: ${item.savedAt || '未知'}\n`;
            txt += `原文:\n${item.originalText}\n`;
            if (item.fullTranslation) {
                txt += `翻译:\n${item.fullTranslation}\n`;
            }
            txt += '\n';
        });
        return txt;
    }

    // 导出历史记录为 MD
    function exportMD() {
        let md = '# 英语阅读实验室 - 历史记录\n\n';
        md += `> 导出时间: ${new Date().toLocaleString()}  |  共 ${history.length} 条记录\n\n`;
        history.forEach((item, i) => {
            md += `## ${i + 1}. ${item.savedAt ? new Date(item.savedAt).toLocaleString() : '未知时间'}\n\n`;
            md += '```\n' + item.originalText + '\n```\n\n';
            if (item.fullTranslation) {
                md += `**翻译:** ${item.fullTranslation}\n\n`;
            }
            md += '---\n\n';
        });
        return md;
    }

    // 获取导出内容（不触发下载）—— 聚合导出（浏览器下载用）
    function getExportContent(format) {
        const dateStr = new Date().toISOString().slice(0, 10);
        switch (format) {
            case 'json':
                return { content: exportJSON(), filename: `history_${dateStr}.json`, mimeType: 'application/json' };
            case 'txt':
                return { content: exportTXT(), filename: `history_${dateStr}.txt`, mimeType: 'text/plain' };
            case 'md':
                return { content: exportMD(), filename: `history_${dateStr}.md`, mimeType: 'text/markdown' };
            default:
                return null;
        }
    }

    // 生成单条历史记录的 MD 内容（全文 + 分句分析）
    function getItemMD(item) {
        const typeLabels = {
            'pos': '词性分析',
            'syntax': '语法结构',
            'knowledge': '知识点',
            'translation': '翻译'
        };

        const title = (item.originalText || '').replace(/\n/g, ' ').substring(0, 30);
        const time = item.savedAt ? new Date(item.savedAt).toLocaleString() : '未知时间';

        let md = `# ${title}\n\n`;
        md += `**时间**: ${time}\n\n`;
        md += `---\n\n`;

        // 全文翻译
        if (item.fullTranslation) {
            md += `## 全文翻译\n\n${item.fullTranslation}\n\n`;
            md += `---\n\n`;
        }

        // 分句分析
        const sentences = item.sentences || [];
        const sentenceData = item.sentenceData || {};

        if (sentences.length > 0) {
            md += `## 分句分析\n\n`;
            sentences.forEach((sentence, i) => {
                const data = sentenceData[i] || {};
                const hasData = Object.keys(data).length > 0;

                md += `### 句子 ${i + 1}\n\n`;
                md += `> ${sentence}\n\n`;

                if (hasData) {
                    for (const type of ['pos', 'syntax', 'knowledge', 'translation']) {
                        if (data[type]) {
                            md += `**${typeLabels[type] || type}**:\n\n`;
                            let content = data[type];
                            if (typeof content === 'object') {
                                content = JSON.stringify(content, null, 2);
                            }
                            md += `${content}\n\n`;
                        }
                    }
                } else {
                    md += `*暂无分析数据*\n\n`;
                }

                md += `---\n\n`;
            });
        }

        return md;
    }

    // 获取所有历史记录条目（用于逐条导出到本地文件夹）
    function getHistoryItems() {
        return [...history];
    }

    // 为单条记录生成文件名
    function getItemFilename(item) {
        const ts = item.savedAt ? new Date(item.savedAt) : new Date(parseInt(item.id) || Date.now());
        const pad = (n) => String(n).padStart(2, '0');
        return `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.md`;
    }

    // 通用导出（触发下载）
    function exportHistory(format) {
        const result = getExportContent(format);
        if (!result) return { success: false, error: '不支持的导出格式' };
        _triggerDownload(result.content, result.filename, result.mimeType);
        return { success: true, filename: result.filename };
    }

    function _triggerDownload(content, filename, mimeType) {
        const blob = new Blob(['\uFEFF' + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 更新指定历史记录的句子分析数据
    async function updateSentenceData(id, idx, data) {
        const item = history.find(h => h.id === id);
        if (!item) return false;
        if (!item.sentenceData) item.sentenceData = {};
        item.sentenceData[idx] = { ...(item.sentenceData[idx] || {}), ...data };
        await saveToStorage();
        return true;
    }

    // 初始化加载（异步）
    loadHistory().then(() => {
        console.log('[HistoryManager] 初始化完成，共', history.length, '条记录');
    });

    // 页面卸载前强制同步到 localStorage（确保不丢数据）
    window.addEventListener('beforeunload', () => {
        _saveToLocalStorage();
    });
    // pagehide 也做一次（移动端更可靠）
    window.addEventListener('pagehide', () => {
        _saveToLocalStorage();
    });

    // 监听本地文件夹就绪事件，重新加载数据
    if (typeof EventBus !== 'undefined' && EventBus && EventBus.on) {
        EventBus.on('localStorageReady', () => {
            loadHistory().then(() => {
                console.log('[HistoryManager] 已切换到本地文件存储，共', history.length, '条记录');
            });
        });
    }
    
    // 导出接口
    window.HistoryManager = {
        saveHistory,
        getHistory,
        deleteHistoryItem,
        clearHistory,
        findByText,
        updateSentenceData,
        exportHistory,
        getExportContent,
        getItemMD,
        getItemFilename,
        getHistoryItems
    };
})();