// 回归验证 dict_lookup.js 核心逻辑（Node 环境模拟）
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// 模拟浏览器全局
global.window = global;
global.indexedDB = null; // 走纯内存降级路径

// 模拟 fetch（从本地文件读取，模拟 data/dict/ 分片拉取）
const files = {
  'data/dict/index.json': JSON.parse(fs.readFileSync(path.join(root, 'data/dict/index.json'), 'utf8')),
  'data/dict/shard_000.json': JSON.parse(fs.readFileSync(path.join(root, 'data/dict/shard_000.json'), 'utf8')),
  'data/dict/shard_008.json': JSON.parse(fs.readFileSync(path.join(root, 'data/dict/shard_008.json'), 'utf8')),
  'data/dict_core/index.json': JSON.parse(fs.readFileSync(path.join(root, 'data/dict_core/index.json'), 'utf8')),
  'data/dict_core/shard_000.json': JSON.parse(fs.readFileSync(path.join(root, 'data/dict_core/shard_000.json'), 'utf8')),
};
global.fetch = async (url) => {
  const clean = String(url).split('?')[0];
  if (files[clean]) return { ok: true, status: 200, json: async () => files[clean] };
  return { ok: false, status: 404, json: async () => null };
};

// 模拟 VocabLibrary.findWord：从高频常驻档（CET4 4544 词）二分查找，贴合阶段B 真实常驻态
const core = JSON.parse(fs.readFileSync(path.join(root, 'data/vocab_core_high.json'), 'utf8'));
global.VocabLibrary = {
  findWord(word) {
    let lo = 0, hi = core.words.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const wk = core.words[mid].word.toLowerCase();
      if (wk < word) lo = mid + 1;
      else if (wk > word) hi = mid - 1;
      else return core.words[mid];
    }
    return null;
  }
};

require(path.join(root, 'core/shared/dict_lookup.js'));

(async () => {
  const DL = global.DictLookup;
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); };

  // 1) 核心词（有例句）
  const coreHit = await DL.lookup('abandon');
  ok(coreHit && coreHit.source === 'core', '核心词命中');
  ok(coreHit && coreHit.phonetic === "ә'bændәn", '核心词音标');
  ok(coreHit && !!coreHit.example, '核心词例句');

  // 2) 核心词（无例句也应返回）
  const coreNoEx = await DL.lookup('apple');
  ok(coreNoEx && coreNoEx.source === 'core' && !!coreNoEx.example, '核心词例句(apple)');

  // 3) 分片词（world 在 shard_000）
  const shardHit = await DL.lookup('world');
  ok(shardHit && shardHit.source === 'shard', '分片词命中 shard');

  // 3.1) 高频功能词静态兜底（the → art；file:// 下无需分片即命中）
  const theHit = await DL.lookup('the');
  ok(theHit && theHit.source === 'static', '静态兜底命中(the)');
  ok(theHit && theHit.pos === 'art', '静态兜底词性(the→art)');
  ok(theHit && !!theHit.meaning, '静态兜底释义(the)');

  // 3.2) 补丁分片（be 变形等高频缺词）——现由静态兜底优先命中
  const isHit = await DL.lookup('is');
  ok(isHit && isHit.source === 'static' && isHit.pos === 'v' && !!isHit.meaning, '静态兜底命中(is)');
  const areHit = await DL.lookup('are');
  ok(areHit && areHit.pos === 'v', '静态兜底命中(are)');

  // 3.3) core_low 低频档懒加载分片（abalone 在 core_low shard_000，不在高频常驻）
  const lowHit = await DL.lookup('abalone');
  ok(lowHit && lowHit.source === 'core_low', 'core_low 分片命中(abalone)');
  ok(lowHit && !!lowHit.meaning, 'core_low 释义(abalone)');

  // 4) 未命中 → null
  const miss = await DL.lookup('zzzqqqzzz');
  ok(miss === null, '未命中返回 null');

  // 5) 热度升温：查询 3 次分片词后进入热缓存
  await DL.lookup('world');
  await DL.lookup('world');
  const after = await DL.lookup('world');
  ok(after && after.source === 'shard', '多次查询仍正常');
  // 内部 _hot 应有 world
  ok(global.DictLookup._hot ? global.DictLookup._hot.has('world') : false, '热度升温进入内存热缓存');

  // 6) 空输入
  ok((await DL.lookup('')) === null, '空输入返回 null');

  console.log(`\n===== 回归验证 =====\n共 ${pass + fail} 项，PASS ${pass}，FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
