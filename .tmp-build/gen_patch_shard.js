/* 高频缺词补丁：be/do/have 变形等因 ECDICT frq=0 被过滤未入库，手动补齐
   输出:
     · data/dict/shard_008.json — 补丁分片 { s, words: { word: entry } }
     · data/dict/index.json     — 补丁词并入索引 map，n 递增
   说明：仅当目标词尚不在索引时写入（幂等）；分片索引号取当前 n。 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const IDX = path.join(root, 'data', 'dict', 'index.json');

const patch = {
  is:     { w: 'is',     pos: 'v', p: 'iz',        m: '是（be 的第三人称单数现在式）' },
  are:    { w: 'are',    pos: 'v', p: 'a:',         m: '是（be 的第二人称/复数现在式）' },
  was:    { w: 'was',    pos: 'v', p: 'wɔz',       m: '是（be 的第一/三人称单数过去式）' },
  were:   { w: 'were',   pos: 'v', p: 'wә:',       m: '是（be 的过去式）' },
  been:   { w: 'been',   pos: 'v', p: 'bi:n',      m: '是（be 的过去分词）' },
  has:    { w: 'has',    pos: 'v', p: 'hæz',       m: '有（have 的第三人称单数现在式）' },
  had:    { w: 'had',    pos: 'v', p: 'hæd',       m: '有（have 的过去式/过去分词）' },
  does:   { w: 'does',   pos: 'v', p: 'dʌz',       m: '做（do 的第三人称单数）；助动词（构成疑问/否定）' },
  did:    { w: 'did',    pos: 'v', p: 'did',       m: '做（do 的过去式）；助动词（构成过去疑问/否定）' },
  got:    { w: 'got',    pos: 'v', p: 'gɔt',       m: '得到（get 的过去式/过去分词）' },
  became: { w: 'became', pos: 'v', p: "bi'keim",   m: '成为（become 的过去式）' },
};

const idx = JSON.parse(fs.readFileSync(IDX, 'utf8'));
const sn = idx.n;
let added = 0;
for (const k of Object.keys(patch)) {
  if (idx.map[k] == null) { idx.map[k] = sn; added++; }
}
idx.n = sn + 1;
fs.writeFileSync(IDX, JSON.stringify(idx), 'utf8');
const shardPath = path.join(root, 'data', 'dict', 'shard_' + String(sn).padStart(3, '0') + '.json');
fs.writeFileSync(shardPath, JSON.stringify({ s: sn, words: patch }), 'utf8');
console.log('补丁词加入索引:', added, '| n=', idx.n, '|', path.basename(shardPath), '已生成');
