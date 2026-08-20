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
      <div class="esc-word" data-word="${esc(w.word)}">
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

    // 多生词本切换胶囊
    const tabsEl = rootEl.querySelector('#m-nb-tabs');
    tabsEl.innerHTML = notebooks.map((n) => {
      const active = n.id === currentId ? ' is-active' : '';
      return `<button class="esc-nb-tab${active}" data-nb="${esc(n.id)}">${esc(n.name)}<span class="esc-nb-tab-count">${n.wordCount}</span></button>`;
    }).join('') + `<button class="esc-nb-tab esc-add" data-act="new-nb">${icon('plus')}</button>`;

    rootEl.querySelector('#m-vocab-badge').textContent = `共 ${total} 词`;
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
      ? arr.map(wordCard).join('')
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
    wrap.querySelectorAll('.esc-word').forEach((el) => {
      const word = el.getAttribute('data-word');
      const pron = el.querySelector('[data-act="pron"]');
      if (pron) pron.addEventListener('click', (e) => { e.stopPropagation(); if (word) Speech.speak(word); });
    });
  }

  function render(container) {
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('book-open', 'esc-logo')}<h1>生词本</h1></div>
          <div class="esc-header-actions">
            <button id="m-vocab-manage" class="esc-icon-btn" aria-label="管理生词本">${icon('settings-2')}</button>
            <span id="m-vocab-badge" class="esc-badge">${icon('layers')}<span>共 0 词</span></span>
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

    // 多生词本切换
    container.querySelector('#m-nb-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-nb]');
      if (tab) { Store.setCurrentNotebook(tab.getAttribute('data-nb')); return; }
      const add = e.target.closest('[data-act="new-nb"]');
      if (add) createNotebookFlow();
    });

    // 管理生词本
    container.querySelector('#m-vocab-manage').addEventListener('click', () => manageNotebooks());

    paint();
    UI.refreshIcons(container);
  }

  // 新建生词本流程（底部弹层表单）
  function createNotebookFlow() {
    const html = `
      <div class="esc-bsheet-grip"></div>
      <div class="esc-bsheet-title">新建生词本</div>
      <input type="text" class="esc-nb-input esc-input" placeholder="生词本名称" maxlength="20" style="margin-bottom:14px" />
      <div class="esc-nb-error" hidden style="color:var(--study-error);font-size:12px;margin-bottom:8px"></div>
      <button class="esc-btn esc-btn-primary" data-act="create" style="width:100%;justify-content:center">创建</button>`;
    UI.bottomSheet(html, {
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

  // 管理生词本：重命名 / 删除 / 合并（底部弹层）
  function manageNotebooks() {
    const notebooks = Store.getNotebooks();
    const currentId = Store.getCurrentNotebookId();
    const rows = notebooks.map((n) => {
      const isCurrent = n.id === currentId;
      return `<button class="esc-bsheet-row" data-act="rename" data-id="${esc(n.id)}">
          ${icon('edit-3')}<span>重命名「${esc(n.name)}」${isCurrent ? '（当前）' : ''}</span>
        </button>
        <button class="esc-bsheet-row" data-act="merge" data-id="${esc(n.id)}">
          ${icon('git-merge')}<span>合并「${esc(n.name)}」到其它本</span>
        </button>
        <button class="esc-bsheet-row esc-danger" data-act="del" data-id="${esc(n.id)}">
          ${icon('trash-2')}<span>删除「${esc(n.name)}」</span>
        </button>`;
    }).join('');
    const html = `
      <div class="esc-bsheet-grip"></div>
      <div class="esc-bsheet-title">管理生词本</div>
      ${rows}`;
    UI.bottomSheet(html, {
      onOpen: (sheet, close) => {
        sheet.querySelectorAll('[data-act="rename"]').forEach((b) => b.addEventListener('click', () => {
          close(); renameFlow(b.getAttribute('data-id'));
        }));
        sheet.querySelectorAll('[data-act="merge"]').forEach((b) => b.addEventListener('click', () => {
          close(); mergeFlow(b.getAttribute('data-id'));
        }));
        sheet.querySelectorAll('[data-act="del"]').forEach((b) => b.addEventListener('click', () => {
          close(); deleteFlow(b.getAttribute('data-id'));
        }));
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

  function mergeFlow(fromId) {
    const notebooks = Store.getNotebooks();
    const targets = notebooks.filter((n) => n.id !== fromId);
    if (!targets.length) { UI.toast('没有可合并的目标生词本'); return; }
    const fromName = (notebooks.find((n) => n.id === fromId) || {}).name || '';
    const rows = targets.map((n) =>
      `<button class="esc-bsheet-row" data-id="${esc(n.id)}">${icon('book-open')}<span>${esc(n.name)} <span style="color:var(--study-muted-foreground);font-size:12px">(${n.wordCount})</span></span></button>`
    ).join('');
    const html = `
      <div class="esc-bsheet-grip"></div>
      <div class="esc-bsheet-title">合并「${esc(fromName)}」到</div>
      ${rows}`;
    UI.bottomSheet(html, {
      onOpen: (sheet, close) => {
        sheet.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
          const r = Store.mergeNotebooks(fromId, b.getAttribute('data-id'));
          if (!r.success) { UI.toast(r.error); return; }
          UI.toast(`已合并，目标本共 ${r.count} 词`);
          close();
        }));
      }
    });
  }

  function deleteFlow(id) {
    const n = Store.getNotebooks().find((x) => x.id === id);
    if (!n) return;
    if (Store.getNotebooks().length <= 1) { UI.toast('至少保留一个生词本'); return; }
    const html = `
      <div class="esc-bsheet-grip"></div>
      <div class="esc-bsheet-title">删除生词本</div>
      <p style="font-size:14px;color:var(--study-muted-foreground);margin:0 0 12px">确定删除「${esc(n.name)}」？本内 ${n.wordCount} 个单词将一并移除（不可恢复）。</p>
      <div style="display:flex;gap:10px">
        <button class="esc-btn esc-btn-ghost" data-act="cancel" style="flex:1;justify-content:center">取消</button>
        <button class="esc-btn esc-btn-danger" data-act="ok" style="flex:1;justify-content:center">删除</button>
      </div>`;
    UI.bottomSheet(html, {
      onOpen: (sheet, close) => {
        sheet.querySelector('[data-act="cancel"]').addEventListener('click', close);
        sheet.querySelector('[data-act="ok"]').addEventListener('click', () => {
          const r = Store.deleteNotebook(id);
          if (!r.success) { UI.toast(r.error); return; }
          UI.toast('已删除');
          close();
        });
      }
    });
  }

  // 生词数据变化时自动刷新（由 Store 事件触发）
  Store.on('vocab', () => { if (rootEl && !rootEl.hidden) paint(); });

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.vocab = { render };
})(window);
