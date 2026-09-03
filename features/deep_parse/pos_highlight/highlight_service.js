// highlight_service.js - 词性高亮服务
// 使用依赖注入替代全局变量，提供清晰的服务接口

(function() {
    'use strict';
    
    /**
     * 词性高亮服务类
     * 封装所有词性高亮相关的业务逻辑
     */
    class HighlightService {
        constructor(cacheService, apiService, eventBus) {
            this.cacheService = cacheService;
            this.apiService = apiService;
            this.eventBus = eventBus;
            
            // 词性到CSS类名的映射
            this.posClassMap = {
                'n': 'pos-n',
                'v': 'pos-v',
                'adj': 'pos-adj',
                'adv': 'pos-adv',
                'pron': 'pos-pron',
                'prep': 'pos-prep',
                'conj': 'pos-conj',
                'interj': 'pos-interj',
                'art': 'pos-art',
                'num': 'pos-num'
            };
            
            // 默认高亮配置
            this.defaultHighlightMap = {
                n: true, v: true, adj: true, adv: true, pron: true, 
                prep: true, conj: true, interj: true, art: true, num: true
            };
            
            // 当前高亮配置
            this.highlightPosMap = this.loadHighlightConfig();
            
            console.log('[HighlightService] 服务已初始化');
        }
        
        /**
         * 从 localStorage 加载高亮配置
         */
        loadHighlightConfig() {
            try {
                const saved = localStorage.getItem('highlightPosMap');
                if (saved) {
                    return { ...this.defaultHighlightMap, ...JSON.parse(saved) };
                }
            } catch (e) {
                console.warn('[HighlightService] 加载配置失败:', e);
            }
            return { ...this.defaultHighlightMap };
        }
        
        /**
         * 保存高亮配置到 localStorage
         */
        saveHighlightConfig() {
            try {
                localStorage.setItem('highlightPosMap', JSON.stringify(this.highlightPosMap));
            } catch (e) {
                console.warn('[HighlightService] 保存配置失败:', e);
            }
        }
        
        /**
         * 更新高亮配置
         * @param {Object} newMap - 新的高亮配置
         */
        updateHighlightConfig(newMap) {
            this.highlightPosMap = { ...newMap };
            this.saveHighlightConfig();
            this.eventBus.emit('highlightConfigChanged', this.highlightPosMap);
        }
        
        /**
         * 获取当前高亮配置
         */
        getHighlightConfig() {
            return { ...this.highlightPosMap };
        }
        
        /**
         * 清除所有单词的高亮样式
         */
        clearAllHighlight() {
            document.querySelectorAll('.word-span').forEach(span => {
                // 移除所有词性相关的类
                Object.values(this.posClassMap).forEach(className => {
                    span.classList.remove(className);
                });
                // 移除所有高亮标记
                span.classList.remove('click-highlight');
                span.classList.remove('global-highlight');
            });
        }
        
        /**
         * 高亮单个句子中的单词
         * @param {string} sentenceElementId - 句子元素ID
         * @param {Object} sentenceData - 句子数据（包含词性信息）
         */
        highlightSentenceWords(sentenceElementId, sentenceData) {
            const sentenceDiv = document.getElementById(sentenceElementId);
            if (!sentenceDiv) return;
            
            let posList = [];
            if (sentenceData && sentenceData.pos) {
                if (Array.isArray(sentenceData.pos)) {
                    posList = sentenceData.pos;
                } else if (sentenceData.pos.pos) {
                    posList = sentenceData.pos.pos;
                }
            }
            
            if (posList.length === 0) return;
            
            const spans = sentenceDiv.querySelectorAll('.word-span');
            
            spans.forEach(span => {
                const word = span.dataset.word;
                if (!word) return;
                
                const normalizedWord = this.normalizeWord(word);
                const posItem = posList.find(p => 
                    p.word && this.normalizeWord(p.word) === normalizedWord
                );
                
                if (posItem && this.highlightPosMap[posItem.pos]) {
                    const className = this.posClassMap[posItem.pos];
                    if (className) {
                        span.classList.add(className);
                        // 添加全局高亮标记，用于区分全局高亮和点击高亮
                        span.classList.add('global-highlight');
                    }
                }
            });
        }
        
        /**
         * 应用高亮到所有句子
         */
        applyHighlightToAll() {
            this.clearAllHighlight();
            
            if (!this.cacheService) {
                console.warn('[HighlightService] CacheService 不可用');
                return;
            }
            
            const sentences = this.cacheService.getSentences();
            if (!sentences) return;
            
            for (let i = 0; i < sentences.length; i++) {
                const posCache = this.cacheService.getSentenceCache(i, 'pos');
                if (!posCache) continue;
                
                try {
                    const parsed = typeof posCache === 'string' ? JSON.parse(posCache) : posCache;
                    this.highlightSentenceWords(`sentence-${i}`, { pos: parsed });
                } catch (e) {
                    console.warn(`[HighlightService] 解析句子 ${i} 的词性数据失败:`, e);
                }
            }
            
            this.eventBus.emit('highlightApplied', { sentenceCount: sentences.length });
        }
        
        /**
         * 分析单个句子的词性
         * @param {number} idx - 句子索引
         * @param {string} sentence - 句子文本
         */
        async analyzeSentence(idx, sentence) {
            if (!this.apiService) {
                console.warn('[HighlightService] ApiService 不可用');
                return null;
            }
            
            try {
                const result = await this.apiService.requestPos(sentence);
                if (this.cacheService) {
                    this.cacheService.setSentenceCache(idx, 'pos', result);
                }
                return result;
            } catch (error) {
                console.error(`[HighlightService] 分析句子 ${idx} 失败:`, error);
                return null;
            }
        }
        
        /**
         * 分析所有句子的词性
         */
        async analyzeAllSentences() {
            if (!this.cacheService) {
                console.warn('[HighlightService] CacheService 不可用');
                return;
            }
            
            const sentences = this.cacheService.getSentences();
            if (!sentences || sentences.length === 0) {
                console.warn('[HighlightService] 没有句子数据');
                return;
            }
            
            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i];
                if (!sentence) continue;
                
                // 检查是否已有缓存
                const existingPosData = this.cacheService.getSentenceCache(i, 'pos');
                if (existingPosData) continue;
                
                await this.analyzeSentence(i, sentence);
            }
            
            this.eventBus.emit('allSentencesAnalyzed', { count: sentences.length });
        }
        
        /**
         * 高亮句子中指定的单词
         * @param {number} sentenceIndex - 句子索引
         * @param {string} word - 要高亮的单词
         * @param {string} pos - 词性
         */
        highlightWordInSentence(sentenceIndex, word, pos) {
            // 参数验证
            if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || !Number.isInteger(sentenceIndex)) {
                console.warn(`[HighlightService] 无效的句子索引: ${sentenceIndex}`);
                return;
            }
            if (typeof word !== 'string' || !word.trim()) {
                console.warn('[HighlightService] 无效的单词');
                return;
            }
            if (typeof pos !== 'string' || !this.posClassMap[pos]) {
                console.warn(`[HighlightService] 无效的词性: ${pos}`);
                return;
            }
            
            const sentenceElementId = `sentence-${sentenceIndex}`;
            const sentenceDiv = document.getElementById(sentenceElementId);
            
            if (!sentenceDiv) {
                console.warn(`[HighlightService] 找不到句子元素: ${sentenceElementId}`);
                return;
            }
            
            // 获取句子中所有单词 span
            const wordSpans = sentenceDiv.querySelectorAll('.word-span');
            const wordNormalized = this.normalizeWord(word);
            
            // 清除之前的点击高亮状态并设置新高亮（在同一个遍历中完成，避免重复DOM操作）
            wordSpans.forEach(span => {
                const spanWord = span.dataset.word;
                const isMatch = spanWord && this.normalizeWord(spanWord) === wordNormalized;
                
                if (span.classList.contains('click-highlight')) {
                    // 如果是点击高亮的单词，先清除
                    if (!isMatch) {
                        // 只有不是当前要高亮的单词才清除
                        Object.values(this.posClassMap).forEach(className => {
                            span.classList.remove(className);
                        });
                    }
                    // 移除点击高亮标记（后续会重新添加给匹配的单词）
                    span.classList.remove('click-highlight');
                }
                
                // 对匹配的单词应用高亮
                if (isMatch && this.highlightPosMap[pos]) {
                    const className = this.posClassMap[pos];
                    if (className) {
                        span.classList.add(className);
                        span.classList.add('click-highlight');
                    }
                }
            });
            
            console.log(`[HighlightService] 已高亮句子 ${sentenceIndex} 中的单词: ${word} (${pos})`);
            this.eventBus.emit('wordHighlighted', { sentenceIndex, word, pos });
        }
        
        /**
         * 标准化单词（去除标点符号）
         * @param {string} word - 原始单词
         * @returns {string} 标准化后的单词
         */
        normalizeWord(word) {
            if (typeof word !== 'string') return '';
            // 去除首尾的标点符号和空格
            return word.toLowerCase().replace(/^[,.!?;:\"\']+|[,.!?;:\"\']+$/g, '');
        }
        
        /**
         * 清除句子中指定单词的点击高亮状态（保留全局高亮）
         * @param {number} sentenceIndex - 句子索引
         */
        clearWordClickHighlight(sentenceIndex) {
            // 参数验证
            if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || !Number.isInteger(sentenceIndex)) {
                console.warn(`[HighlightService] 无效的句子索引: ${sentenceIndex}`);
                return;
            }
            
            const sentenceElementId = `sentence-${sentenceIndex}`;
            const sentenceDiv = document.getElementById(sentenceElementId);
            
            if (!sentenceDiv) return;
            
            // 只移除带有点击高亮标记但没有全局高亮标记的单词
            const wordSpans = sentenceDiv.querySelectorAll('.word-span.click-highlight:not(.global-highlight)');
            wordSpans.forEach(span => {
                // 移除所有词性类
                Object.values(this.posClassMap).forEach(className => {
                    span.classList.remove(className);
                });
                // 移除点击高亮标记
                span.classList.remove('click-highlight');
            });
        }
        
        /**
         * 清除句子中指定单词的高亮状态（清除所有高亮，包括全局和点击）
         * @param {number} sentenceIndex - 句子索引
         */
        clearWordHighlight(sentenceIndex) {
            // 参数验证
            if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || !Number.isInteger(sentenceIndex)) {
                console.warn(`[HighlightService] 无效的句子索引: ${sentenceIndex}`);
                return;
            }
            
            const sentenceElementId = `sentence-${sentenceIndex}`;
            const sentenceDiv = document.getElementById(sentenceElementId);
            
            if (!sentenceDiv) return;
            
            // 移除所有词性高亮类
            const wordSpans = sentenceDiv.querySelectorAll('.word-span');
            wordSpans.forEach(span => {
                // 移除所有词性相关的类
                Object.values(this.posClassMap).forEach(className => {
                    span.classList.remove(className);
                });
                span.classList.remove('click-highlight');
            });
        }
    }
    
    // 导出类供直接使用
    window.HighlightService = HighlightService;
})();
