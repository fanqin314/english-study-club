/* ============================================================
   views/home.js — 深度解析（首页 / 底部导航 home）
   组件与交互：
   · 顶部栏：Logo + 「历史记录」快捷入口（data-action=go-history）
   · 输入面板：textarea（文章输入）、上传文件、开始解析
   · 快捷操作：示例文章、剪贴板导入
   · 统计条：单词数 / 句子数 / 阅读时间（解析后计算）
   · 逐句解析卡片：序号 + 句子类型 + 英文 + 中文 + 词性/语法标签
   · 加载示例文章链接
   状态：text（输入内容）、parsing（请求中）
   事件：解析提交、文件读取、示例填充、剪贴板读取、句子点击发音
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, API = Mobile.API, Store = Mobile.Store, Speech = Mobile.Speech;
  const esc = UI.esc, icon = UI.icon;

  const SAMPLE_TEXT = [
    'The rapid advancement of artificial intelligence has transformed numerous industries, from healthcare to finance.',
    'Despite its obvious benefits, the technology also raises important ethical questions about privacy and autonomy.',
    'Researchers are now focusing on developing more transparent and explainable AI systems.'
  ].join('\n');

  let state = { text: '', parsing: false };

  function statsHTML(stats) {
    return `
      <div class="esc-grid-3">
        <div class="esc-stat"><div class="esc-num is-foreground">${esc(stats.words)}</div><div class="esc-label">单词数</div></div>
        <div class="esc-stat"><div class="esc-num is-foreground">${esc(stats.sentences)}</div><div class="esc-label">句子数</div></div>
        <div class="esc-stat"><div class="esc-num is-foreground">${esc(stats.minutes)}<span style="font-size:12px"> min</span></div><div class="esc-label">阅读时间</div></div>
      </div>`;
  }

  function tagsHTML(s) {
    const tags = [];
    (s.words || []).forEach((w) => {
      const pos = w.pos ? w.pos + '. ' : '';
      tags.push(`<span class="esc-tag">${esc(w.word)} &rarr; ${esc(pos)}${esc(w.zh)}</span>`);
    });
    (s.grammar || []).forEach((g) => tags.push(`<span class="esc-tag">${esc(g)}</span>`));
    return tags.length ? `<div class="esc-tags">${tags.join('')}</div>` : '';
  }

  function sentenceCard(s, i) {
    return `
      <div class="esc-sentence" data-en="${esc(s.en)}">
        <div class="esc-sentence-head">
          <span class="esc-sentence-idx">${i + 1}</span>
          <span class="esc-sentence-type">${esc(s.type || '句子')}</span>
        </div>
        <p class="esc-sentence-en">${esc(s.en)}</p>
        ${s.zh ? `<p class="esc-sentence-zh">${esc(s.zh)}</p>` : ''}
        ${tagsHTML(s)}
      </div>`;
  }

  function render(container, params) {
    if (params && params.text) state.text = params.text;
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">
            ${icon('book-open', 'esc-logo')}
            <h1>英研社</h1>
          </div>
          <button class="esc-icon-btn" data-action="go-history" aria-label="历史记录">${icon('clock')}</button>
        </header>

        <div class="esc-card">
          <div class="esc-section-title">${icon('file-text')}<span>输入英文文章</span></div>
          <textarea id="m-input" class="esc-textarea" placeholder="粘贴英文文章，AI 自动解析词性、语法与翻译...">${esc(state.text)}</textarea>
          <div class="esc-btn-row">
            <button id="m-upload" class="esc-btn esc-btn-ghost">${icon('upload')}<span>上传文件</span></button>
            <button id="m-parse" class="esc-btn esc-btn-primary">${icon('sparkles')}<span>开始解析</span></button>
          </div>
          <input type="file" id="m-file" accept=".txt,.md,text/plain" hidden />
        </div>

        <div class="esc-pill-row">
          <button id="m-sample" class="esc-pill">${icon('bookmark')}<span>示例文章</span></button>
          <button id="m-paste" class="esc-pill">${icon('clipboard-paste')}<span>剪贴板导入</span></button>
        </div>

        <div id="m-stats"></div>

        <div class="esc-section-title" style="margin-top:16px">${icon('align-left')}<span>逐句解析</span></div>
        <div id="m-cards"></div>

        <div style="text-align:center;padding:8px 0 4px">
          <a id="m-load-sample" style="display:inline-flex;align-items:center;gap:6px;color:var(--study-primary);font-size:14px;cursor:pointer">${icon('file-down')}<span>加载示例文章</span></a>
        </div>
      </div>`;

    bind(container);
    UI.refreshIcons(container);
  }

  function bind(root) {
    const $ = (id) => root.querySelector(id);
    const input = $('#m-input');
    const fileInput = $('#m-file');

    input.addEventListener('input', () => { state.text = input.value; });

    // 顶栏「历史记录」入口：按钮由本视图动态渲染，需在此绑定（router 启动时元素尚未存在）
    const histBtn = root.querySelector('[data-action="go-history"]');
    if (histBtn) histBtn.addEventListener('click', () => Mobile.Router.go('history'));

    $('#m-upload').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { input.value = reader.result; state.text = input.value; UI.toast('已导入文件'); };
      reader.readAsText(f);
    });

    $('#m-sample').addEventListener('click', () => { input.value = SAMPLE_TEXT; state.text = SAMPLE_TEXT; UI.toast('已填入示例文章'); });
    $('#m-load-sample').addEventListener('click', () => { input.value = SAMPLE_TEXT; state.text = SAMPLE_TEXT; doParse(root); });

    $('#m-paste').addEventListener('click', async () => {
      try {
        const t = await navigator.clipboard.readText();
        if (t) { input.value = t; state.text = t; UI.toast('已从剪贴板导入'); }
        else UI.toast('剪贴板为空');
      } catch (e) { UI.toast('无法读取剪贴板，请手动粘贴'); }
    });

    $('#m-parse').addEventListener('click', () => doParse(root));
  }

  async function doParse(root) {
    const $ = (id) => root.querySelector(id);
    const input = $('#m-input');
    const text = input.value.trim();
    if (!text) { UI.toast('请先输入或粘贴英文文章'); return; }
    if (state.parsing) return;
    state.parsing = true;
    state.text = text;

    const parseBtn = $('#m-parse');
    parseBtn.disabled = true;
    $('#m-cards').innerHTML = `<div class="esc-loading"><div class="esc-spinner"></div><div>AI 正在解析...</div></div>`;

    const res = await API.parse(text);
    state.parsing = false;
    parseBtn.disabled = false;

    if (res.error === 'NO_KEY') UI.toast('未配置 API Key，展示示例解析（设置页可填写）');
    else if (res.error && res.error !== 'EMPTY') UI.toast('解析失败，已回退示例数据');

    $('#m-stats').innerHTML = statsHTML(res.stats || API.computeStats(text));
    $('#m-cards').innerHTML = (res.sentences || []).map(sentenceCard).join('') || `<div class="esc-empty"><p class="esc-empty-title">没有可解析的内容</p></div>`;

    // 句子点击发音
    root.querySelectorAll('.esc-sentence').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => Speech.speak(el.getAttribute('data-en')));
    });

    // 自动收藏生词
    const s = Store.getSettings();
    if (s.autoCollect && res.sentences) {
      res.sentences.forEach((st) => (st.words || []).forEach((w) =>
        Store.addWord({ word: w.word, pos: w.pos, meaning: w.zh, example: st.en, exampleZh: st.zh })));
    }

    // 写入历史（按文本去重）
    if (res.sentences && res.sentences.length) {
      const first = res.sentences[0];
      const title = (first.en || '').slice(0, 40);
      const snippet = (first.zh || first.en || '').slice(0, 80);
      const hist = Store.getHistory();
      const dup = hist.find((h) => h.text === text);
      if (dup) Store.removeHistory(dup.id);
      Store.addHistory({ title, text, snippet, words: res.stats ? res.stats.words : 0, sentences: res.sentences.length });
    }

    UI.refreshIcons(root);
  }

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.home = { render };
})(window);
