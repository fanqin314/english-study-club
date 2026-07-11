// 一键添加所有词性按钮.js - 将当前文章中指定词性的单词批量添加到生词本

(function() {
    function showLoading() {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = '正在添加单词...';
            toast.style.opacity = '1';
        }
    }

    async function execute(posMap, selectedNotebookId) {
        const selectedPos = Object.keys(posMap).filter(code => posMap[code] === true);
        if (selectedPos.length === 0) {
            showToast('请至少选择一个词性');
            return;
        }
        
        if (!window.VocabData) {
            showToast('生词本模块未加载');
            return;
        }
        
        if (!selectedNotebookId) {
            showToast('请选择目标生词本');
            return;
        }
        
        showLoading();
        
        let allPosData = [];
        if (window.CacheManager) {
            for (let i = 0; ; i++) {
                const posCache = window.CacheManager.getSentenceCache(i, 'pos');
                if (!posCache) break;
                try {
                    const parsed = typeof posCache === 'string' ? JSON.parse(posCache) : posCache;
                    if (parsed.pos && Array.isArray(parsed.pos)) {
                        allPosData.push(...parsed.pos);
                    }
                } catch(e) {
                }
            }
        } else if (window.SentenceRenderer) {
            const data = window.SentenceRenderer.getSentencesData();
            const sentenceData = data.sentenceData;
            for (let idx in sentenceData) {
                const sent = sentenceData[idx];
                if (sent && sent.pos) {
                    const posData = typeof sent.pos === 'string' ? JSON.parse(sent.pos) : sent.pos;
                    if (posData.pos && Array.isArray(posData.pos)) {
                        allPosData.push(...posData.pos);
                    }
                }
            }
        }
        
        const wordsToAdd = new Set();
        allPosData.forEach(item => {
            if (selectedPos.includes(item.pos)) {
                wordsToAdd.add(item.word);
            }
        });
        
        if (wordsToAdd.size === 0) {
            showToast('当前文章中没有这些词性的单词');
            return;
        }
        
        const notebook = window.VocabData.getNotebook(selectedNotebookId);
        if (!notebook) {
            showToast('生词本不存在');
            return;
        }
        
        const existingWords = new Set(notebook.words.map(w => w.word));
        
        let addedCount = 0;
        const skippedCount = wordsToAdd.size;
        
        for (let word of wordsToAdd) {
            if (!existingWords.has(word)) {
                let meaning = '';
                let pos = '';
                
                if (window.DictService) {
                    const dictResult = await window.DictService.getWordMeaning(word, {
                        apiCall: async (w) => {
                            if (window.APIRequest && window.APIRequest.requestWordMeaning) {
                                return await window.APIRequest.requestWordMeaning(w);
                            }
                            return null;
                        }
                    });
                    if (dictResult) {
                        meaning = dictResult.meaning;
                        pos = dictResult.pos;
                    }
                }
                
                window.VocabData.addWord(selectedNotebookId, {
                    word: word,
                    meaning: meaning,
                    pos: pos,
                    context: '',
                    timestamp: Date.now()
                });
                addedCount++;
            }
        }
        
        if (addedCount > 0) {
            showToast(`✅ 已添加 ${addedCount} 个新单词到生词本"${notebook.name}"`);
        } else {
            showToast(`所有单词已存在于生词本"${notebook.name}"中`);
        }
        
        if (window.VocabInterface && window.VocabInterface.refresh) {
            window.VocabInterface.refresh();
        }
    }
    
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        } else {
            console.log(msg);
        }
    }
    
    window.AddAllPosToVocab = {
        execute
    };
})();
