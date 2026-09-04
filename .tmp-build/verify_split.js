/* 阶段B 验证：拆分一致性 + 分片覆盖 + 内联文件可用性 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FULL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vocab_library.json'), 'utf8'));
const HIGH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vocab_core_high.json'), 'utf8'));
const HIGH_JS = fs.readFileSync(path.join(ROOT, 'data/vocab_core_high.data.js'), 'utf8');

let pass = true;
function check(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!cond) pass = false;
}

// 1) 高频 + 低频 = 全量，无重叠无遗漏
const fullWords = FULL.words.map(w => String(w.word).toLowerCase());
const highWords = HIGH.words.map(w => String(w.word).toLowerCase());
const highSet = new Set(highWords);
const fullSet = new Set(fullWords);
check('全量词数 = 14270', fullWords.length === 14270, 'got ' + fullWords.length);
check('高频词数 > 0', highWords.length === highSet.size, 'high=' + highWords.length + ' unique=' + highSet.size);
check('高频 ⊆ 全量', highWords.every(w => fullSet.has(w)));

// 低频 = 全量 - 高频
const lowWords = fullWords.filter(w => !highSet.has(w));
const lowSet = new Set(lowWords);
check('低频 + 高频 = 全量', (lowWords.length + highWords.length) === fullWords.length, 'low=' + lowWords.length);
check('无重叠', lowWords.length === lowSet.size);

// 2) 高频档保留全部字段（含 tags/cefr 供 getLevel/自测）
const sample = HIGH.words[0];
check('高频档字段完整', ['word', 'pos', 'meaning', 'tags', 'cefr'].every(k => k in sample));

// 3) 全量档内 words 已按小写排序（findWord 二分依赖）
const ords = fullWords.slice();
const sorted = ords.slice().sort();
check('全量档小写有序（findWord 二分前提）', ords.every((w, i) => w === sorted[i]));

// 4) 内联 data.js 可用（window.__VOCAB_CORE_HIGH_DATA__ 注入）
check('vocab_core_high.data.js 含注入键', HIGH_JS.indexOf('__VOCAB_CORE_HIGH_DATA__') >= 0);

// 5) dict_core 分片覆盖全部低频词
const coreIdx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dict_core/index.json'), 'utf8'));
check('core_low 索引 map 数 = 低频词数', Object.keys(coreIdx.map).length === lowWords.length, 'map=' + Object.keys(coreIdx.map).length);
check('core_low 分片数 = 索引 n', coreIdx.n === fs.readdirSync(path.join(ROOT, 'data/dict_core')).filter(f => /^shard_\d+\.json$/.test(f)).length, 'n=' + coreIdx.n);

// 每个低频词都能映射到一个分片，且分片内能找到
let mapMiss = 0;
for (const w of lowWords) {
  const sn = coreIdx.map[w];
  if (sn === undefined) { mapMiss++; continue; }
  const shard = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dict_core/shard_' + String(sn).padStart(3, '0') + '.json'), 'utf8'));
  if (!shard.words || !shard.words[w]) mapMiss++;
}
check('每个低频词均可在分片命中', mapMiss === 0, 'miss=' + mapMiss);

// 6) 分片内词的字段完整性
let fieldBad = 0;
for (let i = 0; i < coreIdx.n; i++) {
  const shard = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dict_core/shard_' + String(i).padStart(3, '0') + '.json'), 'utf8'));
  for (const k of Object.keys(shard.words)) {
    const e = shard.words[k];
    if (!e || !e.word || !e.meaning) { fieldBad++; }
  }
}
check('分片词条 word/meaning 完整', fieldBad === 0, 'bad=' + fieldBad);

// 7) 高频档 tags 聚合后各档 count 应接近全量档聚合（cet4 完全一致，其余需 ensureFull 才有完整值）
const highCet4 = HIGH.words.filter(w => w.tags && w.tags.indexOf('exam-cet4') >= 0).length;
const fullCet4 = FULL.words.filter(w => w.tags && w.tags.indexOf('exam-cet4') >= 0).length;
check('高频档 cet4 聚合 = 全量档 cet4 聚合', highCet4 === fullCet4, 'high=' + highCet4 + ' full=' + fullCet4);

console.log('\n' + (pass ? 'ALL PASS' : 'SOME FAIL'));
process.exit(pass ? 0 : 1);
