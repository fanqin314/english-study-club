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

  function wordCard(w) {
    return `
      <div class="esc-word" data-id="${esc(w.id)}">
        <div class="esc-word-inner">
          <div class="esc-word-accent"></div>
          <div class="esc-word-body">
            <div class="esc-word-top">
              <div style="min-width:0">
                <h3 class="esc-word-name">${esc(w.word)}</h3>
                ${w.phonetic ? `<div class="esc-word-phon">/${esc(w.phonetic)}/</div>` : ''}
                <p class="esc-word-mean">${esc(w.pos ? w.pos + '. ' : '')}${esc(w.meaning || w.zh || '')}</p>
              </div>
            </div>
            ${w.example ? `<div class="esc-word-ex"><p class="esc-word-ex-en">"${esc(w.example)}"</p>${w.exampleZh ? `<p class="esc-word-ex-zh">${esc(w.exampleZh)}</p>` : ''}</div>` : ''}
            <div class="esc-word-foot">
              <button class="esc-word-pron" data-act="pron">${icon('volume-2')}<span>发音</span></button>
              <span class="esc-dot"></span>
              <span class="esc-word-date">${esc(relTime(w.createdAt))}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function relTime(ts) {
    if (!ts) return '';
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 30) return days + '天前';
    return Math.floor(days / 30) + '月前';
  }

  function paint() {
    if (!rootEl) return;
    const list = Store.getVocab();
    const total = list.length;
    const p = Store.getProgress();
    const s = Store.getSettings();
    const today = list.filter((w) => isToday(w.createdAt)).length;
    const mastered = p.masteredCount;        // 全局累计掌握（桌面端 stats_mastered_words）
    const goal = s.dailyGoal || 20;
    const pct = goal ? Math.min(100, Math.round((today / goal) * 100)) : 0;

    rootEl.querySelector('#m-vocab-badge').textContent = `共 ${total} 词`;
    rootEl.querySelector('#m-vocab-stats').innerHTML = `
      <div class="esc-grid-3" style="grid-template-columns:repeat(3,1fr)">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:22px;font-weight:700;color:var(--study-primary);font-family:var(--study-font-serif)">${today}</span><span style="font-size:12px;color:var(--study-muted-foreground)">今日新增</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;border-left:1px solid var(--study-border);border-right:1px solid var(--study-border)"><span style="font-size:22px;font-weight:700;color:var(--study-warning);font-family:var(--study-font-serif)">${total}</span><span style="font-size:12px;color:var(--study-muted-foreground)">生词总数</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:22px;font-weight:700;color:var(--study-success);font-family:var(--study-font-serif)">${mastered}</span><span style="font-size:12px;color:var(--study-muted-foreground)">累计掌握</span></div>
      </div>
      <div class="esc-progress" style="margin-top:12px"><i style="width:${pct}%"></i></div>
      <p style="font-size:12px;color:var(--study-muted-foreground);text-align:center;margin:8px 0 0">今日目标进度 ${pct}%</p>`;

    const arr = filtered(list);
    const wrap = rootEl.querySelector('#m-vocab-list');
    wrap.innerHTML = arr.length
      ? arr.map(wordCard).join('')
      : `<div class="esc-empty">${icon('book-open', 'esc-ico')}<p class="esc-empty-title" style="margin-top:16px">还没有生词</p><p class="esc-empty-desc">深度解析单词后，点击收藏即可将单词添加到生词本中</p></div>`;

    UI.refreshIcons(wrap);
    bindCards(wrap);
  }

  function bindCards(wrap) {
    wrap.querySelectorAll('.esc-word').forEach((el) => {
      const id = el.getAttribute('data-id');
      const pron = el.querySelector('[data-act="pron"]');
      if (pron) pron.addEventListener('click', (e) => { e.stopPropagation(); const w = Store.getWord(id); if (w) Speech.speak(w.word); });
    });
  }

  function render(container) {
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('book-open', 'esc-logo')}<h1>生词本</h1></div>
          <span id="m-vocab-badge" class="esc-badge">${icon('layers')}<span>共 0 词</span></span>
        </header>

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

    paint();
    UI.refreshIcons(container);
  }

  // 生词数据变化时自动刷新（由 Store 事件触发）
  Store.on('vocab', () => { if (rootEl && !rootEl.hidden) paint(); });

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.vocab = { render };
})(window);
