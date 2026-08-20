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
  // 判断是否为 短语 / 固定搭配（phr / idiom / collocation），用于短语专属视觉样式
  function isPhrase(pos) {
    const p = normPos(pos);
    return p === 'phr' || p === 'idiom' || p === 'collocation';
  }
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

  // 通用 CDN 脚本懒加载（带去重与缓存）
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const exist = document.querySelector(`script[src="${src}"]`);
      if (exist && exist.dataset.ready === '1') return resolve();
      if (exist) {
        exist.addEventListener('load', () => resolve());
        exist.addEventListener('error', () => reject(new Error('脚本加载失败')));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.ready = '1'; resolve(); };
      s.onerror = () => reject(new Error('脚本加载失败，请检查网络'));
      document.head.appendChild(s);
    });
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

  // PDF 解析：懒加载 pdf.js，逐页提取文本
  function loadPdf(file) {
    const input = document.querySelector('#m-input');
    UI.toast('正在解析 PDF（首次加载需联网）...');
    const PDF_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    loadScript(PDF_SRC).then(() => {
      if (!window.pdfjsLib) throw new Error('PDF 引擎未就绪');
      // worker 与核心库同版本，避免 API 不匹配
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const fr = new FileReader();
      fr.onload = () => {
        const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(fr.result) });
        loadingTask.promise.then(async (pdf) => {
          let out = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            out += content.items.map((it) => it.str).join(' ') + '\n\n';
          }
          input.value = out.trim(); state.text = input.value;
          UI.toast('PDF 解析完成');
        }).catch((e) => { console.error(e); UI.toast('PDF 解析失败'); });
      };
      fr.onerror = () => UI.toast('PDF 读取失败');
      fr.readAsArrayBuffer(file);
    }).catch((e) => UI.toast(e.message || 'PDF 解析引擎加载失败'));
  }

  // Word 解析：懒加载 mammoth，提取正文文本
  function loadDoc(file) {
    const input = document.querySelector('#m-input');
    UI.toast('正在解析 Word 文档（首次加载需联网）...');
    loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js').then(() => {
      if (!window.mammoth) throw new Error('Word 解析引擎未就绪');
      const fr = new FileReader();
      fr.onload = () => {
        window.mammoth.extractRawText({ arrayBuffer: fr.result }).then((res) => {
          const text = (res.value || '').trim();
          input.value = text; state.text = text;
          UI.toast(text ? 'Word 解析完成' : '未提取到文本');
        }).catch((e) => { console.error(e); UI.toast('Word 解析失败'); });
      };
      fr.onerror = () => UI.toast('Word 读取失败');
      fr.readAsArrayBuffer(file);
    }).catch((e) => UI.toast(e.message || 'Word 解析引擎加载失败'));
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
        const phrCls = isPhrase(info.pos) ? ' esc-sw--phr' : '';
        return `<span class="esc-sw${phrCls}" data-word="${esc(t)}" data-pos="${esc(info.pos)}" data-meaning="${esc(info.zh)}">${esc(t)}</span>`;
      }
      return esc(t);
    }).join('');
  }

  // 关闭单词气泡（popover）：移除文档/滚动监听后淡出移除
  function closeWordSheet() {
    if (!currentSheet) return;
    const el = currentSheet;
    currentSheet = null;
    if (typeof el._cleanup === 'function') { try { el._cleanup(); } catch (e) {} }
    el.classList.remove('is-show');
    setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
  }
  // 轻点单词：指向单词的气泡（popover）——对齐网页端「点单词弹字典气泡」体验，
  // 不再用底部上滑抽屉；去掉例句（网页版无此展示）。气泡带小三角指向单词，点击空白/滚动关闭。
  function openWordPopover(word, sp, pos, meaning, phon) {
    closeWordSheet();
    const word0 = (word || '').trim();
    if (!word0) return;
    const pop = document.createElement('div');
    pop.className = 'esc-wordpop';
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

    pop.innerHTML = `
      <div class="esc-wordpop-arrow"></div>
      <div class="esc-wordpop-card">
        <div class="esc-word-head">
          <h3 class="esc-word-hw">${esc(word0)}</h3>
          ${phon ? `<span class="esc-word-phon">/${esc(phon)}/</span>` : ''}
          ${pos ? `<span class="esc-word-pos">${esc(pos)}</span>` : ''}
        </div>
        ${meaning ? `<p class="esc-word-gloss">${esc(meaning)}</p>` : ''}
        <div class="esc-word-actions">
          <button class="esc-btn esc-btn-ghost" data-act="speak">${icon('volume-2')}<span>发音</span></button>
          <button class="esc-btn esc-btn-primary" data-act="add">${icon('bookmark-plus')}<span>加入生词本</span></button>
        </div>
        <div class="esc-nb-list" hidden>${nbHTML}</div>
        <button class="esc-nb-new" data-act="new" hidden>+ 新建生词本</button>
        <div class="esc-nb-form" hidden>
          <input type="text" class="esc-nb-input" placeholder="生词本名称" maxlength="20" />
          <div class="esc-nb-form-actions">
            <button class="esc-btn esc-btn-ghost" data-act="new-cancel">取消</button>
            <button class="esc-btn esc-btn-primary" data-act="new-create">创建并添加</button>
          </div>
          <div class="esc-nb-error" hidden></div>
        </div>
      </div>`;
    document.body.appendChild(pop);
    currentSheet = pop;

    // 定位：默认显示在单词上方并水平居中对齐单词中心；空间不足则翻到下方。
    const rect = sp ? sp.getBoundingClientRect() : ({ left: innerWidth / 2, right: innerWidth / 2, top: 80, bottom: 80 });
    const pr = pop.getBoundingClientRect();
    const margin = 8;
    let top = rect.top - pr.height - 10;     // 默认上方
    let placeBelow = false;
    if (top < margin) { top = rect.bottom + 10; placeBelow = true; }
    let centerX = (rect.left + rect.right) / 2;
    let left = centerX - pr.width / 2;
    const minL = margin, maxL = innerWidth - pr.width - margin;
    left = Math.max(minL, Math.min(left, maxL));
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    pop.classList.toggle('is-below', placeBelow);
    // 三角水平位置对齐单词中心（受气泡左右夹紧后做相对偏移）
    const arrow = pop.querySelector('.esc-wordpop-arrow');
    if (arrow) arrow.style.left = (centerX - left) + 'px';

    requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add('is-show')));

    // 点击气泡外部 / 滚动即关闭；点气泡内部不关闭
    const onDocDown = (e) => { if (pop !== e.target && !pop.contains(e.target)) closeWordSheet(); };
    const onScroll = () => closeWordSheet();
    setTimeout(() => {
      document.addEventListener('touchstart', onDocDown, { passive: true });
      document.addEventListener('mousedown', onDocDown);
      const sc = document.querySelector('.esc-main');
      if (sc) sc.addEventListener('scroll', onScroll, { passive: true });
    }, 0);
    pop._cleanup = () => {
      document.removeEventListener('touchstart', onDocDown);
      document.removeEventListener('mousedown', onDocDown);
      const sc = document.querySelector('.esc-main');
      if (sc) sc.removeEventListener('scroll', onScroll);
    };

    const nbList = pop.querySelector('.esc-nb-list');
    const newBtn = pop.querySelector('[data-act="new"]');
    pop.querySelector('[data-act="speak"]').addEventListener('click', (e) => { e.stopPropagation(); Speech.speak(word0); });
    pop.querySelector('[data-act="add"]').addEventListener('click', (e) => {
      e.stopPropagation();
      nbList.hidden = false; newBtn.hidden = false;
      UI.refreshIcons();
    });

    pop.querySelectorAll('.esc-nb-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id, name = btn.dataset.name;
        const r = Store.addWordToNotebook(id, { word: word0, pos: pos, meaning: meaning });
        if (r.success) {
          UI.toast(r.added ? `已添加到「${name}」` : `「${name}」中已有该词`);
          setTimeout(closeWordSheet, 600);
        } else UI.toast(r.error || '添加失败');
      });
    });
    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const form = pop.querySelector('.esc-nb-form');
      form.hidden = false; newBtn.hidden = true; form.querySelector('.esc-nb-input').focus();
    });
    pop.querySelector('[data-act="new-cancel"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const form = pop.querySelector('.esc-nb-form');
      form.hidden = true; newBtn.hidden = false; pop.querySelector('.esc-nb-error').hidden = true;
    });
    pop.querySelector('[data-act="new-create"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const name = pop.querySelector('.esc-nb-input').value.trim();
      const errDiv = pop.querySelector('.esc-nb-error');
      if (!name) { errDiv.textContent = '请输入生词本名称'; errDiv.hidden = false; return; }
      const c = Store.createNotebook(name);
      if (!c.success) { errDiv.textContent = c.error; errDiv.hidden = false; return; }
      const r = Store.addWordToNotebook(c.id, { word: word0, pos: pos, meaning: meaning });
      UI.toast(r.success ? `已创建「${name}」并添加` : (r.error || '添加失败'));
      setTimeout(closeWordSheet, 600);
    });
  }

  // 长按快捷收藏：直接加入当前生词本并提示（区别于轻点查词弹层）
  function quickCollect(word, pos, meaning, example) {
    const word0 = (word || '').trim();
    if (!word0) return;
    const r = Store.addWord({ word: word0, pos, meaning, example, context: example });
    if (r) {
      const existed = Store.getNotebooks().some((nb) => Store.isWordInNotebook(nb.id, word0));
      UI.toast(existed ? '该词已在生词本中' : '已加入生词本');
    }
  }

  function sentenceCard(s, i) {
    const en = s.en || '';
    return `
      <div class="esc-sentence" data-idx="${i}" data-example="${esc(en)}">
        <div class="esc-sentence-head">
          <span class="esc-sentence-idx">${i + 1}</span>
          <span class="esc-sentence-type">${esc(s.type || '句子')}</span>
        </div>
        <p class="esc-sentence-en">${sentenceEnHTML(s)}</p>
        <div class="esc-zh" data-panel="translation">
          <button type="button" class="esc-zh-toggle is-open" aria-expanded="true">
            <span>中文翻译</span>${icon('chevron-down', 'esc-zh-caret')}
          </button>
          <div class="esc-collapse is-collapsed"><div class="esc-collapse-inner"><div class="esc-zh-body">${translationHTML(s)}</div></div></div>
        </div>
        <div class="esc-extra">
          <button type="button" class="esc-extra-trig" data-act="syntax">${icon('git-branch')}<span>语法</span></button>
          <button type="button" class="esc-extra-trig" data-act="knowledge">${icon('lightbulb')}<span>知识点</span></button>
        </div>
        <div class="esc-spanel" data-panel="syntax" hidden>${syntaxHTML(s)}</div>
        <div class="esc-spanel" data-panel="knowledge" hidden>${knowledgeHTML(s)}</div>
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
          <div class="esc-section-title">
            ${icon('file-text')}<span>输入英文文章</span>
            <span style="flex:1"></span>
            <button id="m-upload" class="esc-icon-btn esc-title-icon" title="上传文件">${icon('upload')}</button>
            <button id="m-camera" class="esc-icon-btn esc-title-icon" title="拍照识别">${icon('camera')}</button>
          </div>
          <textarea id="m-input" class="esc-textarea" placeholder="粘贴英文文章，AI 自动解析词性、语法与翻译...">${esc(state.text)}</textarea>
          <div class="esc-btn-row">
            <button id="m-parse" class="esc-btn esc-btn-primary">${icon('sparkles')}<span>开始解析</span></button>
          </div>
          <input type="file" id="m-file" accept=".txt,.md,.pdf,.doc,.docx,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden />
          <input type="file" id="m-camfile" accept="image/*" hidden />
        </div>

        <div class="esc-pill-row">
          <button id="m-sample" class="esc-pill">${icon('bookmark')}<span>示例文章</span></button>
          <button id="m-paste" class="esc-pill">${icon('clipboard-paste')}<span>粘贴导入</span></button>
          <button id="m-highlight" class="esc-pill" data-hl="off">${icon('highlighter')}<span>词性高亮</span></button>
          <button id="m-save" class="esc-pill">${icon('save')}<span>保存分析</span></button>
        </div>

        <div id="m-stats"></div>

        <div class="esc-section-title" id="m-ft-title" style="margin-top:16px" hidden>${icon('align-left')}<span>全文翻译</span></div>
        <div id="m-fulltrans"></div>

        <div class="esc-section-title" id="m-cards-title" style="margin-top:16px" hidden>${icon('align-left')}<span>逐句解析</span></div>
        <div id="m-cards"></div>
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
      const name = (f.name || '').toLowerCase();
      if (name.endsWith('.txt') || name.endsWith('.md') || f.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = () => { input.value = reader.result; state.text = input.value; UI.toast('已导入文件'); };
        reader.onerror = () => UI.toast('文件读取失败');
        reader.readAsText(f);
      } else if (name.endsWith('.pdf')) {
        loadPdf(f);
      } else if (name.endsWith('.doc') || name.endsWith('.docx')) {
        loadDoc(f);
      } else {
        UI.toast('暂不支持该格式，请使用 txt/md/PDF/Word 或图片');
      }
    });

    $('#m-sample').addEventListener('click', () => { input.value = SAMPLE_TEXT; state.text = SAMPLE_TEXT; UI.toast('已填入示例文章'); });

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

    // 选中即翻译：在解析结果区 / 输入框选中文本后显示浮动「翻译」提示，点击调用 AI
    bindSelectionTranslate(root);
  }

  // 选中即翻译：监听选区变化，长文本（>1 个词）弹出浮动提示，点击后查词弹层展示译文
  // 全局只注册一次 selectionchange 监听，避免每次重渲染叠加监听器（泄漏）。
  let _selTip = null;       // 当前激活的浮动提示节点
  let _selClear = null;     // 当前激活的 clearTip
  let _selBound = false;
  function bindSelectionTranslate(root) {
    const tip = document.createElement('div');
    tip.className = 'esc-sel-tip esc-clickable';
    tip.hidden = true;
    tip.textContent = '翻译';
    document.body.appendChild(tip);
    let hideTimer = null;

    function clearTip() { tip.hidden = true; if (tip.parentNode) tip.style.opacity = ''; }
    // 切换文章时清理上一个 tip，防止多个浮动提示残留
    if (_selTip && _selTip.parentNode) _selTip.parentNode.removeChild(_selTip);
    _selTip = tip;
    _selClear = clearTip;

    function showTip(rect, text) {
      tip.hidden = false;
      tip.style.left = (rect.left + rect.width / 2) + 'px';
      tip.style.top = (rect.top - 8) + 'px';
      tip.onclick = () => {
        clearTip();
        translateSelection(text);
      };
    }

    function onSelect() {
      clearTimeout(hideTimer);
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel && (sel.toString() || '').trim();
        if (!text || text.split(/\s+/).length < 2) { clearTip(); return; }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) { clearTip(); return; }
        showTip(rect, text);
      }, 120);
    }

    root.addEventListener('mouseup', onSelect);
    root.addEventListener('touchend', onSelect, { passive: true });
    if (!_selBound) {
      _selBound = true;
      document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (!sel || !sel.toString().trim()) { if (_selClear) _selClear(); }
      });
    }
    tip.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  // 调用 AI 翻译选中文本并以查词弹层展示
  async function translateSelection(text) {
    UI.toast('正在翻译…');
    try {
      const r = await API.refetch(text, 'translation');
      const zh = (r && r.zh) || (r && r.translation) || '';
      openWordPopover(text.length > 24 ? text.slice(0, 24) + '…' : text, null, '', zh || '（未获取到译文）', '');
    } catch (e) {
      UI.toast('翻译失败，请重试');
    }
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

  // 绑定单张句子卡片上的交互（单词点按/长按、中文翻译折叠、语法·知识点惰性展开、词性徽章联动）
  function bindCard(el) {
    const example = el.getAttribute('data-example') || '';
    el.querySelectorAll('.esc-sw').forEach((sp) => {
      const word = sp.getAttribute('data-word');
      const pos = sp.getAttribute('data-pos');
      const meaning = sp.getAttribute('data-meaning');
      // 长按：快捷收藏到生词本（区别于轻点查词弹层）
      const lp = { t: null, fired: false };
      function cancelLp() { if (lp.t) { clearTimeout(lp.t); lp.t = null; } }
      sp.addEventListener('touchstart', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        UI.ripple(sp, ev);
        cancelLp(); lp.fired = false;
        lp.t = setTimeout(() => {
          lp.fired = true; lp.t = null;
          pulseEl(sp);
          pulseLinked(el, word, '.esc-pos-badge'); // 联动：对应词性徽章一起提示
          quickCollect(word, pos, meaning, example);
        }, 500);
      }, { passive: false });
      sp.addEventListener('touchmove', cancelLp);
      sp.addEventListener('touchend', cancelLp);
      sp.addEventListener('touchcancel', cancelLp);
      // 鼠标长按（桌面测试 / 触控板）
      sp.addEventListener('mousedown', (ev) => {
        if (window.matchMedia && window.matchMedia('(hover:none)').matches) return;
        cancelLp(); lp.fired = false;
        lp.t = setTimeout(() => {
          lp.fired = true; lp.t = null;
          pulseEl(sp);
          pulseLinked(el, word, '.esc-pos-badge');
          quickCollect(word, pos, meaning, example);
        }, 500);
      });
      sp.addEventListener('mouseup', cancelLp);
      sp.addEventListener('mouseleave', cancelLp);
      // 轻点：打开查词弹层（含音标/释义/例句/发音/加词）
      sp.addEventListener('click', (ev) => {
        if (lp.fired) { lp.fired = false; ev.stopPropagation(); return; }
        ev.stopPropagation();
        cancelLp();
        pulseEl(sp);
        pulseLinked(el, word, '.esc-pos-badge'); // 联动：对应词性徽章一起提示
        openWordPopover(word, sp, pos, meaning);
      });
    });
    // 中文翻译：点击折叠头展开/收起（grid 行高过渡动效）
    const zhToggle = el.querySelector('.esc-zh-toggle');
    if (zhToggle) {
      const collapse = el.querySelector('.esc-zh .esc-collapse');
      const zhBody = el.querySelector('.esc-zh-body');
      zhToggle.addEventListener('click', () => {
        if (!collapse) return;
        const collapsed = collapse.classList.toggle('is-collapsed');
        zhToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        zhToggle.classList.toggle('is-open', !collapsed);
        el.classList.toggle('is-open', !collapsed);
      });
    }
    // 语法 / 知识点：惰性展开次要区块（同一时刻至多展开一个；为空时触发重拉）
    const extraTrigs = el.querySelectorAll('.esc-extra-trig');
    const panels = el.querySelectorAll('.esc-spanel');
    extraTrigs.forEach((trig) => {
      trig.addEventListener('click', () => {
        const act = trig.getAttribute('data-act');
        const panel = el.querySelector(`.esc-spanel[data-panel="${act}"]`);
        const willOpen = panel && panel.hidden;
        extraTrigs.forEach((b) => b.classList.remove('is-active'));
        panels.forEach((p) => { p.hidden = true; });
        if (willOpen && panel) {
          panel.hidden = false;
          trig.classList.add('is-active');
          // 数据缺失时点击自动重新请求该分析项（防重入：loading 标记）
          if (!trig.dataset.loading && panel.querySelector('.esc-spanel-empty')) {
            lazyFetchAction(el, act, panel, trig);
          }
        }
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

  // 手动补拉某项分析：卡片某项为空时由 bindCard 触发，重新请求成功后只刷新该面板并保持展开
  async function lazyFetchAction(el, act, panel, btn) {
    const idx = parseInt(el.getAttribute('data-idx'), 10);
    const en = el.getAttribute('data-example');
    const arr = state.last && state.last.sentences;
    if (!en || !arr || Number.isNaN(idx) || !arr[idx]) return;
    btn.dataset.loading = '1';
    panel.innerHTML = '<div class="esc-spanel-empty">AI 解析中...</div>';
    try {
      const upd = await API.refetch(en, act);
      const merged = Object.assign({}, arr[idx], upd);
      arr[idx] = merged;
      let html;
      if (act === 'pos') html = posHTML(merged);
      else if (act === 'syntax') html = syntaxHTML(merged);
      else if (act === 'knowledge') html = knowledgeHTML(merged);
      else html = translationHTML(merged);
      panel.innerHTML = html;
      UI.refreshIcons(panel);
      // 翻译补到后，同步刷新全文翻译区
      if (act === 'translation' && merged.zh) {
        const page = el.closest('.esc-page');
        if (page) renderFullTranslationFromArr(page, arr);
      }
      if (panel.querySelector('.esc-spanel-empty')) UI.toast('该句此项暂未获取到，请稍后重试');
    } catch (e) {
      panel.innerHTML = '<div class="esc-spanel-empty">获取失败，请点击重试</div>';
    } finally {
      delete btn.dataset.loading;
    }
  }

  function bindSentenceCards(root) {
    root.querySelectorAll('.esc-sentence').forEach((el) => bindCard(el));
  }

  // 全文翻译区：增量渲染 + 完成进度。
  // 一次性建好容器；新句子完成只追加对应条目，已存在条目不动（避免整块 innerHTML 重绘导致闪烁）。
  const _ftCache = new WeakMap(); // el -> { wrap, listEl, items: Map<idx, btn> }

  function ftProgressHTML(total, done) {
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return `<div class="esc-ft-progress">
      <div class="esc-ft-progress-track"><div class="esc-ft-progress-bar" style="width:${pct}%"></div></div>
      <span class="esc-ft-progress-text">${done}/${total}</span>
    </div>`;
  }

  // 渲染全文翻译区（传入按 idx 排列的句子数组；逐句解析中实时调用，随完成累计追加）
  function renderFullTranslationFromArr(root, arr) {
    const el = root.querySelector('#m-fulltrans');
    if (!el) return;
    const list = arr || [];
    const done = list.reduce((acc, st) => acc + (((st && (st.zh || st.translation || '')) ? 1 : 0)), 0);

    let cache = _ftCache.get(el);
    if (!cache) {
      el.innerHTML =
        `<div class="esc-ft">
          <button type="button" class="esc-ft-head" aria-expanded="false">
            ${icon('languages')}<span>全文翻译</span>${icon('chevron-down', 'esc-ft-caret')}
          </button>
          <div class="esc-ft-body" hidden>
            <div class="esc-ft-note">点击任一条目跳转到对应句子并展开翻译</div>
            <div class="esc-ft-progress-wrap"></div>
            <div class="esc-ft-list"></div>
          </div>
        </div>`;
      cache = {
        wrap: el.querySelector('.esc-ft-progress-wrap'),
        listEl: el.querySelector('.esc-ft-list'),
        items: new Map(),
        ft: el.querySelector('.esc-ft'),
        head: el.querySelector('.esc-ft-head'),
        body: el.querySelector('.esc-ft-body')
      };
      _ftCache.set(el, cache);
      // 折叠头：点击展开/收起（仅绑定一次）
      cache.head.addEventListener('click', () => {
        const open = cache.body.hidden;
        cache.body.hidden = !open;
        cache.head.setAttribute('aria-expanded', open ? 'true' : 'false');
        cache.head.classList.toggle('is-open', !cache.body.hidden);
        cache.ft.classList.toggle('is-open', !cache.body.hidden);
      });
    }

    // 进度条
    cache.wrap.innerHTML = done ? ftProgressHTML(list.length, done) : '';

    // 增量：仅补新出现的条目；已存在条目原位保留，不重绘不闪
    list.forEach((st, idx) => {
      const zh = (st && (st.zh || st.translation || '')) || '';
      if (!zh || cache.items.has(idx)) return;
      const btn = document.createElement('button');
      btn.className = 'esc-ft-item ft-new';
      btn.setAttribute('data-idx', idx);
      btn.innerHTML = `<span class="esc-ft-seq">${idx + 1}</span><span class="esc-ft-text">${esc(zh)}</span>`;
      cache.items.set(idx, btn);
      // 按 idx 顺序插入，保持序号递增
      let next = null;
      for (const child of cache.listEl.childNodes) {
        if (child.nodeType === 1 && parseInt(child.getAttribute('data-idx'), 10) > idx) { next = child; break; }
      }
      cache.listEl.insertBefore(btn, next);
      // 绑定点击（仅新条目一次，避免重复监听）
      btn.addEventListener('click', () => {
        const cards = root.querySelectorAll('.esc-sentence');
        const card = cards && cards[idx];
        if (!card) return;
        pulseEl(btn);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 展开该句中文翻译（若此前被手动收起）
        const zh = card.querySelector('.esc-zh');
        if (zh) {
          const zhBody = zh.querySelector('.esc-zh-body');
          const zhToggle = zh.querySelector('.esc-zh-toggle');
          if (zhBody && zhBody.hidden) {
            zhBody.hidden = false;
            if (zhToggle) {
              zhToggle.setAttribute('aria-expanded', 'true');
              zhToggle.classList.add('is-open');
            }
            card.classList.add('is-open');
          }
        }
        pulseEl(card);
      });
    });

    UI.refreshIcons(el);
  }
  // 解析完成后基于 state.last 渲染（整篇/一次性路径使用）
  function renderFullTranslation(root) {
    renderFullTranslationFromArr(root, state.last ? state.last.sentences : null);
  }

  // 全文翻译条目点击逻辑已内联到 renderFullTranslationFromArr 的新条目上（仅绑定一次）
  // ============================================================
  async function doParse(root) {
    const $ = (id) => root.querySelector(id);
    const input = $('#m-input');
    const text = input.value.trim();
    if (!text) { UI.toast('请先输入或粘贴英文文章'); return; }
    if (state.parsing) return;
    state.parsing = true;
    state.text = text;
    _ftCache.delete(root.querySelector('#m-fulltrans')); // 新一次解析，清空全文翻译增量缓存

    const parseBtn = $('#m-parse');
    parseBtn.disabled = true;
    // 点击解析后才展示结果区标题（全文翻译 / 逐句解析）
    ['#m-ft-title', '#m-cards-title'].forEach((sel) => {
      const t = root.querySelector(sel);
      if (t) t.hidden = false;
    });
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
