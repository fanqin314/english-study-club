// api_request.js - 处理所有API请求，包括词性分析、语法结构、知识点、翻译等
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
            if (!content || typeof content !== 'string') return null;

            const startIdx = content.indexOf('{');
            const endIdx = content.lastIndexOf('}');
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

            let jsonStr = content.substring(startIdx, endIdx + 1);

            // 尝试直接解析
            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                // 尝试修复常见问题后重试
            }

            // 修复常见 JSON 格式问题
            try {
                // 1. 移除尾随逗号（在 } 或 ] 之前）
                jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
                // 2. 移除 markdown 代码块标记
                jsonStr = jsonStr.replace(/```(?:json)?\s*/g, '');
                // 3. 修复中文引号等特殊字符
                jsonStr = jsonStr.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
                // 4. 修复字符串值内的裸换行（JSON 字符串内不允许裸换行，状态机扫描）
                {
                    let fixed = '', inString = false, escaped = false;
                    for (let i = 0; i < jsonStr.length; i++) {
                        const ch = jsonStr[i];
                        if (inString) {
                            if (escaped) { fixed += ch; escaped = false; }
                            else if (ch === '\\') { fixed += ch; escaped = true; }
                            else if (ch === '"') { fixed += ch; inString = false; }
                            else if (ch === '\n' || ch === '\r') { fixed += '\\n'; }
                            else { fixed += ch; }
                        } else {
                            if (ch === '"') inString = true;
                            fixed += ch;
                        }
                    }
                    jsonStr = fixed;
                }
                return JSON.parse(jsonStr);
            } catch (e2) {
                // 如果仍然失败，记录原始内容便于调试
                if (window.DEBUG_MODE) {
                    console.warn(`[${context}] JSON解析失败，原始内容:`, content.substring(0, 500));
                }
                return null;
            }
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

                const userContent = `分析句子: "${sentence}"`;
                
                // 空结果时自动重试一次（模型可能临时返回空数组）
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const content = await callAPI([
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userContent }
                        ], { maxTokens: 1000, temperature: 0 });

                        const result = extractAndParseJSON(content, 'pos');
                        if (result && result.pos && result.pos.length > 0) {
                            return result;
                        }
                        
                        if (attempt === 0) {
                            // 第一次返回空结果，短暂延迟后重试
                            if (window.DEBUG_MODE) console.log('[pos] 返回空结果，1秒后重试...');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                        
                        if (!result) {
                            ErrorHandler.handleApiError(new Error('JSON解析失败'));
                        }
                        return { pos: [] };
                    } catch (error) {
                        if (attempt === 0 && error.message === 'MODEL_OVERLOAD') {
                            // 模型过载，延迟后重试
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            continue;
                        }
                        ErrorHandler.handleApiError(error);
                        return { pos: [] };
                    }
                }
                return { pos: [] };
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
                const systemPrompt = `你是英语语言学专家。请按以下三套分类体系分析句子、提取从句，并分析句子成分。返回JSON格式：
{
  "structure": "按句子结构分：只能是 简单句/并列句/复合句/并列复合句",
  "function": "按句子功能分：只能是 陈述句/疑问句/祈使句/感叹句",
  "pattern": "按动词类型的基本句式：只能是 SV/SVO/SVP/SVOO/SVOC",
  "clauses": [
    {
      "category": "从句类别：定语从句(形容词性) / 状语从句(副词性) / 主语从句 / 宾语从句 / 表语从句 / 同位语从句",
      "subtype": "状语从句的细分逻辑关系（时间/原因/条件/让步/目的结果/方式/比较/地点），非状语从句留空字符串",
      "trigger": "引导词，如 that/which/who/whom/whose/where/when/because/if/unless/although/so that 等，无则留空",
      "text": "该从句在原文中对应的英文文本，尽量逐词与原文一致；若原文包含双引号，请改为单引号，避免破坏JSON"
    }
  ],
  "constituents": [
    {
      "name": "成分名：只能是 主语/谓语/宾语/表语/定语/状语/补语",
      "type": "该成分的具体分类（见下方分类清单），只列句子中实际存在的成分",
      "text": "该成分在句中对应的英文文本，可空字符串",
      "note": "一句话说明该分类的判断依据，可空字符串"
    }
  ],
  "syntax": "综合三套体系的判定依据 + 完整语法结构描述（主谓宾定状补成分）"
}
句子成分分类清单（type 字段取其一）：
- 状语（修饰动词/形容词/句子，9类）：时间状语/地点状语/原因状语/目的状语/结果状语/条件状语/让步状语/方式状语/程度状语
- 定语（修饰名词，按位置2类）：前置定语/后置定语
- 宾语（按数目3类）：单宾语/双宾语/复合宾语
- 表语（按词性）：名词性表语/形容词性表语/介词短语或副词表语/表语从句
- 主语（按真假2类）：逻辑主语/形式主语
- 谓语（按动词构成2类）：简单谓语/复合谓语
- 补语（按补充对象2类）：宾语补足语/主语补足语
判定规则：
- structure 按包含几套主谓结构：简单句只有一套；并列句两套或多套用 and/but/so/or 等连接；复合句一套主句+从句（定语/状语/名词性）；并列复合句并列分句中再含从句。
- function 按语气：陈述（句号）/疑问（问号）/祈使（省略主语 you 的指令）/感叹（how/what 或感叹语气）。
- pattern 按动词类型：SV（不及物）/SVO（单宾）/SVP（系动词+表语）/SVOO（双宾）/SVOC（宾+宾补）。
- clauses：仅当句子含从句时列出；简单句和并列句为空数组。
- constituents：逐类检查句子是否含该成分，实际存在的才列出，不存在的类别不要写。
- JSON字符串值内禁止出现未转义的双引号和换行符。
只返回JSON，不要其他文字。`;

                const userContent = `分析句子: "${sentence}"`;
                
                // JSON 解析失败时自动重试一次（模型偶尔会输出格式错误）
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const content = await callAPI([
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userContent }
                        ], { maxTokens: 3072, temperature: 0 });

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
                const systemPrompt = `你是英语语言学专家。返回JSON格式：
{
  "knowledge": "重点搭配、金句，使用换行符分隔不同要点"
}
只返回JSON，不要其他文字。`;

                const userContent = `分析句子: "${sentence}"`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ], { maxTokens: 600, temperature: 0 });

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
                const systemPrompt = `将以下英文句子翻译成中文，只返回翻译结果文本，不要其他内容。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: sentence }
                    ], { maxTokens: 300 });
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
                const systemPrompt = `你是英语词典助手。返回JSON格式：
{
  "meaning": "中文释义",
  "pos": "词性缩写(n/v/adj/adv等)"
}
只返回JSON，不要其他文字。`;

                const userContent = `提供单词"${word}"的中文释义和词性。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ], { maxTokens: 300, temperature: 0 });

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
                const systemPrompt = `将以下英文文章逐句翻译成中文。请严格按照原文的句号(.)、问号(?)、感叹号(!)作为句子结束标志进行分割，每句翻译之间用 [SENTENCE_END] 分隔。只返回翻译结果，不要其他内容。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ], { maxTokens: 8000 });
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
                const systemPrompt = `你是英语学习助手，负责为单词生成自然、实用的例句。返回JSON格式：
{
  "en": "英文例句",
  "zh": "中文翻译"
}
只返回JSON，不要其他文字。`;

                const userContent = `为单词 "${word}"（意思：${meaning}）生成一个自然的英文例句，并提供中文翻译。`;
                
                try {
                    const content = await callAPI([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ], { maxTokens: 300, temperature: 0 });

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