/* 从 Tatoeba 句对为「核心词」抽取英中例句
   输入: .tmp-build/tat_eng.tsv.bz2 / tat_cmn.tsv.bz2 / tat_links.tar.bz2
         data/vocab_library.json（核心词表）
   输出: data/tat_examples.json = { word(lower): { en, cn } }
   策略: 每个词取「含该词整词」的最短例句（3–12 词，≤90 字符），且该句须有中文翻译。
   说明: 只为核心词配例句；分片词不配（保持分片体积小）。
   使用: 需先解压三个文件为 .tmp-build/tat_eng.tsv / tat_cmn.tsv / tat_links.csv */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const root = path.resolve(__dirname, '..');

const ENG = path.join(root, '.tmp-build', 'tat_eng.tsv');
const CMN = path.join(root, '.tmp-build', 'tat_cmn.tsv');
const LINKS = path.join(root, '.tmp-build', 'tat_links.csv');
const OUT = path.join(root, 'data', 'tat_examples.json');

const MAX_LEN = 110;      // 例句最大字符数
const MIN_WORDS = 2;
const MAX_WORDS = 15;

function lines(file) {
  return readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
}

async function main() {
  /* 1) 中文句映射 id -> text */
  console.log('读取中文句…');
  const cmn = new Map();
  for await (const line of lines(CMN)) {
    const t = line.split('\t');
    if (t.length < 3) continue;
    cmn.set(t[0], t[2]);
  }
  console.log('中文句:', cmn.size);

  /* 2) links: 收集「有中文翻译的英文句 id」集合 + 映射 eng->cmnId */
  console.log('读取 links…');
  const engHasCmn = new Set();
  const engCmn = new Map();
  for await (const line of lines(LINKS)) {
    const t = line.split('\t');
    if (t.length < 2) continue;
    const a = t[0], b = t[1].trim();
    // 双向：a-b 任意一端是中文句，则另一端（英文）有中文翻译
    if (cmn.has(a)) { if (!engCmn.has(b)) engCmn.set(b, a); engHasCmn.add(b); }
    if (cmn.has(b)) { if (!engCmn.has(a)) engCmn.set(a, b); engHasCmn.add(a); }
  }
  console.log('有中文翻译的英文句:', engHasCmn.size);

  /* 3) 目标词集（核心词） */
  const core = JSON.parse(fs.readFileSync(path.join(root, 'data', 'vocab_library.json'), 'utf8'));
  const targets = new Set(core.words.map((w) => w.word.toLowerCase()));
  console.log('目标词:', targets.size);

  /* 4) 流式扫英文句，为词挑选最短例句 */
  const result = {};   // word -> {en, cn}
  let scanned = 0, matchedWords = 0;
  const reCache = new Map();
  for await (const line of lines(ENG)) {
    const t = line.split('\t');
    if (t.length < 3) continue;
    const id = t[0];
    if (!engHasCmn.has(id)) continue;
    const text = t[2];
    const words = text.split(/[^A-Za-z']+/).filter(Boolean).map((w) => w.toLowerCase());
    if (words.length < MIN_WORDS || words.length > MAX_WORDS) continue;
    if (text.length > MAX_LEN) continue;
    scanned++;
    const seen = new Set();
    for (const w of words) {
      if (!targets.has(w) || seen.has(w)) continue;
      seen.add(w);
      const cnId = engCmn.get(id);
      const cn = cnId ? cmn.get(cnId) : '';
      if (!cn) continue;
      if (!result[w] || text.length < result[w].en.length) {
        result[w] = { en: text, cn };
        matchedWords++;
      }
    }
    if (scanned % 200000 === 0) console.log('  扫描', scanned, '已配词', Object.keys(result).length);
  }

  console.log('=== Tatoeba 例句统计 ===');
  console.log('扫描英文句:', scanned);
  console.log('配到例句词数:', Object.keys(result).length, '/', targets.size,
    '覆盖率:', (Object.keys(result).length / targets.size * 100).toFixed(1) + '%');
  fs.writeFileSync(OUT, JSON.stringify(result), 'utf8');
  console.log('写出:', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(2), 'MB');
}

main().catch((e) => { console.error(e); process.exit(1); });
