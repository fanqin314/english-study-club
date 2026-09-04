/* 阶段B 冒烟测试：高频常驻 + ensureFull 整载 + DictLookup core_low 懒加载
   用法: node .tmp-build/verify_stageB.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

global.window = global;
global.indexedDB = null; // 纯内存降级

// 从本地文件模拟浏览器 fetch（strip 查询串）
const cache = {};
function loadJson(rel) {
  if (cache[rel]) return cache[rel];
  const p = path.join(root, rel);
  cache[rel] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  return cache[rel];
}
global.fetch = async (url) => {
  const clean = String(url).split('?')[0];
  const data = loadJson(clean);
  if (data != null) {
    const text = JSON.stringify(data);
    return { ok: true, status: 200, text: async () => text, json: async () => data };
  }
  return { ok: false, status: 404, text: async () => '', json: async () => null };
};

// 无 document（file:// 内联回退分支不会触发，因为我们 fetch 成功）
require(path.join(root, 'core/shared/vocab_library.js'));
require(path.join(root, 'core/shared/dict_lookup.js'));

const full = loadJson('data/vocab_library.json');
const fullKeys = new Set(full.words.map(w => String(w.word).toLowerCase()));
const highKeys = new Set(loadJson('data/vocab_core_high.json').words.map(w => String(w.word).toLowerCase()));
const lowKeys = [...fullKeys].filter(k => !highKeys.has(k));

// 挑测试词：一个高频词 + 一个低频词 + 一个仅词典分片词
const highWord = 'abandon';
const lowWord = lowKeys.find(k => /^[a-z]+$/.test(k));
const shardOnlyWord = 'world'; // dict 分片有、core 无的词

(async () => {
  const VL = global.VocabLibrary;
  const DL = global.DictLookup;
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg); };

  // 1) load() 只加载高频档
  const r1 = await VL.load();
  ok(r1.ok, 'load() 成功');
  ok(highKeys.size === 4544, '高频档词数 4544，got ' + highKeys.size);
  ok(!!VL.findWord(highWord), '高频词 findWord 命中：' + highWord);
  ok(!VL.findWord(lowWord), '低频词 findWord 未命中（懒加载）：' + lowWord);
  const levelsHigh = VL.listLevels();
  // load() 仅高频常驻：档位列表可枚举，但非 cet4 档词量不完整（依赖 ensureFull 补齐）
  const toeflPartial = (levelsHigh.find(l => l.id === 'exam-toefl') || {}).count || 0;
  ok(toeflPartial < 10367, 'load() 后 toefl 档词量不完整（' + toeflPartial + '<10367，需 ensureFull）');

  // 2) DictLookup 惰性 init 走 load()，查高频词命中 core
  const highHit = await DL.lookup(highWord);
  ok(highHit && highHit.source === 'core', '高频词查词命中 core：' + (highHit && highHit.word));
  ok(highHit && !!highHit.meaning, '高频词有释义');

  // 3) core_low 懒加载：低频词命中 core_low
  const lowHit = await DL.lookup(lowWord);
  ok(lowHit && lowHit.source === 'core_low', '低频词查词命中 core_low：' + lowWord + ' → ' + (lowHit && lowHit.meaning));
  ok(lowHit && !!lowHit.meaning, '低频词有释义');

  // 4) 词典分片词（不在 core_high/core_low）
  const shardHit = await DL.lookup(shardOnlyWord);
  ok(shardHit && shardHit.source === 'shard', '分片词命中 shard：' + shardOnlyWord);

  // 5) ensureFull() 整载全量
  const r2 = await VL.ensureFull();
  ok(r2.ok, 'ensureFull() 成功');
  const levels = VL.listLevels();
  ok(levels.length === 5, 'ensureFull 后 5 个档位，got ' + levels.length);
  ok(levels.every(l => l.count > 0), '每档 count > 0：' + levels.map(l => l.name + '=' + l.count).join(', '));
  ok(!!VL.findWord(lowWord), 'ensureFull 后低频词 findWord 命中：' + lowWord);
  const cet4 = VL.getLevel('exam-cet4');
  ok(cet4 && cet4.words.length === highKeys.size, 'cet4 档聚合 = 高频词数 ' + highKeys.size + '，got ' + (cet4 && cet4.words.length));

  // 6) ensureFull 幂等
  const r3 = await VL.ensureFull();
  ok(r3.ok && r3.levels.length === 5, 'ensureFull 幂等');

  // 7) 自测：prepareQuiz 依赖全量，能出题
  const quiz = VL.prepareQuiz();
  ok(quiz.length === 5, 'prepareQuiz 5 档，got ' + quiz.length);
  ok(quiz.every(q => q.questions.length > 0), '每档都有题');

  // 8) importToNotebook 内部 ensureFull
  let imported = null;
  const r4 = await VL.importToNotebook('exam-cet4', async (words) => { imported = words.length; return { added: words.length, skipped: 0 }; });
  ok(r4.ok && imported === highKeys.size, 'importToNotebook 导入 ' + imported + ' 词');

  // 9) 未命中返回 null
  ok((await DL.lookup('zzzqqqzzz')) === null, '未命中返回 null');

  console.log(`\n===== 阶段B 冒烟测试 =====\n共 ${pass + fail} 项，PASS ${pass}，FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
