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
      grammar: ['现在完成时']
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
      grammar: ['让步状语从句']
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
      grammar: ['现在进行时']
    }
  ];

  function hasKey() {
    const s = Store.getSettings();
    return !!(s.apiKey && s.apiKey.trim());
  }

  function buildPrompt(text, fast) {
    const depth = fast
      ? '只做轻量解析：句子切分 + 每句一句中文翻译 + 句子类型（简单句/复合句/并列句）。'
      : '做深度解析：句子切分、每句中文翻译、句子类型（简单句/复合句/并列句）、句中重点单词（word/pos/zh）、语法点（如时态、从句）。';
    return [
      {
        role: 'system',
        content: '你是英语精读助手。仅输出 JSON，不要解释、不要 markdown 代码块。结构：{"sentences":[{"en":"原文句子","zh":"中文翻译","type":"句子类型","words":[{"word":"单词","pos":"词性如 adj./n./v.","zh":"释义"}],"grammar":["语法点"]}]}。'
      },
      {
        role: 'user',
        content: `请解析下面这篇文章。${depth}\n\n文章：\n${text}`
      }
    ];
  }

  // 从模型返回里尽量稳健地提取 JSON
  function extractJSON(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) { /* fall through */ }
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ }
    }
    return null;
  }

  function computeStats(text) {
    const words = (text.trim().match(/[A-Za-z']+/g) || []).length;
    const sentences = (text.trim().match(/[.!?]+(\s|$)/g) || []).length || 1;
    const minutes = Math.max(1, Math.round(words / 200));
    return { words, sentences, minutes };
  }

  // 真实请求
  async function requestReal(text, fast) {
    const s = Store.getSettings();
    const url = `${s.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey.trim()}` },
        body: JSON.stringify({
          model: s.model || DEFAULT_MODEL,
          messages: buildPrompt(text, fast),
          temperature: 0.3,
          max_tokens: 1500,
          chat_template_kwargs: { enable_thinking: false }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('empty content');
      const parsed = extractJSON(content);
      if (!parsed || !Array.isArray(parsed.sentences)) throw new Error('bad format');
      return { sentences: parsed.sentences, stats: computeStats(text), demo: false };
    } finally {
      clearTimeout(timer);
    }
  }

  // 降级：示例/启发式解析
  function demoParse(text) {
    let sentences;
    if (!text || text.trim().length < 40) {
      sentences = SAMPLE_SENTENCES.map((s) => Object.assign({}, s));
    } else {
      sentences = text
        .split(/\n+/)
        .map((b) => b.trim())
        .filter(Boolean)
        .flatMap((block) => block.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean))
        .map((en) => ({
          en,
          zh: '',
          type: en.length > 90 ? '复合句' : '简单句',
          words: [],
          grammar: []
        }));
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
      // 空输入：直接给示例，便于演示
      return Object.assign(demoParse(''), { error: 'EMPTY' });
    }
    if (!hasKey()) {
      return Object.assign(demoParse(text), { error: 'NO_KEY' });
    }
    try {
      return await requestReal(text, Store.getSettings().parseMode === 'fast');
    } catch (e) {
      console.warn('[api] real parse failed, fallback demo:', e);
      return Object.assign(demoParse(text), { error: e.message || 'PARSE_FAIL' });
    }
  }

  Mobile.API = { parse, hasKey, computeStats, DEFAULT_MODEL, SAMPLE_SENTENCES };
})(window);
