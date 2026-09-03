/* 把 KyleBing 五套考试词库转换为项目 vocab_library.json schema
   输入: .tmp-build/kb/{cet4,cet6,kaoyan,toefl,sat}.json
   输出: data/vocab_library.json + data/vocab_library.data.js
   结构: { version, levels:[{id,name,cefr,description,words:[{word,pos,meaning}]}] }
   每个词取首条 translation 作为 pos/meaning。 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const kb = path.join(root, '.tmp-build', 'kb');

const META = [
  { file: 'cet4',   id: 'exam-cet4',   name: '大学英语四级 CET-4', cefr: 'B1-B2', desc: '四六级核心词汇，覆盖大学基础阶段高频词，难度约 B1–B2' },
  { file: 'cet6',   id: 'exam-cet6',   name: '大学英语六级 CET-6', cefr: 'B2-C1', desc: '六级进阶词汇，在四级基础上扩展学术与深度用词，难度约 B2–C1' },
  { file: 'kaoyan', id: 'exam-kaoyan', name: '考研英语',           cefr: 'B2-C1', desc: '考研核心词汇，覆盖阅读/翻译/写作高频学术词，难度约 B2–C1' },
  { file: 'toefl',  id: 'exam-toefl',  name: '托福 TOEFL',         cefr: 'B2-C2', desc: '托福学术词汇，覆盖听力/阅读/写作高频学科词，难度约 B2–C2' },
  { file: 'sat',    id: 'exam-sat',    name: 'SAT',                cefr: 'C1-C2', desc: 'SAT 高阶词汇，覆盖阅读/写作精深词汇，难度约 C1–C2' }
];

const levels = META.map((m) => {
  const raw = JSON.parse(fs.readFileSync(path.join(kb, m.file + '.json'), 'utf8'));
  const seen = new Set();
  const words = [];
  raw.forEach((w) => {
    const word = w && w.word ? String(w.word).trim() : '';
    if (!word || seen.has(word)) return;
    const tr = (w.translations && w.translations[0]) || {};
    const meaning = (tr.translation || '').trim();
    if (!meaning) return;
    seen.add(word);
    words.push({ word: word, pos: (tr.type || '').trim(), meaning: meaning });
  });
  return { id: m.id, name: m.name, cefr: m.cefr, description: m.desc, words: words };
});

const data = { version: 20260903, levels: levels };

// 紧凑输出
const jsonStr = JSON.stringify(data);
const jsStr = '/* auto-generated — 勿手改 */\n(function (g) { g.__VOCAB_LIBRARY_DATA__ = ' + jsonStr + '; })(window);\n';

// 仅统计，先不覆盖正式文件
const tmpJson = path.join(root, '.tmp-build', 'vocab_library.new.json');
const tmpJs = path.join(root, '.tmp-build', 'vocab_library.new.data.js');
fs.writeFileSync(tmpJson, jsonStr, 'utf8');
fs.writeFileSync(tmpJs, jsStr, 'utf8');

let total = 0;
console.log('=== 词库统计 ===');
levels.forEach((lv) => {
  console.log(lv.id, '|', lv.name, '| CEFR', lv.cefr, '|', lv.words.length, '词');
  total += lv.words.length;
});
console.log('--- 合计:', total, '词 ---');
console.log('json:', (jsonStr.length / 1024 / 1024).toFixed(2), 'MB');
console.log('data.js:', (jsStr.length / 1024 / 1024).toFixed(2), 'MB');
