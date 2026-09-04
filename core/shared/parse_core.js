/* ============================================================
   shared/parse_core.js — 共享 AI 解析核心（两端复用）
   · 纯函数：schema 定义、prompt 构造、JSON 提取、结构归一化。
   · 目标是让网页端与 mobile 端对同一句/同一文，产出**一致**的数据结构，
     从而 UI 可各自渲染、底层解析共享单一真源。
   · 只做解析与结构，不涉及 DOM / 请求编排（请求由各端自己实现）。
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});

  /* ---------- 词性定义（两端统一） ---------- */
  var POS_LIST = ['n', 'v', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'art', 'num'];

  // 句子结构三套体系的限定枚举（与网页端 api_request.js 中一致）
  var STRUCTURES = ['简单句', '并列句', '复合句', '并列复合句'];
  var FUNCTIONS = ['陈述句', '疑问句', '祈使句', '感叹句'];

  /**
   * 构建「轻量解析」prompt 的 system 部分
   * 与网页端「fast」一致：切分 + 翻译 + 句子类型 + 重点词。
   */
  function fastPromptText() {
    return '做轻量解析：句子切分 + 每句一句中文翻译 + 句子类型（简单句/复合句/并列句）+ 重点单词（word/pos/zh）。';
  }

  /**
   * 构建「深度解析」prompt 的 system 部分
   * 与网页端 requestSyntax / requestPos / requestKnowledge 深度解析一致。
   */
  function deepPromptText() {
    return (
      '做深度解析：句子切分、每句中文翻译、句子类型（简单句/复合句/并列句）、句中重点单词（word/pos/zh）、' +
      '语法点（时态、从句等），并对每句给出结构化语法分析与知识点。'
    );
  }

  // 全文解析 JSON schema（单次请求由模型产出全部句子，mobile 端使用）
  function fullParseSchema(fast) {
    return fast
      ? '{"sentences":[{"en":"原文句子","zh":"中文翻译","type":"句子类型","words":[{"word":"单词","pos":"词性如 adj./n./v.","zh":"释义"}]}]}'
      : '{"sentences":[{"en":"原文句子","zh":"中文翻译","type":"句子类型","words":[{"word":"单词","pos":"词性如 adj./n./v.","zh":"释义"}],"grammar":["语法点"],"syntax":{"structure":"句子结构如 简单句/并列句/复合句/并列复合句","function":"句子功能如 陈述句/疑问句/祈使句/感叹句","pattern":"基本句式如 主谓/主谓宾/主系表","syntax":"一句话综合语法描述","clauses":[{"category":"从句类别如 定语从句/状语从句","trigger":"引导词","text":"从句原文"}],"constituents":[{"name":"句子成分如 主语/谓语/宾语","type":"","text":"成分对应原文","note":"说明"}]},"knowledge":"该句知识点、搭配、用法或文化背景（换行分隔要点）"}]}';
  }

  /**
   * 构造一个「全文解析」的 messages 数组（mobile 单次请求）
   * @param {string} text
   * @param {boolean} fast
   */
  function buildFullParseMessages(text, fast) {
    return [
      {
        role: 'system',
        content: '你是英语精读助手。仅输出 JSON，不要解释、不要 markdown 代码块。结构：' + fullParseSchema(fast) + '。'
      },
      {
        role: 'user',
        content: '请解析下面这篇文章。' + (fast ? fastPromptText() : deepPromptText()) + '\n\n文章：\n' + text
      }
    ];
  }

  /* ---------- 逐句细粒度解析 prompt（网页端使用） ---------- */

  // 词性分析
  function buildPosPrompt(sentence) {
    return {
      messages: [
        {
          role: 'system',
          content:
            '你是英语语言学专家。返回JSON格式：\n{"pos": [{"word": "单词", "pos": "n/v/adj/adv/pron/prep/conj/interj/art/num", "meaning": "中文释义"}]}\n只返回JSON，不要其他文字。'
        },
        { role: 'user', content: '分析句子: "' + sentence + '"' }
      ],
      maxTokens: 1000,
      temperature: 0
    };
  }

  // 语法结构：三套分类 + 从句 + 成分
  function buildSyntaxPrompt(sentence) {
    return {
      messages: [
        {
          role: 'system',
          content:
            '你是英语语言学专家。请按以下三套分类体系分析句子、提取从句，并分析句子成分。返回JSON格式：\n' +
            '{\n  "structure": "按句子结构分：只能是 ' + STRUCTURES.join('/') + '",\n' +
            '  "function": "按句子功能分：只能是 ' + FUNCTIONS.join('/') + '",\n' +
            '  "pattern": "按动词类型的基本句式：只能是 SV/SVO/SVP/SVOO/SVOC",\n' +
            '  "clauses": [{"category": "从句类别：定语从句(形容词性)/状语从句(副词性)/主语从句/宾语从句/表语从句/同位语从句", "subtype": "状语从句细分逻辑关系，非状语从句留空", "trigger": "引导词如 that/which/who/where/when/because/if/unless/although 等，无则留空", "text": "该从句在原文中对应的英文文本，尽量逐词与原文一致；若含双引号请改为单引号避免破坏JSON"}],\n' +
            '  "constituents": [{"name": "成分名：只能是 主语/谓语/宾语/表语/定语/状语/补语", "type": "该成分具体分类", "text": "成分在句中对应英文，可空", "note": "判断依据，可空"}],\n' +
            '  "syntax": "综合三套体系的判定依据 + 完整语法结构描述"\n}\n' +
            '句子成分分类清单（type 字段取其一）：\n' +
            '- 状语（修饰功能，9类）：时间/地点/原因/目的/结果/条件/让步/方式/程度状语\n' +
            '- 定语（按位置2类）：前置定语/后置定语\n- 宾语（按数目3类）：单宾语/双宾语/复合宾语\n' +
            '- 表语（按词性）：名词性表语/形容词性表语/介词短语或副词表语/表语从句\n' +
            '- 主语（按真假2类）：逻辑主语/形式主语\n- 谓语（按动词构成2类）：简单谓语/复合谓语\n' +
            '- 补语（按补充对象2类）：宾语补足语/主语补足语\n' +
            '判定规则：structure 按包含几套主谓结构判断；function 按语气；pattern 按动词类型；clauses 仅含从句时列出；constituents 只列出实际存在的成分。\n' +
            'JSON字符串值内禁止出现未转义的双引号和换行符。\n只返回JSON，不要其他文字。'
        },
        { role: 'user', content: '分析句子: "' + sentence + '"' }
      ],
      maxTokens: 3072,
      temperature: 0
    };
  }

  // 知识点
  function buildKnowledgePrompt(sentence) {
    return {
      messages: [
        {
          role: 'system',
          content:
            '你是英语语言学专家。返回JSON格式：\n{"knowledge": "重点搭配、金句，使用换行符分隔不同要点"}\n只返回JSON，不要其他文字。'
        },
        { role: 'user', content: '分析句子: "' + sentence + '"' }
      ],
      maxTokens: 600,
      temperature: 0
    };
  }

  // 单句翻译
  function buildTranslationPrompt(sentence) {
    return {
      messages: [
        { role: 'system', content: '将以下英文句子翻译成中文，只返回翻译结果文本，不要其他内容。' },
        { role: 'user', content: sentence }
      ],
      maxTokens: 300
    };
  }

  // 全文翻译
  // 输出契约为 JSON 数组（逐句翻译按原文顺序排列），比自定义分隔符 [SENTENCE_END]
  // 更易被模型稳定遵循，避免模型把多句译文用逗号/分号连写导致数量对不上。
  function buildFullTranslationMessages(text) {
    return [
      {
        role: 'system',
        content:
          '你是逐句翻译引擎。将用户提供的英文文章逐句翻译成中文，并返回一个 JSON 数组。规则：\n' +
          '1. 数组的每个元素对应原文一个句子的中文翻译，元素顺序必须与原文句子顺序完全一致。\n' +
          '2. 只有英文句号(.)、问号(?)、感叹号(!)是句子结束标志；分号(;)、冒号(:)、逗号(,)都不是句子边界，一个句子即使包含多个分句也必须翻译成一条完整的译文，禁止拆成多条。\n' +
          '3. 数组长度必须严格等于原文句子总数（按句号/问号/感叹号统计）。\n' +
          '4. 严禁把多个句子的译文合并成一条（不得用逗号或分号连接多句）；一个数组元素只能对应一个原文句子。\n' +
          '5. 文章开头的独立标题（如 "Of Studies"）不要单独输出，并入第一句翻译。\n' +
          '只返回 JSON 数组本身，不要任何解释、注释或 Markdown 代码块。'
      },
      { role: 'user', content: text }
    ];
  }

  // 单词释义
  function buildWordMeaningPrompt(word) {
    return {
      messages: [
        {
          role: 'system',
          content:
            '你是英语词典助手。返回JSON格式：\n{"meaning": "中文释义", "pos": "词性缩写(n/v/adj/adv等)"}\n只返回JSON，不要其他文字。'
        },
        { role: 'user', content: '提供单词"' + word + '"的中文释义和词性。' }
      ],
      maxTokens: 300,
      temperature: 0
    };
  }

  // 单词例句
  function buildExamplePrompt(word, meaning) {
    return {
      messages: [
        {
          role: 'system',
          content:
            '你是英语学习助手，负责为单词生成自然、实用的例句。返回JSON格式：\n{"en": "英文例句", "zh": "中文翻译"}\n只返回JSON，不要其他文字。'
        },
        { role: 'user', content: '为单词 "' + word + '"（意思：' + meaning + '）生成一个自然的英文例句，并提供中文翻译。' }
      ],
      maxTokens: 300,
      temperature: 0
    };
  }

  /* ---------- JSON 稳健提取（与网页端 extractAndParseJSON 对齐） ---------- */
  function extractJSON(text) {
    if (!text || typeof text !== 'string') return null;
    var startIdx = text.indexOf('{');
    var endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

    var jsonStr = text.substring(startIdx, endIdx + 1);
    try { return JSON.parse(jsonStr); } catch (e) { /* continue */ }

    // 修复常见问题
    try {
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');          // 尾随逗号
      jsonStr = jsonStr.replace(/```(?:json)?\s*/g, '');          // markdown 标记
      jsonStr = jsonStr.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"'); // 中文引号
      // 字符串值内裸换行
      var fixed = '', inString = false, escaped = false;
      for (var i = 0; i < jsonStr.length; i++) {
        var ch = jsonStr[i];
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
      return JSON.parse(fixed);
    } catch (e2) {
      return null;
    }
  }

  /* ---------- 结构归一化：保证各端拿到一致的字段 ---------- */

  /**
   * 把一条 AI 原始句子记录规整成统一结构（关键字段有默认值、数组有兜底）
   */
  function normalizeSentence(s) {
    if (!s || typeof s !== 'object') return null;
    var rawSyn = s.syntax && typeof s.syntax === 'object' ? s.syntax : {};
    return {
      en: s.en || '',
      zh: s.zh || s.translation || '',
      type: s.type || rawSyn.structure || '简单句',
      words: Array.isArray(s.words) ? s.words.map(function (w) {
        return {
          word: w.word || '',
          pos: w.pos || '',
          zh: w.zh || w.meaning || '',
          // 精读洞察（C2/C3）：透传 AI 解析的词根/搭配/同反义字段，无则留空数组
          wordRoot: Array.isArray(w.wordRoot) ? w.wordRoot : (w.root ? [].concat(w.root) : []),
          collocations: Array.isArray(w.collocations) ? w.collocations : [],
          synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
          antonyms: Array.isArray(w.antonyms) ? w.antonyms : []
        };
      }) : [],
      grammar: Array.isArray(s.grammar) ? s.grammar : [],
      syntax: {
        structure: rawSyn.structure || '',
        function: rawSyn.function || '',
        pattern: rawSyn.pattern || '',
        syntax: rawSyn.syntax || '',
        clauses: Array.isArray(rawSyn.clauses) ? rawSyn.clauses : [],
        constituents: Array.isArray(rawSyn.constituents) ? rawSyn.constituents : []
      },
      knowledge: s.knowledge || ''
    };
  }

  /**
   * 统计：单词数 / 句子数 / 阅读分钟
   */
  function computeStats(text) {
    var s = text || '';
    var out = {
      words: (s.trim().match(/[A-Za-z']+/g) || []).length,
      sentences: (s.trim().match(/[.!?。！？]+(?:\s|$)/gm) || []).length || 1,
      minutes: Math.max(1, Math.round(s.trim().match(/[A-Za-z']+/g) ? (s.trim().match(/[A-Za-z']+/g).length / 200) : 0))
    };
    // 难度预估：共享 study_stats 模块提供 estimateReadability；缺失/空白时该字段为 null，展示端优雅隐藏
    if (Shared.Stats && Shared.Stats.estimateReadability) {
      out.readability = Shared.Stats.estimateReadability(s);
    } else {
      out.readability = null;
    }
    return out;
  }

  /**
   * 词库优先的词性预填（两端复用）：将句子切分为单词，逐词查询本地词典。
   * @param {string} sentence
   * @param {Function} dictLookup - 传入各端已绑定的词典查询函数（async: word -> {pos, meaning} | null）
   * @returns {Promise<{hits: Array, missing: Array}>}
   *   hits: 本地命中 [{word,pos,meaning}]（按原词序、去重）
   *   missing: 未命中需交 AI 的单词（保留原词形）
   */
  async function localPosLookup(sentence, dictLookup) {
    var hits = [];
    var missing = [];
    if (!sentence || typeof sentence !== 'string' || typeof dictLookup !== 'function') {
      return { hits: hits, missing: missing };
    }
    var tokens = sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/g) || [];
    // 去重并保持首次出现顺序（词性列表顺序与原文一致）
    var seen = {};
    var uniq = [];
    for (var i = 0; i < tokens.length; i++) {
      var k = tokens[i].toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      uniq.push(tokens[i]);
    }
    // 并行查询：DictLookup 内部已对同一分片做 in-flight 去重，多词并发触发分片加载可复用同一次请求，
    // 冷启动时分片并发拉取，避免逐词串行 await 把各分片下载时间累加
    var results = await Promise.all(uniq.map(function (token) {
      return dictLookup(token).catch(function () { return null; });
    }));
    for (var j = 0; j < uniq.length; j++) {
      var dict = results[j];
      if (dict && dict.pos) {
        hits.push({ word: uniq[j], pos: dict.pos, meaning: dict.meaning || '' });
      } else {
        missing.push(uniq[j]);
      }
    }
    return { hits: hits, missing: missing };
  }

  /* ---------- 导出 ---------- */
  Shared.POS_LIST = POS_LIST;
  Shared.STRUCTURES = STRUCTURES;
  Shared.FUNCTIONS = FUNCTIONS;
  Shared.fullParseSchema = fullParseSchema;
  Shared.buildFullParseMessages = buildFullParseMessages;
  Shared.buildPosPrompt = buildPosPrompt;
  Shared.buildSyntaxPrompt = buildSyntaxPrompt;
  Shared.buildKnowledgePrompt = buildKnowledgePrompt;
  Shared.buildTranslationPrompt = buildTranslationPrompt;
  Shared.buildFullTranslationMessages = buildFullTranslationMessages;
  Shared.buildWordMeaningPrompt = buildWordMeaningPrompt;
  Shared.buildExamplePrompt = buildExamplePrompt;
  Shared.extractJSON = extractJSON;
  Shared.normalizeSentence = normalizeSentence;
  Shared.computeStats = computeStats;
  Shared.localPosLookup = localPosLookup;
})(typeof window !== 'undefined' ? window : globalThis);