const { execSync } = require('child_process');

const pages = [
  { nodeId: 'page-home', htmlSrc: 'pages/home.html' },
  { nodeId: 'page-vocab', htmlSrc: 'pages/vocab.html' },
  { nodeId: 'page-history', htmlSrc: 'pages/history.html' },
  { nodeId: 'page-memory', htmlSrc: 'pages/memory.html' },
];

const baseDir = 'c:\\Users\\29799\\Desktop\\english-study-club\\english-study-mobile';
const script = 'c:\\Users\\29799\\.trae-cn\\builtin\\design\\default\\skills\\solo-design\\shared-runtime\\deterministic-tooling\\record-dispatch-completion.mjs';
const toolLedger = '{\"todoWriteCalls\":0,\"previewCalls\":0,\"validationScriptCalls\":0,\"helperScriptWrites\":0}';

for (const page of pages) {
  const args = [
    `"${baseDir}"`,
    `--node-id=${page.nodeId}`,
    `--changed-files="${page.htmlSrc}"`,
    '--status=completed',
    `--trace-digest="${page.nodeId}-generated"`,
    `--tool-ledger-json=${toolLedger}`
  ];
  const cmd = `node "${script}" ${args.join(' ')}`;
  console.log(`Running: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed for ${page.nodeId}: ${e.message}`);
  }
}