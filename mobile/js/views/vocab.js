/* ============================================================
   views/vocab.js — 生词本（底部导航 vocab）
   组件与交互：
   · 顶部栏：标题 + 「共 N 词」徽章
   · 统计卡：今日新增 / 生词总数 / 累计掌握（全局计数器）+ 今日目标进度条
   · 搜索框：按单词实时过滤
   · 筛选标签：全部 / 按字母
   · 单词卡：单词 + 音标 + 释义 + 例句 + 发音 + 添加日期（无「标记掌握」——该概念桌面端无对应，已移除）
   · 空状态：无生词时提示去深度解析
   状态：filter（当前筛选）、search（搜索词）
   事件：搜索输入、筛选切换、发音
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, Speech = Mobile.Speech;
  const esc = UI.esc, icon = UI.icon;

  let state = { filter: 'all', search: '' };
  let rootEl = null;
  let editBubble = null; // 编辑单词气泡（网页版风格）
  let batchMode = false;         // 批量选择模式开关（点顶部垃圾桶进入）
  let batchSelected = new Set(); // 已选单词 id（nbId::word）
  let batchBarEl = null;         // 批量操作底栏

  function isToday(ts) {
    const d = new Date(ts), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  function filtered(list) {
    let arr = list.slice();
    const q = state.search.trim().toLowerCase();
    if (q) arr = arr.filter((w) => (w.word || '').toLowerCase().includes(q));
    if (state.filter === 'alpha') arr = arr.slice().sort((a, b) => (a.word || '').localeCompare(b.word || ''));
    return arr;
  }

  function wordCard(w, nbId) {
    const ex = w.example || w.context;
    const wid = `${nbId || ''}::${(w.word || '').toLowerCase()}`;
    const sel = batchSelected.has(wid) ? ' is-selected' : '';
    return `
      <div class="esc-word${sel}" data-word="${esc(w.word)}" data-id="${esc(wid)}">
        <span class="esc-word-check">${icon('check')}</span>
        <div class="esc-word-inner">
          <div class="esc-word-accent"></div>
          <div class="esc-word-body">
            <div class="esc-word-bwrap">
              <div class="esc-word-top">
                <div style="min-width:0">
                  <h3 class="esc-word-name">${esc(w.word)}</h3>
                  ${w.phonetic ? `<div class="esc-word-phon">/${esc(w.phonetic)}/</div>` : ''}
                  <p class="esc-word-mean">${esc(w.pos ? w.pos + '. ' : '')}${esc(w.meaning || w.zh || '')}</p>
                </div>
                <div class="esc-word-actions">
                  <button class="esc-word-act" data-act="edit" aria-label="编辑">${icon('pencil')}</button>
                  <button class="esc-word-act is-del" data-act="delete" aria-label="删除">${icon('trash-2')}</button>
                </div>
              </div>
              ${ex ? `<div class="esc-word-ex"><p class="esc-word-ex-en">"${esc(ex)}"</p>${w.exampleZh ? `<p class="esc-word-ex-zh">${esc(w.exampleZh)}</p>` : ''}</div>` : ''}
              <div class="esc-word-foot">
                <button class="esc-word-pron" data-act="pron">${icon('volume-2')}<span>发音</span></button>
                <span class="esc-word-date">${esc(relTime(w.createdAt))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // 每两个单词卡一组包一层 .esc-word-row；末尾单张自成一行（.is-alone 占满整行）
  function wordRows(arr, nbId) {
    const rows = [];
    for (let i = 0; i < arr.length; i += 2) {
      const pair = arr.slice(i, i + 2);
      rows.push(`<div class="esc-word-row${pair.length === 1 ? ' is-alone' : ''}">${pair.map((w) => wordCard(w, nbId)).join('')}</div>`);
    }
    return rows.join('');
  }

  function relTime(ts) {
    if (!ts) return '';
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 30) return days + '天前';
    return Math.floor(days / 30) + '月前';
  }

  // 掌握度分级（启发式：按加入时间估算，桌面端无单词掌握状态字段）
  function masterySegments(list) {
    const now = Date.now(), day = 86400000;
    let fresh = 0, learning = 0, mastered = 0;
    list.forEach((w) => {
      const age = (now - (w.createdAt || now)) / day;
      if (age <= 7) fresh++;
      else if (age <= 30) learning++;
      else mastered++;
    });
    return { fresh, learning, mastered, total: list.length };
  }

  // 依据标签色计算可读前景色（深底白字 / 浅底深字）
  function textOn(bg) {
    if (!bg) return '#ffffff';
    const h = bg.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.6 ? '#202020' : '#ffffff';
  }

  function paint() {
    if (!rootEl) return;
    const notebooks = Store.getNotebooks();
    const currentId = Store.getCurrentNotebookId();
    const list = Store.getNotebookWords(currentId) || [];
    const total = list.length;
    const p = Store.getProgress();
    const s = Store.getSettings();
    const today = list.filter((w) => isToday(w.createdAt)).length;
    const mastered = p.masteredCount;        // 全局累计掌握（桌面端 stats_mastered_words）
    const goal = s.dailyGoal || 20;
    const pct = goal ? Math.min(100, Math.round((today / goal) * 100)) : 0;

    // 多生词本切换胶囊（整颗标签使用生词本色，小圆点随之移除）
    const tabsEl = rootEl.querySelector('#m-nb-tabs');
    tabsEl.innerHTML = notebooks.map((n) => {
      const active = n.id === currentId ? ' is-active' : '';
      return `<button class="esc-nb-tab${active}" data-nb="${esc(n.id)}" data-color="${esc(n.color)}" style="--nb:${esc(n.color)};--nb-fg:${textOn(n.color)}"><span class="esc-nb-tab-name">${esc(n.name)}</span><span class="esc-nb-tab-count">${n.wordCount}</span></button>`;
    }).join('') + `<button class="esc-nb-tab esc-add" data-act="new-nb">${icon('plus')}</button>`;

    rootEl.querySelector('#m-vocab-stats').innerHTML = `
      <div class="esc-grid-3" style="grid-template-columns:repeat(3,1fr)">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:22px;font-weight:700;color:var(--study-primary);font-family:var(--study-font-serif)">${today}</span><span style="font-size:12px;color:var(--study-muted-foreground)">今日新增</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;border-left:1px solid var(--study-border);border-right:1px solid var(--study-border)"><span style="font-size:22px;font-weight:700;color:var(--study-warning);font-family:var(--study-font-serif)">${total}</span><span style="font-size:12px;color:var(--study-muted-foreground)">生词总数</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:22px;font-weight:700;color:var(--study-success);font-family:var(--study-font-serif)">${mastered}</span><span style="font-size:12px;color:var(--study-muted-foreground)">累计掌握</span></div>
      </div>
      <div class="esc-progress" style="margin-top:12px"><i style="width:${pct}%"></i></div>
      <p style="font-size:12px;color:var(--study-muted-foreground);text-align:center;margin:8px 0 0">今日目标进度 ${pct}%</p>
      ${masteryHTML(masterySegments(list))}`;

    const arr = filtered(list);
    const wrap = rootEl.querySelector('#m-vocab-list');
    wrap.innerHTML = arr.length
      ? wordRows(arr, currentId)
      : `<div class="esc-empty">${icon('book-open', 'esc-ico')}<p class="esc-empty-title" style="margin-top:16px">还没有生词</p><p class="esc-empty-desc">深度解析单词后，点击收藏即可将单词添加到生词本中</p></div>`;

    UI.refreshIcons(wrap);
    bindCards(wrap);
  }

  // 掌握度分级可视化（新学 / 学习中 / 已掌握）
  function masteryHTML(seg) {
    if (!seg.total) return '';
    const pct = (n) => Math.round((n / seg.total) * 100);
    return `
      <div class="esc-mastery">
        <div class="esc-mastery-bar">
          <div class="esc-mastery-seg esc-m-new" style="width:${pct(seg.fresh)}%"></div>
          <div class="esc-mastery-seg esc-m-learning" style="width:${pct(seg.learning)}%"></div>
          <div class="esc-mastery-seg esc-m-mastered" style="width:${pct(seg.mastered)}%"></div>
        </div>
        <div class="esc-mastery-legend">
          <span><i class="esc-m-new"></i>新学 ${seg.fresh}</span>
          <span><i class="esc-m-learning"></i>学习中 ${seg.learning}</span>
          <span><i class="esc-m-mastered"></i>已掌握 ${seg.mastered}</span>
        </div>
      </div>`;
  }

  function bindCards(wrap) {
    const selecting = batchMode;
    wrap.classList.toggle('is-batch-mode', selecting);
    wrap.querySelectorAll('.esc-word').forEach((el) => {
      const word = el.getAttribute('data-word');
      const id = el.getAttribute('data-id');
      if (selecting) {
        // 批量选择模式：点击卡片切换选中，不再展开 / 编辑 / 删除 / 发音
        el.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect(el, id); });
        return;
      }
      const pron = el.querySelector('[data-act="pron"]');
      if (pron) pron.addEventListener('click', (e) => { e.stopPropagation(); if (word) Speech.speak(word); });
      const edit = el.querySelector('[data-act="edit"]');
      if (edit) edit.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (id) editWordFlow(id, edit); });
      const del = el.querySelector('[data-act="delete"]');
      if (del) del.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (id) deleteWordFlow(id); });
      el.addEventListener('click', () => toggleExpand(el));
    });
    updateBatchBar();
  }

  // 编辑单词：网页版风格的「气泡」表单（词性/释义/例句），锚定在编辑按钮附近
  function editWordFlow(id, anchor) {
    const w = Store.getWord(id);
    if (!w) return;
    closeEditBubble();

    const bubble = document.createElement('div');
    bubble.className = 'esc-wbubble';
    bubble.innerHTML = `
      <div class="bubble-arrow"></div>
      <div class="bubble-inner">
        <div class="bubble-title">编辑单词</div>
        <div class="form-group">
          <label>词性:</label>
          <input type="text" class="pos-input" value="${esc(w.pos || '')}" placeholder="如: n., v., adj.等">
        </div>
        <div class="form-group">
          <label>释义:</label>
          <textarea class="meaning-input" placeholder="请输入中文释义">${esc(w.meaning || '')}</textarea>
        </div>
        <div class="form-group">
          <label>上下文/例句:</label>
          <textarea class="context-input" placeholder="请输入单词的上下文或例句">${esc(w.example || w.context || '')}</textarea>
        </div>
        <div class="esc-nb-error" hidden></div>
        <div class="form-actions">
          <button class="save-btn">保存</button>
          <button class="cancel-btn">取消</button>
        </div>
      </div>`;
    document.body.appendChild(bubble);
    editBubble = bubble;
    positionEditBubble(bubble, anchor);
    bindEditBubbleClose(bubble);

    bubble.querySelector('.cancel-btn').addEventListener('click', (e) => { e.stopPropagation(); closeEditBubble(); });
    bubble.querySelector('.save-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const pos = bubble.querySelector('.pos-input').value.trim();
      const meaning = bubble.querySelector('.meaning-input').value.trim();
      const ctx = bubble.querySelector('.context-input').value.trim();
      const err = bubble.querySelector('.esc-nb-error');
      if (!meaning) { err.textContent = '释义不能为空'; err.hidden = false; return; }
      const r = Store.updateWord(id, { pos, meaning, context: ctx });
      if (!r.success) { err.textContent = r.error; err.hidden = false; return; }
      closeEditBubble();
      UI.toast('单词信息已更新');
    });
  }

  // 关闭编辑气泡（解除全局点击 / Esc 监听）
  function closeEditBubble() {
    if (editBubble) {
      if (editBubble._docHandler) document.removeEventListener('click', editBubble._docHandler);
      if (editBubble._escHandler) document.removeEventListener('keydown', editBubble._escHandler);
      editBubble._docHandler = editBubble._escHandler = null;
      editBubble.remove();
      editBubble = null;
    }
  }

  // 定位气泡：使右上箭头（右缘 24px）正对编辑按钮中心，故气泡整体偏左，超出视口时自动翻转/夹紧
  function positionEditBubble(bubble, anchor) {
    bubble.style.visibility = 'hidden';
    const rect = anchor.getBoundingClientRect();
    const bw = bubble.offsetWidth || 260;
    const bh = bubble.offsetHeight || 320;
    const vw = innerWidth, vh = innerHeight;
    let left = rect.left + rect.width / 2 + 24 - bw; // 箭头对准按钮中心，气泡整体偏左
    let top = rect.bottom + 8;
    let above = false;
    if (left + bw > vw - 8) left = vw - bw - 8;
    if (left < 8) left = 8;
    if (top + bh > vh - 8) { top = rect.top - bh - 8; above = true; }
    bubble.classList.toggle('is-above', above);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.visibility = '';
  }

  // 点击气泡外部 / 按 Esc 关闭（同时记录两个 handler 供关闭时解绑，避免监听泄漏）
  function bindEditBubbleClose(bubble) {
    const handler = (e) => { if (editBubble && !editBubble.contains(e.target)) closeEditBubble(); };
    const escHandler = (e) => { if (e.key === 'Escape') closeEditBubble(); };
    bubble._docHandler = handler;
    bubble._escHandler = escHandler;
    setTimeout(() => {
      if (!editBubble) return; // 气泡已在 10ms 内被关闭：不再绑定，防止泄漏
      document.addEventListener('click', handler);
      document.addEventListener('keydown', escHandler);
    }, 10);
  }

  // 删除单词：居中确认后调用 Store.removeWord
  function deleteWordFlow(id) {
    const w = Store.getWord(id);
    if (!w) return;
    const html = `
      <div class="esc-modal-title">删除单词</div>
      <p class="esc-modal-text">确定删除单词「${esc(w.word)}」吗？删除后不可恢复。</p>
      <div class="esc-modal-actions">
        <button class="esc-btn esc-btn-ghost" data-act="cancel">取消</button>
        <button class="esc-btn esc-btn-danger" data-act="ok">删除</button>
      </div>`;
    UI.modal(html, {
      onOpen: (dlg, close) => {
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        dlg.querySelector('[data-act="ok"]').addEventListener('click', () => { close(); Store.removeWord(id); UI.toast('已删除'); });
      }
    });
  }

  /* ============================================================
     批量选择单词：点顶部垃圾桶进入 → 勾选多词 → 批量删除
     ============================================================ */
  function toggleBatchMode() {
    const nbId = Store.getCurrentNotebookId();
    const list = Store.getNotebookWords(nbId) || [];
    if (!batchMode) {
      if (!list.length) { UI.toast('当前生词本没有单词'); return; }
      closeEditBubble();
      batchMode = true;
      batchSelected.clear();
      paint();
    } else {
      exitBatchMode();
    }
    updateTrashState();
  }

  function exitBatchMode() {
    batchMode = false;
    batchSelected.clear();
    updateTrashState();
    paint();
    updateBatchBar();
  }

  function toggleSelect(el, id) {
    if (!id) return;
    const on = batchSelected.has(id);
    if (on) batchSelected.delete(id); else batchSelected.add(id);
    el.classList.toggle('is-selected', !on);
    updateBatchBar();
  }

  function batchToggleAll() {
    const wrap = rootEl ? rootEl.querySelector('#m-vocab-list') : null;
    const ids = wrap ? [...wrap.querySelectorAll('.esc-word')].map((el) => el.getAttribute('data-id')).filter(Boolean) : [];
    const allOn = ids.length > 0 && ids.every((id) => batchSelected.has(id));
    if (allOn) ids.forEach((id) => batchSelected.delete(id));
    else ids.forEach((id) => batchSelected.add(id));
    paint();
    updateBatchBar();
  }

  function batchDeleteConfirm() {
    const ids = [...batchSelected];
    if (!ids.length) return;
    const html = `
      <div class="esc-modal-title">批量删除</div>
      <p class="esc-modal-text">确定删除选中的 <strong>${ids.length}</strong> 个单词吗？删除后不可恢复。</p>
      <div class="esc-modal-actions">
        <button class="esc-btn esc-btn-ghost" data-act="cancel">取消</button>
        <button class="esc-btn esc-btn-danger" data-act="ok">删除</button>
      </div>`;
    UI.modal(html, {
      onOpen: (dlg, close) => {
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        dlg.querySelector('[data-act="ok"]').addEventListener('click', () => {
          close();
          ids.forEach((id) => Store.removeWord(id));
          UI.toast(`已删除 ${ids.length} 个单词`);
          exitBatchMode();
        });
      }
    });
  }

  function updateTrashState() {
    if (!deleteBtnEl) return;
    deleteBtnEl.classList.toggle('is-on', batchMode);
    deleteBtnEl.setAttribute('aria-pressed', batchMode ? 'true' : 'false');
    deleteBtnEl.title = batchMode ? '取消批量选择' : '批量选择单词';
  }

  function createBatchBar() {
    if (batchBarEl) return;
    const bar = document.createElement('div');
    bar.className = 'esc-batch-bar';
    bar.id = 'm-vocab-batchbar';
    bar.hidden = true;
    bar.innerHTML = `
      <button class="esc-batch-all" data-act="all">全选</button>
      <span class="esc-batch-count">已选 0 项</span>
      <button class="esc-btn esc-btn-danger esc-batch-del" data-act="del">删除</button>
      <button class="esc-btn esc-btn-ghost esc-batch-cancel" data-act="cancel">取消</button>`;
    document.body.appendChild(bar);
    batchBarEl = bar;
    bar.querySelector('[data-act="all"]').addEventListener('click', (e) => { e.stopPropagation(); batchToggleAll(); });
    bar.querySelector('[data-act="del"]').addEventListener('click', (e) => { e.stopPropagation(); batchDeleteConfirm(); });
    bar.querySelector('[data-act="cancel"]').addEventListener('click', (e) => { e.stopPropagation(); exitBatchMode(); });
    updateBatchBar();
  }

  function updateBatchBar() {
    if (!batchBarEl) return;
    batchBarEl.hidden = !batchMode;
    if (!batchMode) return;
    const n = batchSelected.size;
    batchBarEl.querySelector('.esc-batch-count').textContent = `已选 ${n} 项`;
    const delBtn = batchBarEl.querySelector('[data-act="del"]');
    delBtn.textContent = n ? `删除(${n})` : '删除';
    delBtn.disabled = !n;
    const wrap = rootEl ? rootEl.querySelector('#m-vocab-list') : null;
    const ids = wrap ? [...wrap.querySelectorAll('.esc-word')].map((el) => el.getAttribute('data-id')).filter(Boolean) : [];
    const allOn = ids.length > 0 && ids.every((id) => batchSelected.has(id));
    batchBarEl.querySelector('[data-act="all"]').textContent = allOn ? '取消全选' : '全选';
  }

  // 点击单词卡：同时仅允许一卡展开。展开自身并挤压同行相邻卡为细条；
  // 再点已展开的卡则全部恢复均分。所有宽度变化由 CSS 的 flex-basis 过渡驱动，
  // 这里只负责切类名，保证过渡必然被触发（简单、无跨帧状态、无监听残留）。
  function toggleExpand(el) {
    if (!rootEl) return;
    const wasExpanded = el.classList.contains('is-expanded');
    // 先复位全部卡（含其它行），保证任何时刻只有一卡处于展开态
    rootEl.querySelectorAll('#m-vocab-list .esc-word')
      .forEach((c) => c.classList.remove('is-expanded', 'is-collapsed'));
    if (wasExpanded) return;
    el.classList.add('is-expanded');
    const row = el.closest('.esc-word-row');
    if (row) {
      row.querySelectorAll('.esc-word').forEach((c) => {
        if (c !== el) c.classList.add('is-collapsed');
      });
    }
  }

  function render(container) {
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('book-open', 'esc-logo')}<h1>生词本</h1></div>
          <div class="esc-header-actions">
            <button id="m-vocab-manage" class="esc-nb-delete" aria-label="删除生词本（拖动生词本到此处删除）">
              <svg class="esc-nb-del-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
            </button>
          </div>
        </header>

        <div id="m-nb-tabs" class="esc-nb-tabs"></div>

        <div id="m-vocab-stats" class="esc-card" style="margin-bottom:20px"></div>

        <div class="esc-input-wrap" style="margin-bottom:16px">
          ${icon('search', 'esc-ico-search')}
          <input id="m-vocab-search" class="esc-input" type="text" placeholder="搜索单词..." />
        </div>

        <div class="esc-tab-row">
          <button class="esc-tab is-active" data-f="all">全部</button>
          <button class="esc-tab" data-f="alpha">按字母</button>
        </div>

        <div id="m-vocab-list"></div>
      </div>`;

    rootEl = container;

    const search = container.querySelector('#m-vocab-search');
    search.addEventListener('input', () => { state.search = search.value; paint(); });
    container.querySelectorAll('.esc-tab').forEach((t) => {
      t.addEventListener('click', () => {
        container.querySelectorAll('.esc-tab').forEach((x) => x.classList.remove('is-active'));
        t.classList.add('is-active');
        state.filter = t.getAttribute('data-f');
        paint();
      });
    });

    // 生词本标签手势：单击切换 / 双击重命名 / 长按选色 / 长按拖拽合并
    bindTabGestures(container.querySelector('#m-nb-tabs'));

    // 删除按钮：既作为拖拽删除生词本的投放目标，点按则进入「批量选择单词」模式
    deleteBtnEl = container.querySelector('#m-vocab-manage');
    deleteBtnEl.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); toggleBatchMode(); });

    createBatchBar();

    paint();
    UI.refreshIcons(container);
  }

  // 新建生词本流程（居中浮窗表单）
  function createNotebookFlow() {
    const html = `
      <div class="esc-modal-title">新建生词本</div>
      <input type="text" class="esc-nb-input esc-input" placeholder="生词本名称" maxlength="20" style="margin-bottom:14px" />
      <div class="esc-nb-error" hidden style="color:var(--study-error);font-size:12px;margin-bottom:8px"></div>
      <button class="esc-btn esc-btn-primary" data-act="create" style="width:100%;justify-content:center">创建</button>`;
    UI.modal(html, {
      onOpen: (sheet, close) => {
        const input = sheet.querySelector('.esc-nb-input');
        const err = sheet.querySelector('.esc-nb-error');
        input.focus();
        sheet.querySelector('[data-act="create"]').addEventListener('click', () => {
          const name = input.value.trim();
          if (!name) { err.textContent = '请输入生词本名称'; err.hidden = false; return; }
          const c = Store.createNotebook(name);
          if (!c.success) { err.textContent = c.error; err.hidden = false; return; }
          UI.toast(`已创建「${name}」`);
          close();
        });
      }
    });
  }

  function renameFlow(id) {
    const n = Store.getNotebooks().find((x) => x.id === id);
    if (!n) return;
    const html = `
      <div class="esc-bsheet-grip"></div>
      <div class="esc-bsheet-title">重命名生词本</div>
      <input type="text" class="esc-nb-input esc-input" value="${esc(n.name)}" maxlength="20" style="margin-bottom:14px" />
      <div class="esc-nb-error" hidden style="color:var(--study-error);font-size:12px;margin-bottom:8px"></div>
      <button class="esc-btn esc-btn-primary" data-act="ok" style="width:100%;justify-content:center">保存</button>`;
    UI.bottomSheet(html, {
      onOpen: (sheet, close) => {
        const input = sheet.querySelector('.esc-nb-input');
        const err = sheet.querySelector('.esc-nb-error');
        input.focus(); input.select();
        sheet.querySelector('[data-act="ok"]').addEventListener('click', () => {
          const r = Store.renameNotebook(id, input.value.trim());
          if (!r.success) { err.textContent = r.error; err.hidden = false; return; }
          UI.toast('已重命名');
          close();
        });
      }
    });
  }

  // 生词数据变化时自动刷新（由 Store 事件触发）
  Store.on('vocab', () => { if (rootEl && !rootEl.hidden) paint(); });

  /* ============================================================
     生词本标签手势：单击切换 / 双击重命名 / 长按选色 / 长按拖拽合并
     （Pointer Events 统一鼠标与触摸；长按后抑制合成 click 防重入）
     ============================================================ */
  let tabRowEl = null;
  let lpSuppress = false;      // 长按/拖拽后抑制后续合成 click
  let tapInfo = null;          // { id, t } 双击判定
  let press = null;            // 长按/拖拽状态机
  let pressEndAt = 0;          // 长按抬起时间，用于忽略合成点击（400ms 锁定期）
  let colorPickerEl = null;    // 当前颜色选择气泡
  let mergeTargetEl = null;    // 当前悬停的合并目标标签
  let mergeBubbleEl = null;    // 合并气泡（fixed 挂在 body，避免 tabs 横向滚动裁剪）
  let bubbleOver = false;      // 幽灵中心是否落在气泡内（用于进出触感反馈）
  let deleteBtnEl = null;      // 删除按钮（拖拽删除的投放目标）
  let deleteOver = false;      // 幽灵中心是否落在删除按钮上
  let pickerOutsideBound = false; // 外部点击关闭监听是否已绑定
  let pickerOutsideFn = null;  // 外部点击关闭监听引用

  function bindTabGestures(tabsEl) {
    tabRowEl = tabsEl;

    // 单击切换生词本 / 双击重命名
    tabsEl.addEventListener('click', (e) => {
      if (lpSuppress) {
        lpSuppress = false;
        e.stopPropagation(); // 阻止长按抬起后的合成 click 冒泡到 document，避免立刻关闭选色气泡
        return;
      }
      const tab = e.target.closest('[data-nb]');
      if (tab) {
        const id = tab.getAttribute('data-nb');
        const now = Date.now();
        if (tapInfo && tapInfo.id === id && now - tapInfo.t <= 300) {
          tapInfo = null;
          e.preventDefault();
          e.stopPropagation();
          renameFlow(id);
          return;
        }
        tapInfo = { id, t: now };
        setTimeout(() => { if (tapInfo && tapInfo.id === id) tapInfo = null; }, 340);
        Store.setCurrentNotebook(id);
        return;
      }
      const add = e.target.closest('[data-act="new-nb"]');
      if (add) createNotebookFlow();
    });

    // 长按（500ms）弹出颜色气泡；继续移动（>12px）进入拖拽合并
    tabsEl.addEventListener('pointerdown', (e) => {
      const tab = e.target.closest('[data-nb]');
      if (!tab || press) return;
      if (tabsEl.setPointerCapture) { try { tabsEl.setPointerCapture(e.pointerId); } catch (_) {} }
      press = {
        id: tab.getAttribute('data-nb'),
        tab,
        x0: e.clientX, y0: e.clientY,
        fired: false,       // 长按已触发
        dragging: false,    // 已进入拖拽
        ghost: null,
        timer: setTimeout(() => {
          if (!press || press.dragging) return;
          press.fired = true;
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
          tab.classList.add('is-pressed');
          showColorPicker(press.id, tab);
        }, 500)
      };
    });

    tabsEl.addEventListener('pointermove', (e) => {
      if (!press) return;
      const dx = e.clientX - press.x0, dy = e.clientY - press.y0;
      if (!press.fired) {
        // 长按前移动超过阈值视为滑动，取消
        if (Math.hypot(dx, dy) > 10) { clearTimeout(press.timer); press = null; }
        return;
      }
      // 长按已触发：移动超过阈值 → 关闭气泡，拖拽合并
      if (!press.dragging && Math.hypot(dx, dy) > 12) {
        press.dragging = true;
        closeColorPicker();
        press.tab.classList.remove('is-pressed');
        press.tab.classList.add('is-dragging');
        createGhost(press.tab, e.clientX, e.clientY);
      }
      if (press.dragging) {
        if (e.cancelable) e.preventDefault();
        moveGhost(e.clientX, e.clientY);
        updateMergeTarget();
      }
    });

    const end = () => {
      if (!press) return;
      const p = press;
      press = null;
      if (p.fired) {
        pressEndAt = Date.now(); // 记录抬起时间，忽略其后 400ms 内的合成点击
        lpSuppress = true;  // 抑制长按后的合成 click
        setTimeout(() => { lpSuppress = false; }, 400);
        p.tab.classList.remove('is-pressed');
        if (p.dragging) {
          p.tab.classList.remove('is-dragging');
          const ghost = p.ghost;
          const dropId = ghost ? hitMergeBubble(ghost) : null; // 松手点在合并气泡内才合并
          if (dropId) {
            const targetRect = mergeTargetEl ? mergeTargetEl.getBoundingClientRect() : null; // paint 前先取 rect
            const r = doMerge(p.id, dropId);
            if (r && r.success) {
              // 合并成功：幽灵吸入目标标签，气泡与高亮随之消失
              animateGhostOut(ghost, 'absorb', targetRect);
              setTimeout(() => { removeGhost(p); clearMergeTarget(); clearDeleteOver(); }, 280);
            } else {
              animateGhostOut(ghost, 'cancel');
              setTimeout(() => { removeGhost(p); clearMergeTarget(); clearDeleteOver(); }, 200);
            }
          } else if (ghost && hitDeleteBtn(ghost)) {
            // 松手点在删除按钮上：幽灵吸入删除按钮，随后弹出居中确认（可勾选「不再提示」）
            const br = deleteBtnEl ? deleteBtnEl.getBoundingClientRect() : null;
            const id = p.id;
            animateGhostOut(ghost, 'absorb', br);
            setTimeout(() => {
              removeGhost(p);
              clearMergeTarget();
              clearDeleteOver();
              doDeleteFlow(id);
            }, 260);
          } else {
            // 未落在气泡/删除按钮上：幽灵缩小淡出，标签保持原位（取消）
            animateGhostOut(ghost, 'cancel');
            setTimeout(() => { removeGhost(p); clearMergeTarget(); clearDeleteOver(); }, 200);
          }
        }
        // 仅长按未拖动：保留颜色气泡供选色
      } else {
        clearTimeout(p.timer);
      }
    };
    tabsEl.addEventListener('pointerup', end);
    tabsEl.addEventListener('pointercancel', () => {
      if (!press) return;
      clearTimeout(press.timer);
      press.tab.classList.remove('is-pressed', 'is-dragging');
      removeGhost();
      clearMergeTarget();
      clearDeleteOver();
      closeColorPicker();
      press = null;
    });
  }

  // 拖拽幽灵标签：跟随手指
  function createGhost(tab, x, y) {
    removeGhost();
    if (!press) return;
    const name = tab.querySelector('.esc-nb-tab-name');
    const color = tab.getAttribute('data-color') || '#506080';
    const ghost = document.createElement('div');
    ghost.className = 'esc-nb-ghost';
    ghost.innerHTML = `<i class="esc-nb-tab-color" style="background:${esc(color)}"></i><span>${esc(name ? name.textContent : '')}</span>`;
    document.body.appendChild(ghost);
    press.ghost = ghost;
    moveGhost(x, y);
  }
  function moveGhost(x, y) {
    if (press && press.ghost) press.ghost.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
  }
  function removeGhost(p) {
    const src = p || press; // end() 中 press 已置空，需显式传入
    if (src && src.ghost && src.ghost.parentNode) src.ghost.parentNode.removeChild(src.ghost);
    if (src) src.ghost = null;
  }

  // 环形颜色选择气泡（还原网页版交互）
  function showColorPicker(id, tab) {
    closeColorPicker();
    const r = tab.getBoundingClientRect();
    const colors = Store.NOTEBOOK_COLORS || [];
    const cur = tab.getAttribute('data-color') || colors[0];
    const n = colors.length;
    const ringR = 78, center = 118; // 与 .esc-nb-cp-ring (236px) 对应
    const opts = colors.map((c, i) => {
      const ang = (i * (360 / n)) * Math.PI / 180;
      const left = Math.round(Math.cos(ang) * ringR + center);
      const top = Math.round(Math.sin(ang) * ringR + center);
      return `<button class="esc-nb-cp-opt${c === cur ? ' is-sel' : ''}" data-color="${c}" style="left:${left}px;top:${top}px;background:${c};--i:${i}" aria-label="选择标签颜色"></button>`;
    }).join('');
    const wrap = document.createElement('div');
    wrap.className = 'esc-nb-cp';
    // 锚定到标签中心，并夹取在视口内（半环半径 118px）
    wrap.style.left = Math.min(Math.max(r.left + r.width / 2, 122), Math.max(122, window.innerWidth - 122)) + 'px';
    wrap.style.top = Math.min(Math.max(r.top + r.height / 2, 130), Math.max(130, window.innerHeight - 130)) + 'px';
    wrap.innerHTML = `
      <div class="esc-nb-cp-ring">
        <button class="esc-nb-cp-center" data-act="close" aria-label="关闭选色">${icon('x')}</button>
        ${opts}
      </div>`;
    document.body.appendChild(wrap);
    colorPickerEl = wrap;
    wrap.querySelectorAll('.esc-nb-cp-opt').forEach((o) => {
      setTimeout(() => o.classList.add('is-show'), Number(o.style.getPropertyValue('--i')) * 30);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('is-open')));
    UI.refreshIcons(wrap);
    // 选色
    wrap.querySelectorAll('.esc-nb-cp-opt').forEach((o) => {
      o.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = o.getAttribute('data-color');
        const res = Store.updateNotebookColor(id, c);
        if (res.success) UI.toast('已更新标签颜色');
        closeColorPicker();
      });
    });
    // 中心关闭
    wrap.querySelector('[data-act="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (Date.now() - pressEndAt < 400) return; // 忽略长按抬起后的合成点击落在关闭按钮上
      closeColorPicker();
    });
    // 点击其它区域关闭（400ms 锁定期内忽略合成点击，之后才生效）
    armOutsideCloser();
  }

  // 绑定「点击气泡外区域关闭」：长按抬起后浏览器会合成一次 click，落在气泡中心
  // 或冒泡到 document，均需在锁定期内忽略，避免气泡刚弹出就被松开动作关闭。
  function armOutsideCloser() {
    if (pickerOutsideBound) return;
    pickerOutsideBound = true;
    pickerOutsideFn = () => {
      if (Date.now() - pressEndAt < 400) return; // 合成点击：忽略并保留监听
      closeColorPicker();
    };
    document.addEventListener('click', pickerOutsideFn);
  }
  function closeColorPicker() {
    if (pickerOutsideBound && pickerOutsideFn) {
      document.removeEventListener('click', pickerOutsideFn);
      pickerOutsideBound = false;
      pickerOutsideFn = null;
    }
    if (!colorPickerEl) return;
    const el = colorPickerEl;
    colorPickerEl = null;
    el.classList.remove('is-open');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }

  // 拖拽悬停检测：与目标标签重叠面积最大的作为合并目标，并在其上方实时显示合并气泡；
  // 命中删除按钮时高亮按钮并清掉合并目标（二者互斥）
  function updateMergeTarget() {
    if (!press || !press.dragging || !press.ghost) return;
    const g = press.ghost.getBoundingClientRect();
    // 删除按钮命中检测（幽灵中心是否落入按钮内）
    const overDel = hitDeleteBtn(press.ghost);
    if (overDel !== deleteOver) {
      deleteOver = overDel;
      if (deleteBtnEl) deleteBtnEl.classList.toggle('is-delete-over', overDel);
      if (overDel && navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
    }
    if (overDel) { clearMergeTarget(); return; } // 落在删除按钮上：不再检测合并目标
    let target = null, best = 0;
    tabRowEl.querySelectorAll('[data-nb]').forEach((t) => {
      if (t === press.tab) return;
      const r = t.getBoundingClientRect();
      const w = Math.min(g.right, r.right) - Math.max(g.left, r.left);
      const h = Math.min(g.bottom, r.bottom) - Math.max(g.top, r.top);
      const ov = (w > 0 && h > 0) ? w * h : 0;
      if (ov > best) { best = ov; target = t; }
    });
    if (target !== mergeTargetEl) {
      clearMergeTarget();
      if (target) {
        mergeTargetEl = target;
        target.classList.add('is-merge-target');
        showMergeBubble(target);
      }
    }
    updateBubbleOverState();
  }
  // 清空删除按钮高亮
  function clearDeleteOver() {
    if (deleteBtnEl) deleteBtnEl.classList.remove('is-delete-over');
    deleteOver = false;
  }
  // 清空合并目标：移除高亮与气泡
  function clearMergeTarget() {
    if (mergeTargetEl) {
      mergeTargetEl.classList.remove('is-merge-target', 'is-over');
      mergeTargetEl = null;
    }
    if (mergeBubbleEl && mergeBubbleEl.parentNode) mergeBubbleEl.parentNode.removeChild(mergeBubbleEl);
    mergeBubbleEl = null;
    bubbleOver = false;
  }
  // 在目标标签上方添加合并气泡（fixed 挂 body，带指向标签的尾巴与「松手合并」提示）
  function showMergeBubble(targetEl) {
    const r = targetEl.getBoundingClientRect();
    const b = document.createElement('span');
    b.className = 'esc-nb-merge-bubble';
    // 52px 气泡中心位于标签上方 10px，并夹取在视口内避免越界
    const left = Math.max(32, Math.min(window.innerWidth - 32, Math.round(r.left + r.width / 2)));
    const top = Math.max(46, Math.round(r.top - 36));
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.innerHTML = icon('git-merge') + '<span class="esc-nb-merge-hint">松手合并</span>';
    document.body.appendChild(b);
    mergeBubbleEl = b;
    UI.refreshIcons(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('is-open')));
  }
  // 幽灵中心是否落在矩形内
  function pointInRect(ghostRect, r) {
    const cx = (ghostRect.left + ghostRect.right) / 2;
    const cy = (ghostRect.top + ghostRect.bottom) / 2;
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }
  // 实时检测幽灵中心是否进入气泡 → 放大反馈 + 触感 + 幽灵描边提示
  function updateBubbleOverState() {
    const br = mergeBubbleEl ? mergeBubbleEl.getBoundingClientRect() : null;
    const over = !!(br && press && press.ghost && pointInRect(press.ghost.getBoundingClientRect(), br));
    if (over !== bubbleOver) {
      bubbleOver = over;
      if (navigator.vibrate) { try { navigator.vibrate(over ? 10 : 5); } catch (_) {} }
    }
    if (mergeBubbleEl) mergeBubbleEl.classList.toggle('is-over', over);
    if (press && press.ghost) press.ghost.classList.toggle('is-drop', over);
  }
  // 松手时判定：幽灵中心在气泡内则返回目标 id，否则 null（取消合并）
  function hitMergeBubble(ghost) {
    if (!mergeTargetEl || !mergeBubbleEl) return null;
    const br = mergeBubbleEl.getBoundingClientRect();
    return pointInRect(ghost.getBoundingClientRect(), br) ? mergeTargetEl.getAttribute('data-nb') : null;
  }
  // 松手/悬停时判定：幽灵中心是否落在删除按钮内（触发删除）
  function hitDeleteBtn(ghost) {
    if (!deleteBtnEl) return false;
    return pointInRect(ghost.getBoundingClientRect(), deleteBtnEl.getBoundingClientRect());
  }
  // 松手动效：absorb=吸入目标标签（合并成功） / cancel=原地缩小淡出（取消）
  function animateGhostOut(ghost, mode, targetRect) {
    if (!ghost) return;
    const g = ghost.getBoundingClientRect();
    const cx = g.left + g.width / 2, cy = g.top + g.height / 2;
    if (mode === 'absorb' && targetRect) {
      ghost.classList.add('is-absorb');
      ghost.style.opacity = '0';
      ghost.style.transform = `translate(${targetRect.left + targetRect.width / 2}px, ${targetRect.top + targetRect.height / 2}px) translate(-50%,-50%) scale(.15)`;
    } else {
      ghost.classList.add('is-cancel');
      ghost.style.opacity = '0';
      ghost.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(.55)`;
    }
  }
  // 执行合并：fromId 并入 toId
  function doMerge(fromId, toId) {
    const names = {};
    Store.getNotebooks().forEach((n) => { names[n.id] = n.name; });
    const r = Store.mergeNotebooks(fromId, toId);
    if (r.success) UI.toast(`已合并「${names[fromId] || ''}」到「${names[toId] || ''}」，目标本共 ${r.count} 词`);
    else UI.toast(r.error);
    return r;
  }

  // 拖拽松手到删除按钮：若已勾选「不再提示」则直接删除，否则弹出居中确认浮窗
  function doDeleteFlow(id) {
    const n = Store.getNotebooks().find((x) => x.id === id);
    if (!n) return;
    if (Store.getNotebooks().length <= 1) { UI.toast('至少保留一个生词本'); return; }
    if (Store.getSkipDeleteConfirm()) { performDelete(id); return; }
    const html = `
      <div class="esc-modal-title">删除生词本</div>
      <p class="esc-modal-text">确定删除「${esc(n.name)}」？本内 ${n.wordCount} 个单词将一并移除（不可恢复）。</p>
      <label class="esc-modal-check"><input type="checkbox" id="m-del-skip" /><span>不再提示，下次直接删除</span></label>
      <div class="esc-modal-actions">
        <button class="esc-btn esc-btn-ghost" data-act="cancel">取消</button>
        <button class="esc-btn esc-btn-danger" data-act="ok">删除</button>
      </div>`;
    UI.modal(html, {
      onOpen: (dlg, close) => {
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        dlg.querySelector('[data-act="ok"]').addEventListener('click', () => {
          if (dlg.querySelector('#m-del-skip').checked) Store.setSkipDeleteConfirm(true);
          close();
          performDelete(id);
        });
      }
    });
  }
  function performDelete(id) {
    const r = Store.deleteNotebook(id);
    if (!r.success) { UI.toast(r.error); return; }
    UI.toast('已删除');
  }

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.vocab = { render };
})(window);
