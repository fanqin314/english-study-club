// translate.js - 浏览器插件查词/翻译源封装
//
// 两种翻译源（用户可在插件设置切换，默认 A）：
//   A = 魔塔 AI（modelscope / ModelScope）：复用桌面端请求体
//       POST {baseUrl}/chat/completions, Bearer {apiKey}, model Qwen/Qwen3.5-35B-A3B
//   B = 本地内置词库：无需联网/Key，离线可用，覆盖常见词，其余返回启发式兜底。
//
// 暴露为 window.ESCTranslate.lookup(word) -> Promise<{
//   word, phonetic, pos, definition, example, source
// }>

(function (global) {
  'use strict';

  const DEFAULT_MODEL = 'Qwen/Qwen3.5-35B-A3B';
  const DEFAULT_BASE_URL = 'https://api-inference.modelscope.cn/v1';

  // ——— 内置精简词库（B 源）———
  // 仅覆盖高频词；结构与网页端生词一致：音标/词性/释义/例句。
  const LOCAL_DICT = {
    the: { phonetic: 'ðə', pos: 'art.', definition: '这，那（定冠词）', example: 'The book is on the table.' },
    be: { phonetic: 'biː', pos: 'v.', definition: '是；存在（am/is/are 的原形）', example: 'I want to be happy.' },
    to: { phonetic: 'tuː', pos: 'prep.', definition: '向；到；动词不定式标记', example: 'I go to school.' },
    of: { phonetic: 'əv', pos: 'prep.', definition: '……的；属于', example: 'A cup of water.' },
    and: { phonetic: 'ænd', pos: 'conj.', definition: '和；并且', example: 'You and me.' },
    a: { phonetic: 'ə', pos: 'art.', definition: '一个（泛指）', example: 'A cat is sleeping.' },
    in: { phonetic: 'ɪn', pos: 'prep.', definition: '在……里面；在……期间', example: 'She is in the room.' },
    that: { phonetic: 'ðæt', pos: 'pron./conj.', definition: '那；那个；以至于', example: 'I think that he is right.' },
    have: { phonetic: 'hæv', pos: 'v.', definition: '有；吃；进行', example: 'I have a dream.' },
    it: { phonetic: 'ɪt', pos: 'pron.', definition: '它', example: 'It is raining.' },
    for: { phonetic: 'fɔːr', pos: 'prep.', definition: '为了；给；因为', example: 'This gift is for you.' },
    not: { phonetic: 'nɒt', pos: 'adv.', definition: '不；没有', example: 'I am not tired.' },
    on: { phonetic: 'ɒn', pos: 'prep.', definition: '在……上；关于', example: 'The book is on the desk.' },
    with: { phonetic: 'wɪð', pos: 'prep.', definition: '和……一起；用', example: 'Tea with lemon.' },
    he: { phonetic: 'hiː', pos: 'pron.', definition: '他', example: 'He likes music.' },
    as: { phonetic: 'æz', pos: 'prep./conj.', definition: '作为；当……时', example: 'She works as a teacher.' },
    you: { phonetic: 'juː', pos: 'pron.', definition: '你；你们', example: 'Thank you.' },
    do: { phonetic: 'duː', pos: 'v.', definition: '做；助动词', example: 'What do you do?' },
    at: { phonetic: 'æt', pos: 'prep.', definition: '在（地点/时间）', example: 'Meet me at noon.' },
    this: { phonetic: 'ðɪs', pos: 'pron.', definition: '这；这个', example: 'This is my friend.' },
    but: { phonetic: 'bʌt', pos: 'conj.', definition: '但是', example: 'It is small but useful.' },
    his: { phonetic: 'hɪz', pos: 'pron.', definition: '他的', example: 'His idea is good.' },
    by: { phonetic: 'baɪ', pos: 'prep.', definition: '被；由；通过', example: 'Written by Tom.' },
    from: { phonetic: 'frɒm', pos: 'prep.', definition: '从；来自', example: 'A letter from home.' },
    they: { phonetic: 'ðeɪ', pos: 'pron.', definition: '他们', example: 'They are students.' },
    we: { phonetic: 'wiː', pos: 'pron.', definition: '我们', example: 'We love coding.' },
    say: { phonetic: 'seɪ', pos: 'v.', definition: '说；讲', example: 'He said hello.' },
    her: { phonetic: 'hɜːr', pos: 'pron.', definition: '她的；她', example: 'Her cat is cute.' },
    she: { phonetic: 'ʃiː', pos: 'pron.', definition: '她', example: 'She studies hard.' },
    or: { phonetic: 'ɔːr', pos: 'conj.', definition: '或者；否则', example: 'Tea or coffee?' },
    an: { phonetic: 'ən', pos: 'art.', definition: '一个（元音前）', example: 'An apple a day.' },
    will: { phonetic: 'wɪl', pos: 'modal', definition: '将；会', example: 'I will help you.' },
    my: { phonetic: 'maɪ', pos: 'pron.', definition: '我的', example: 'My name is Tom.' },
    one: { phonetic: 'wʌn', pos: 'num.', definition: '一；一个', example: 'One more try.' },
    all: { phonetic, pos: 'adj./pron.', definition: '全部；所有', example: 'All people laughed.' },
    would: { phonetic: 'wʊd', pos: 'modal', definition: '会；愿意（will 过去式）', example: 'I would like tea.' },
    there: { phonetic: 'ðeə', pos: 'adv.', definition: '在那里；存在', example: 'There is a cat.' },
    their: { phonetic: 'ðeə', pos: 'pron.', definition: '他们的', example: 'Their house is big.' },
    what: { phonetic: 'wɒt', pos: 'pron.', definition: '什么', example: 'What is this?' },
    so: { phonetic: 'səʊ', pos: 'adv./conj.', definition: '所以；如此', example: 'It is so cold.' },
    up: { phonetic: 'ʌp', pos: 'adv./prep.', definition: '向上；起来', example: 'Stand up.' },
    out: { phonetic: 'aʊt', pos: 'adv.', definition: '出去；在外', example: 'Go out and play.' },
    if: { phonetic: 'ɪf', pos: 'conj.', definition: '如果；是否', example: 'If it rains, we stay.' },
    about: { phonetic: 'əˈbaʊt', pos: 'prep.', definition: '关于；大约', example: 'A book about history.' },
    who: { phonetic: 'huː', pos: 'pron.', definition: '谁', example: 'Who are you?' },
    get: { phonetic: 'ɡet', pos: 'v.', definition: '得到；变得', example: 'I get a gift.' },
    which: { phonetic: 'wɪtʃ', pos: 'pron.', definition: '哪一个', example: 'Which one do you like?' },
    go: { phonetic: 'ɡəʊ', pos: 'v.', definition: '去；走', example: 'Let us go home.' },
    when: { phonetic: 'wen', pos: 'pron.', definition: '什么时候', example: 'When is the party?' },
    make: { phonetic: 'meɪk', pos: 'v.', definition: '制作；使得', example: 'Make a cake.' },
    can: { phonetic: 'kæn', pos: 'modal', definition: '能；可以', example: 'I can swim.' },
    like: { phonetic: 'laɪk', pos: 'v./prep.', definition: '喜欢；像', example: 'I like apples.' },
    time: { phonetic: 'taɪm', pos: 'n.', definition: '时间；次', example: 'Time flies.' },
    no: { phonetic: 'nəʊ', pos: 'adv.', definition: '不；没有', example: 'No problem.' },
    just: { phonetic: 'dʒʌst', pos: 'adv.', definition: '只是；刚刚；正好', example: 'I just arrived.' },
    know: { phonetic: 'nəʊ', pos: 'v.', definition: '知道；认识', example: 'I know the answer.' },
    take: { phonetic: 'teɪk', pos: 'v.', definition: '拿；花费；乘坐', example: 'Take a break.' },
    people: { phonetic: 'ˈpiːpl', pos: 'n.', definition: '人们；人', example: 'People are kind.' },
    into: { phonetic: 'ˈɪntuː', pos: 'prep.', definition: '进入……里', example: 'Come into the room.' },
    year: { phonetic: 'jɪə', pos: 'n.', definition: '年', example: 'A new year begins.' },
    your: { phonetic: 'jɔː', pos: 'pron.', definition: '你的；你们的', example: 'Your turn.' },
    good: { phonetic: 'ɡʊd', pos: 'adj.', definition: '好的；有益的', example: 'A good idea.' },
    some: { phonetic: 'sʌm', pos: 'adj./pron.', definition: '一些', example: 'Some water, please.' },
    could: { phonetic: 'kʊd', pos: 'modal', definition: '能（can 过去式，更委婉）', example: 'Could you help me?' },
    them: { phonetic: 'ðem', pos: 'pron.', definition: '他们（宾格）', example: 'I called them.' },
    see: { phonetic: 'siː', pos: 'v.', definition: '看见；明白', example: 'I see a bird.' },
    other: { phonetic: 'ˈʌðə', pos: 'adj./pron.', definition: '其他的', example: 'The other side.' },
    than: { phonetic: 'ðæn', pos: 'conj.', definition: '比', example: 'Taller than me.' },
    then: { phonetic: 'ðen', pos: 'adv.', definition: '然后；那么', example: 'And then we left.' },
    now: { phonetic: 'naʊ', pos: 'adv.', definition: '现在', example: 'Do it now.' },
    look: { phonetic: 'lʊk', pos: 'v.', definition: '看；看起来', example: 'Look at the sky.' },
    only: { phonetic: 'ˈəʊnli', pos: 'adv.', definition: '仅仅；只', example: 'Only one left.' },
    come: { phonetic: 'kʌm', pos: 'v.', definition: '来', example: 'Come here.' },
    its: { phonetic: 'ɪts', pos: 'pron.', definition: '它的', example: 'The dog wagged its tail.' },
    over: { phonetic: 'ˈəʊvə', pos: 'prep./adv.', definition: '在……上方；结束', example: 'Over the hill.' },
    think: { phonetic: 'θɪŋk', pos: 'v.', definition: '思考；认为', example: 'I think so.' },
    also: { phonetic: 'ˈɔːlsəʊ', pos: 'adv.', definition: '也', example: 'He also sings.' },
    back: { phonetic: 'bæk', pos: 'adv./n.', definition: '回；背部', example: 'Go back home.' },
    after: { phonetic: 'ˈɑːftə', pos: 'prep./conj.', definition: '在……之后', example: 'After lunch.' },
    use: { phonetic: 'juːz', pos: 'v.', definition: '使用', example: 'Use a pen.' },
    two: { phonetic: 'tuː', pos: 'num.', definition: '二', example: 'Two books.' },
    how: { phonetic: 'haʊ', pos: 'adv.', definition: '如何；怎样', example: 'How are you?' },
    our: { phonetic: 'ˈaʊə', pos: 'pron.', definition: '我们的', example: 'Our school.' },
    work: { phonetic: 'wɜːk', pos: 'n./v.', definition: '工作', example: 'Hard work pays off.' },
    first: { phonetic: 'fɜːst', pos: 'adj./adv.', definition: '第一；首先', example: 'First place.' },
    well: { phonetic: 'wel', pos: 'adv.', definition: '好；很好地', example: 'She sings well.' },
    way: { phonetic: 'weɪ', pos: 'n.', definition: '方式；路', example: 'The best way.' },
    even: { phonetic: 'ˈiːvn', pos: 'adv.', definition: '甚至；即使', example: 'Even better.' },
    new: { phonetic: 'njuː', pos: 'adj.', definition: '新的', example: 'A new phone.' },
    want: { phonetic: 'wɒnt', pos: 'v.', definition: '想要', example: 'I want ice cream.' },
    because: { phonetic: 'bɪˈkɒz', pos: 'conj.', definition: '因为', example: 'Because it is rain.' },
    any: { phonetic: 'ˈeni', pos: 'adj./pron.', definition: '任何；一些', example: 'Any questions?' },
    these: { phonetic: 'ðiːz', pos: 'pron.', definition: '这些', example: 'These are mine.' },
    give: { phonetic: 'ɡɪv', pos: 'v.', definition: '给', example: 'Give me a hand.' },
    day: { phonetic: 'deɪ', pos: 'n.', definition: '天；日子', example: 'Have a nice day.' },
    most: { phonetic: 'məʊst', pos: 'adj./adv.', definition: '最；大多数', example: 'Most people agree.' },
    us: { phonetic: 'ʌs', pos: 'pron.', definition: '我们（宾格）', example: 'Tell us.' },
    is: { phonetic: 'ɪz', pos: 'v.', definition: '是（第三人称单数）', example: 'He is here.' },
    are: { phonetic: 'ɑː', pos: 'v.', definition: '是（复数/你/你们）', example: 'They are ready.' },
    was: { phonetic: 'wɒz', pos: 'v.', definition: '是（过去式，单数）', example: 'It was fun.' },
    were: { phonetic: 'wɜː', pos: 'v.', definition: '是（过去式，复数）', example: 'We were late.' },
    learning: { phonetic: 'ˈlɜːnɪŋ', pos: 'n./v.', definition: '学习', example: 'Language learning takes time.' },
    study: { phonetic: 'ˈstʌdi', pos: 'v./n.', definition: '学习；研究', example: 'Study English daily.' },
    word: { phonetic: 'wɜːd', pos: 'n.', definition: '单词；词', example: 'A new word.' },
    book: { phonetic: 'bʊk', pos: 'n.', definition: '书', example: 'Read a book.' },
    read: { phonetic: 'riːd', pos: 'v.', definition: '阅读', example: 'Read aloud.' },
    write: { phonetic: 'raɪt', pos: 'v.', definition: '写', example: 'Write a letter.' },
    language: { phonetic: 'ˈlæŋɡwɪdʒ', pos: 'n.', definition: '语言', example: 'English is a language.' },
    english: { phonetic: 'ˈɪŋɡlɪʃ', pos: 'n./adj.', definition: '英语；英国的', example: 'Speak English.' },
    sentence: { phonetic: 'ˈsentəns', pos: 'n.', definition: '句子', example: 'A long sentence.' },
    example: { phonetic: 'ɪɡˈzɑːmpl', pos: 'n.', definition: '例子', example: 'For example.' },
    meaning: { phonetic: 'ˈmiːnɪŋ', pos: 'n.', definition: '意思；含义', example: 'What is the meaning?' },
    vocabulary: { phonetic: 'vəˈkæbjələri', pos: 'n.', definition: '词汇', example: 'Build vocabulary.' },
    translate: { phonetic: 'trænzˈleɪt', pos: 'v.', definition: '翻译', example: 'Translate this line.' },
    remember: { phonetic: 'rɪˈmembə', pos: 'v.', definition: '记得', example: 'Remember the rule.' },
    practice: { phonetic: 'ˈpræktɪs', pos: 'n./v.', definition: '练习', example: 'Daily practice helps.' },
    improve: { phonetic: 'ɪmˈpruːv', pos: 'v.', definition: '提高；改善', example: 'Improve speaking.' },
  };

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function cleanWord(raw) {
    return (raw || '').trim().replace(/[.,;:!?'"()\[\]{}<>]/g, '');
  }

  function extractJSON(content) {
    if (!content) return null;
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch (e) {
      return null;
    }
  }

  // ——— 源 A：魔塔 AI ———
  async function lookupAI(word, settings) {
    const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const header = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    };
    const messages = [
      {
        role: 'system',
        content:
          '你是一个英语词典助手。用户给你一个英文单词，请只返回一个 JSON 对象，' +
          '字段为：word(原词), phonetic(音标，用 / 包围), pos(词性，如 n./v.), ' +
          'definition(中文释义，简洁), example(一句英文例句，不要翻译)。不要任何额外文字。',
      },
      { role: 'user', content: word },
    ];
    const body = JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 800,
      chat_template_kwargs: { enable_thinking: false },
    });

    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const resp = await fetch(url, { method: 'POST', headers: header, body, signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) {
          lastErr = new Error('HTTP ' + resp.status);
          if ((resp.status === 429 || resp.status >= 500) && attempt < 2) {
            await delay(1000 + attempt * 1000);
            continue;
          }
          throw lastErr;
        }
        const data = await resp.json();
        const content =
          data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        const parsed = extractJSON(content);
        if (parsed && parsed.word) {
          return {
            word: parsed.word || word,
            phonetic: parsed.phonetic || '',
            pos: parsed.pos || '',
            definition: parsed.definition || '',
            example: parsed.example || '',
            source: 'A',
          };
        }
        if (attempt < 2) {
          await delay(700);
          continue;
        }
        throw new Error('AI 返回无法解析');
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
        if (attempt < 2 && (e.name === 'AbortError' || /HTTP 429|5\d\d/.test(String(e.message)))) {
          await delay(1000 + attempt * 1000);
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('AI 查词失败');
  }

  // ——— 源 B：本地词库 ———
  async function lookupLocal(word) {
    const w = cleanWord(word).toLowerCase();
    const entry = LOCAL_DICT[w];
    if (entry) {
      return {
        word: word.trim(),
        phonetic: entry.phonetic || '',
        pos: entry.pos || '',
        definition: entry.definition || '',
        example: entry.example || '',
        source: 'B',
      };
    }
    // 兜底：无法离线查到，返回提示，由上层决定是否回退到 A
    return {
      word: word.trim(),
      phonetic: '',
      pos: '',
      definition: '（本地词库未收录，可在设置切换为「魔塔 AI」查词）',
      example: '',
      source: 'B',
    };
  }

  // 统一入口
  async function lookup(word, opts) {
    const source = (opts && opts.source) || ((opts && opts.settings) || {}).translateSource ||
      (await global.ESCStore.getSettings()).translateSource || 'A';
    const w = cleanWord(word);
    if (!w) {
      return { word: '', phonetic: '', pos: '', definition: '请输入单词', example: '', source: source };
    }

    if (source === 'A') {
      // 优先复用网页端已存的 API 配置（通过 companion 实时读取），插件无需重复填 Key。
      let cfg = null;
      try {
        if (global.ESC_COMPANION && global.ESC_COMPANION.getApiConfig) {
          const r = await global.ESC_COMPANION.getApiConfig();
          if (r && r.ok && r.data && r.data.apiKey) cfg = r.data;
        }
      } catch (e) { cfg = null; }

      // 回退：插件本地 escSettings
      if (!cfg || !cfg.apiKey) {
        const local = (opts && opts.settings) || (await global.ESCStore.getSettings());
        if (local.apiKey && local.apiKey.trim()) {
          cfg = { apiKey: local.apiKey, baseUrl: local.baseUrl || DEFAULT_BASE_URL, model: DEFAULT_MODEL };
        }
      }

      if (!cfg || !cfg.apiKey || !cfg.apiKey.trim()) {
        // 完全无 key：自动降级到本地词库
        const r = await lookupLocal(w);
        r.source = 'B(降级)';
        return r;
      }
      try {
        return await lookupAI(w, cfg);
      } catch (e) {
        // AI 失败：降级到本地词库并标注
        const r = await lookupLocal(w);
        r.source = 'B(降级)';
        return r;
      }
    }
    return await lookupLocal(w);
  }

  global.ESCTranslate = { lookup, lookupLocal, lookupAI, LOCAL_DICT };
})(window);
