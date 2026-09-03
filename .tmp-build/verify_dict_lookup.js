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
};
global.fetch = async (url) => {
  const clean = String(url).split('?')[0];
  if (files[clean]) return { ok: true, status: 200, json: async () => files[clean] };
  return { ok: false, status: 404, json: async () => null };
};

// 模拟 VocabLibrary.findWord：从核心词表二分查找
const core = JSON.parse(fs.readFileSync(path.join(root, 'data/vocab_library.json'), 'utf8'));
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

  // 3.1) 分片词缺失独立 pos 时从释义前缀解析（the → pos=art, meaning 剥离前缀）
  const theHit = await DL.lookup('the');
  ok(theHit && theHit.pos === 'art', '分片词 pos 前缀解析(the)');
  ok(theHit && theHit.meaning === '那', '分片词释义前缀剥离(the)');

  // 3.2) 补丁分片（be 变形等高频缺词）
  const isHit = await DL.lookup('is');
  ok(isHit && isHit.source === 'shard' && isHit.pos === 'v' && !!isHit.meaning, '补丁分片命中(is)');
  const areHit = await DL.lookup('are');
  ok(areHit && areHit.pos === 'v', '补丁分片命中(are)');

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
