/* ============================================================
   views/home.js — 深度解析（首页 / 底部导航 home）
   组件与交互：
   · 顶部栏：Logo + 「历史记录」快捷入口（data-action=go-history）
   · 输入面板：textarea（文章输入）、上传文件、开始解析
   · 快捷操作：示例文章、剪贴板导入
   · 统计条：单词数 / 句子数 / 阅读时间（解析后计算）
   · 逐句解析卡片：序号 + 句子类型 + 英文（单词可点按）+ 中文 + 词性/语法标签
   · 加载示例文章链接
   状态：text（输入内容）、parsing（请求中）
   事件：解析提交、文件读取、示例填充、剪贴板读取、单词点按发音并加入生词本
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

  let state = { text: '', parsing: false, last: null };
  let currentSheet = null;
  // 词性高亮状态
  let hlEnabled = false;
  let hlPos = null; // 命名字典：{'n':true, 'v':true, ...}，null 表示未初始化

  // 词性→颜色映射（对齐桌面端 highlight 设置）
  const POS_COLORS = {
    n: '#8B5A2B', v: '#EF4444', adj: '#F97316', adv: '#EAB308', pron: '#22C55E',
    prep: '#3B82F6', conj: '#6366F1', interj: '#A855F7', art: '#EC4899', num: '#6B7280'
  };
  function normPos(pos) { return (pos || '').replace(/\.$/, '').toLowerCase(); }
  function allPosSet() { const o = {}; Object.keys(POS_COLORS).forEach((k) => { o[k] = true; }); return o; }
  function loadHlState() {
    try { hlEnabled = localStorage.getItem('esc.hlEnabled') === '1'; } catch (e) { hlEnabled = false; }
    try { hlPos = JSON.parse(localStorage.getItem('esc.hlPos')); } catch (e) { hlPos = null; }
    if (!hlPos || typeof hlPos !== 'object') hlPos = allPosSet();
  }
  function saveHlState() {
    try { localStorage.setItem('esc.hlEnabled', hlEnabled ? '1' : '0'); } catch (e) { /* ignore */ }
    try { localStorage.setItem('esc.hlPos', JSON.stringify(hlPos || {})); } catch (e) { /* ignore */ }
  }

  // 懒加载 Tesseract.js (OCR)
  let _Tesseract = null;
  function loadTesseract() {
    if (_Tesseract) return Promise.resolve(_Tesseract);
    return new Promise((resolve, reject) => {
      const src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      if (document.querySelector(`script[src="${src}"]`)) {
        if (window.Tesseract) { _Tesseract = window.Tesseract; return resolve(_Tesseract); }
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { _Tesseract = window.Tesseract; resolve(_Tesseract); };
      s.onerror = () => reject(new Error('OCR 引擎加载失败，请检查网络'));
      document.head.appendChild(s);
    });
  }

  // 照片 / 相册选图后 OCR 识别英文填入输入框
  function runImageOcr(file) {
    const input = document.querySelector('#m-input');
    if (!file) return;
    UI.toast('正在 OCR 识别图片中的英文...');
    loadTesseract().then((Tesseract) => Tesseract.recognize(file, 'eng')
      .then(({ data }) => {
        const text = (data.text || '').trim();
        if (!text) { UI.toast('未识别到文字，请确认图片清晰且含英文'); return; }
        input.value = text; state.text = text;
        UI.toast('拍照识别成功');
      })
      .catch((e) => { console.error('OCR 失败:', e); UI.toast('OCR 识别失败'); })
    ).catch((e) => UI.toast(e.message || 'OCR 引擎加载失败'));
  }

  // 词性高亮：给句子内单词按词性着色
  function applyHighlight(root) {
    root.querySelectorAll('.esc-sw').forEach((sp) => {
      const pos = normPos(sp.getAttribute('data-pos'));
      const color = (hlEnabled && hlPos && hlPos[pos]) ? POS_COLORS[pos] : null;
      if (!color) { sp.style.color = ''; sp.style.borderBottomColor = ''; return; }
      sp.style.color = color; sp.style.borderBottomColor = color;
    });
    const btn = root.querySelector('#m-highlight');
    if (btn) {
      btn.setAttribute('data-hl', hlEnabled ? 'on' : 'off');
      btn.classList.toggle('is-on', hlEnabled);
    }
  }

  // 词性高亮设置弹窗（对齐桌面端右键设置：勾选要高亮的词性）
  // 增强：可一键把当前解析结果中「勾选词性」的单词批量加入指定生词本（对齐桌面端 highlight_settings + add_all_pos）
  function closeHlSheet() {
    if (currentSheet) { currentSheet.remove(); currentSheet = null; }
  }
  function openHlSettings(root) {
    closeHlSheet();
    const backdrop = document.createElement('div');
    backdrop.className = 'esc-bsheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'esc-bsheet esc-hlsheet';
    const items = Object.keys(POS_COLORS).map((k) =>
      `<label class="esc-hl-item">
         <input type="checkbox" data-pos="${k}" ${hlPos && hlPos[k] ? 'checked' : ''} />
         <span class="esc-hl-swatch" style="background:${POS_COLORS[k]}"></span>
         ${posName(k)}
       </label>`).join('');
    const notebooks = Store.getNotebooks();
    const nbOptions = notebooks.map((nb) => `<option value="${esc(nb.id)}">${esc(nb.name)}（${nb.wordCount} 词）</option>`).join('');
    sheet.innerHTML = `
      <div class="esc-bsheet-head">
        <div class="esc-bsheet-title"><div class="esc-bsheet-means">词性高亮设置</div></div>
        <button class="esc-bsheet-close" data-act="close" aria-label="关闭">&times;</button>
      </div>
      <div class="esc-hl-grid">${items}</div>
      <div class="esc-hl-add">
        <div class="esc-hl-add-title">${icon('bookmark')}<span>一键添加所选词性单词</span></div>
        <div class="esc-hl-target">
          <select class="esc-nb-select" data-act="target">
            <option value="">选择目标生词本…</option>
            ${nbOptions}
            <option value="__new">+ 新建生词本…</option>
          </select>
          <div class="esc-nb-form" data-form hidden>
            <input type="text" class="esc-nb-input" placeholder="生词本名称" maxlength="20" />
            <div class="esc-nb-form-actions">
              <button class="esc-btn esc-btn-ghost" data-act="new-cancel">取消</button>
              <button class="esc-btn esc-btn-primary" data-act="new-create">创建</button>
            </div>
            <div class="esc-nb-error" hidden></div>
          </div>
        </div>
        <button class="esc-btn esc-btn-primary esc-hl-apply" data-act="addall">添加到生词本</button>
      </div>
      <button class="esc-btn esc-btn-ghost esc-hl-apply" data-act="apply" style="margin-top:10px">仅应用高亮</button>
    `;
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);
    currentSheet = backdrop;

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeHlSheet(); });
    sheet.querySelector('[data-act="close"]').addEventListener('click', closeHlSheet);

    // 应用高亮（仅保存勾选状态）
    sheet.querySelector('[data-act="apply"]').addEventListener('click', () => {
      const sel = {};
      sheet.querySelectorAll('input[data-pos]').forEach((cb) => { sel[cb.dataset.pos] = cb.checked; });
      hlPos = sel;
      saveHlState();
      applyHighlight(root);
      closeHlSheet();
      UI.toast('高亮设置已应用' + (hlEnabled ? '' : '（请先开启词性高亮）'));
    });

    // 选择「新建生词本」时展开内联表单
    const select = sheet.querySelector('[data-act="target"]');
    const form = sheet.querySelector('[data-form]');
    const input = sheet.querySelector('.esc-nb-input');
    const errDiv = sheet.querySelector('.esc-nb-error');
    select.addEventListener('change', () => {
      if (select.value === '__new') { form.hidden = false; input.focus(); }
      else { form.hidden = true; errDiv.hidden = true; }
    });
    sheet.querySelector('[data-act="new-cancel"]').addEventListener('click', () => {
      form.hidden = true; errDiv.hidden = true; select.value = '';
    });
    sheet.querySelector('[data-act="new-create"]').addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) { errDiv.textContent = '请输入生词本名称'; errDiv.hidden = false; return; }
      const c = Store.createNotebook(name);
      if (!c.success) { errDiv.textContent = c.error; errDiv.hidden = false; return; }
      select.value = c.id;
      form.hidden = true; errDiv.hidden = true;
      UI.toast(`已创建「${name}」`);
    });

    // 一键添加勾选词性单词到目标生词本（复用当前解析结果 state.last.sentences）
    sheet.querySelector('[data-act="addall"]').addEventListener('click', () => {
      const targetId = select.value;
      if (!targetId || targetId === '__new') { UI.toast('请先选择目标生词本'); return; }
      const sel = {};
      sheet.querySelectorAll('input[data-pos]').forEach((cb) => { sel[cb.dataset.pos] = cb.checked; });
      const posKeys = Object.keys(sel).filter((k) => sel[k]);
      if (!posKeys.length) { UI.toast('请先勾选要添加的词性'); return; }
      const res = state.last;
      const seen = {};
      let total = 0, added = 0;
      ((res && res.sentences) || []).forEach((st) => (st.words || []).forEach((w) => {
        if (posKeys.indexOf(normPos(w.pos)) < 0) return;
        const word = (w.word || '').trim();
        if (!word || seen[word.toLowerCase()]) return;
        seen[word.toLowerCase()] = true;
        total++;
        const r = Store.addWordToNotebook(targetId, { word, pos: w.pos, meaning: w.zh || w.meaning, example: st.en });
        if (r.success && r.added) added++;
      }));
      if (!total) { UI.toast('当前解析结果中没有匹配词性的单词'); return; }
      const nb = Store.getNotebooks().find((x) => x.id === targetId);
      UI.toast(`已添加 ${added}/${total} 个单词到「${nb ? nb.name : '生词本'}」`);
      closeHlSheet();
    });
  }
  function posName(code) {
    return { n: '名词', v: '动词', adj: '形容词', adv: '副词', pron: '代词', prep: '介词', conj: '连词', interj: '感叹词', art: '冠词', num: '数词' }[code] || code;
  }

  // 保存当前分析到历史（对齐桌面端 onSaveAnalysis）
  function saveAnalysis(root) {
    const res = state.last;
    if (!res || !res.sentences || !res.sentences.length) { UI.toast('暂无解析结果可保存'); return; }
    const text = state.text;
    const first = res.sentences[0];
    const title = (first.en || '').slice(0, 40);
    const snippet = (first.zh || first.en || '').slice(0, 80);
    const hist = Store.getHistory();
    const dup = hist.find((h) => h.text === text);
    if (dup) Store.removeHistory(dup.id);
    Store.addHistory({ title, text, snippet, words: res.stats ? res.stats.words : 0, sentences: res.sentences.length });
    UI.toast('当前分析已保存到历史');
  }

  function statsHTML(stats) {
    return `
      <div class="esc-grid-3">
        <div class="esc-stat"><div class="esc-num is-foreground">${esc(stats.words)}</div><div class="esc-label">单词数</div></div>
        <div class="esc-stat"><div class="esc-num is-foreground">${esc(stats.sentences)}</div><div class="esc-label">句子数</div></div>
        <div class="esc-stat"><div class="esc-num is-foreground">${esc(stats.minutes)}<span style="font-size:12px"> min</span></div><div class="esc-label">阅读时间</div></div>
      </div>`;
  }

  // 词性面板：word [pos] · meaning（点按单词可发音）
  function posHTML(s) {
    const words = s.words || [];
    if (!words.length) return '<div class="esc-spanel-empty">暂无词性标注</div>';
    return '<div class="esc-pos-list">' + words.map((w) => {
      const meaning = w.zh || w.meaning || '';
      return `<span class="esc-pos-badge" data-word="${esc(w.word)}">${esc(w.word)} <i>${esc(w.pos || '')}</i>${meaning ? '<em>' + esc(meaning) + '</em>' : ''}</span>`;
    }).join('') + '</div>';
  }

  // 语法结构面板：对齐桌面端结构化语法分析（结构/功能/句式 + 综合描述 + 从句 + 成分）
  function syntaxHTML(s) {
    const syn = s.syntax || {};
    const structure = syn.structure || '';
    const fn = syn.function || '';
    const pattern = syn.pattern || '';
    const desc = syn.syntax || '';
    const clauses = Array.isArray(syn.clauses) ? syn.clauses : [];
    const constituents = Array.isArray(syn.constituents) ? syn.constituents : [];
    const badges = [];
    if (structure) badges.push(['结构', structure]);
    if (fn) badges.push(['功能', fn]);
    if (pattern) badges.push(['句式', pattern]);
    let html = '<div class="esc-syntax">';
    if (badges.length) {
      html += '<div class="esc-syntax-badges">' + badges.map((b) => `<span class="esc-syntax-badge"><b>${esc(b[0])}</b>${esc(b[1])}</span>`).join('') + '</div>';
    }
    if (clauses.length) {
      html += '<div class="esc-syntax-sec">从句分析</div>';
      html += clauses.map((c) => `<div class="esc-clause"><span class="esc-clause-cat">${esc(c.category || '从句')}</span>${c.trigger ? `<span class="esc-clause-trig">引导词 ${esc(c.trigger)}</span>` : ''}${c.text ? `<div class="esc-clause-text">${esc(c.text)}</div>` : ''}</div>`).join('');
    }
    if (constituents.length) {
      html += '<div class="esc-syntax-sec">句子成分</div>';
      html += '<div class="esc-constituents">' + constituents.map((c) => `<span class="esc-constituent"><b>${esc(c.name || '')}</b>${c.text ? ' ' + esc(c.text) : ''}</span>`).join('') + '</div>';
    }
    if (desc) html += `<div class="esc-syntax-desc">${esc(desc)}</div>`;
    if (!badges.length && !clauses.length && !constituents.length && !desc) html += '<div class="esc-spanel-empty">暂无语法结构</div>';
    html += '</div>';
    return html;
  }

  // 知识点面板：自由文本，保留换行
  function knowledgeHTML(s) {
    const k = s.knowledge || '';
    if (!k) return '<div class="esc-spanel-empty">暂无知识点</div>';
    return `<div class="esc-knowledge">${esc(k).replace(/\n/g, '<br>')}</div>`;
  }

  // 翻译面板
  function translationHTML(s) {
    const zh = s.zh || '';
    if (!zh) return '<div class="esc-spanel-empty">暂无翻译</div>';
    return `<div class="esc-translation">${esc(zh)}</div>`;
  }

  // 英文句子拆成可点按单词（对齐桌面端「点单词加入生词本」）
  // 仅字母开头的 token 可点按；标点/空格原样保留。pos/meaning 来自解析结果映射。
  function sentenceEnHTML(s) {
    const en = s.en || '';
    const wordMap = {};
    (s.words || []).forEach((w) => {
      wordMap[(w.word || '').toLowerCase()] = { pos: w.pos || '', zh: w.zh || w.meaning || '' };
    });
    const tokens = en.match(/[A-Za-z][A-Za-z'’-]*|[0-9]+|[^A-Za-z0-9\s]+|\s+/g) || [en];
    return tokens.map((t) => {
      if (/^[A-Za-z]/.test(t)) {
        const info = wordMap[t.toLowerCase()] || { pos: '', zh: '' };
        return `<span class="esc-sw" data-word="${esc(t)}" data-pos="${esc(info.pos)}" data-meaning="${esc(info.zh)}">${esc(t)}</span>`;
      }
      return esc(t);
    }).join('');
  }

  // 「加入生词本」底部弹层（移动端等价桌面端单词气泡：选本 / 新建本 / 已在本内打勾）
  function closeWordSheet() {
    if (currentSheet) { currentSheet.remove(); currentSheet = null; }
  }
  function openWordSheet(word, pos, meaning, example) {
    closeWordSheet();
    const word0 = (word || '').trim();
    if (!word0) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'esc-bsheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'esc-bsheet';
    const notebooks = Store.getNotebooks();
    const nbHTML = notebooks.length
      ? notebooks.map((nb) => {
          const inNb = Store.isWordInNotebook(nb.id, word0);
          return `<button class="esc-nb-item${inNb ? ' is-in' : ''}" data-id="${esc(nb.id)}" data-name="${esc(nb.name)}">
            <span class="esc-nb-name">${esc(nb.name)}</span>
            <span class="esc-nb-meta">${inNb ? '✓ 已添加' : '添加 · ' + nb.wordCount + ' 词'}</span>
          </button>`;
        }).join('')
      : '<div class="esc-bsheet-empty">还没有生词本，点击下方新建</div>';

    sheet.innerHTML = `
      <div class="esc-bsheet-head">
        <div class="esc-bsheet-title">
          <div class="esc-bsheet-word">${esc(word0)}${pos ? ` <i>${esc(pos)}</i>` : ''}</div>
          ${meaning ? `<div class="esc-bsheet-mean">${esc(meaning)}</div>` : ''}
        </div>
        <button class="esc-bsheet-close" data-act="close" aria-label="关闭">&times;</button>
      </div>
      <div class="esc-bsheet-sub">加入生词本</div>
      <div class="esc-bsheet-list">${nbHTML}</div>
      <button class="esc-nb-new" data-act="new">+ 新建生词本</button>
      <div class="esc-nb-form" hidden>
        <input type="text" class="esc-nb-input" placeholder="生词本名称" maxlength="20" />
        <div class="esc-nb-form-actions">
          <button class="esc-btn esc-btn-ghost" data-act="new-cancel">取消</button>
          <button class="esc-btn esc-btn-primary" data-act="new-create">创建并添加</button>
        </div>
        <div class="esc-nb-error" hidden></div>
      </div>`;
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);
    currentSheet = backdrop;

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeWordSheet(); });
    sheet.querySelector('[data-act="close"]').addEventListener('click', closeWordSheet);

    sheet.querySelectorAll('.esc-nb-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id, name = btn.dataset.name;
        const r = Store.addWordToNotebook(id, { word: word0, pos: pos, meaning: meaning, example: example, context: example });
        if (r.success) {
          UI.toast(r.added ? `已添加到「${name}」` : `「${name}」中已有该词`);
          setTimeout(closeWordSheet, 600);
        } else UI.toast(r.error || '添加失败');
      });
    });

    const newBtn = sheet.querySelector('[data-act="new"]');
    const form = sheet.querySelector('.esc-nb-form');
    const input = sheet.querySelector('.esc-nb-input');
    const errDiv = sheet.querySelector('.esc-nb-error');
    newBtn.addEventListener('click', () => { form.hidden = false; newBtn.hidden = true; input.focus(); });
    sheet.querySelector('[data-act="new-cancel"]').addEventListener('click', () => { form.hidden = true; newBtn.hidden = false; errDiv.hidden = true; });
    sheet.querySelector('[data-act="new-create"]').addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) { errDiv.textContent = '请输入生词本名称'; errDiv.hidden = false; return; }
      const c = Store.createNotebook(name);
      if (!c.success) { errDiv.textContent = c.error; errDiv.hidden = false; return; }
      const r = Store.addWordToNotebook(c.id, { word: word0, pos: pos, meaning: meaning, example: example, context: example });
      UI.toast(r.success ? `已创建「${name}」并添加` : (r.error || '添加失败'));
      setTimeout(closeWordSheet, 600);
    });
  }

  function sentenceCard(s, i) {
    const en = s.en || '';
    return `
      <div class="esc-sentence" data-example="${esc(en)}">
        <div class="esc-sentence-head">
          <span class="esc-sentence-idx">${i + 1}</span>
          <span class="esc-sentence-type">${esc(s.type || '句子')}</span>
        </div>
        <p class="esc-sentence-en">${sentenceEnHTML(s)}</p>
        <div class="esc-sentence-actions">
          <button class="esc-sact" data-act="pos">词性</button>
          <button class="esc-sact" data-act="syntax">语法结构</button>
          <button class="esc-sact" data-act="knowledge">知识点</button>
          <button class="esc-sact" data-act="translation">翻译</button>
        </div>
        <div class="esc-spanel" data-panel="pos" hidden>${posHTML(s)}</div>
        <div class="esc-spanel" data-panel="syntax" hidden>${syntaxHTML(s)}</div>
        <div class="esc-spanel" data-panel="knowledge" hidden>${knowledgeHTML(s)}</div>
        <div class="esc-spanel" data-panel="translation" hidden>${translationHTML(s)}</div>
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
            <button id="m-upload" class="esc-btn esc-btn-ghost esc-icobtn" title="上传文件">${icon('upload')}</button>
            <button id="m-camera" class="esc-btn esc-btn-ghost esc-icobtn" title="拍照识别">${icon('camera')}</button>
            <button id="m-parse" class="esc-btn esc-btn-primary">${icon('sparkles')}<span>开始解析</span></button>
          </div>
          <input type="file" id="m-file" accept=".txt,.md,text/plain" hidden />
          <input type="file" id="m-camfile" accept="image/*" hidden />
        </div>

        <div class="esc-pill-row">
          <button id="m-sample" class="esc-pill">${icon('bookmark')}<span>示例文章</span></button>
          <button id="m-paste" class="esc-pill">${icon('clipboard-paste')}<span>剪贴板导入</span></button>
          <button id="m-highlight" class="esc-pill" data-hl="off">${icon('highlighter')}<span>词性高亮</span></button>
          <button id="m-save" class="esc-pill">${icon('save')}<span>保存分析</span></button>
        </div>

        <div id="m-stats"></div>

        <div class="esc-section-title" style="margin-top:16px">${icon('align-left')}<span>全文翻译</span></div>
        <div id="m-fulltrans"></div>

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

    // 拍照识别
    const camBtn = $('#m-camera');
    const camInput = $('#m-camfile');
    if (camBtn && camInput) {
      camBtn.addEventListener('click', () => camInput.click());
      camInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        camInput.value = '';
        if (f) runImageOcr(f);
      });
    }

    // 词性高亮开关（单击开关；长按打开设置，对齐桌面端右键设置）
    const hlBtn = $('#m-highlight');
    if (hlBtn) {
      loadHlState();
      const btn = { t: null, cancel: false };
      hlBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.cancel = false;
        btn.t = setTimeout(() => { btn.cancel = true; openHlSettings(root); }, 500);
      }, { passive: false });
      hlBtn.addEventListener('touchend', (e) => {
        clearTimeout(btn.t);
        if (!btn.cancel) toggleHighlight(root);
      });
      hlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.cancel) { btn.cancel = false; return; }
        if (window.matchMedia && window.matchMedia('(hover:none)').matches) return;
        toggleHighlight(root);
      });
      applyHighlight(root);
    }

    // 保存分析
    const saveBtn = $('#m-save');
    if (saveBtn) saveBtn.addEventListener('click', (e) => { e.stopPropagation(); saveAnalysis(root); });
  }

  function toggleHighlight(root) {
    hlEnabled = !hlEnabled;
    applyHighlight(root);
    UI.toast(hlEnabled ? '词性高亮已开启' : '词性高亮已关闭');
  }

  // 点击反馈：给单个元素加短暂高亮提示（is-tapped，配合 CSS esc-pop 动效）
  function pulseEl(node) {
    if (!node) return;
    if ((node.getAttribute('class') || '').indexOf('is-tapped') < 0) node.classList.add('is-tapped');
    setTimeout(() => node.classList.remove('is-tapped'), 260);
  }
  // 卡片内联动：让 data-word 与 word 匹配的所有 selector 元素一起提示
  function pulseLinked(cardEl, word, selector) {
    const lower = (word || '').toLowerCase();
    cardEl.querySelectorAll(selector).forEach((n) => {
      if ((n.getAttribute('data-word') || '').toLowerCase() === lower) pulseEl(n);
    });
  }

  // 绑定单张句子卡片上的交互（单词点按 / 面板展开 / 词性标签发音 / 单词↔词性徽章联动提示）
  function bindCard(el) {
    const example = el.getAttribute('data-example') || '';
    el.querySelectorAll('.esc-sw').forEach((sp) => {
      sp.addEventListener('click', () => {
        const word = sp.getAttribute('data-word');
        pulseEl(sp);
        pulseLinked(el, word, '.esc-pos-badge'); // 联动：对应词性徽章一起提示
        Speech.speak(word);
        openWordSheet(word, sp.getAttribute('data-pos'), sp.getAttribute('data-meaning'), example);
      });
    });
    const actions = el.querySelectorAll('.esc-sact');
    const panels = el.querySelectorAll('.esc-spanel');
    actions.forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const panel = el.querySelector(`.esc-spanel[data-panel="${act}"]`);
        const willOpen = panel.hidden;
        actions.forEach((b) => b.classList.remove('is-active'));
        panels.forEach((p) => { p.hidden = true; });
        if (willOpen) { panel.hidden = false; btn.classList.add('is-active'); }
      });
    });
    el.querySelectorAll('.esc-pos-badge').forEach((b) => {
      b.addEventListener('click', () => {
        const word = b.getAttribute('data-word');
        pulseEl(b);
        pulseLinked(el, word, '.esc-sw'); // 联动：对应句子内单词一起提示
        Speech.speak(word);
      });
    });
  }

  function bindSentenceCards(root) {
    root.querySelectorAll('.esc-sentence').forEach((el) => bindCard(el));
  }

  // 全文翻译卡片：把每句翻译（按 idx 排列，可含空位/null）拼成带序号条目（对齐桌面端 fullTranslationArea）
  // 空位表示该句翻译尚未完成，暂时跳过；data-idx 保证条目序号与分句严格对应，点击可准确跳转
  function fullTranslationHTML(list) {
    list = list || [];
    const items = list.map((st, i) => {
      const zh = (st && (st.zh || st.translation || '')) || '';
      if (!zh) return '';
      return `<button class="esc-ft-item" data-idx="${i}">
        <span class="esc-ft-seq">${i + 1}</span>
        <span class="esc-ft-text">${esc(zh)}</span>
      </button>`;
    }).filter(Boolean);
    if (!items.length) return '';
    return `
      <div class="esc-ft">
        <div class="esc-ft-head">${icon('languages')}<span>全文翻译</span></div>
        <div class="esc-ft-note">点击任一条目跳转到对应句子并展开翻译</div>
        <div class="esc-ft-list">${items.join('')}</div>
      </div>`;
  }

  // 渲染全文翻译区（传入按 idx 排列的句子数组；逐句解析过程中实时调用，随每句完成累计填入）
  function renderFullTranslationFromArr(root, arr) {
    const el = root.querySelector('#m-fulltrans');
    if (!el) return;
    const html = fullTranslationHTML(arr);
    el.innerHTML = html;
    if (html) { bindFullTranslation(root); UI.refreshIcons(el); }
  }
  // 解析完成后基于 state.last 渲染（整篇/一次性路径使用）
  function renderFullTranslation(root) {
    renderFullTranslationFromArr(root, state.last ? state.last.sentences : null);
  }

  // 全文翻译条目点击：平滑滚动到对应句子卡片并展开其「翻译」面板（对齐桌面端 jumpToSentence）
  function bindFullTranslation(root) {
    root.querySelectorAll('.esc-ft-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-idx'), 10);
        const cards = root.querySelectorAll('.esc-sentence');
        const card = cards && cards[idx];
        if (!card) return;
        pulseEl(item);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const actions = card.querySelectorAll('.esc-sact');
        const panels = card.querySelectorAll('.esc-spanel');
        const panel = card.querySelector('.esc-spanel[data-panel="translation"]');
        actions.forEach((b) => b.classList.remove('is-active'));
        panels.forEach((p) => { p.hidden = true; });
        if (panel) {
          panel.hidden = false;
          const btn = card.querySelector('.esc-sact[data-act="translation"]');
          if (btn) btn.classList.add('is-active');
          pulseEl(card);
        }
      });
    });
  }

  // 渲染全文翻译区（解析完成后调用；无翻译内容时自动隐藏）
  function renderFullTranslation(root) {
    const el = root.querySelector('#m-fulltrans');
    if (!el) return;
    const html = fullTranslationHTML(state.last);
    el.innerHTML = html;
    if (html) { bindFullTranslation(root); UI.refreshIcons(el); }
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

    const sMode = Store.getSettings();
    const fast = sMode.parseMode === 'fast';
    const usePerSentence = sMode.parseMethod !== 'fullText';
    const noKey = !API.hasKey();

    // 无 Key 或整篇解析：沿用一次性渲染
    if (noKey || !usePerSentence) {
      const res = await API.parse(text);
      state.parsing = false;
      parseBtn.disabled = false;
      state.last = res;
      if (res.error === 'NO_KEY') UI.toast('未配置 API Key，展示示例解析（设置页可填写）');
      else if (res.error && res.error !== 'EMPTY') UI.toast('解析失败，已回退示例数据');
      $('#m-stats').innerHTML = statsHTML(res.stats || API.computeStats(text));
      $('#m-cards').innerHTML = (res.sentences || []).map(sentenceCard).join('') || `<div class="esc-empty"><p class="esc-empty-title">没有可解析的内容</p></div>`;
      bindSentenceCards(root);
      UI.refreshIcons(root);
      applyHighlight(root);
      renderFullTranslation(root);
      return;
    }

    // 逐句模式：先用本地分句渲染骨架（毫秒级），AI 逐句回来再局部补全
    const scaffold = API.scaffold(text);
    if (!scaffold.length) {
      state.parsing = false; parseBtn.disabled = false;
      $('#m-cards').innerHTML = `<div class="esc-empty"><p class="esc-empty-title">没有可解析的内容</p></div>`;
      return;
    }
    const stats = API.computeStats(text);
    $('#m-stats').innerHTML = statsHTML(stats);
    const cardsEl = $('#m-cards');
    cardsEl.innerHTML = scaffold.map(sentenceCard).join('');
    bindSentenceCards(root);

    const fullArr = new Array(scaffold.length).fill(null);
    const count = await API.parseStream(text, fast, (idx, full) => {
      fullArr[idx] = full;
      renderFullTranslationFromArr(root, fullArr); // 每完成一句翻译 → 全文翻译区实时累计
      const els = cardsEl.querySelectorAll('.esc-sentence');
      if (els && els[idx]) {
        const tmp = document.createElement('div');
        tmp.innerHTML = sentenceCard(full, idx);
        const neu = tmp.firstElementChild;
        els[idx].replaceWith(neu);
        bindCard(neu);
      }
    });

    state.parsing = false;
    parseBtn.disabled = false;
    state.last = { sentences: fullArr.filter(Boolean), stats, demo: false, method: 'perSentence' };
    const res = state.last;
    UI.refreshIcons(root);
    applyHighlight(root);
    renderFullTranslation(root);

    // 自动收藏生词
    const s = sMode;
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
  }

  // 共享词性高亮状态（home 与 settings 两个视图复用；状态持久化在 localStorage esc.hlEnabled / esc.hlPos）
  const Highlight = {
    POS_COLORS,
    posName,
    load: loadHlState,
    save: saveHlState,
    isEnabled: () => hlEnabled,
    isPosOn: (code) => !!(hlPos && hlPos[code]),
    setEnabled: (v) => { hlEnabled = !!v; },
    setPos: (code, on) => { if (!hlPos) hlPos = {}; hlPos[code] = !!on; }
  };
  Mobile.Highlight = Highlight;

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.home = { render };
})(window);
