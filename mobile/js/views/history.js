/* ============================================================
   views/history.js — 历史记录（底部导航 history）
   组件与交互：
   · 顶部栏：标题 + 筛选按钮（切换 最近/最早 排序）
   · 统计条：共解析 / 本周 / 总词数
   · 历史卡片：标题 + 日期 + 词数 + 句数 + 摘要 + 查看解析 / 开始复习
   · 空状态：无历史时提示去解析
   状态：order（'recent' | 'oldest'）
   事件：查看解析（带入文本跳首页）、开始复习（跳记忆模式）、筛选切换
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, Router = Mobile.Router;
  const esc = UI.esc, icon = UI.icon;

  let state = { order: 'recent' };
  let rootEl = null;

  function withinWeek(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr); const n = new Date();
    return (n - d) <= 7 * 86400000 && !isNaN(d);
  }

  function historyCard(h) {
    return `
      <div class="esc-history" data-id="${esc(h.id)}">
        <div class="esc-history-body">
          <div class="esc-history-top">
            <h3 class="esc-history-title">${esc(h.title || '未命名文章')}</h3>
            ${icon('chevron-right')}
          </div>
          <div class="esc-history-meta">
            <span>${icon('calendar')}${esc(h.date)}</span>
            <span>${icon('file-text')}${esc(h.words || 0)} 词</span>
            <span>${icon('bar-chart-2')}${esc(h.sentences || 0)} 句</span>
          </div>
          ${h.snippet ? `<p class="esc-history-snip">${esc(h.snippet)}</p>` : ''}
          <div class="esc-history-actions">
            <button class="esc-mini-btn" data-act="view">查看解析</button>
            <button class="esc-mini-btn esc-muted" data-act="review">开始复习</button>
          </div>
        </div>
      </div>`;
  }

  function paint() {
    if (!rootEl) return;
    let list = Store.getHistory().slice();
    if (state.order === 'oldest') list.reverse();

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
  }

  function bindCards(wrap) {
    wrap.querySelectorAll('.esc-history').forEach((el) => {
      const id = el.getAttribute('data-id');
      const view = el.querySelector('[data-act="view"]');
      const review = el.querySelector('[data-act="review"]');
      if (view) view.addEventListener('click', (e) => {
        e.stopPropagation();
        const h = Store.getHistoryItem(id);
        if (h) Router.go('home', { text: h.text });
      });
      if (review) review.addEventListener('click', (e) => { e.stopPropagation(); Router.go('memory'); });
      el.addEventListener('click', () => { const h = Store.getHistoryItem(id); if (h) Router.go('home', { text: h.text }); });
    });
  }

  function render(container) {
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <button class="esc-icon-btn" data-act="back" aria-label="返回" style="margin-right:0">${icon('chevron-left')}</button>
          <div class="esc-title-row">${icon('clock', 'esc-logo')}<h1>历史记录</h1></div>
          <button id="m-hist-filter" class="esc-pill">${icon('sliders-horizontal')}<span>筛选</span></button>
        </header>

        <section style="margin-top:16px">
          <div id="m-hist-stats"></div>
        </section>

        <div style="margin:16px 4px 8px"><h2 style="font-size:12px;font-weight:600;color:var(--study-muted-foreground);text-transform:uppercase;letter-spacing:.05em">最近解析</h2></div>
        <div id="m-hist-list"></div>
      </div>`;

    rootEl = container;
    const backBtn = container.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', () => Router.go('home'));
    container.querySelector('#m-hist-filter').addEventListener('click', () => {
      state.order = state.order === 'recent' ? 'oldest' : 'recent';
      UI.toast(state.order === 'recent' ? '按最近排序' : '按最早排序');
      paint();
    });

    paint();
    UI.refreshIcons(container);
  }

  Store.on('history', () => { if (rootEl && !rootEl.hidden) paint(); });

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.history = { render };
})(window);
