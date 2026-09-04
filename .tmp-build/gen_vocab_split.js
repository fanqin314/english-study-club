/* 词频分层（阶段 B）：把核心词表拆为「高频常驻 + 低频懒加载分片」
   输入: data/vocab_library.json（14,270 词全量，唯一事实源）
   输出:
     · data/vocab_core_high.json        — 高频档（CET4 标签，常驻内存）
     · data/vocab_core_high.data.js     — 高频档内联兜底（file:// 用，global.__VOCAB_CORE_HIGH_DATA__）
     · data/dict_core/index.json        — 低频档索引 { n, map:{word:shard} }
     · data/dict_core/shard_000.json…   — 低频档分片（保留全字段，供档位/生词本/查词）
   高频档规则：tags 含 exam-cet4（大学英语四级 = 基础高频词）。
   边界可后续用真实词频表精修——只需改 HIGH_TAG/谓词并重跑本脚本，运行时零改动。
   全量 data/vocab_library.json / vocab_library.data.js 保留，作为档位按需整载与 file:// 回退。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const CORE = path.join(root, 'data', 'vocab_library.json');
const HIGH_JSON = path.join(root, 'data', 'vocab_core_high.json');
const HIGH_JS = path.join(root, 'data', 'vocab_core_high.data.js');
const LOW_DIR = path.join(root, 'data', 'dict_core');
const SHARD_SIZE = 4000;

// 高频档判定：tags 含 exam-cet4。TRUE_FREQ 可用真实词频表替换此谓词
function isHigh(w) {
  return !!w.tags && w.tags.indexOf('exam-cet4') >= 0;
}

function main() {
  const full = JSON.parse(fs.readFileSync(CORE, 'utf8'));
  const words = full.words;
  const high = words.filter(isHigh);
  const low = words.filter((w) => !isHigh(w));
  console.log('全量:', words.length, ' 高频:', high.length, ' 低频:', low.length);

  /* ---- 1) 高频档：内联 + json ---- */
  const highData = { version: full.version, words: high };
  const highStr = JSON.stringify(highData);
  fs.writeFileSync(HIGH_JSON, highStr, 'utf8');
  fs.writeFileSync(HIGH_JS,
    '/* auto-generated — 勿手改 */\n(function (g) { g.__VOCAB_CORE_HIGH_DATA__ = ' + highStr + '; })(window);\n', 'utf8');

  /* ---- 2) 低频档：索引 + 分片（全字段） ---- */
  fs.mkdirSync(LOW_DIR, { recursive: true });
  const indexMap = {};
  const nShards = Math.ceil(low.length / SHARD_SIZE);
  for (let i = 0; i < nShards; i++) {
    const chunk = low.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE);
    const wmap = {};
    chunk.forEach((e) => {
      const key = String(e.word).toLowerCase();
      const entry = { word: e.word };
      if (e.pos) entry.pos = e.pos;
      if (e.meaning) entry.meaning = e.meaning;
      if (e.phonetic) entry.phonetic = e.phonetic;
      if (e.tags) entry.tags = e.tags;
      if (e.cefr) entry.cefr = e.cefr;
      if (e.example) entry.example = e.example;
      if (e.exampleCn) entry.exampleCn = e.exampleCn;
      wmap[key] = entry;
      indexMap[key] = i;
    });
    fs.writeFileSync(path.join(LOW_DIR, 'shard_' + String(i).padStart(3, '0') + '.json'),
      JSON.stringify({ s: i, words: wmap }), 'utf8');
  }
  fs.writeFileSync(path.join(LOW_DIR, 'index.json'),
    JSON.stringify({ n: nShards, map: indexMap }), 'utf8');

  /* ---- 3) 校验：high ∪ low == full，无重叠无遗漏 ---- */
  const fullKeys = new Set(words.map((w) => String(w.word).toLowerCase()));
  const highKeys = new Set(high.map((w) => String(w.word).toLowerCase()));
  const lowKeys = new Set(low.map((w) => String(w.word).toLowerCase()));
  const overlap = highKeys.size + lowKeys.size - new Set([...highKeys, ...lowKeys]).size;
  const union = new Set([...highKeys, ...lowKeys]);
  const missing = [...fullKeys].filter((k) => !union.has(k));
  const extra = [...union].filter((k) => !fullKeys.has(k));
  if (overlap !== 0) throw new Error('高低档重叠词数: ' + overlap);
  if (missing.length || extra.length) throw new Error('集合不一致 missing=' + missing.length + ' extra=' + extra.length);

  /* ---- 统计 ---- */
  const idx = JSON.parse(fs.readFileSync(path.join(LOW_DIR, 'index.json'), 'utf8'));
  console.log('=== 词频分层统计 ===');
  console.log('高频 json:', (highStr.length / 1024 / 1024).toFixed(2), 'MB,', high.length, '词');
  console.log('低频分片数:', idx.n, ' 索引词条:', Object.keys(idx.map).length);
  fs.readdirSync(LOW_DIR).filter((f) => f.startsWith('shard_')).forEach((f) =>
    console.log('  ' + f + ':', (fs.statSync(path.join(LOW_DIR, f)).size / 1024 / 1024).toFixed(2), 'MB'));
  console.log('✓ 拆分校验通过（high ∪ low == full，无重叠）');
}

main();
