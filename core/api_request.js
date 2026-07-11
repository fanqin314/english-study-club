/**
 * @module APIRequest
 * @description 处理所有API请求，包括词性分析、语法结构、知识点、翻译等
 * @requires Security, ErrorHandler, Performance
 * @exports {Object} APIRequest对象
 */
// 解析请求.js - 调用 API 获取词性、语法结构、知识点、翻译
(function() {
    ModuleRegistry.register('APIRequest', ['Security', 'ErrorHandler', 'Performance'], function(Security, ErrorHandler, Performance) {
        /**
         * 获取 API 配置
         * @returns {Object} API配置对象
         */
        function getApiConfig() {
            return Security.getApiConfig();
        }

        /**
         * 通用 API 请求函数
         * @param {Array} messages - API请求消息数组
         * @param {Object} options - 请求选项
         * @returns {Promise<string>} API响应内容
         * @throws {Error} API请求失败时抛出错误
         */
        async function callAPI(messages, options = {}) {
            const config = getApiConfig();
            
            if (!config || !config.apiKey) {
                throw new Error('请先配置 API Key');
            }

            // 验证API配置
            if (!Security.validateUrl(config.baseUrl).valid) {
                throw new Error('API 基础URL格式不正确');
            }

            // 验证请求参数
            if (!Array.isArray(messages)) {
                throw new Error('请求消息格式不正确');
            }

            // 过滤请求消息中的敏感信息
            const filteredMessages = messages.map(msg => ({
                ...msg,
                content: Security.filterSensitiveInfo(msg.content)
            }));

            // 根据调试模式决定是否打印日志
            const isDebug = options.logLevel === 'debug' || window.DEBUG_MODE;
            
            if (isDebug) {
                const maskedApiKey = config.apiKey.substring(0, 4) + '***' + config.apiKey.substring(config.apiKey.length - 4);
                console.log('API配置信息:', {
                    baseUrl: config.baseUrl,
                    apiKey: maskedApiKey,
                    model: config.model
                });
                console.log('API请求参数:', {
                    messages: filteredMessages,
                    options: options
                });
            }

            Performance.trackAPIRequest();

            // 添加重试机制
            const maxRetries = 2;
            let retries = 0;

            while (retries <= maxRetries) {
                try {
                    const url = `${config.baseUrl}/chat/completions`;
                    if (isDebug) console.log('API请求URL:', url);
                    
                    // 添加请求超时设置
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.apiKey}`
                        },
                        body: JSON.stringify({
                            model: config.model,
                            messages: messages,
                            temperature: options.temperature || 0.3,
                            ...(options.responseFormat ? { response_format: { type: options.responseFormat } } : {})
                        }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (isDebug) {
                        console.log('API响应状态:', response.status);
                        console.log('API响应状态文本:', response.statusText);
                    }

                    if (!response.ok) {
                        const errorText = await response.text();
                        if (isDebug) {
                            console.log('API错误响应:', Security.filterSensitiveInfo(errorText));
                        }
                        
                        let errorMessage = `API 请求失败: ${response.status}`;
                        try {
                            const errorObj = JSON.parse(errorText);
                            if (errorObj.error && errorObj.error.message) {
                                errorMessage += ` - ${Security.filterSensitiveInfo(errorObj.error.message)}`;
                            }
                        } catch (e) {
                            errorMessage += ` - ${Security.filterSensitiveInfo(errorText)}`;
                        }
                        
                        // 根据状态码提供更具体的错误信息
                        if (response.status === 401) {
                            throw new Error('API Key 无效');
                        } else if (response.status === 403) {
                            throw new Error('API 权限不足');
                        } else if (response.status === 429) {
                            throw new Error('API 请求过于频繁，请稍后再试');
                        } else if (response.status === 500) {
                            throw new Error('服务器内部错误，请稍后再试');
                        } else if (response.status >= 500 && retries < maxRetries) {
                            // 服务器错误，进行重试
                            retries++;
                            if (isDebug) {
                                console.log(`API请求失败，正在重试 (${retries}/${maxRetries})...`);
                            }
                            // 指数退避策略
                            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
                            continue;
                        }
                        throw new Error(errorMessage);
                    }

                    const data = await response.json();
                    if (isDebug) {
                        console.log('API成功响应:', data);
                    }
                    
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        throw new Error('API 返回格式错误');
                    }
                    return data.choices[0].message.content;
                } catch (error) {
                    if (isDebug) {
                        console.error('API请求错误:', Security.filterSensitiveInfo(error.message));
                    }
                    if ((error.message && error.message.includes('fetch') || error.name === 'TypeError') && retries < maxRetries) {
                        // 网络错误，进行重试
                        retries++;
                        if (isDebug) {
                            console.log(`网络连接失败，正在重试 (${retries}/${maxRetries})...`);
                        }
                        // 指数退避策略
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
                        continue;
                    } else if (error.name === 'AbortError') {
                        throw new Error('API 请求超时');
                    }
                    throw error;
                }
            }
        }

        /**
         * 批量 API 请求函数
         * @param {Array} requests - 请求数组，每个请求包含messages和options
         * @returns {Promise<Array>} API响应内容数组
         * @throws {Error} API请求失败时抛出错误
         */
        async function callBatchAPI(requests) {
            if (!Array.isArray(requests) || requests.length === 0) {
                return [];
            }

            // 对于少量请求，直接并行处理
            if (requests.length <= 3) {
                return await Performance.parallelAPIRequests(requests.map(req => () => callAPI(req.messages, req.options)));
            }

            // 对于大量请求，分批处理
            const batchSize = 3;
            const results = [];

            for (let i = 0; i < requests.length; i += batchSize) {
                const batch = requests.slice(i, i + batchSize);
                const batchResults = await Performance.parallelAPIRequests(batch.map(req => () => callAPI(req.messages, req.options)));
                results.push(...batchResults);
                // 批次之间添加短暂延迟，避免请求过于集中
                if (i + batchSize < requests.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return results;
        }

        /**
         * 生成缓存键的哈希函数
         * @param {string} prefix - 缓存键前缀
         * @param {string} content - 缓存内容
         * @returns {string} 生成的缓存键
         */
        function generateCacheKey(prefix, content) {
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
                const char = content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            return `${prefix}_${Math.abs(hash)}`;
        }

        /**
         * 请求词性分析
         * @param {string} sentence - 待分析的句子
         * @returns {Promise<Object>} 词性分析结果
         */
        const requestPos = ErrorHandler.wrapAsyncFunction(async function(sentence) {
            // 输入验证
            if (!sentence || typeof sentence !== 'string') {
                ErrorHandler.handleValidationError('句子不能为空');
                return { pos: [] };
            }
            
            const validation = Security.validateText(sentence, 1000);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return { pos: [] }; // 返回空对象而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('pos', sentence);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `你是英语语言学专家。返回JSON格式：
{
  "pos": [
    {"word": "单词", "pos": "n/v/adj/adv/pron/prep/conj/interj/art/num", "meaning": "中文释义"}
  ]
}
只返回JSON，不要其他文字。`;

                const userContent = `分析句子: "${Security.escapeHtml(sentence)}"`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ]);

                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        ErrorHandler.handleApiError(new Error('返回格式错误'));
                        return { pos: [] };
                    }
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (parseError) {
                        ErrorHandler.handleApiError(new Error('JSON解析失败: ' + parseError.message));
                        return { pos: [] };
                    }
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return { pos: [] };
                }
            });
        });

        /**
         * 请求语法结构分析
         * @param {string} sentence - 待分析的句子
         * @returns {Promise<string>} 语法结构分析结果
         */
        const requestSyntax = ErrorHandler.wrapAsyncFunction(async function(sentence) {
            // 输入验证
            if (!sentence || typeof sentence !== 'string') {
                ErrorHandler.handleValidationError('句子不能为空');
                return '暂无语法结构';
            }
            
            const validation = Security.validateText(sentence, 1000);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return '暂无语法结构'; // 返回默认值而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('syntax', sentence);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `你是英语语言学专家。返回JSON格式：
{
  "syntax": "该句的语法结构描述（主语、谓语、宾语、定语、状语等）"
}
只返回JSON，不要其他文字。`;

                const userContent = `分析句子: "${Security.escapeHtml(sentence)}"`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ]);

                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        ErrorHandler.handleApiError(new Error('返回格式错误'));
                        return '暂无语法结构';
                    }
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        return parsed.syntax || '暂无语法结构';
                    } catch (parseError) {
                        ErrorHandler.handleApiError(new Error('JSON解析失败: ' + parseError.message));
                        return '暂无语法结构';
                    }
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return '暂无语法结构';
                }
            });
        });

        /**
         * 请求知识点分析
         * @param {string} sentence - 待分析的句子
         * @returns {Promise<string>} 知识点分析结果
         */
        const requestKnowledge = ErrorHandler.wrapAsyncFunction(async function(sentence) {
            // 输入验证
            if (!sentence || typeof sentence !== 'string') {
                ErrorHandler.handleValidationError('句子不能为空');
                return '暂无知识点';
            }
            
            const validation = Security.validateText(sentence, 1000);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return '暂无知识点'; // 返回默认值而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('knowledge', sentence);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `你是英语语言学专家。返回JSON格式：
{
  "knowledge": "重点搭配、金句，使用换行符分隔不同要点"
}
只返回JSON，不要其他文字。`;

                const userContent = `分析句子: "${Security.escapeHtml(sentence)}"`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ]);

                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        ErrorHandler.handleApiError(new Error('返回格式错误'));
                        return '暂无知识点';
                    }
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        let knowledge = parsed.knowledge || '暂无知识点';
                        knowledge = knowledge.replace(/[；;]\s*/g, '<br>');
                        knowledge = knowledge.replace(/(重点搭配|金句|写作建议)/g, '<strong>$1</strong>');
                        return knowledge;
                    } catch (parseError) {
                        ErrorHandler.handleApiError(new Error('JSON解析失败: ' + parseError.message));
                        return '暂无知识点';
                    }
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return '暂无知识点';
                }
            });
        });

        /**
         * 请求句子翻译
         * @param {string} sentence - 待翻译的句子
         * @returns {Promise<string>} 翻译结果
         */
        const requestTranslation = ErrorHandler.wrapAsyncFunction(async function(sentence) {
            // 输入验证
            if (!sentence || typeof sentence !== 'string') {
                ErrorHandler.handleValidationError('句子不能为空');
                return '';
            }
            
            const validation = Security.validateText(sentence, 1000);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return ''; // 返回空字符串而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('translation', sentence);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `将以下英文句子翻译成中文，只返回翻译结果文本，不要其他内容。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: Security.escapeHtml(sentence) }
                    ]);
                    return content;
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return '';
                }
            });
        });

        /**
         * 请求单词释义
         * @param {string} word - 待查询的单词
         * @returns {Promise<Object>} 单词释义结果
         */
        const requestWordMeaning = ErrorHandler.wrapAsyncFunction(async function(word) {
            // 输入验证
            if (!word || typeof word !== 'string') {
                ErrorHandler.handleValidationError('单词不能为空');
                return { meaning: '', pos: '' };
            }
            
            const validation = Security.validateText(word, 100);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return { meaning: '', pos: '' }; // 返回空对象而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('meaning', word);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `你是英语词典助手。返回JSON格式：
{
  "meaning": "中文释义",
  "pos": "词性缩写(n/v/adj/adv等)"
}
只返回JSON，不要其他文字。`;

                const userContent = `提供单词"${Security.escapeHtml(word)}"的中文释义和词性。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ]);

                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        ErrorHandler.handleApiError(new Error('返回格式错误'));
                        return { meaning: '', pos: '' };
                    }
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (parseError) {
                        ErrorHandler.handleApiError(new Error('JSON解析失败: ' + parseError.message));
                        return { meaning: '', pos: '' };
                    }
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return { meaning: '', pos: '' };
                }
            });
        });

        /**
         * 请求全文翻译
         * @param {string} text - 待翻译的文本
         * @returns {Promise<string>} 翻译结果
         */
        const requestFullTranslation = ErrorHandler.wrapAsyncFunction(async function(text) {
            // 输入验证
            if (!text || typeof text !== 'string') {
                ErrorHandler.handleValidationError('文本不能为空');
                return '';
            }
            
            const validation = Security.validateText(text, 10000);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return ''; // 返回空字符串而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('full_translation', text);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `将以下英文文章逐句翻译成中文。每句翻译之间用 [SENTENCE_END] 分隔。只返回翻译结果，不要其他内容。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: Security.escapeHtml(text) }
                    ]);
                    return content;
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return '';
                }
            });
        });

        /**
         * 请求单词例句
         * @param {string} word - 单词
         * @param {string} meaning - 中文释义
         * @returns {Promise<Object>} 例句结果 {en: "英文例句", zh: "中文翻译"}
         */
        const requestExample = ErrorHandler.wrapAsyncFunction(async function(word, meaning) {
            // 输入验证
            if (!word || typeof word !== 'string') {
                ErrorHandler.handleValidationError('单词不能为空');
                return { en: '', zh: '' };
            }
            
            const validation = Security.validateText(word, 100);
            if (!validation.valid) {
                ErrorHandler.handleValidationError(validation.error);
                return { en: '', zh: '' }; // 返回空对象而不是null
            }

            // 使用缓存
            const cacheKey = generateCacheKey('example', word + '_' + meaning);
            return Performance.cacheAPIRequest(cacheKey, async () => {
                const systemPrompt = `你是英语学习助手，负责为单词生成自然、实用的例句。返回JSON格式：
{
  "en": "英文例句",
  "zh": "中文翻译"
}
只返回JSON，不要其他文字。`;

                const userContent = `为单词 "${Security.escapeHtml(word)}"（意思：${Security.escapeHtml(meaning)}）生成一个自然的英文例句，并提供中文翻译。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ]);

                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        ErrorHandler.handleApiError(new Error('返回格式错误'));
                        return { en: '', zh: '' };
                    }
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (parseError) {
                        ErrorHandler.handleApiError(new Error('JSON解析失败: ' + parseError.message));
                        return { en: '', zh: '' };
                    }
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    return { en: '', zh: '' };
                }
            });
        });

        // 导出全局接口（保持向后兼容）
        window.APIRequest = {
            requestPos,
            requestSyntax,
            requestKnowledge,
            requestTranslation,
            requestWordMeaning,
            requestFullTranslation,
            requestExample,
            callBatchAPI,
            // 兼容别名
            requestPosAnalysis: requestPos,
            requestSyntaxAnalysis: requestSyntax,
            requestKnowledgePoints: requestKnowledge
        };

        return {
            requestPos,
            requestSyntax,
            requestKnowledge,
            requestTranslation,
            requestWordMeaning,
            requestFullTranslation,
            requestExample,
            callBatchAPI
        };
    });
})();