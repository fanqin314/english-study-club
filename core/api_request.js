// api_request.js - 处理所有API请求，包括词性分析、语法结构、知识点、翻译等
// 解析请求.js - 调用 API 获取词性、语法结构、知识点、翻译
(function() {
    // 共享解析核心（分句/prompt/JSON提取/结构归一化统一真源）
    const Shared = (window.EnglishStudyShared = window.EnglishStudyShared || {});
    if (!Shared.extractJSON) {
        throw new Error('shared/parse_core.js 未加载，请刷新页面重试');
    }

    ModuleRegistry.register('APIRequest', ['Security', 'ErrorHandler', 'Performance'], function(Security, ErrorHandler, Performance) {
        /**
         * 获取 API 配置
         * @returns {Object} API配置对象
         */
        function getApiConfig() {
            return Security.getApiConfig();
        }

        // 默认AI模式（默认魔搭AI）：直连魔搭免费 qwen
        const DEFAULT_AI_MODEL = 'Qwen/Qwen3.5-35B-A3B';
        // DeepSeek 系列模型（自定义模式下使用，显式关闭思考直接输出）
        const DEEPSEEK_MODELS = ['deepseek-v4-pro', 'deepseek-v4-flash'];

        /**
         * 通用 API 请求函数
         * @param {Array} messages - API请求消息数组
         * @param {Object} options - 请求选项
         * @returns {Promise<string>} API响应内容
         * @throws {Error} API请求失败时抛出错误
         */
        async function callAPI(messages, options = {}) {
            const config = getApiConfig();
            
            // 默认AI模式（默认魔搭AI）：直连魔搭免费 qwen，不使用代理
            const isDefaultAI = localStorage.getItem('defaultAIMode') !== 'false';
            const proxyUrl = isDefaultAI ? '' : config.proxyUrl;
            const useProxy = !!(proxyUrl && proxyUrl.trim() !== '');
            // 自定义模式使用用户配置的模型；DeepSeek 系列模型显式关闭思考直接输出
            const isDeepseekModel = DEEPSEEK_MODELS.includes((config.model || '').trim().toLowerCase());
            const effectiveModel = isDefaultAI ? DEFAULT_AI_MODEL : (config.model || '');
            if (!useProxy && (!config || !config.apiKey)) {
                ErrorHandler.showOfflineHint('AI 解析需要配置 API Key。你仍可使用阅读、标记生词与复习功能；点击右上角「设置」填入自己的 Key 即可启用 AI 解析。');
                throw new Error('请先配置 API Key');
            }

            // 检查每日免费用量
            if (window.UsageTracker && !window.UsageTracker.hasQuota()) {
                const s = window.UsageTracker.summary();
                throw new Error(`今日免费次数已用完（${s.used}/${s.limit}），请明天再试或升级会员`);
            }

            // 验证API配置
            const targetUrl = useProxy ? proxyUrl : config.baseUrl;
            if (!Security.validateUrl(targetUrl).valid) {
                throw new Error('API 地址格式不正确');
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
                const maskedApiKey = config.apiKey ? config.apiKey.substring(0, 4) + '***' + config.apiKey.substring(config.apiKey.length - 4) : 'proxy';
                console.log('API配置信息:', {
                    baseUrl: targetUrl,
                    apiKey: maskedApiKey,
                    model: effectiveModel,
                    useProxy
                });
                console.log('API请求参数:', {
                    messages: filteredMessages,
                    options: options
                });
            }

            Performance.trackAPIRequest();

            // 添加重试机制（含随机抖动避免惊群效应）
            const maxRetries = 3;
            let retries = 0;

            while (retries <= maxRetries) {
                try {
                    const url = useProxy ? `${proxyUrl.replace(/\/+$/, '')}/api/v1/chat/completions` : `${config.baseUrl}/chat/completions`;
                    if (isDebug) console.log('API请求URL:', url);
                    
                    // 添加请求超时设置
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000);
                    
                    // 代理模式下不发送 Authorization 头（Worker 内置了 Key）
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    if (!useProxy && config.apiKey) {
                        headers['Authorization'] = `Bearer ${config.apiKey}`;
                    }
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            model: effectiveModel,
                            messages: messages,
                            temperature: options.temperature ?? 0.3,
                            max_tokens: options.maxTokens || 500,
                            chat_template_kwargs: { enable_thinking: false },
                            // DeepSeek 系列模型：显式关闭思考，直接输出（不产生 reasoning_content，更快更省 token）
                            ...(isDeepseekModel ? { thinking: { type: 'disabled' } } : {}),
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
                            // 服务器错误，进行重试（含随机抖动）
                            retries++;
                            if (isDebug) {
                                console.log(`API请求失败，正在重试 (${retries}/${maxRetries})...`);
                            }
                            const delay = 1500 * Math.pow(2, retries - 1) + Math.random() * 1000;
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                        throw new Error(errorMessage);
                    }

                    const data = await response.json();
                    if (isDebug) {
                        console.log('API成功响应:', data);
                    }

                    // 检查 200 响应中嵌套的 error
                    if (data.error) {
                        const errMsg = data.error.message || JSON.stringify(data.error);
                        throw new Error(`API 返回错误: ${Security.filterSensitiveInfo(errMsg)}`);
                    }

                    // 检查 choices 为 null（模型未处理，可重试的服务端问题）
                    if (data.choices === null || (data.usage && data.usage.total_tokens === 0 && data.usage.completion_tokens === 0)) {
                        throw new Error('MODEL_OVERLOAD');
                    }

                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        const summary = JSON.stringify(data).substring(0, 300);
                        if (isDebug) console.warn('API 返回非预期格式:', summary);
                        throw new Error(`API 返回格式错误: ${summary}`);
                    }

                    // 确认有实际输出后才消耗用量
                    if (window.UsageTracker) {
                        window.UsageTracker.consume();
                    }

                    const msg = data.choices[0].message;
                    if (!msg.content && msg.content !== '') {
                        throw new Error('API 返回空内容');
                    }

                    if (data.choices[0].finish_reason === 'length') {
                        if (isDebug) console.warn('API 响应被截断 (finish_reason=length)');
                        throw new Error('API 响应被截断，请增大 max_tokens 参数');
                    }

                    ErrorHandler.clearOfflineHint();
                    return msg.content;
                } catch (error) {
                    if (isDebug) {
                        console.error('API请求错误:', Security.filterSensitiveInfo(error.message));
                    }
                    const isRetryable = (
                        (error.message && error.message.includes('fetch')) ||
                        error.name === 'TypeError' ||
                        error.message === 'MODEL_OVERLOAD'
                    );
                    if (isRetryable && retries < maxRetries) {
                        // 网络/过载错误，进行重试（含随机抖动）
                        retries++;
                        const reason = error.message === 'MODEL_OVERLOAD' ? '模型过载' : '网络连接失败';
                        if (isDebug) {
                            console.log(`${reason}，正在重试 (${retries}/${maxRetries})...`);
                        }
                        // 指数退避 + 随机抖动：1.5s/3s/6s ± 0~1s
                        const delay = 1500 * Math.pow(2, retries - 1) + Math.random() * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    } else if (error.name === 'AbortError') {
                        ErrorHandler.showOfflineHint('AI 请求超时，你仍可阅读、标记生词和复习。请稍后重试，或在「设置」中配置自己的 API Key。');
                        throw new Error('API 请求超时');
                    } else if (error.message === 'MODEL_OVERLOAD') {
                        ErrorHandler.showOfflineHint('AI 服务繁忙，你仍可阅读、标记生词和复习。请稍后重试。');
                        throw new Error('模型服务繁忙，请稍后重试（已重试多次仍失败）');
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
         * 从 API 响应中提取并解析 JSON
         * 使用 indexOf 定位首尾花括号，比正则更可靠
         * @param {string} content - API 响应内容
         * @param {string} context - 上下文标识（用于调试日志）
         * @returns {Object|null} 解析后的对象，失败返回 null
         */
        function extractAndParseJSON(content, context) {
            // 委托给共享核心（统一 JSON 提取逻辑）
            const result = Shared.extractJSON(content);
            if (!result && window.DEBUG_MODE) {
                console.warn(`[${context}] JSON解析失败，原始内容:`, (content || '').substring(0, 500));
            }
            return result;
        }

        /**
         * 词库优先的词性预填：将句子切分为单词，逐词查询本地词典。
         * @param {string} sentence
         * @returns {Promise<{hits: Array, missing: Array}>}
         *   hits: 本地命中 [{word,pos,meaning}]
         *   missing: 未命中需交 AI 的单词（保留原词形与出现顺序）
         */
        function localPosLookup(sentence) {
            const DL = window.DictLookup;
            const lookupFn = (DL && typeof DL.lookup === 'function')
                ? function (w) { return DL.lookup(w); }
                : null;
            return Shared.localPosLookup(sentence, lookupFn);
        }

        // AI 补测失败词的短时记忆：无 AI/慢 AI 时，近期失败过的词不再重复触发网络等待，
        // 同一批缺词在 TTL 内再次查询直接返回本地命中部分（incomplete），避免每次点击都卡在 AI 往返上
        const AI_FAIL_TTL = 30000;  // 30s
        let aiFailWords = {};       // word(lower) -> timestamp
        function rememberAiFail(words) {
            const now = Date.now();
            (words || []).forEach(w => { if (w) aiFailWords[String(w).toLowerCase()] = now; });
        }
        function isRecentlyFailed(word) {
            const key = String(word).toLowerCase();
            const t = aiFailWords[key];
            if (!t) return false;
            if (Date.now() - t > AI_FAIL_TTL) { delete aiFailWords[key]; return false; }
            return true;
        }

        /**
         * 请求词性分析（词库优先 + AI 兜底难词）
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

            // 词库优先：先本地查词，仅未命中的难词才交给 AI 补测（省 token、更快）
            const { hits, missing } = await localPosLookup(sentence);
            // 所有词均命中本地词典，直接返回，无需调 AI（词性列表顺序与原文一致）
            if (missing.length === 0) {
                return { pos: hits };
            }

            // AI 失败短时记忆：缺词在 TTL 内刚 AI 补测失败过 → 不再触发 AI 网络往返，
            // 直接返回本地命中部分（incomplete），避免无 AI/慢 AI 时每次点击都卡在 AI 超时等待
            if (missing.some(isRecentlyFailed)) {
                return { pos: hits, incomplete: true };
            }

            // 使用缓存（缓存键基于整句，AI 结果与本地结果合并后整体缓存）
            const cacheKey = generateCacheKey('pos', sentence);
            let merged = null;
            try {
                merged = await Performance.cacheAPIRequest(cacheKey, async () => {
                    // 只让 AI 补测未命中的难词，并强制按原词序返回
                    const missingPrompt = {
                        messages: [
                            {
                                role: 'system',
                                content:
                                    '你是英语词典助手。请对下面给出的每个单词返回词性。返回JSON格式：\n{"pos": [{"word": "单词", "pos": "n/v/adj/adv/pron/prep/conj/interj/art/num", "meaning": "中文释义"}]}\n只返回JSON，不要其他文字，顺序与输入一致。'
                            },
                            { role: 'user', content: '为以下单词标注词性（按给定顺序，逐词给出）：' + missing.join(', ') }
                        ],
                        maxTokens: 1000,
                        temperature: 0
                    };

                    // 空结果时自动重试一次（模型可能临时返回空数组）
                    for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                            const content = await callAPI(missingPrompt.messages, { maxTokens: missingPrompt.maxTokens, temperature: missingPrompt.temperature });

                            const result = extractAndParseJSON(content, 'pos');
                            const aiPos = (result && Array.isArray(result.pos)) ? result.pos : [];
                            if (aiPos.length > 0) {
                                // 合并：本地命中在前，AI 补测难度词在后
                                return { pos: hits.concat(aiPos) };
                            }

                            if (attempt === 0) {
                                // 第一次返回空结果，短暂延迟后重试
                                if (window.DEBUG_MODE) console.log('[pos] 返回空结果，1秒后重试...');
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                continue;
                            }
                            // AI 未返回任何词性（空结果）→ 视为失败，抛出不写入缓存
                            throw new Error('AI 未返回词性数据');
                        } catch (error) {
                            if (attempt === 0 && error.message === 'MODEL_OVERLOAD') {
                                // 模型过载，延迟后重试
                                await new Promise(resolve => setTimeout(resolve, 1500));
                                continue;
                            }
                            // 失败不缓存：向上抛出，避免不完整的 {pos:hits} 被写入 5 分钟缓存，
                            // 否则词库分片加载完成后重查仍会读到旧的部分结果
                            throw error;
                        }
                    }
                    throw new Error('AI 未返回词性数据');
                });
            } catch (error) {
                // AI 补测失败：记入短时记忆，TTL 内同批缺词直接走本地命中部分，
                // 不再重复触发网络等待（无 AI/慢 AI 场景的关键提速点）
                rememberAiFail(missing);
                ErrorHandler.handleApiError(error);
            }
            // 即便 AI 失败，本地已命中的词性也应返回；但存在本地未命中且 AI 未补测到的词，
            // 结果不完整 → 标记 incomplete 让上层不写缓存，用户后续点击可重新查询
            // （分片词典加载完成后即可获得完整词性，避免需反复点刷新才能看到高频词）
            return merged && Array.isArray(merged.pos) ? merged : { pos: hits, incomplete: true };
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
                const { messages, maxTokens, temperature } = Shared.buildSyntaxPrompt(sentence);

                // JSON 解析失败时自动重试一次（模型偶尔会输出格式错误）
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const content = await callAPI(messages, { maxTokens, temperature });

                        const parsed = extractAndParseJSON(content, 'syntax');
                        if (parsed) {
                            return {
                                structure: parsed.structure || '',
                                function: parsed.function || '',
                                pattern: parsed.pattern || '',
                                syntax: parsed.syntax || '暂无语法结构',
                                clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
                                constituents: Array.isArray(parsed.constituents) ? parsed.constituents : []
                            };
                        }

                        if (attempt === 0) {
                            // 第一次解析失败，短暂延迟后重试
                            if (window.DEBUG_MODE) console.log('[syntax] JSON解析失败，1秒后重试...');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }

                        ErrorHandler.handleApiError(new Error('JSON解析失败'));
                        return { structure: '', function: '', pattern: '', syntax: '暂无语法结构', clauses: [], constituents: [] };
                    } catch (error) {
                        if (attempt === 0 && error.message === 'MODEL_OVERLOAD') {
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            continue;
                        }
                        ErrorHandler.handleApiError(error);
                        return { structure: '', function: '', pattern: '', syntax: '暂无语法结构', clauses: [], constituents: [] };
                    }
                }
                return { structure: '', function: '', pattern: '', syntax: '暂无语法结构', clauses: [], constituents: [] };
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
                const { messages, maxTokens, temperature } = Shared.buildKnowledgePrompt(sentence);

                try {
                    const content = await callAPI(messages, { maxTokens, temperature });

                    const parsed = extractAndParseJSON(content, 'knowledge');
                    if (parsed) {
                        let knowledge = parsed.knowledge || '暂无知识点';
                        knowledge = knowledge.replace(/[；;]\s*/g, '<br>');
                        knowledge = knowledge.replace(/(重点搭配|金句|写作建议)/g, '<strong>$1</strong>');
                        return knowledge;
                    }
                    ErrorHandler.handleApiError(new Error('JSON解析失败'));
                    return '暂无知识点';
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
                const { messages, maxTokens, temperature } = Shared.buildTranslationPrompt(sentence);

                try {
                    const content = await callAPI(messages, { maxTokens, temperature });
                    return content;
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    throw error; // 重新抛出，让调用方获知真实错误原因
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
                const { messages, maxTokens, temperature } = Shared.buildWordMeaningPrompt(word);

                try {
                    const content = await callAPI(messages, { maxTokens, temperature });

                    const result = extractAndParseJSON(content, 'meaning');
                    if (result) return result;
                    ErrorHandler.handleApiError(new Error('JSON解析失败'));
                    return { meaning: '', pos: '' };
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
                const messages = Shared.buildFullTranslationMessages(text);

                try {
                    const content = await callAPI(messages, { maxTokens: 8000 });
                    return content;
                } catch (error) {
                    ErrorHandler.handleApiError(error);
                    throw error; // 重新抛出，让调用方获知真实错误原因
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
                const { messages, maxTokens, temperature } = Shared.buildExamplePrompt(word, meaning);

                try {
                    const content = await callAPI(messages, { maxTokens, temperature });

                    const result = extractAndParseJSON(content, 'example');
                    if (result) return result;
                    ErrorHandler.handleApiError(new Error('JSON解析失败'));
                    return { en: '', zh: '' };
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