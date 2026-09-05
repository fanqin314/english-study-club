// history_detail_ui.js - 历史记录详情界面的实时解析功能

(function() {
    let tempCache = {}; // 内存缓存，仅在当前详情界面有效
    let currentHistoryItem = null;
    let isSecondaryAnalysis = false;
    
    // 初始化历史记录详情模块
    function init() {
        // 监听导航到二级分析界面的事件
        if (typeof EventBus !== 'undefined' && EventBus && EventBus.on) {
            EventBus.on('navigateToSecondaryAnalysis', function(data) {
                isSecondaryAnalysis = true;
                // 优先使用传递过来的历史记录项，如果没有则查找
                currentHistoryItem = data.historyItem || findHistoryItem(data.text);
                clearCache(); // 切换历史记录时清除缓存
                
                // 延迟绑定返回按钮事件，确保按钮已创建
                setTimeout(bindBackButton, 100);
            });
            
            // 监听返回按钮点击事件
            EventBus.on('showHistoryMode', function() {
                isSecondaryAnalysis = false;
                currentHistoryItem = null;
                clearCache(); // 回到历史记录列表时清除缓存
            });
        }
        
        // 绑定返回按钮点击事件
        bindBackButton();
        
        // 绑定导出讲义按钮
        bindExportHandoutButton();
    }
    
    // 绑定返回按钮事件
    function bindBackButton() {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            // 移除可能存在的旧事件监听器
            backButton.removeEventListener('click', handleBackButtonClick);
            // 添加新的事件监听器
            backButton.addEventListener('click', handleBackButtonClick);
        }
    }
    
    // 处理返回按钮点击
    function handleBackButtonClick() {
        isSecondaryAnalysis = false;
        currentHistoryItem = null;
        clearCache();
        // 清除历史记录高亮
        if (window.HistoryHighlight && window.HistoryHighlight.clearHighlight) {
            window.HistoryHighlight.clearHighlight();
        }
        // 清除 CacheManager 中的历史数据，避免影响深度解析界面
        if (window.CacheManager) {
            window.CacheManager.setSentences([]);
            window.CacheManager.setOriginalText('');
            window.CacheManager.setFullTranslation('');
            if (window.CacheManager.resetAllCache) window.CacheManager.resetAllCache();
        }
        // 恢复侧边栏显示（离开历史详情/二级分析视图）
        document.body.classList.remove('mode-sub-interface');

        // 直接调用 showHistoryMode 重建历史列表视图。
        // 注意不能调用 switchMode('history')：currentMode 已是 'history' 时会提前 return，导致视图不刷新。
        if (window.MainButtonManager && window.MainButtonManager.showHistoryMode) {
            window.MainButtonManager.showHistoryMode();
        } else if (window.MainButtonManager && window.MainButtonManager.switchMode) {
            window.MainButtonManager.switchMode('history');
        }
    }
    
    // 绑定导出讲义按钮
    function bindExportHandoutButton() {
        const exportBtn = document.getElementById('exportHandoutBtn');
        if (!exportBtn) return;
        // 移除可能存在的旧事件监听器，避免重复绑定
        exportBtn.removeEventListener('click', handleExportHandout);
        exportBtn.addEventListener('click', handleExportHandout);
    }
    
    // 显示提示消息
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    }
    
    // 从所有生词本构建 word -> { meaning, pos } 查找表（按小写匹配）
    function buildVocabLookup() {
        const map = {};
        try {
            const nbs = window.VocabData && window.VocabData.getAllNotebooks ? window.VocabData.getAllNotebooks() : null;
            if (nbs) {
                Object.keys(nbs).forEach(function(id) {
                    const nb = nbs[id];
                    const words = nb && nb.words ? nb.words : [];
                    words.forEach(function(w) {
                        if (w && w.word) {
                            const key = String(w.word).toLowerCase();
                            if (!map[key]) {
                                map[key] = { word: w.word, meaning: w.meaning || '', pos: w.pos || '' };
                            }
                        }
                    });
                });
            }
        } catch (e) {
            console.warn('[HistoryDetail] 读取生词本失败:', e);
        }
        return map;
    }
    
    // 处理导出讲义
    async function handleExportHandout(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        
        // 文章无解析数据（无 sentenceData）时提示先完成深度解析
        if (!currentHistoryItem || !currentHistoryItem.sentenceData || Object.keys(currentHistoryItem.sentenceData).length === 0) {
            showToast('请先完成深度解析');
            return;
        }
        
        const Handout = window.EnglishStudyShared && window.EnglishStudyShared.Handout;
        if (!Handout) {
            showToast('讲义导出模块未加载，请刷新页面重试');
            return;
        }
        
        const article = {
            originalText: currentHistoryItem.originalText || '',
            fullTranslation: currentHistoryItem.fullTranslation || '',
            sentences: currentHistoryItem.sentences || [],
            sentenceData: currentHistoryItem.sentenceData || {}
        };
        const vocabMap = buildVocabLookup();
        
        try {
            // 聚合生词：从生词本查 meaning，查不到返回 ''
            let words = await Handout.collectWords(article, {
                getMeaning: function(word) {
                    const nb = vocabMap[String(word).toLowerCase()];
                    return nb ? nb.meaning : '';
                }
            });
            // 若生词本中有该词，则取生词本的 pos/meaning 覆盖（词性优先用标注值）
            words = words.map(function(w) {
                const nb = vocabMap[String(w.word).toLowerCase()];
                if (nb) {
                    return Object.assign({}, w, {
                        pos: nb.pos || w.pos,
                        meaning: nb.meaning || w.meaning
                    });
                }
                return w;
            });
            
            const rawTitle = (currentHistoryItem.originalText || '').split('\n')[0].trim() || '英语学习讲义';
            const title = (currentHistoryItem.title || rawTitle).substring(0, 40);
            const html = Handout.buildHandout({
                title: title,
                text: article.originalText,
                fullTranslation: article.fullTranslation,
                words: words
            });
            
            Handout.openHandout(html);
            showToast('已生成讲义，可在新窗口直接打印');
        } catch (err) {
            console.error('导出讲义失败:', err);
            showToast('导出讲义失败: ' + ((err && err.message) || '未知错误'));
        }
    }
    
    // 查找历史记录项
    function findHistoryItem(text) {
        // 直接使用 HistoryManager 获取完整的历史记录数据
        if (window.HistoryManager) {
            const history = window.HistoryManager.getHistory();
            return history.find(item => item.originalText === text) || null;
        }
        return null;
    }
    
    // 清除内存缓存
    function clearCache() {
        tempCache = {};
    }
    
    // 获取缓存数据
    function getCachedData(sentenceIndex, type) {
        const key = `${sentenceIndex}_${type}`;
        return tempCache[key] || null;
    }
    
    // 设置缓存数据
    function setCachedData(sentenceIndex, type, data) {
        const key = `${sentenceIndex}_${type}`;
        tempCache[key] = data;
    }
    
    // 检查历史记录中是否有数据
    function hasHistoryData(sentenceIndex, type) {
        if (!currentHistoryItem || !currentHistoryItem.sentenceData) {
            return false;
        }
        
        const sentenceData = currentHistoryItem.sentenceData[sentenceIndex];
        if (!sentenceData) {
            return false;
        }
        
        switch (type) {
            case 'pos':
                return sentenceData.pos !== undefined;
            case 'syntax':
                return sentenceData.syntax !== undefined;
            case 'knowledge':
                return sentenceData.knowledge !== undefined;
            case 'translation':
                return sentenceData.translation !== undefined;
            default:
                return false;
        }
    }
    
    // 从历史记录中获取数据
    function getHistoryData(sentenceIndex, type) {
        if (!currentHistoryItem || !currentHistoryItem.sentenceData) {
            return null;
        }
        
        const sentenceData = currentHistoryItem.sentenceData[sentenceIndex];
        if (!sentenceData) {
            return null;
        }
        
        switch (type) {
            case 'pos':
                return sentenceData.pos;
            case 'syntax':
                return sentenceData.syntax;
            case 'knowledge':
                return sentenceData.knowledge;
            case 'translation':
                return sentenceData.translation;
            default:
                return null;
        }
    }
    
    // 获取句子文本
    function getSentenceText(sentenceIndex) {
        if (currentHistoryItem && currentHistoryItem.sentences && currentHistoryItem.sentences[sentenceIndex]) {
            return currentHistoryItem.sentences[sentenceIndex];
        }
        
        // 从缓存或渲染器获取
        if (window.CacheManager) {
            const sentences = window.CacheManager.getSentences();
            if (sentences && sentences[sentenceIndex]) {
                return sentences[sentenceIndex];
            }
        } else if (window.SentenceRenderer) {
            const data = window.SentenceRenderer.getSentencesData();
            if (data.sentences && data.sentences[sentenceIndex]) {
                return data.sentences[sentenceIndex];
            }
        }
        
        return '';
    }
    
    // 实时调用API获取数据
    async function fetchData(sentenceIndex, type, panel) {
        const sentence = getSentenceText(sentenceIndex);
        if (!sentence) {
            showError(panel, '无法获取句子内容');
            return null;
        }
        
        const apiConfig = window.Security ? window.Security.getApiConfig() : null;
        if (!apiConfig || !apiConfig.apiKey) {
            showError(panel, '请先配置 API Key', true);
            return null;
        }
        
        // 显示加载状态
        showLoading(panel);
        
        try {
            let result = null;
            switch (type) {
                case 'pos':
                    result = await window.APIRequest.requestPosAnalysis(sentence);
                    break;
                case 'syntax':
                    result = await window.APIRequest.requestSyntaxAnalysis(sentence);
                    break;
                case 'knowledge':
                    result = await window.APIRequest.requestKnowledgePoints(sentence);
                    break;
                case 'translation':
                    result = await window.APIRequest.requestTranslation(sentence);
                    break;
                default:
                    throw new Error('未知的分析类型');
            }
            
            if (result) {
                // 缓存结果
                setCachedData(sentenceIndex, type, result);
                // 显示结果
                displayResult(panel, type, result);
                return result;
            } else {
                throw new Error('API返回空结果');
            }
        } catch (error) {
            console.error('API请求失败:', error);
            showError(panel, error.message || 'API请求失败', true);
            return null;
        }
    }
    
    // 显示加载状态
    function showLoading(panel) {
        panel.innerHTML = '<div class="loading">加载中...</div>';
        panel.classList.add('show');
    }
    
    // 显示错误信息
    function showError(panel, message, showRetry = false) {
        let html = `<div class="error-message">${message}</div>`;
        if (showRetry) {
            html += '<button class="retry-btn">重试</button>';
        }
        panel.innerHTML = html;
        panel.classList.add('show');
        
        // 绑定重试按钮事件
        if (showRetry) {
            const retryBtn = panel.querySelector('.retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    const type = panel.id.split('-')[0];
                    const sentenceIndex = parseInt(panel.id.split('-')[2]);
                    if (window.onLoadSentenceDetail) {
                        window.onLoadSentenceDetail(sentenceIndex, type);
                    }
                });
            }
        }
    }
    
    // 显示结果
    function displayResult(panel, type, result) {
        let html = '';
        switch (type) {
            case 'pos':
                html = `<strong>🏷️ 词性</strong><div>${formatPosResult(result)}</div>`;
                break;
            case 'syntax':
                html = `<strong>📐 语法结构</strong><div>${formatSyntaxResult(result)}</div>`;
                break;
            case 'knowledge':
                html = `<strong>💡 知识点</strong><div>${formatKnowledgeResult(result)}</div>`;
                break;
            case 'translation':
                html = `<strong><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>翻译</strong><div>${formatTranslationResult(result)}</div>`;
                break;
        }
        panel.innerHTML = html;
        panel.classList.add('show');
    }
    
    // 格式化词性结果
    function formatPosResult(result) {
        if (typeof result === 'string') {
            return result;
        }
        if (Array.isArray(result)) {
            return result.map(item => {
                if (typeof item === 'object') {
                    return `${item.word}: ${item.pos}`;
                }
                return item;
            }).join('<br>');
        }
        return JSON.stringify(result);
    }
    
    // 格式化语法结构结果
    function formatSyntaxResult(result) {
        if (typeof result === 'string') {
            return result;
        }
        return JSON.stringify(result);
    }
    
    // 格式化知识点结果
    function formatKnowledgeResult(result) {
        if (typeof result === 'string') {
            return result;
        }
        if (Array.isArray(result)) {
            return result.join('<br>');
        }
        return JSON.stringify(result);
    }
    
    // 格式化翻译结果
    function formatTranslationResult(result) {
        if (typeof result === 'string') {
            return result;
        }
        return JSON.stringify(result);
    }
    
    // 处理句子详情加载
    async function handleSentenceDetail(sentenceIndex, type, panel) {
        // 检查是否在二级分析界面
        if (!isSecondaryAnalysis) {
            // 非二级分析界面，使用原有逻辑
            if (window.originalOnLoadSentenceDetail) {
                window.originalOnLoadSentenceDetail(sentenceIndex, type);
            }
            return;
        }

        // 翻译类型统一委托给 SentenceTranslation.onLoad（只从缓存读取，不调AI）
        if (type === 'translation') {
            if (window.SentenceTranslation && window.SentenceTranslation.onLoad) {
                window.SentenceTranslation.onLoad(sentenceIndex, panel);
            } else {
                displayResult(panel, type, '暂无翻译，请先使用全文翻译');
            }
            return;
        }
        
        // 检查缓存
        const cachedData = getCachedData(sentenceIndex, type);
        if (cachedData) {
            displayResult(panel, type, cachedData);
            return;
        }
        
        // 检查历史记录数据
        if (hasHistoryData(sentenceIndex, type)) {
            const historyData = getHistoryData(sentenceIndex, type);
            // 如果历史记录数据为 null，尝试从 API 获取
            if (historyData === null) {
                await fetchData(sentenceIndex, type, panel);
            } else {
                displayResult(panel, type, historyData);
            }
            return;
        }
        
        // 历史记录中没有数据，尝试从 API 获取
        await fetchData(sentenceIndex, type, panel);
    }
    
    // 使用EventBus替代全局回调
    if (typeof EventBus !== 'undefined' && EventBus) {
        // 监听句子详情加载事件
        EventBus.on('loadSentenceDetail', async function(data) {
            const { idx, type } = data;
            const panel = document.getElementById(`${type}-panel-${idx}`);
            if (!panel) {
                console.error(`面板 ${type}-panel-${idx} 未找到`);
                return;
            }
            
            await handleSentenceDetail(idx, type, panel);
        });
    }
    
    // 保留原有的全局回调，确保向后兼容
    if (window.onLoadSentenceDetail) {
        window.originalOnLoadSentenceDetail = window.onLoadSentenceDetail;
    }
    
    window.onLoadSentenceDetail = async function(idx, type) {
        const panel = document.getElementById(`${type}-panel-${idx}`);
        if (!panel) {
            console.error(`面板 ${type}-panel-${idx} 未找到`);
            return;
        }
        
        // 优先使用新的 EventBus 事件
        if (typeof EventBus !== 'undefined' && EventBus) {
            EventBus.emit('loadSentenceDetail', { idx, type, panel });
        }
        
        // 保留原有的回调逻辑作为回退
        if (window.originalOnLoadSentenceDetail) {
            window.originalOnLoadSentenceDetail(idx, type);
        }
    };
    
    // 导出接口
    window.HistoryDetail = {
        init,
        clearCache,
        isSecondaryAnalysis: () => isSecondaryAnalysis
    };
    
    // 初始化模块
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();