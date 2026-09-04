/* ============================================================
   api.js — 移动端 AI 解析（与桌面端「深度解析」后端行为对齐）
   · 复刻桌面端请求：模型 Qwen/Qwen3.5-35B-A3B、POST {baseUrl}/chat/completions、
     Bearer {apiKey}、关闭思考（enable_thinking:false）。
   · 无 Key / 网络失败 / 解析失败时优雅降级：返回示例解析（demo:true），
     调用方据此提示用户，界面始终可用（与桌面端 offline-hint 降级策略一致）。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});
  const Store = Mobile.Store;

  // 共享解析核心（分句 / prompt / JSON 提取 / 结构归一化统一真源，与桌面端一致）
  const Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  if (!Shared.splitSentences || !Shared.extractJSON) {
    throw new Error('[api.js] shared/ 核心未加载，请刷新页面重试');
  }

  const DEFAULT_MODEL = 'Qwen/Qwen3.5-35B-A3B';

  // 设计稿内置的示例文章（无 Key 时的演示数据，保证界面可演示）
  const SAMPLE_SENTENCES = [
    {
      en: 'The rapid advancement of artificial intelligence has transformed numerous industries, from healthcare to finance.',
      zh: '人工智能的快速发展已经改变了从医疗保健到金融的众多行业。',
      type: '简单句',
      words: [
        { word: 'rapid', pos: 'adj.', zh: '快速的' },
        { word: 'advancement', pos: 'n.', zh: '进步' },
        { word: 'transformed', pos: 'v.', zh: '改变' }
      ],
      grammar: ['现在完成时'],
      syntax: {
        structure: '简单句', function: '陈述句', pattern: '主谓宾',
        syntax: '主语 the rapid advancement of artificial intelligence，谓语 has transformed，宾语 numerous industries，后接介词短语 from healthcare to finance 表示范围。',
        clauses: [],
        constituents: [
          { name: '主语', type: '', text: 'The rapid advancement of artificial intelligence', note: '' },
          { name: '谓语', type: '', text: 'has transformed', note: '' },
          { name: '宾语', type: '', text: 'numerous industries', note: '' }
        ]
      },
      knowledge: 'advancements in AI 是常见搭配；transform 常用于「改变行业 / 社会」的语境。'
    },
    {
      en: 'Despite its obvious benefits, the technology also raises important ethical questions about privacy and autonomy.',
      zh: '尽管有明显的好处，这项技术也引发了关于隐私和自主权的重要伦理问题。',
      type: '复合句',
      words: [
        { word: 'despite', pos: 'prep.', zh: '尽管' },
        { word: 'ethical', pos: 'adj.', zh: '伦理的' },
        { word: 'autonomy', pos: 'n.', zh: '自主权' }
      ],
      grammar: ['让步状语从句'],
      syntax: {
        structure: '复合句', function: '陈述句', pattern: '主谓宾',
        syntax: 'Despite its obvious benefits 为让步状语，主句 the technology also raises important ethical questions 说明技术带来的问题。',
        clauses: [{ category: '状语从句', trigger: 'Despite', text: 'Despite its obvious benefits' }],
        constituents: [
          { name: '状语', type: '', text: 'Despite its obvious benefits', note: '让步' },
          { name: '主语', type: '', text: 'the technology', note: '' },
          { name: '谓语', type: '', text: 'raises', note: '' },
          { name: '宾语', type: '', text: 'important ethical questions', note: '' }
        ]
      },
      knowledge: 'despite 是介词，后接名词或动名词，不可接完整句子（区别于 although）。'
    },
    {
      en: 'Researchers are now focusing on developing more transparent and explainable AI systems.',
      zh: '研究人员现在正专注于开发更透明、可解释的人工智能系统。',
      type: '简单句',
      words: [
        { word: 'focus on', pos: 'phr.', zh: '专注于' },
        { word: 'transparent', pos: 'adj.', zh: '透明的' },
        { word: 'explainable', pos: 'adj.', zh: '可解释的' }
      ],
      grammar: ['现在进行时'],
      syntax: {
        structure: '简单句', function: '陈述句', pattern: '主谓宾',
        syntax: '主语 Researchers，谓语 are focusing on，宾语为 developing more transparent and explainable AI systems（动名词短语）。',
        clauses: [],
        constituents: [
          { name: '主语', type: '', text: 'Researchers', note: '' },
          { name: '谓语', type: '', text: 'are focusing on', note: '' },
          { name: '宾语', type: '', text: 'developing more transparent and explainable AI systems', note: '动名词短语' }
        ]
      },
      knowledge: 'focus on 后接名词或动名词；transparent / explainable 是 AI 可解释性（XAI）领域的常用词。'
    }
  ];

  function hasKey() {
    const s = Store.getSettings();
    return !!(s.apiKey && s.apiKey.trim());
  }

  // prompt / JSON 提取 / 统计 / 归一化均委托给共享核心，保证与桌面端一致
  const buildFullParseMessages = Shared.buildFullParseMessages;

  // JSON 提取 / 统计 / 归一化
  const extractJSON = Shared.extractJSON;
  const computeStats = Shared.computeStats;
  const normalizeSentence = Shared.normalizeSentence;

  // ——— API 缓存（复用桌面端 performance.cacheAPIRequest 策略） ———
  // 双重缓存：内存 Map + localStorage 持久化；默认 5 分钟过期。
  const API_CACHE_EXPIRY = 5 * 60 * 1000;
  const apiCacheMem = new Map();

  function generateCacheKey(prefix, content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const ch = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash = hash & hash; // 32 位整数
    }
    return `${prefix}_${Math.abs(hash)}`;
  }

  // 命中 localStorage / 内存缓存则直接返回，否则执行 requestFn 并写入两级缓存
  function cachedRequest(key, requestFn) {
    const lsKey = `api_cache_${key}`;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < API_CACHE_EXPIRY) return Promise.resolve(parsed.data);
      }
    } catch (e) { /* ignore */ }
    const mem = apiCacheMem.get(key);
    if (mem && Date.now() - mem.timestamp < API_CACHE_EXPIRY) return Promise.resolve(mem.data);
    return requestFn().then((data) => {
      apiCacheMem.set(key, { data, timestamp: Date.now() });
      try { localStorage.setItem(lsKey, JSON.stringify({ data, timestamp: Date.now() })); } catch (e) { /* ignore */ }
      return data;
    });
  }

  // 单次 POST /chat/completions，返回 reply content 字符串（不含缓存；
  // 缓存放在各 doRequest* 的结果层，见下，与桌面端 cacheAPIRequest 一致——
  // 这样带重试的 pos/syntax 在重试时会真正重新请求，且最终只缓存成功结果）。
  async function chatOnce(messages, options = {}) {
    const s = Store.getSettings();
    const url = `${s.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const header = { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey.trim()}` };
    const body = JSON.stringify({
      model: s.model || DEFAULT_MODEL,
      messages,
      temperature: Object.prototype.hasOwnProperty.call(options, 'temperature') ? options.temperature : 0.3,
      max_tokens: options.maxTokens || 2500,
      chat_template_kwargs: { enable_thinking: false }
    });
    const baseTimeout = options.timeout || 60000;
    // 限流/超时/5xx/空内容：在传输层集中做退避重试（尊重 Retry-After），
    // 四个子请求统一受益，显著降低“偶发整句为空/没解析”的概率。
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), baseTimeout);
      let resp;
      try {
        resp = await fetch(url, { method: 'POST', headers: header, body, signal: controller.signal });
      } catch (e) {
        clearTimeout(timer);
        // 网络错误 / 超时(AbortError)：可重试
        if (attempt < 2) { await delay(1000 + attempt * 1000); continue; }
        throw e;
      }
      clearTimeout(timer);
      if (resp.ok) {
        try {
          const data = await resp.json();
          const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (content) return content;
        } catch (e) { /* 解析失败按空内容重试 */ }
        if (attempt < 2) { await delay(1000 + attempt * 1000); continue; }
        throw new Error('empty content');
      }
      // 非 2xx：仅对限流/5xx 做退避重试
      const retryable = resp.status === 429 || (resp.status >= 500 && resp.status < 600);
      if (retryable && attempt < 2) {
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10);
        await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 + attempt * 1000);
        continue;
      }
      throw new Error('HTTP ' + resp.status);
    }
    throw new Error('请求失败，已多次重试');
  }

  // ——— 逐句调用（默认，与网页端一致） ———
  // 对每句做 pos / syntax / knowledge / translation 的伪并行请求，
  // 与桌面端 sentence_card_render 分批(每批3句)逐句调用的行为对齐。

  function doRequestPos(sentence) {
    // 词库优先：先本地查词，仅未命中的难词才交给 AI 补测（省 token、更快）
    return cachedRequest(generateCacheKey('pos', sentence), async () => {
      const DL = (global.Mobile && global.Mobile.DictLookup) || global.DictLookup;
      const lookupFn = (DL && typeof DL.lookup === 'function') ? function (w) { return DL.lookup(w); } : null;
      const { hits, missing } = await Shared.localPosLookup(sentence, lookupFn);
      // 全部命中本地词典，直接返回，无需调 AI
      if (missing.length === 0) return hits;

      const missingMessages = [
        {
          role: 'system',
          content:
            '你是英语词典助手。请对下面给出的每个单词返回词性。返回JSON格式：\n{"pos": [{"word": "单词", "pos": "n/v/adj/adv/pron/prep/conj/interj/art/num", "meaning": "中文释义"}]}\n只返回JSON，不要其他文字，顺序与输入一致。'
        },
        { role: 'user', content: '为以下单词标注词性（按给定顺序，逐词给出）：' + missing.join(', ') }
      ];

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const content = await chatOnce(missingMessages, { maxTokens: 1000, temperature: 0 });
          const r = extractJSON(content);
          if (r && Array.isArray(r.pos)) return hits.concat(r.pos);
          if (attempt === 0) { await delay(700); continue; }
          return hits;
        } catch (e) { if (attempt === 0) { await delay(500); continue; } return hits; }
      }
      return hits;
    });
  }

  function doRequestSyntax(sentence) {
    return cachedRequest(generateCacheKey('syntax', sentence), async () => {
      const { messages, maxTokens, temperature } = Shared.buildSyntaxPrompt(sentence);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const content = await chatOnce(messages, { maxTokens, temperature });
          const r = extractJSON(content);
          if (r) return {
            structure: r.structure || '', function: r.function || '', pattern: r.pattern || '',
            syntax: r.syntax || '暂无语法结构',
            clauses: Array.isArray(r.clauses) ? r.clauses : [],
            constituents: Array.isArray(r.constituents) ? r.constituents : []
          };
          if (attempt === 0) { await delay(700); continue; }
        } catch (e) { if (attempt === 0) { await delay(500); continue; } }
      }
      return { structure: '', function: '', pattern: '', syntax: '暂无语法结构', clauses: [], constituents: [] };
    });
  }

  function doRequestKnowledge(sentence) {
    return cachedRequest(generateCacheKey('knowledge', sentence), async () => {
      const { messages, maxTokens, temperature } = Shared.buildKnowledgePrompt(sentence);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const content = await chatOnce(messages, { maxTokens, temperature });
          const r = extractJSON(content);
          if (r && r.knowledge) return String(r.knowledge).replace(/[；;]\s*/g, '<br>');
        } catch (e) { /* 限流/超时/失败，进入重试 */ }
        if (attempt === 0) await delay(600); // 失败后退避再试一次
      }
      return '';
    });
  }

  function doRequestTranslation(sentence) {
    return cachedRequest(generateCacheKey('translation', sentence), async () => {
      const { messages, maxTokens, temperature } = Shared.buildTranslationPrompt(sentence);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const content = await chatOnce(messages, { maxTokens, temperature });
          const v = String(content || '').replace(/^["'\s]+|["'\s]+$/g, '');
          if (v) return v;
        } catch (e) { /* 限流/超时/失败，进入重试 */ }
        if (attempt === 0) await delay(600); // 失败后退避再试一次
      }
      return '';
    });
  }

  function delay(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // 解析单句（deep/fast 一致）：仅预取「词性标注 + 中文翻译」两项基础数据。
  // 语法结构 / 知识点刻意留空，改为用户点击分句卡片的「语法」「知识点」按钮时才按需调用
  // refetch 拉取（对齐网页端行为：不提前消耗 AI 额度，避免免费模型被 429/超时拖垮整页解析）。
  async function parseOneSentence(en, fast) {
    const [pos, zh] = await Promise.all([doRequestPos(en), doRequestTranslation(en)]);
    const words = pos.map((w) => ({ word: w.word, pos: w.pos, zh: w.meaning }));
    return normalizeSentence({ en, zh, type: '', words });
  }

  // 逐句：立即返回骨架（分句结果，详情为空），后台逐句解析完成后回调 onSentence(idx, fullSentence)
  // 并发控制：每批同时跑 batchSize 句（每句内部又并行发其子请求，算法同网页端），
  // 批间留 300ms 限流缓冲，避免免费模型被 429/超时。句子上限即文本句子数。
  async function parseStream(text, fast, onSentence) {
    const sentences = Shared.splitSentences(text);
    const n = sentences.length;
    const results = new Array(n);
    const batchSize = 3; // 对齐网页端 sentence_card_render
    for (let i = 0; i < n; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);
      const tasks = batch.map((en, off) => parseOneSentence(en, fast).then((full) => { results[i + off] = full; onSentence(i + off, full); }).catch(() => {}));
      await Promise.all(tasks);
      // 批间 300ms 限流缓冲（与网页端一致），显著降低免费模型被 429/超时的概率
      if (i + batchSize < n) await delay(300);
    }
    await backfillMissing(sentences, results, fast, onSentence); // 末轮补全缺翻译/缺词性的句子
    return n;
  }

  // 末轮补全：首轮跑完已隔一段时间、限流多已缓解，对仍缺翻译/缺词性的句子单独再请求一轮，
  // 补齐后回调 onSentence 刷新对应句子与全文翻译，避免序号“跳空”。
  async function backfillMissing(sentences, results, fast, onSentence) {
    const need = [];
    for (let i = 0; i < results.length; i++) {
      const f = results[i];
      if (!f || !f.zh || (Array.isArray(f.words) && f.words.length === 0)) need.push(i);
    }
    for (const i of need) {
      const full = await parseOneSentence(sentences[i], fast);
      const prev = results[i] || {};
      const prevWords = Array.isArray(prev.words) ? prev.words.length : 0;
      const newWords = Array.isArray(full.words) ? full.words.length : 0;
      // 只保留“更好/更全”的结果，避免用空结果覆盖已有数据
      if (full.zh && !prev.zh) { results[i] = full; onSentence(i, full); }
      else if (newWords > prevWords) { results[i] = full; onSentence(i, full); }
      await delay(250); // 逐个补，避免再次顶爆限流
    }
  }

  // 逐句：分句采用共享本地规则，每句以「深度/快速」粒度做不同调用组合
  async function requestPerSentence(text, fast) {
    const list = Shared.splitSentences(text);
    const out = new Array(list.length).fill(null);
    await parseStream(text, fast, (idx, full) => { out[idx] = full; });
    return out.filter(Boolean);
  }

  // ——— 单次全文解析（需在设置中手动切换，非默认） ———
  async function requestFullText(text, fast) {
    return cachedRequest(generateCacheKey('fulltext', (fast ? 'f|' : 'd|') + text), async () => {
      const messages = buildFullParseMessages(text, fast);
      const content = await chatOnce(messages, { maxTokens: 2500 });
      const parsed = extractJSON(content);
      if (!parsed || !Array.isArray(parsed.sentences)) throw new Error('bad format');
      return parsed.sentences.map(normalizeSentence).filter(Boolean);
    });
  }

  // 降级：示例/启发式解析（分句复用共享核心，与网页端本地分句规则一致）
  function demoParse(text) {
    let sentences;
    if (!text || text.trim().length < 40) {
      sentences = SAMPLE_SENTENCES.map((s) => {
        const n = normalizeSentence(s);
        n.zh = n.zh || s.zh; // 示例自带 zh
        return n;
      });
    } else {
      sentences = Shared.fallbackParse(text);
      if (sentences.length === 0) sentences = SAMPLE_SENTENCES.map((s) => Object.assign({}, s));
    }
    return { sentences, stats: computeStats(text || SAMPLE_SENTENCES.map((s) => s.en).join(' ')), demo: true };
  }

  /**
   * 解析文章
   * @returns {Promise<{sentences:Array, stats:Object, demo:boolean, error?:string}>}
   */
  async function parse(text) {
    if (!text || !text.trim()) {
      return Object.assign(demoParse(''), { error: 'EMPTY' });
    }
    if (!hasKey()) {
      return Object.assign(demoParse(text), { error: 'NO_KEY' });
    }
    const s = Store.getSettings();
    const fast = s.parseMode === 'fast';
    const usePerSentence = s.parseMethod !== 'fullText'; // 默认逐句调用
    try {
      const sentences = usePerSentence ? await requestPerSentence(text, fast) : await requestFullText(text, fast);
      return { sentences, stats: computeStats(text), demo: false, method: usePerSentence ? 'perSentence' : 'fullText' };
    } catch (e) {
      console.warn('[api] real parse failed, fallback demo:', e);
      return Object.assign(demoParse(text), { error: e.message || 'PARSE_FAIL' });
    }
  }

  // 为生词生成一条自然英文例句 + 中文翻译（生词本「AI 例句」按需调用；无 Key/失败返回 null）
  async function generateExample(word, meaning) {
    if (!hasKey()) return null;
    const prompt = `You are an English learning assistant. Write ONE natural, everyday English example sentence that uses the word "${word}"${meaning ? ` (meaning: ${meaning})` : ''}. The sentence should clearly show how the word is used, be easy for a learner to remember, and NOT restate the dictionary definition itself. Respond with ONLY a raw JSON object, no extra text: {"en":"<the English example sentence>","zh":"<concise Chinese translation>"}`;
    try {
      const content = await chatOnce([{ role: 'user', content: prompt }], { maxTokens: 600, temperature: 0.6 });
      const r = extractJSON(content);
      if (!r || !r.en) return null;
      return { en: String(r.en).trim(), zh: (r.zh ? String(r.zh).trim() : '') };
    } catch (e) {
      console.warn('[api] generateExample failed:', e);
      return null;
    }
  }

  // 单句单项补拉：供分句卡片某项为空时，点击该按钮重新请求，返回可直接合并进句子对象的字段
  async function refetch(en, act) {
    switch (act) {
      case 'pos': {
        const pos = await doRequestPos(en);
        return { words: pos.map((w) => ({ word: w.word, pos: w.pos, zh: w.meaning })) };
      }
      case 'syntax': {
        return { syntax: await doRequestSyntax(en) };
      }
      case 'knowledge': {
        return { knowledge: await doRequestKnowledge(en) };
      }
      case 'translation': {
        // 本地高频词快路径：基础词直接返回，省 token；未命中才走 AI
        const local = Mobile.LocalLexicon && Mobile.LocalLexicon.translateText(en);
        if (local) return { zh: local, local: true };
        return { zh: await doRequestTranslation(en) };
      }
      default:
        return {};
    }
  }

  Mobile.API = {
    parse, hasKey, computeStats, DEFAULT_MODEL, SAMPLE_SENTENCES,
    requestPerSentence, requestFullText,
    scaffold: Shared.fallbackParse,          // 本地启发式骨架（含空详情，供「边加载边显示」首屏渲染）
    parseStream,                             // 流式逐句：回调 onSentence(idx, fullSentence)
    refetch,                                 // 单项补拉：refetch(en, act) -> Partial<句子对象>
    generateExample                          // 生成例句：generateExample(word, meaning) -> {en,zh}|null
  };
})(window);
