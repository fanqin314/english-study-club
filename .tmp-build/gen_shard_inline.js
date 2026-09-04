/* 分片内联兜底生成：为 data/dict 与 data/dict_core 的每个 json 生成同名 .data.js
   供 file:// 协议下 fetch 受限时，dict_lookup.js 动态注入 <script> 兜底加载。
   命名规则（window 全局键）：
     data/dict/index.json        → index.data.js      → __DICT_INDEX__
     data/dict/shard_000.json    → shard_000.data.js  → __DICT_SHARD_000__
     data/dict_core/index.json   → index.data.js      → __CORE_LOW_INDEX__
     data/dict_core/shard_000.json → shard_000.data.js → __CORE_LOW_SHARD_000__
   用法: node .tmp-build/gen_shard_inline.js
   幂等：仅生成缺失或内容变化的内联文件。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function globalKeyFor(rel) {
  const parts = rel.replace(/\.json$/, '').split('/');
  // parts: ['data','dict'|'dict_core', 'index'|'shard_000']
  const ns = parts[1] === 'dict_core' ? 'CORE_LOW' : 'DICT';
  if (parts[2] === 'index') return '__' + ns + '_INDEX__';
  return '__' + ns + '_SHARD_' + parts[2].replace('shard_', '') + '__';
}

function gen(rel) {
  const src = path.join(root, rel);
  const out = path.join(root, rel.replace(/\.json$/, '.data.js'));
  const json = fs.readFileSync(src, 'utf8');
  const key = globalKeyFor(rel);
  const content = '/* auto-generated — 勿手改 */\n(function (g) { g.' + key + ' = ' + json + '; })(window);\n';
  let changed = true;
  if (fs.existsSync(out)) {
    changed = fs.readFileSync(out, 'utf8') !== content;
  }
  fs.writeFileSync(out, content, 'utf8');
  return { out, key, changed, kb: Math.round(Buffer.byteLength(content) / 1024) };
}

let totalKb = 0, n = 0;
for (const dir of ['dict', 'dict_core']) {
  for (const f of fs.readdirSync(path.join(root, 'data', dir)).filter((x) => x.endsWith('.json')).sort()) {
    const r = gen('data/' + dir + '/' + f);
    totalKb += r.kb; n++;
    console.log((r.changed ? 'GEN ' : 'skip') + '  ' + r.out.replace(root + '/', '') + '  ' + r.kb + 'KB  → ' + r.key);
  }
}
console.log('共 ' + n + ' 个内联文件，合计 ' + Math.round(totalKb / 1024) + 'MB');
