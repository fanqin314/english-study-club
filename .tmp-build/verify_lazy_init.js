/* 验证：DictLookup.lookup 惰性加载核心词表（模拟真实场景：初始 findWord 无效，load() 后生效） */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
global.window = global;
global.indexedDB = null;
const core = JSON.parse(fs.readFileSync(path.join(root, 'data/vocab_library.json'), 'utf8'));
const files = { 'data/dict/index.json': JSON.parse(fs.readFileSync(path.join(root, 'data/dict/index.json'), 'utf8')) };
for (let i = 0; i < files['data/dict/index.json'].n; i++) {
  files['data/dict/shard_' + String(i).padStart(3, '0') + '.json'] =
    JSON.parse(fs.readFileSync(path.join(root, 'data/dict', 'shard_' + String(i).padStart(3, '0') + '.json'), 'utf8'));
}
global.fetch = async (url) => {
  const c = String(url).split('?')[0];
  return files[c] ? { ok: true, status: 200, json: async () => files[c] } : { ok: false, status: 404, json: async () => null };
};
// 模拟真实浏览器：初始 _data 为空，load() 后才可查
let coreLoaded = false;
global.VocabLibrary = {
  async load() { coreLoaded = true; },  // 模拟异步加载核心词表
  findWord(w) {
    if (!coreLoaded) return null;       // 未加载时查不到（真实场景）
    let lo = 0, hi = core.words.length - 1;
    w = String(w).toLowerCase();
    while (lo <= hi) { const m = (lo + hi) >> 1; const wk = core.words[m].word.toLowerCase(); if (wk < w) lo = m + 1; else if (wk > w) hi = m - 1; else return core.words[m]; }
    return null;
  }
};
require(path.join(root, 'core/shared/dict_lookup.js'));
(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS' : 'FAIL') + ' ' + m); };
  // 此时词库未加载：直接 findWord 无效
  ok(global.VocabLibrary.findWord('run') === null, '未加载前 findWord 返回 null（真实场景）');
  const r = await global.DictLookup.lookup('run');       // 触发惰性 init
  ok(r && r.source === 'core' && r.meaning === '跑,运转,经营', 'lookup 惰性加载后核心词 run 命中 ' + JSON.stringify(r && r.meaning));
  const r2 = await global.DictLookup.lookup('you');
  ok(r2 && r2.pos === 'pron', '核心词 you 命中 pos=' + (r2 && r2.pos));
  const r3 = await global.DictLookup.lookup('prove');
  ok(r3 && r3.pos === 'v' && !!r3.meaning, '核心词 prove 命中');
  const r4 = await global.DictLookup.lookup("i'll");
  ok(r4 === null, "缩写 i'll 未命中（预期，走 AI 兜底）");
  // 幂等：再次查询核心词仍命中（不重复加载）
  const r5 = await global.DictLookup.lookup('race');
  ok(r5 && r5.source === 'core', '二次查询不重复初始化，race 仍命中');
  console.log('--- 结果: ' + pass + ' 通过 / ' + fail + ' 失败 ---');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
