/* ============================================================
   views/history_detail.js — 历史记录「查看解析」详情页（二级视图）
   · 从 Store.getHistoryItem(id) 读取已保存的解析结果并离线渲染，
     复用 home 视图的 renderParsed（统计条 / 逐句卡片 / 词性高亮 / 全文翻译）。
   · 旧记录若未保存句子数据（result.sentences 为空），提供「重新解析」入口。
   事件：返回、重新解析
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, Router = Mobile.Router;
  const esc = UI.esc, icon = UI.icon;

  function render(container, params) {
    const id = (params && params.id) || '';
    const h = id ? Store.getHistoryItem(id) : null;

    if (!h) {
      container.innerHTML = `
        <div class="esc-page">
          <header class="esc-header">
            <button class="esc-icon-btn" data-act="back" aria-label="返回" style="margin-right:0">${icon('chevron-left')}</button>
            <div class="esc-title-row">${icon('file-text', 'esc-logo')}<h1>解析详情</h1></div>
          </header>
          <div class="esc-empty">${icon('file-question', 'esc-ico')}<p class="esc-empty-title" style="margin-top:16px">记录不存在或已被删除</p><p class="esc-empty-desc">返回历史列表看看其他记录</p></div>
        </div>`;
      bindBack(container);
      UI.refreshIcons(container);
      return;
    }

    const sentences = (h.result && Array.isArray(h.result.sentences)) ? h.result.sentences : [];
    const hasData = sentences.length > 0;

    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <button class="esc-icon-btn" data-act="back" aria-label="返回" style="margin-right:0">${icon('chevron-left')}</button>
          <div class="esc-title-row">${icon('file-text', 'esc-logo')}<h1>解析详情</h1></div>
        </header>

        <div class="esc-card" style="margin-bottom:16px">
          <h3 class="esc-history-title" style="margin:0 0 8px">${esc(h.title || '未命名文章')}</h3>
          <div class="esc-history-meta">
            <span>${icon('calendar')}${esc(h.date)}</span>
            <span>${icon('file-text')}${esc(h.words || 0)} 词</span>
            <span>${icon('bar-chart-2')}${esc(h.sentences || 0)} 句</span>
          </div>
          ${hasData ? '' : `
            <div class="esc-spanel-empty" style="margin-top:12px">该记录未保存解析数据</div>
            <button class="esc-btn esc-btn-primary" data-act="reparse" style="width:100%;justify-content:center;margin-top:10px">${icon('refresh-cw')}<span>重新解析</span></button>`}
        </div>

        ${hasData ? `
        <div id="m-stats"></div>
        <div class="esc-section-title" style="margin-top:16px">${icon('languages')}<span>全文翻译</span></div>
        <div id="m-fulltrans"></div>
        <div class="esc-section-title" style="margin-top:16px">${icon('align-left')}<span>逐句解析</span></div>
        <div id="m-cards"></div>` : ''}
      </div>`;

    bindBack(container);
    const reparse = container.querySelector('[data-act="reparse"]');
    if (reparse) reparse.addEventListener('click', () => Router.go('home', { text: h.text }));

    if (hasData) {
      // 词性高亮状态：与首页/设置页共享（localStorage 持久化）
      if (Mobile.Highlight && typeof Mobile.Highlight.load === 'function') Mobile.Highlight.load();
      const res = Object.assign({}, h.result, { stats: h.result.stats || undefined });
      if (Mobile.Views.home && typeof Mobile.Views.home.renderParsed === 'function') {
        Mobile.Views.home.renderParsed(container, res);
      } else {
        const cardsEl = container.querySelector('#m-cards');
        if (cardsEl) cardsEl.innerHTML = `<div class="esc-empty"><p class="esc-empty-title">渲染组件未加载，请刷新页面</p></div>`;
      }
    }
    UI.refreshIcons(container);
  }

  function bindBack(container) {
    const backBtn = container.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', () => Router.go('history'));
  }

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.detail = { render };
})(window);
