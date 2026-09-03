// vocab_data.js - 生词本数据的增删改查、本地文件存储
(function() {
    // 存储键名
    const STORAGE_KEY = 'vocabData';
    const FILE_NAME = 'vocabData.json';
    const TS_KEY = 'vocabData_ts';  // 时间戳键，用于比较新旧

    // Leitner 间隔重复调度器（core/shared/srs.js，已在 index.html 中 study_stats.js 之后引入）
    const SRS = (window.EnglishStudyShared && window.EnglishStudyShared.SRS) || null;
    
    // 数据结构
    let vocabData = {
        notebooks: {},      // { notebookId: { name, words: [{ word, meaning, pos, context, timestamp }] } }
        currentNotebookId: null
    };
    
    // 防抖定时器
    let saveTimer = null;
    const SAVE_DELAY = 300; // 300ms防抖
    
    // 加载数据（比较本地文件与 localStorage 时间戳，取最新的）
    async function loadData() {
        const LFS = window.LocalFileStorage;
        const localTs = parseInt(localStorage.getItem(TS_KEY) || '0');
        
        if (LFS && LFS.isActive()) {
            try {
                const data = await LFS.readJSON(FILE_NAME);
                if (data && data.notebooks) {
                    const fileTs = parseInt(localStorage.getItem(TS_KEY + '_file') || '0');
                    if (fileTs >= localTs) {
                        vocabData = data;
                        _ensureDataIntegrity();
                        _saveToLocalStorage(true);
                        console.log('[VocabData] 从本地文件加载，共', Object.keys(vocabData.notebooks).length, '个生词本');
                        return;
                    }
                    console.log('[VocabData] localStorage 数据更新，使用 localStorage');
                    _saveToLocalFile();
                    return;
                }
            } catch (e) {
                console.warn('[VocabData] 本地文件加载失败，使用 localStorage:', e.message);
            }
        }
        // 从 localStorage 加载
        const loaded = _loadFromLocalStorage();
        if (loaded) {
            console.log('[VocabData] 从 localStorage 加载');
            if (LFS && LFS.isActive()) _saveToLocalFile();
        }
    }
    
    // 从 localStorage 加载（返回是否成功）
    function _loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    vocabData = parsed;
                    _ensureDataIntegrity();
                    return true;
                } catch(e) {
                    console.error('解析生词本数据失败:', e);
                    initDefaultData();
                    return true;
                }
            } else {
                initDefaultData();
                return true;
            }
        } catch(e) {
            console.error('加载生词本数据失败:', e);
            initDefaultData();
            return true;
        }
    }
    
    // 保存到 localStorage（skipTs 跳过时间戳更新）
    function _saveToLocalStorage(skipTs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(vocabData));
            if (!skipTs) {
                localStorage.setItem(TS_KEY, Date.now().toString());
            }
        } catch (e) {
            console.error('保存生词本到 localStorage 失败:', e);
        }
    }
    
    // 保存到本地文件
    async function _saveToLocalFile() {
        const LFS = window.LocalFileStorage;
        if (LFS && LFS.isActive()) {
            try {
                await LFS.writeJSON(FILE_NAME, vocabData);
                localStorage.setItem(TS_KEY + '_file', Date.now().toString());
            } catch (e) {
                console.error('保存生词本到本地文件失败:', e);
            }
        }
    }
    
    // 确保数据结构完整
    function _ensureDataIntegrity() {
        if (!vocabData.notebooks) vocabData.notebooks = {};
        if (!vocabData.currentNotebookId) {
            const firstId = Object.keys(vocabData.notebooks)[0];
            vocabData.currentNotebookId = firstId || null;
        }
        for (let id in vocabData.notebooks) {
            if (!vocabData.notebooks[id].words) {
                vocabData.notebooks[id].words = [];
            }
            if (!vocabData.notebooks[id].createdDate) {
                vocabData.notebooks[id].createdDate = new Date().toISOString();
            }
        }
    }
    
    // 初始化默认数据
    function initDefaultData() {
        const defaultId = Date.now().toString();
        vocabData = {
            notebooks: {
                [defaultId]: {
                    name: '默认生词本',
                    words: [],
                    createdDate: new Date().toISOString()
                }
            },
            currentNotebookId: defaultId
        };
        _saveToLocalStorage();
        _saveToLocalFile();
    }
    
    // 保存数据（防抖，双写 localStorage + 本地文件）
    function saveData() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            _saveToLocalStorage();
            await _saveToLocalFile();
        }, SAVE_DELAY);
    }
    
    // 立即保存数据（不使用防抖，双写）
    async function saveDataImmediately() {
        clearTimeout(saveTimer);
        _saveToLocalStorage();
        await _saveToLocalFile();
    }
    
    // 获取所有生词本
    function getAllNotebooks() {
        return vocabData.notebooks;
    }
    
    // 获取当前生词本ID
    function getCurrentNotebookId() {
        return vocabData.currentNotebookId;
    }
    
    // 设置当前生词本
    function setCurrentNotebookId(notebookId) {
        if (vocabData.notebooks[notebookId]) {
            vocabData.currentNotebookId = notebookId;
            saveData();
            return true;
        }
        return false;
    }
    
    // 获取生词本
    function getNotebook(notebookId) {
        return vocabData.notebooks[notebookId] || null;
    }
    
    // 获取当前生词本
    function getCurrentNotebook() {
        if (!vocabData.currentNotebookId) return null;
        return vocabData.notebooks[vocabData.currentNotebookId] || null;
    }
    
    // 创建生词本
    function createNotebook(name) {
        if (!name || name.trim() === '') {
            return { success: false, error: '生词本名称不能为空' };
        }
        
        const trimmedName = name.trim();
        if (trimmedName.length > 50) {
            return { success: false, error: '生词本名称长度不能超过50个字符' };
        }
        
        const newId = Date.now().toString();
        vocabData.notebooks[newId] = {
            name: trimmedName,
            words: [],
            createdDate: new Date().toISOString()
        };
        
        // 如果是第一个生词本，设置为当前
        if (Object.keys(vocabData.notebooks).length === 1) {
            vocabData.currentNotebookId = newId;
        }
        
        saveData();
        return { success: true, id: newId, name: trimmedName };
    }
    
    // 删除生词本
    function deleteNotebook(notebookId) {
        if (!vocabData.notebooks[notebookId]) {
            return { success: false, error: '生词本不存在' };
        }
        
        // 不允许删除最后一个生词本
        if (Object.keys(vocabData.notebooks).length === 1) {
            return { success: false, error: '不能删除最后一个生词本' };
        }
        
        delete vocabData.notebooks[notebookId];
        
        // 如果删除的是当前生词本，切换到第一个
        if (vocabData.currentNotebookId === notebookId) {
            const firstId = Object.keys(vocabData.notebooks)[0];
            vocabData.currentNotebookId = firstId;
        }
        
        saveData();
        return { success: true };
    }
    
    // 重命名生词本
    function renameNotebook(notebookId, newName) {
        if (!vocabData.notebooks[notebookId]) {
            return { success: false, error: '生词本不存在' };
        }
        
        if (!newName || newName.trim() === '') {
            return { success: false, error: '生词本名称不能为空' };
        }
        
        const trimmedName = newName.trim();
        if (trimmedName.length > 50) {
            return { success: false, error: '生词本名称长度不能超过50个字符' };
        }
        
        vocabData.notebooks[notebookId].name = trimmedName;
        saveData();
        return { success: true, name: trimmedName };
    }
    
    // 添加单词到生词本
    function addWord(notebookId, wordData) {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return { success: false, error: '生词本不存在' };
        }
        
        const { word, meaning = '', pos = '', context = '', timestamp = Date.now() } = wordData;
        
        if (!word || word.trim() === '') {
            return { success: false, error: '单词不能为空' };
        }
        
        const trimmedWord = word.trim();
        if (trimmedWord.length > 50) {
            return { success: false, error: '单词长度不能超过50个字符' };
        }
        
        if (meaning.length > 500) {
            return { success: false, error: '词义长度不能超过500个字符' };
        }
        
        if (pos.length > 20) {
            return { success: false, error: '词性长度不能超过20个字符' };
        }
        
        if (context.length > 1000) {
            return { success: false, error: '上下文长度不能超过1000个字符' };
        }
        
        // 检查是否已存在（不区分大小写）
        const exists = notebook.words.some(w => w.word.toLowerCase() === trimmedWord.toLowerCase());
        if (exists) {
            return { success: false, error: '单词已存在' };
        }
        
        const newWord = {
            word: trimmedWord,
            meaning: meaning.trim(),
            pos: pos.trim(),
            context: context.trim(),
            timestamp: timestamp
        };
        if (SRS) SRS.initWord(newWord);
        notebook.words.push(newWord);
        
        saveData();
        return { success: true };
    }
    
    // 批量添加单词到生词本（词库整档导入专用：Set 查重 + 仅保存一次，避免逐词保存卡死）
    function addWordsBulk(notebookId, words) {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return { success: false, added: 0, skipped: 0, error: '生词本不存在' };
        }
        if (!Array.isArray(words)) {
            return { success: false, added: 0, skipped: 0, error: '参数错误' };
        }
        const existing = new Set(notebook.words.map(w => w.word.toLowerCase()));
        let added = 0, skipped = 0;
        const toAdd = [];
        for (let i = 0; i < words.length; i++) {
            const wd = words[i] || {};
            const word = String(wd.word || '').trim();
            if (!word) { skipped++; continue; }
            const lower = word.toLowerCase();
            if (existing.has(lower)) { skipped++; continue; }
            const newWord = {
                word: word,
                meaning: String(wd.meaning || '').trim(),
                pos: String(wd.pos || '').trim(),
                context: String(wd.context || '').trim(),
                timestamp: Date.now()
            };
            if (SRS) SRS.initWord(newWord);
            existing.add(lower);
            toAdd.push(newWord);
            added++;
        }
        if (toAdd.length) {
            notebook.words.push(...toAdd);
            saveData();
        }
        return { success: true, added: added, skipped: skipped };
    }
    
    // 删除单词
    function deleteWord(notebookId, word) {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return { success: false, error: '生词本不存在' };
        }
        
        const index = notebook.words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
        if (index === -1) {
            return { success: false, error: '单词不存在' };
        }
        
        notebook.words.splice(index, 1);
        saveData();
        return { success: true };
    }
    
    // 更新单词
    function updateWord(notebookId, word, updates) {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return { success: false, error: '生词本不存在' };
        }
        
        const wordObj = notebook.words.find(w => w.word.toLowerCase() === word.toLowerCase());
        if (!wordObj) {
            return { success: false, error: '单词不存在' };
        }
        
        Object.assign(wordObj, updates);
        saveData();
        return { success: true };
    }
    
    // 获取单词列表
    function getWords(notebookId, sortBy = 'timestamp', order = 'desc') {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return [];
        }
        
        const sortedWords = [...notebook.words].sort((a, b) => {
            if (sortBy === 'word') {
                return order === 'asc' ? a.word.localeCompare(b.word) : b.word.localeCompare(a.word);
            } else if (sortBy === 'timestamp') {
                return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
            }
            return 0;
        });
        
        return sortedWords;
    }
    
    // 获取当前生词本的单词列表
    function getCurrentWords(sortBy = 'timestamp', order = 'desc') {
        const notebook = getCurrentNotebook();
        if (!notebook) {
            return [];
        }
        
        const sortedWords = [...notebook.words].sort((a, b) => {
            if (sortBy === 'word') {
                return order === 'asc' ? a.word.localeCompare(b.word) : b.word.localeCompare(a.word);
            } else if (sortBy === 'timestamp') {
                return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
            }
            return 0;
        });
        
        return sortedWords;
    }
    
    // 搜索单词
    function searchWords(notebookId, keyword) {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return [];
        }
        
        if (!keyword || keyword.trim() === '') {
            return [...notebook.words];
        }
        
        const lowerKeyword = keyword.toLowerCase().trim();
        return notebook.words.filter(word => {
            return (
                word.word.toLowerCase().includes(lowerKeyword) ||
                word.meaning.toLowerCase().includes(lowerKeyword) ||
                word.context.toLowerCase().includes(lowerKeyword)
            );
        });
    }
    
    // 搜索当前生词本的单词
    function searchCurrentWords(keyword) {
        const notebook = getCurrentNotebook();
        if (!notebook) {
            return [];
        }
        
        if (!keyword || keyword.trim() === '') {
            return [...notebook.words];
        }
        
        const lowerKeyword = keyword.toLowerCase().trim();
        return notebook.words.filter(word => {
            return (
                word.word.toLowerCase().includes(lowerKeyword) ||
                word.meaning.toLowerCase().includes(lowerKeyword) ||
                word.context.toLowerCase().includes(lowerKeyword)
            );
        });
    }
    
    // 统计单词数
    function getWordCount() {
        let total = 0;
        for (let id in vocabData.notebooks) {
            total += vocabData.notebooks[id].words.length;
        }
        return total;
    }
    
    // 更新生词本属性
    function updateNotebook(id, updates) {
        if (!vocabData.notebooks[id]) {
            return { success: false, error: '生词本不存在' };
        }
        
        vocabData.notebooks[id] = { ...vocabData.notebooks[id], ...updates };
        saveData();
        return { success: true };
    }
    
    // 统计每个生词本的单词数
    function getNotebookWordCounts() {
        const counts = {};
        for (let id in vocabData.notebooks) {
            counts[id] = {
                name: vocabData.notebooks[id].name,
                count: vocabData.notebooks[id].words.length
            };
        }
        return counts;
    }
    
    // 统计当前生词本的单词数
    function getCurrentNotebookWordCount() {
        const notebook = getCurrentNotebook();
        return notebook ? notebook.words.length : 0;
    }
    
    // 按评级更新单词的 Leitner 调度状态（正确/错误），并持久化
    function scheduleWord(notebookId, word, correct) {
        if (!SRS) return null;
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) return null;
        
        const wordObj = notebook.words.find(w => w.word.toLowerCase() === word.toLowerCase());
        if (!wordObj) return null;
        
        // 旧词可能缺少 box/interval，交给调度器按 1 处理
        const result = SRS.schedule(wordObj.box, wordObj.interval, !!correct, Date.now());
        wordObj.box = result.box;
        wordObj.interval = result.interval;
        wordObj.nextReview = result.nextReview;
        
        saveData();
        return wordObj;
    }
    
    // 当前生词本中今日到期待复习的单词数
    function getDueCount() {
        if (!SRS) return 0;
        const notebook = getCurrentNotebook();
        if (!notebook || !notebook.words) return 0;
        return SRS.dueCount(notebook.words);
    }
    
    // 导出所有数据
    function exportData() {
        return JSON.stringify(vocabData, null, 2);
    }
    
    // 导出单个生词本
    function exportNotebook(notebookId, format = 'json') {
        const notebook = vocabData.notebooks[notebookId];
        if (!notebook) {
            return { success: false, error: '生词本不存在' };
        }
        
        let data = '';
        let filename = '';
        let mimeType = '';
        
        switch (format) {
            case 'json':
                const exportObj = {
                    name: notebook.name,
                    words: notebook.words,
                    exportDate: new Date().toISOString(),
                    version: '1.0'
                };
                data = JSON.stringify(exportObj, null, 2);
                filename = `${notebook.name}_生词本_${new Date().toLocaleDateString()}.json`;
                mimeType = 'application/json';
                break;
                
            case 'md':
                let mdContent = `# ${notebook.name}\n\n`;
                mdContent += `> 共 ${notebook.words.length} 个单词\n\n`;
                mdContent += `导出时间: ${new Date().toLocaleString()}\n\n`;
                mdContent += `---\n\n`;
                
                notebook.words.forEach((word, index) => {
                    mdContent += `${index + 1}. **${word.word}**`;
                    if (word.meaning) {
                        mdContent += `  ${word.meaning}`;
                    }
                    mdContent += '\n';
                });
                data = mdContent;
                filename = `${notebook.name}_生词本_${new Date().toLocaleDateString()}.md`;
                mimeType = 'text/markdown';
                break;
                
            case 'txt':
                let txtContent = `${notebook.name}\n`;
                txtContent += `=${'='.repeat(notebook.name.length)}=\n\n`;
                txtContent += `共 ${notebook.words.length} 个单词\n`;
                txtContent += `导出时间: ${new Date().toLocaleString()}\n\n`;
                
                notebook.words.forEach((word) => {
                    txtContent += `${word.word}`;
                    if (word.meaning) {
                        txtContent += `\t${word.meaning}`;
                    }
                    txtContent += '\n';
                });
                data = txtContent;
                filename = `${notebook.name}_生词本_${new Date().toLocaleDateString()}.txt`;
                mimeType = 'text/plain';
                break;
                
            default:
                return { success: false, error: '不支持的导出格式' };
        }
        
        return { 
            success: true, 
            data: data,
            filename: filename,
            mimeType: mimeType
        };
    }
    
    // 导入数据
    function importData(jsonData) {
        try {
            const parsed = JSON.parse(jsonData);
            if (!parsed || typeof parsed !== 'object') {
                return { success: false, error: '数据格式无效' };
            }
            
            if (!parsed.notebooks || typeof parsed.notebooks !== 'object') {
                return { success: false, error: '数据格式无效：缺少notebooks字段' };
            }
            
            // 验证每个生词本的结构
            for (let id in parsed.notebooks) {
                const notebook = parsed.notebooks[id];
                if (!notebook || typeof notebook !== 'object') {
                    return { success: false, error: `数据格式无效：生词本 ${id} 格式错误` };
                }
                if (!notebook.name || typeof notebook.name !== 'string') {
                    return { success: false, error: `数据格式无效：生词本 ${id} 缺少名称` };
                }
                if (!Array.isArray(notebook.words)) {
                    return { success: false, error: `数据格式无效：生词本 ${id} 的words字段必须是数组` };
                }
                // 验证每个单词的结构
                for (let word of notebook.words) {
                    if (!word || typeof word !== 'object') {
                        return { success: false, error: `数据格式无效：生词本 ${id} 中存在无效单词` };
                    }
                    if (!word.word || typeof word.word !== 'string') {
                        return { success: false, error: `数据格式无效：生词本 ${id} 中存在无单词的条目` };
                    }
                }
            }
            
            vocabData = parsed;
            if (!vocabData.currentNotebookId) {
                const firstId = Object.keys(vocabData.notebooks)[0];
                vocabData.currentNotebookId = firstId || null;
            }
            // 确保数据结构完整
            if (!vocabData.notebooks) vocabData.notebooks = {};
            for (let id in vocabData.notebooks) {
                if (!vocabData.notebooks[id].words) {
                    vocabData.notebooks[id].words = [];
                }
            }
            saveData();
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message };
        }
    }

    // 从 Markdown/TXT 文件导入数据
    function importFromMarkdown(text) {
        try {
            const words = [];
            
            // 支持多种格式：
            // 1. 每行一个单词
            // 2. 单词 释义 格式（用空格、冒号、- 分隔）
            // 3. Markdown 列表格式
            
            const lines = text.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                
                // 跳过 Markdown 标题和空行
                if (line.startsWith('#')) continue;
                
                // 移除列表标记
                line = line.replace(/^[\s*-+]+\s*/, '');
                
                // 尝试解析单词和释义
                let word = '';
                let meaning = '';
                
                // 模式1: 单词 释义 (用多个空格分隔)
                const spaceMatch = line.match(/^(\S+)\s{2,}(.+)$/);
                if (spaceMatch) {
                    word = spaceMatch[1].trim();
                    meaning = spaceMatch[2].trim();
                } 
                // 模式2: 单词: 释义
                else if (line.includes(':')) {
                    const parts = line.split(':');
                    word = parts[0].trim();
                    meaning = parts.slice(1).join(':').trim();
                }
                // 模式3: 单词 - 释义
                else if (line.includes(' - ')) {
                    const parts = line.split(' - ');
                    word = parts[0].trim();
                    meaning = parts.slice(1).join(' - ').trim();
                }
                // 模式4: 单词|释义 (竖线分隔)
                else if (line.includes('|')) {
                    const parts = line.split('|');
                    word = parts[0].trim();
                    meaning = parts.slice(1).join('|').trim();
                }
                // 模式5: 只有单词
                else {
                    word = line;
                }
                
                // 过滤无效单词
                if (word && word.length > 0 && !/^[\d\s]+$/.test(word)) {
                    words.push({ word, meaning });
                }
            }
            
            if (words.length === 0) {
                return { success: false, error: '未找到有效的单词数据' };
            }
            
            // 创建新的生词本数据
            const newNotebookId = 'imported_' + Date.now();
            vocabData = {
                notebooks: {
                    [newNotebookId]: {
                        name: '导入的生词本',
                        words: words
                    }
                },
                currentNotebookId: newNotebookId
            };
            
            saveData();
            return { success: true, importedCount: words.length };
        } catch(e) {
            return { success: false, error: e.message };
        }
    }
    
    // 导出接口
    window.VocabData = {
        loadData,
        saveData,
        saveDataImmediately,
        getAllNotebooks,
        getCurrentNotebookId,
        setCurrentNotebookId,
        getNotebook,
        getCurrentNotebook,
        createNotebook,
        deleteNotebook,
        addWord,
        addWordsBulk,
        deleteWord,
        updateWord,
        getWords,
        getCurrentWords,
        searchWords,
        searchCurrentWords,
        getWordCount,
        updateNotebook,
        getNotebookWordCounts,
        getCurrentNotebookWordCount,
        scheduleWord,
        getDueCount,
        renameNotebook,
        exportData,
        exportNotebook,
        importData,
        importFromMarkdown
    };
    
    // 自动加载数据（异步）
    loadData().then(() => {
        console.log('[VocabData] 初始化完成');
    });

    // 页面卸载前强制同步到 localStorage（确保不丢数据）
    window.addEventListener('beforeunload', () => {
        _saveToLocalStorage();
    });
    window.addEventListener('pagehide', () => {
        _saveToLocalStorage();
    });

    // 监听本地文件夹就绪事件，重新加载数据
    if (typeof EventBus !== 'undefined' && EventBus && EventBus.on) {
        EventBus.on('localStorageReady', () => {
            loadData().then(() => {
                console.log('[VocabData] 已切换到本地文件存储');
            });
        });
    }
})();