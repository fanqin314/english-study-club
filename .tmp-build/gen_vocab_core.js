/* 合并 5 档考试词库 → 单一去重词表 + 多考试标签 + 派生 CEFR（幂等：可重复运行）
   输入: data/vocab_library.json（支持两种结构）
     · 旧 5-level 结构 { version, levels:[{id,words:[{word,pos,meaning}]}] } → 合并去重
     · 新 words 结构  { version, words:[{word,pos,meaning,tags,cefr}] } → 仅重排（大小写不敏感）
   输出: data/vocab_library.json（新 words 结构）+ data/vocab_library.data.js（内联兜底）
   结构: { version, words:[{word,pos,meaning,tags,cefr}] }
   · 去重键：小写 word；重复词仅保留一条，tags 取所有命中档位并集
   · 释义取舍：保留 meaning 最长者（最完整），配套 pos
   · CEFR：由最高档位派生
   · 排序：大小写不敏感，保证加载器可二分查找 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const srcPath = path.join(root, 'data', 'vocab_library.json');

const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

// 档位带序 + CEFR 派生表（band 越大越难）
const BAND = { 'exam-cet4': 1, 'exam-cet6': 2, 'exam-kaoyan': 3, 'exam-toefl': 4, 'exam-sat': 5 };
const CEFR_BY_BAND = { 1: 'B1', 2: 'B2', 3: 'B2', 4: 'C1', 5: 'C2' };

function deriveCefr(tags) {
  let band = 0;
  (tags || []).forEach((t) => { const b = BAND[t] || 0; if (b > band) band = b; });
  return CEFR_BY_BAND[band] || 'B1';
}

// 大小写不敏感排序（先按小写，再按原串稳定）
function sortWords(words) {
  words.sort((a, b) => {
    const ka = a.word.toLowerCase();
    const kb = b.word.toLowerCase();
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
  });
  return words;
}

let words;
if (Array.isArray(src.words)) {
  // 已是合并后的 words 结构：仅重排（幂等）
  words = src.words;
  words.forEach((e) => { if (!e.cefr) e.cefr = deriveCefr(e.tags); });
} else {
  // 旧 5-level 结构：合并去重
  const map = new Map(); // lowercase word -> entry
  (src.levels || []).forEach((lv) => {
    const tag = lv.id;
    (lv.words || []).forEach((w) => {
      const word = w && w.word ? String(w.word).trim() : '';
      if (!word) return;
      const key = word.toLowerCase();
      let e = map.get(key);
      if (!e) {
        e = { word: word, pos: w.pos || '', meaning: (w.meaning || '').trim(), tags: [] };
        map.set(key, e);
      }
      if (e.tags.indexOf(tag) < 0) e.tags.push(tag);
      // 取最完整释义：保留 meaning 最长者（配套 pos）
      const m = (w.meaning || '').trim();
      if (m.length > e.meaning.length) { e.meaning = m; e.pos = w.pos || ''; }
    });
  });
  words = Array.from(map.values()).map((e) => {
    e.cefr = deriveCefr(e.tags);
    return e;
  });
}
sortWords(words);

const data = { version: src.version, words: words };
const jsonStr = JSON.stringify(data);
const jsStr = '/* auto-generated — 勿手改 */\n(function (g) { g.__VOCAB_LIBRARY_DATA__ = ' + jsonStr + '; })(window);\n';

fs.writeFileSync(srcPath, jsonStr, 'utf8');
fs.writeFileSync(path.join(root, 'data', 'vocab_library.data.js'), jsStr, 'utf8');

// 统计
const tagCounts = {};
words.forEach((w) => w.tags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
console.log('=== 去重词库统计 ===');
console.log('唯一词数:', words.length);
Object.keys(tagCounts).sort().forEach((t) => console.log(' ', t, tagCounts[t]));
console.log('json:', (jsonStr.length / 1024 / 1024).toFixed(2), 'MB');
console.log('data.js:', (jsStr.length / 1024 / 1024).toFixed(2), 'MB');
