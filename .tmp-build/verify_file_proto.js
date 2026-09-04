/* file:// 场景模拟：fetch 全失败 → 分片/索引经 <script> 内联 data.js 兜底
   验证 to/spend/too/their 等分片依赖词在本地文件下也能查到释义 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

global.window = global;
global.indexedDB = null; // 纯内存降级

// fetch 全部失败（模拟 file:// CORS 阻止）
global.fetch = async () => { throw new Error('file:// CORS blocked'); };

// document mock：appendChild(script) 时同步执行同目录 .data.js 并触发 onload
global.document = {
  head: {
    appendChild(el) {
      if (!el || el.tagName !== 'SCRIPT') return;
      const rel = String(el.src).split('?')[0].replace(/^(\.\/|\.\.\/)*/, '');
      const p = path.join(root, rel);
      if (!fs.existsSync(p)) { if (el.onerror) el.onerror(new Error('404 ' + p)); return; }
      const code = fs.readFileSync(p, 'utf8');
      (new Function('window', code))(global); // data.js 是 (function(g){ g.KEY = {...}; })(window)
      if (el.onload) el.onload();
    }
  },
  createElement(tag) {
    return { tagName: String(tag).toUpperCase(), set src(v) { this._src = v; }, get src() { return this._src; } };
  }
};

// 高频常驻档 findWord（模拟 load() 只加载 CET4 高频）
const high = JSON.parse(fs.readFileSync(path.join(root, 'data/vocab_core_high.json'), 'utf8')).words;
const highMap = new Map(high.map(w => [w.word.toLowerCase(), w]));
global.VocabLibrary = { findWord(w) { return highMap.get(String(w).toLowerCase()) || null; } };

require(path.join(root, 'core/shared/dict_lookup.js'));

(async () => {
  const DL = global.DictLookup;
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg); };

  const cases = [
    ['to', 'core_low'], ['spend', 'core_low'],
    ['too', 'shard'], ['their', 'shard'],
    ['abandon', 'core'], ['the', 'static'], ['world', 'shard']
  ];
  for (const [w, expect] of cases) {
    const r = await DL.lookup(w);
    ok(r && r.meaning, w + ' 有释义：' + (r && (r.meaning || '').slice(0, 24)));
    ok(r && r.source === expect, w + ' source=' + (r && r.source) + '（期望 ' + expect + '）');
  }
  // 未命中仍返回 null
  ok((await DL.lookup('zzzqqqzzz')) === null, '未命中返回 null');

  console.log(`\n===== file:// 内联兜底验证 =====\n共 ${pass + fail} 项，PASS ${pass}，FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
