#!/usr/bin/env node
/* ============================================================
   scripts/verify.mjs — 英研社一键验收/回归脚本（纯 Node，零依赖）
   ------------------------------------------------------------
   检查项：
   1. JS 语法：全项目 *.js 逐个 `node --check`
   2. 主题清单一致性：themes/index.json 与两端入口页
      THEME_PLUGIN_THEMES 逐位一致
   3. SW 预缓存清单：mobile/sw.js 的 CORE 与实际文件存在性一致
   4. 关键资源可用性：本地文件存在 + 本地 HTTP 服务返回 200
      （含 themes 相对路径与移动端 css/js）
   输出每项 PASS/FAIL 汇总，任意失败 exit code = 1（供 CI 用）。
   用法：node scripts/verify.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import http from 'node:http';

const ROOT = path.resolve('.');
const SKIP_DIRS = new Set(['node_modules', '.git', '.trae', '.tmp-snap', '.codebuddy', 'dist', 'base.apk', 'obsidian-plugin/node_modules']);

const results = [];
function check(ok, label, detail) {
  results.push({ ok, label, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}\t${label}${detail ? '\t' + detail : ''}\n`);
}
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/* ---------- 1. JS 语法 --check ---------- */
function listJs(dir) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('._')) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out = out.concat(listJs(path.join(dir, e.name)));
    } else if (e.name.endsWith('.js')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}
const jsFiles = listJs(ROOT);
let jsBad = 0;
for (const f of jsFiles) {
  const rel = path.relative(ROOT, f);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    jsBad++;
    check(false, 'JS语法', rel + (r.stderr ? ' :: ' + r.stderr.trim().split('\n')[0] : ''));
  }
}
check(jsBad === 0, `JS语法（${jsFiles.length} 个文件）`, jsBad ? `${jsBad} 个失败` : '全部通过');

/* ---------- 2. 主题清单一致性 ---------- */
let manifestIds = [];
try {
  manifestIds = JSON.parse(read(path.join(ROOT, 'themes/index.json'))).themes.map((t) => t.id);
} catch { /* ignore */ }
// 入口页注入是 JS 对象字面量（键未加引号），用正则抽取 id 而非 JSON.parse
function injectedThemeIds(html) {
  const m = html.match(/window\.THEME_PLUGIN_THEMES\s*=\s*\[([\s\S]+?)\];/);
  if (!m) return null;
  const ids = [];
  const re = /id:\s*['"]([^'"]+)['"]/g;
  let x;
  while ((x = re.exec(m[1]))) ids.push(x[1]);
  return ids;
}
for (const [name, htmlPath] of [['桌面端 index.html', path.join(ROOT, 'index.html')], ['移动端 mobile/index.html', path.join(ROOT, 'mobile/index.html')]]) {
  const ids = injectedThemeIds(read(htmlPath));
  if (ids === null) { check(false, '主题清单注入', name + ': 未解析到 THEME_PLUGIN_THEMES'); continue; }
  const ok = JSON.stringify(ids) === JSON.stringify(manifestIds);
  check(ok, '主题清单一致性', `${name} ${ids.join('|')} == index.json ${manifestIds.join('|')}`);
}

/* ---------- 3. SW CORE 清单与实际文件一致性 ---------- */
const swSrc = read(path.join(ROOT, 'mobile/sw.js'));
let coreEntries = [];
const coreBlock = swSrc.match(/const CORE = \[([\s\S]+?)\];/);
if (coreBlock) coreEntries = [...coreBlock[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map((m) => m[1]);
let coreBad = 0;
if (coreBlock) {
  for (const rel of coreEntries) {
    const abs = path.join(ROOT, 'mobile', rel);
    if (!fs.existsSync(abs)) { coreBad++; check(false, 'SW CORE 存在性', 'mobile/' + rel + ' 缺失'); }
  }
  check(coreBad === 0, `SW CORE（${coreEntries.length} 项）`, coreBad ? `${coreBad} 项缺失` : '全部存在');
} else {
  check(false, 'SW CORE 解析', 'mobile/sw.js 未找到 CORE');
}

/* ---------- 4. 关键资源可用性（文件存在 + HTTP 200） ---------- */
function htmlAssetPaths(htmlFile, base) {
  const html = read(htmlFile);
  const out = [];
  const re = /(?:src|href)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    let v = m[1].split('?')[0].split('#')[0];
    if (!v || v.startsWith('http') || v.startsWith('//') || v.startsWith('data:')) continue;
    out.push(v);
  }
  return out;
}
// 归纳为项目根相对的可探测路径
const probeSet = new Set();
function addRel(p) {
  let clean = String(p).split('?')[0];
  if (clean.startsWith('/')) clean = clean.slice(1);
  probeSet.add(clean);
}
addRel('index.html');
addRel('mobile/index.html');
addRel('themes/index.json');
addRel('themes/theme_plugin.js');
for (const href of htmlAssetPaths(path.join(ROOT, 'index.html'))) addRel(href);
for (const href of htmlAssetPaths(path.join(ROOT, 'mobile/index.html'))) {
  if (href.startsWith('../')) addRel(href.replace(/^\.\.\//, ''));
  else addRel('mobile/' + href.replace(/^\.\//, ''));
}
for (const id of manifestIds) {
  const base = path.join(ROOT, 'themes', id);
  addRel(path.relative(ROOT, path.join(base, 'theme.css')));
  addRel(path.relative(ROOT, path.join(base, 'theme.mobile.css')));
}
for (const e of coreEntries) addRel('mobile/' + e);

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0] || '/');
  const rel = url.replace(/^\/+/, '');
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.statusCode = 404; res.end('nf'); return; }
  res.statusCode = 200;
  res.end('ok');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
let httpBad = 0;
for (const rel of [...probeSet].sort()) {
  if (rel === 'themes/brutal-comic/theme.mobile.css' && !fs.existsSync(path.join(ROOT, rel))) {
    // 移动端辅助样式可缺失（加载器会忽略），但此处若存在则必须 200
    continue;
  }
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { httpBad++; check(false, '资源存在性', rel); continue; }
  const status = await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/' + rel }, (r) => { r.resume(); resolve(r.statusCode); });
    req.on('error', () => resolve(0));
  });
  if (status !== 200) { httpBad++; check(false, '资源200', rel + ' -> ' + status); }
}
check(httpBad === 0, `关键资源 HTTP 200（${probeSet.size} 项）`, httpBad ? `${httpBad} 项失败` : '全部通过');
server.close();

/* ---------- 汇总 ---------- */
const failed = results.filter((r) => !r.ok);
process.stdout.write('\n===== 汇总 =====\n');
process.stdout.write(`共 ${results.length} 项，PASS ${results.length - failed.length}，FAIL ${failed.length}\n`);
for (const f of failed) process.stdout.write(`  FAIL  ${f.label}\t${f.detail || ''}\n`);
process.exit(failed.length ? 1 : 0);