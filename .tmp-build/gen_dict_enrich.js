/* 词典补充：从 ECDICT 提取音标/例句，丰富核心词库并生成按词频分档的懒加载词典
   输入: .tmp-build/ecdict.csv（ECDICT，66MB）+ data/vocab_library.json（去重核心词表）
   输出:
     · data/vocab_library.json       — 核心词表追加 phonetic/example/exampleCn
     · data/vocab_library.data.js    — 内联兜底
     · data/dict/index.json          — { n: 分片数, map: { word: shardIndex } }
     · data/dict/shard_000.json ...  — 按词频从高到低的分片 { s, words: { word: entry } }
   · 核心词保留既有 meaning（考试导向），仅补音标/例句
   · 分片词取 top COMMON_LIMIT 常用词（frq/bnc 升序），剔除核心词避免重复存储
   · 例句缺失即不写字段（展示端隐藏），不补编（零 AI token） */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const root = path.resolve(__dirname, '..');

const ECDICT = path.join(root, '.tmp-build', 'ecdict.csv');
const CORE = path.join(root, 'data', 'vocab_library.json');
const DICT_DIR = path.join(root, 'data', 'dict');
const COMMON_LIMIT = 40000;   // 常用词典覆盖词数（词频前 N）
const SHARD_SIZE = 4000;      // 每片词数

/* ---- CSV 解析（处理双引号转义） ---- */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/* 从 detail（柯林斯 JSON）提取首条例句 { en, cn } */
function extractExample(detail) {
  if (!detail || typeof detail !== 'string') return null;
  try {
    const arr = JSON.parse(detail);
    if (!Array.isArray(arr)) return null;
    for (const e of arr) {
      let d = e && e.detail;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { continue; } }
      if (d && Array.isArray(d.sent) && d.sent.length) {
        const s = d.sent[0];
        if (s && s.en) return { en: String(s.en), cn: s.cn ? String(s.cn) : '' };
      }
    }
  } catch (e) { /* 解析失败忽略 */ }
  return null;
}

function frqNum(v) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n <= 0) return Infinity; // 0 = 无频率数据
  return n;
}

async function main() {
  if (!fs.existsSync(ECDICT)) throw new Error('缺少 ECDICT: ' + ECDICT);

  console.log('解析 ECDICT…');
  const lookup = new Map(); // lowercase word -> {phonetic, meaning, pos, frq, example}
  const stream = fs.createReadStream(ECDICT, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) continue; // 表头
    if (!line) continue;
    const c = parseCsvLine(line);
    const word = (c[0] || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    const frq = frqNum(c[9]);
    const existing = lookup.get(key);
    // 保留真实频率更高（frq 更小）的词条；无频率（Infinity）词条仅在无替代时保留
    if (existing && existing.frq <= frq) continue;
    const ex = extractExample(c[11]);
    lookup.set(key, {
      word,
      phonetic: (c[1] || '').trim(),
      meaning: (c[3] || '').trim().replace(/\n/g, '；'),
      pos: (c[4] || '').trim(),
      frq,
      example: ex ? ex.en : '',
      exampleCn: ex ? ex.cn : ''
    });
  }
  console.log('ECDICT 词条:', lookup.size);

  /* ---- 1) 丰富核心词表 ---- */
  const core = JSON.parse(fs.readFileSync(CORE, 'utf8'));
  // 例句补充源：Tatoeba（ECDICT detail 为空）。tat_examples.json = { word: {en, cn} }
  let tat = {};
  const TAT = path.join(root, 'data', 'tat_examples.json');
  if (fs.existsSync(TAT)) { try { tat = JSON.parse(fs.readFileSync(TAT, 'utf8')); } catch (e) { tat = {}; } }
  let corePhon = 0, coreEx = 0, coreTatEx = 0;
  core.words.forEach((w) => {
    const e = lookup.get(w.word.toLowerCase());
    if (e) {
      if (e.phonetic) { w.phonetic = e.phonetic; corePhon++; }
      if (e.example) { w.example = e.example; w.exampleCn = e.exampleCn; coreEx++; }
    }
    // 已有 ECDICT 例句则优先；否则补 Tatoeba 例句
    if (!w.example) {
      const te = tat[w.word.toLowerCase()];
      if (te && te.en) { w.example = te.en; w.exampleCn = te.cn || ''; coreTatEx++; }
    }
  });
  const coreStr = JSON.stringify(core);
  fs.writeFileSync(CORE, coreStr, 'utf8');
  fs.writeFileSync(path.join(root, 'data', 'vocab_library.data.js'),
    '/* auto-generated — 勿手改 */\n(function (g) { g.__VOCAB_LIBRARY_DATA__ = ' + coreStr + '; })(window);\n', 'utf8');

  /* ---- 2) 分片词：按词频升序取前 COMMON_LIMIT，剔除核心词与无频率词 ---- */
  const coreKeys = new Set(core.words.map((w) => w.word.toLowerCase()));
  const common = Array.from(lookup.values())
    .filter((e) => e.frq !== Infinity)           // 只有真实词频
    .filter((e) => !coreKeys.has(e.word.toLowerCase()))
    .sort((a, b) => a.frq - b.frq)
    .slice(0, COMMON_LIMIT);
  console.log('分片常用词（剔除核心词）:', common.length);

  /* ---- 3) 写分片 + 索引 ---- */
  fs.mkdirSync(DICT_DIR, { recursive: true });
  const indexMap = {};
  const nShards = Math.ceil(common.length / SHARD_SIZE);
  for (let i = 0; i < nShards; i++) {
    const chunk = common.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE);
    const words = {};
    chunk.forEach((e) => {
      const entry = { w: e.word };
      if (e.phonetic) entry.p = e.phonetic;
      if (e.meaning) entry.m = e.meaning;
      if (e.pos) entry.pos = e.pos;
      if (e.example) { entry.ex = e.example; entry.exCn = e.exampleCn; }
      words[e.word.toLowerCase()] = entry;
      indexMap[e.word.toLowerCase()] = i;
    });
    fs.writeFileSync(path.join(DICT_DIR, 'shard_' + String(i).padStart(3, '0') + '.json'),
      JSON.stringify({ s: i, words }), 'utf8');
  }
  fs.writeFileSync(path.join(DICT_DIR, 'index.json'),
    JSON.stringify({ n: nShards, map: indexMap }), 'utf8');

  /* ---- 统计 ---- */
  const idx = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'index.json'), 'utf8'));
  console.log('=== 词典补充统计 ===');
  console.log('核心词音标覆盖:', corePhon + '/' + core.words.length);
  console.log('核心词例句覆盖:', coreEx + '/' + core.words.length, '(ECDICT)', coreTatEx, '(Tatoeba) 合计', coreEx + coreTatEx);
  console.log('分片数:', nShards, '索引词条:', Object.keys(idx.map).length);
  console.log('核心 json:', (coreStr.length / 1024 / 1024).toFixed(2), 'MB');
  const idxStr = JSON.stringify(idx);
  console.log('索引 json:', (idxStr.length / 1024 / 1024).toFixed(2), 'MB');
  const shardSizes = fs.readdirSync(DICT_DIR).filter((f) => f.startsWith('shard_')).map((f) =>
    fs.statSync(path.join(DICT_DIR, f)).size);
  shardSizes.forEach((s, i) => console.log('  shard_' + i + ':', (s / 1024 / 1024).toFixed(2), 'MB'));
}

main().catch((e) => { console.error(e); process.exit(1); });
