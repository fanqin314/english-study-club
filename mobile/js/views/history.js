/* ============================================================
   views/history.js — 历史记录（底部导航 history）
   组件与交互：
   · 顶部栏：标题 + 筛选按钮（切换 最近/最早 排序）
   · 统计条：共解析 / 本周 / 总词数
   · 历史卡片：标题 + 日期 + 词数 + 句数 + 摘要
   · 空状态：无历史时提示去解析
   状态：order（'recent' | 'oldest'）
   事件：点击卡片进入解析详情页、筛选切换
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, Router = Mobile.Router;
  const esc = UI.esc, icon = UI.icon;

  let state = { order: 'recent', selecting: false, selected: new Set() };
  let rootEl = null;

  function withinWeek(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr); const n = new Date();
    return (n - d) <= 7 * 86400000 && !isNaN(d);
  }

  function historyCard(h) {
    const sel = state.selecting;
    const isOn = state.selected.has(h.id);
    return `
      <div class="esc-history${isOn ? ' is-selected' : ''}" data-id="${esc(h.id)}">
        <div class="esc-history-body">
          <div class="esc-history-top">
            <h3 class="esc-history-title">${esc(h.title || '未命名文章')}</h3>
            ${sel ? `<span class="esc-check${isOn ? ' is-on' : ''}">${icon('check')}</span>` : icon('chevron-right')}
          </div>
          <div class="esc-history-meta">
            <span>${icon('calendar')}${esc(h.date)}</span>
            <span>${icon('file-text')}${esc(h.words || 0)} 词</span>
            <span>${icon('bar-chart-2')}${esc(h.sentences || 0)} 句</span>
          </div>
          ${h.snippet ? `<p class="esc-history-snip">${esc(h.snippet)}</p>` : ''}
        </div>
      </div>`;
  }

  function paint() {
    if (!rootEl) return;
    let list = Store.getHistory().slice();
    if (state.order === 'oldest') list.reverse();

    // 无记录时删除按钮无意义，隐藏
    const delBtn = rootEl.querySelector('#m-hist-del');
    if (delBtn) delBtn.hidden = list.length === 0;

    const totalWords = list.reduce((s, h) => s + (h.words || 0), 0);
    const week = list.filter((h) => withinWeek(h.date)).length;

    rootEl.querySelector('#m-hist-stats').innerHTML = `
      <div class="esc-grid-3">
        <div class="esc-stat"><div class="esc-num">${list.length}</div><div class="esc-label">共解析</div></div>
        <div class="esc-stat"><div class="esc-num">${week}</div><div class="esc-label">本周</div></div>
        <div class="esc-stat"><div class="esc-num">${esc(totalWords)}</div><div class="esc-label">总词数</div></div>
      </div>`;

    const wrap = rootEl.querySelector('#m-hist-list');
    if (!list.length) {
      wrap.innerHTML = `<div class="esc-empty">${icon('file-text', 'esc-ico')}<p class="esc-empty-title" style="margin-top:16px">暂无历史记录</p><p class="esc-empty-desc">快去解析一篇文章吧</p></div>`;
    } else {
      wrap.innerHTML = list.map(historyCard).join('');
    }
    UI.refreshIcons(wrap);
    bindCards(wrap);
    updateSelBar();
  }

  function bindCards(wrap) {
    wrap.querySelectorAll('.esc-history').forEach((el) => {
      const id = el.getAttribute('data-id');
      el.classList.add('esc-tap');
      el.addEventListener('touchstart', (ev) => UI.ripple(el, ev), { passive: true });
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        // 多选模式下点击卡片 = 勾选/取消勾选；普通模式 = 进入解析详情
        if (state.selecting) {
          toggleSelectItem(id, el);
          return;
        }
        const h = Store.getHistoryItem(id);
        if (h) Router.go('detail', { id: h.id });
      });
    });
  }

  // ---- 多选删除 ----
  function setSelecting(on) {
    state.selecting = !!on;
    if (!on) state.selected.clear();
    const filter = rootEl && rootEl.querySelector('#m-hist-filter');
    const del = rootEl && rootEl.querySelector('#m-hist-del');
    if (filter) filter.hidden = !!on;
    if (del) del.classList.toggle('is-on', !!on);
    paint();
  }

  function toggleSelectItem(id, el) {
    const chk = el && el.querySelector('.esc-check');
    if (state.selected.has(id)) {
      state.selected.delete(id);
      if (el) el.classList.remove('is-selected');
      if (chk) chk.classList.remove('is-on');
    } else {
      state.selected.add(id);
      if (el) el.classList.add('is-selected');
      if (chk) chk.classList.add('is-on');
    }
    updateSelBar();
  }

  function selectAll() {
    const list = Store.getHistory();
    const all = list.map((h) => h.id);
    const allSel = all.length > 0 && all.every((id) => state.selected.has(id));
    state.selected.clear();
    if (!allSel) all.forEach((id) => state.selected.add(id));
    paint();
  }

  function confirmDelete() {
    if (!state.selected.size) return;
    const ids = Array.from(state.selected);
    if (!UI.confirmDialog(`确定删除选中的 ${ids.length} 条历史记录吗？`)) return;
    ids.forEach((id) => Store.removeHistory(id));
    state.selected.clear();
    setSelecting(false);
    UI.toast(`已删除 ${ids.length} 条记录`);
  }

  function updateSelBar() {
    if (!rootEl) return;
    const bar = rootEl.querySelector('#m-sel-bar');
    if (!bar) return;
    bar.hidden = !state.selecting;
    if (!state.selecting) return;
    const total = Store.getHistory().length;
    const n = state.selected.size;
    const count = bar.querySelector('#m-sel-count');
    if (count) count.textContent = `已选 ${n} 项`;
    const allBtn = bar.querySelector('[data-act="sel-all"]');
    if (allBtn) {
      const lbl = allBtn.querySelector('span');
      if (lbl) lbl.textContent = n > 0 && n === total ? '取消全选' : '全选';
    }
    const del = bar.querySelector('[data-act="sel-del"]');
    if (del) del.disabled = n === 0;
  }

  function bindSelBar(container) {
    const bar = container.querySelector('#m-sel-bar');
    if (!bar) return;
    bar.innerHTML = `
      <button type="button" class="esc-mini-btn" data-act="sel-all">${icon('list-checks')}<span>全选</span></button>
      <span class="esc-sel-count" id="m-sel-count">已选 0 项</span>
      <button type="button" class="esc-mini-btn esc-danger" data-act="sel-del" disabled>${icon('trash-2')}<span>删除</span></button>
      <button type="button" class="esc-mini-btn esc-muted" data-act="sel-cancel">${icon('x')}<span>取消</span></button>
    `;
    bar.querySelector('[data-act="sel-all"]').addEventListener('click', selectAll);
    bar.querySelector('[data-act="sel-del"]').addEventListener('click', confirmDelete);
    bar.querySelector('[data-act="sel-cancel"]').addEventListener('click', () => setSelecting(false));
  }

  function render(container) {
    // 重新进入页面时重置多选状态
    state.selecting = false;
    state.selected.clear();
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <button class="esc-icon-btn" data-act="back" aria-label="返回" style="margin-right:0">${icon('chevron-left')}</button>
          <div class="esc-title-row">${icon('clock', 'esc-logo')}<h1>历史记录</h1></div>
          <button id="m-hist-filter" class="esc-pill">${icon('sliders-horizontal')}<span>筛选</span></button>
          <button id="m-hist-del" class="esc-pill" title="删除">${icon('trash-2')}<span>删除</span></button>
        </header>

        <section style="margin-top:16px">
          <div id="m-hist-stats"></div>
        </section>

        <div style="margin:16px 4px 8px"><h2 style="font-size:12px;font-weight:600;color:var(--study-muted-foreground);text-transform:uppercase;letter-spacing:.05em">最近解析</h2></div>
        <div id="m-hist-list"></div>
      </div>
      <div id="m-sel-bar" class="esc-sel-bar" hidden></div>`;

    rootEl = container;
    const backBtn = container.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', () => Router.go('home'));
    container.querySelector('#m-hist-filter').addEventListener('click', () => {
      state.order = state.order === 'recent' ? 'oldest' : 'recent';
      UI.toast(state.order === 'recent' ? '按最近排序' : '按最早排序');
      paint();
    });
    container.querySelector('#m-hist-del').addEventListener('click', () => setSelecting(!state.selecting));
    bindSelBar(container);

    paint();
    UI.refreshIcons(container);
  }

  Store.on('history', () => { if (rootEl && !rootEl.hidden) paint(); });

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.history = { render };
})(window);
