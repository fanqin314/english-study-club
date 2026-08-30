/* ============================================================
   views/memory.js — 记忆模式（底部导航 memory）
   对齐网页版「记忆模式」：顶部「单词 / 文章」两个标签切换。
   · 单词标签：生词本选择器 + 4 个模式（闪卡 / 填空 / 听写 / 选词）
   · 文章标签：文章选择器 + 4 个模式（语境填空 / 全文回顾 / 逐句精读 / 生词测验）
   · 顶部保留学习进度卡（连续学习 / 环形进度 / 待复习·已掌握·正确率）
   状态：currentTab（'word'|'article'）、selectedArticleId、练习 session
   事件：标签切换、模式卡点击（启动对应练习）、文章选择、练习内交互
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, Speech = Mobile.Speech, Router = Mobile.Router;
  const esc = UI.esc, icon = UI.icon;
  // 共享统计/计划纯计算核心（core/shared/study_stats.js）
  const Shared = global.EnglishStudyShared || {};
  const SStats = Shared.Stats || null;

  // 单词标签的 4 个练习模式
  const WORD_MODES = [
    { key: 'flashcard', name: '闪卡模式', desc: '翻转卡片，快速记忆单词', ico: 'layers' },
    { key: 'fill', name: '填空练习', desc: '语境填空，加深词汇理解', ico: 'text-cursor-input' },
    { key: 'spelling', name: '听写练习', desc: '听音拼写，强化记忆', ico: 'volume-2' },
    { key: 'choice', name: '选词练习', desc: '释义选词，巩固掌握', ico: 'list-checks' }
  ];
  // 文章标签的 4 个练习模式
  const ARTICLE_MODES = [
    { key: 'cloze', name: '语境填空', desc: '基于文章填空记忆生词', ico: 'text-cursor-input' },
    { key: 'review', name: '全文回顾', desc: '回顾全文，巩固阅读', ico: 'book-open' },
    { key: 'sentence', name: '逐句精读', desc: '逐句精读，深入理解', ico: 'align-left' },
    { key: 'vocabQuiz', name: '生词测验', desc: '测验文章生词掌握度', ico: 'brain' }
  ];

  // 记忆模式标识对齐桌面端 MODULE_META（features/stats_tracker.js），
  // 供 recordModuleActivity 写入 stats_module_data，桌面端统计页可直接读取。
  const MODULE_MAP = {
    flashcard: 'flashcard',
    fill: 'fillPractice',
    spelling: 'spelling',
    choice: 'choicePractice',
    cloze: 'cloze',
    review: 'fullReview',
    sentence: 'sentenceReview',
    vocabQuiz: 'vocabQuiz'
  };

  // 记忆模块元数据 + 生词本配色：统一来自共享层（core/shared/study_stats.js），
  // 与桌面端 features/stats_tracker.js MODULE_META 唯一一致，避免两端漂移。
  const MODULE_META = (SStats && SStats.MODULE_META) || {
    flashcard: { label: '闪卡模式', color: '#3b82f6', type: 'word' },
    fillPractice: { label: '填空练习', color: '#10b981', type: 'word' }
  };
  const NB_COLORS = (Shared.NB_COLORS) || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];

  const FALLBACK = [
    { word: 'serendipity', phonetic: 'ˌser.ənˈdɪp.ə.ti', meaning: '意外发现珍奇事物的本领', example: 'Life is full of serendipity.', exampleZh: '生活中处处充满意外惊喜。' },
    { word: 'eloquent', phonetic: 'ˈel.ə.kwənt', meaning: '雄辩的；有口才的', example: 'She gave an eloquent speech.', exampleZh: '她发表了一场感人至深的演讲。' },
    { word: 'ephemeral', phonetic: 'ɪˈfem.ər.əl', meaning: '短暂的；转瞬即逝的', example: 'Trends are ephemeral.', exampleZh: '潮流转瞬即逝。' },
    { word: 'pragmatic', phonetic: 'præɡˈmæt.ɪk', meaning: '务实的；实用主义的', example: 'A pragmatic approach.', exampleZh: '务实的方法。' },
    { word: 'resilient', phonetic: 'rɪˈzɪl.i.ənt', meaning: '有韧性的；能恢复的', example: 'Children are resilient.', exampleZh: '孩子更有韧性。' }
  ];

  let rootEl = null;
  let currentTab = 'word';
  let selectedArticleId = null;
  // 文章记忆模式的多选生词本（扇形轮盘点选）。默认 = 当前生词本，可继续追加多个。
  let nbSel = null;

  // ---------- 数据辅助 ----------
  // 轮盘选中的生词本集合 → 归一化生词（对齐桌面端 memory-nb-multi 的多选语义）。
  // 优先使用轮盘/选择器选中的集合；未选择时退化为「当前选定的生词本」，而非所有生词本。
  function getSelectedVocab() {
    const all = Store.getVocab();
    const ids = nbSel && nbSel.size ? nbSel : null;
    if (ids) return all.filter((w) => ids.has(w.notebookId));
    const curId = Store.getCurrentNotebookId();
    return curId ? all.filter((w) => w.notebookId === curId) : all;
  }
  function getVocabSet() {
    return new Set(getSelectedVocab().map((w) => (w.word || '').toLowerCase()).filter(Boolean));
  }
  function splitSentences(text) {
    if (!text) return [];
    return text.split(/\n+/).map((b) => b.trim()).filter(Boolean)
      .flatMap((b) => b.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean));
  }
  function getArticle(id) {
    if (!id) return null;
    return Store.getHistory().find((h) => h.id === id) || null;
  }
  // 单词练习队列：取当前选定生词本的前 10（桌面端不区分「已掌握」，故不再按 status 排序）
  function buildWordQueue() {
    // 当前生词本为空时返回空队列，由调用方提示「先去收藏生词」，不再回退演示词
    const vocab = Store.getNotebookWords(Store.getCurrentNotebookId()) || [];
    return vocab.slice(0, 10);
  }
  // 文章「语境填空」队列：取含生词的句子，挖空该生词
  function buildArticleClozeQueue(item) {
    const sentences = splitSentences(item.text);
    const vocabSet = getVocabSet();
    const queue = [];
    sentences.forEach((s) => {
      const words = s.match(/\b([A-Za-z][A-Za-z'-]+)\b/g) || [];
      const hit = words.find((w) => vocabSet.has(w.toLowerCase()));
      if (hit) queue.push({ example: s, word: hit });
    });
    if (queue.length === 0) {
      // 文章无匹配生词：退化为挖最长词，仍可练习
      sentences.slice(0, 8).forEach((s) => {
        const words = s.match(/\b([A-Za-z][A-Za-z'-]+)\b/g) || [];
        if (words.length) {
          const longest = words.slice().sort((a, b) => b.length - a.length)[0];
          queue.push({ example: s, word: longest });
        }
      });
    }
    return queue.slice(0, 10);
  }
  // 文章「生词测验」队列：文章中出现过、且属于轮盘选中生词本的生词
  function buildArticleVocabQueue(item) {
    const text = (item.text || '').toLowerCase();
    const selected = getSelectedVocab();
    const found = selected.filter((w) => w.word && text.includes(w.word.toLowerCase()));
    return (found.length ? found : selected).slice(0, 10);
  }

  // ---------- 渲染 ----------
  function render(container) {
    const p = Store.getProgress();
    const s = Store.getSettings();
    const goal = s.dailyGoal || 20;
    const done = Math.min(p.todayCount, goal);
    const pct = goal ? Math.round((done / goal) * 100) : 0;
    const remain = Math.max(goal - p.todayCount, 0);
    const mins = Math.max(1, Math.round((remain * 0.4)));
    const circ = 2 * Math.PI * 42;
    const offset = circ * (1 - pct / 100);
    const vocabCount = Store.getVocab().length;
    const nbs = Store.getNotebooks();
    const curId = Store.getCurrentNotebookId();
    const curNb = nbs.find((nb) => nb.id === curId) || nbs[0] || null;
    const curName = curNb ? curNb.name : '默认生词本';
    const curCount = curNb ? curNb.wordCount : vocabCount;

    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('flame', 'esc-logo')}<h1>记忆模式</h1></div>
          <div class="esc-badge">${icon('flame')}<span>连续学习 <b style="color:var(--study-warning)">${esc(p.streak)}</b> 天</span></div>
        </header>

        <!-- 学习统计 / 学习计划 入口（对齐桌面端记忆模式 header 按钮） -->
        <div class="esc-mem-actions">
          <button class="esc-btn esc-btn-ghost" data-act="stats">${icon('bar-chart-3')}<span>学习统计</span></button>
          <button class="esc-btn esc-btn-ghost" data-act="plan">${icon('calendar')}<span>学习计划</span></button>
        </div>

        <!-- 学习进度卡 -->
        <section class="esc-card" style="margin-top:12px">
          <div class="esc-section-title">${icon('target')}<span>今日学习进度</span></div>
          <div style="display:flex;align-items:center;gap:16px">
            <div class="esc-ring-wrap">
              <svg class="esc-ring" width="72" height="72" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--study-muted)" stroke-width="8"></circle>
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--study-primary)" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
              </svg>
              <div class="esc-ring-center"><span class="esc-num">${done}</span><span class="esc-sub">/ ${goal}</span></div>
            </div>
            <div style="flex:1;min-width:0">
              <p style="font-size:14px;font-weight:500;margin:0 0 4px">今日目标 <b>${goal} 词</b> / 已完成 <b style="color:var(--study-primary)">${done} 词</b></p>
              <div class="esc-progress" style="margin-bottom:8px"><i style="width:${pct}%"></i></div>
              <p style="font-size:12px;color:var(--study-muted-foreground);display:flex;align-items:center;gap:4px;margin:0">${icon('clock')}预计还需 <b style="color:var(--study-foreground)">${mins} 分钟</b></p>
            </div>
          </div>
          <div class="esc-grid-3" style="margin-top:14px">
            <div class="esc-stat"><div class="esc-num">${esc(p.reviewDue)}</div><div class="esc-label">待复习</div></div>
            <div class="esc-stat"><div class="esc-num is-success">${esc(p.masteredCount)}</div><div class="esc-label">已掌握</div></div>
            <div class="esc-stat"><div class="esc-num is-foreground">${esc(p.correctRate)}<span style="font-size:12px">%</span></div><div class="esc-label">正确率</div></div>
          </div>
        </section>

        <!-- 单词 / 文章 标签切换 -->
        <div class="esc-seg is-full" id="m-mmtabs" style="margin-top:16px">
          <button data-tab="word">单词</button>
          <button data-tab="article">文章</button>
        </div>

        <!-- 单词标签内容 -->
        <div id="m-word" class="esc-mmtab-content">
          <div class="esc-nbcard" role="button" tabindex="0" data-act="select-nb" aria-label="切换生词本">
            <div class="esc-nb-ico" ${curNb ? `style="--nb:${curNb.color}"` : ''}>${icon('book-open')}</div>
            <div class="esc-nb-info">
              <div class="esc-nb-name">${esc(curName)}</div>
              <div class="esc-nb-sub">${curCount} 个生词</div>
            </div>
            <div class="esc-nb-count">${curCount} 词<span class="esc-nb-caret">${icon('chevron-down')}</span></div>
          </div>
          <div class="esc-mtitle">选择记忆模式</div>
          <div class="esc-mode-grid">
            ${WORD_MODES.map((m) => `
              <button class="esc-mode" data-mode="${m.key}">
                <div class="esc-mode-ico">${icon(m.ico)}</div>
                <div><p class="esc-mode-name">${esc(m.name)}</p><p class="esc-mode-desc">${esc(m.desc)}</p></div>
              </button>`).join('')}
          </div>
        </div>

        <!-- 文章标签内容 -->
        <div id="m-article" class="esc-mmtab-content" hidden>
          <div class="esc-field">
            <label class="esc-field-label">选择文章</label>
            <div class="esc-art-row">
              <div class="esc-nbwheel" id="m-nbwheel" role="menu" aria-label="选择生词本">
                <button type="button" class="esc-nbwheel-btn" data-act="nbwheel" aria-label="选择生词本" aria-haspopup="menu">${icon('book-open')}</button>
                <!-- 展开时的透明捕捉面：覆盖整个风扇区（含芯片空隙），让上下拖动随处可旋转轮盘 -->
                <div class="esc-nbwheel-area" data-act="nbwheel-drag" aria-hidden="true"></div>
                <ul class="esc-nbwheel-items"></ul>
              </div>
              <div class="esc-select-wrap">
                <button type="button" id="m-art" class="esc-art-trigger" data-act="art-pick" aria-haspopup="listbox">
                  <span class="esc-art-ico">${icon('file-text')}</span>
                  <span class="esc-art-label">选择文章</span>
                  <span class="esc-art-caret">${icon('chevron-down')}</span>
                </button>
              </div>
            </div>
          </div>
          <div class="esc-mtitle">选择记忆模式</div>
          <div class="esc-mode-grid">
            ${ARTICLE_MODES.map((m) => `
              <button class="esc-mode" data-mode="${m.key}">
                <div class="esc-mode-ico">${icon(m.ico)}</div>
                <div><p class="esc-mode-name">${esc(m.name)}</p><p class="esc-mode-desc">${esc(m.desc)}</p></div>
              </button>`).join('')}
          </div>
        </div>
      </div>`;

    rootEl = container;
    paintArticleSelect();
    bind(container);
    wheelSetup(container);
    selectTab(currentTab);
    UI.refreshIcons(container);
  }

  function paintArticleSelect() {
    const btn = rootEl && rootEl.querySelector('#m-art');
    if (!btn) return;
    const label = btn.querySelector('.esc-art-label');
    const list = Store.getHistory();
    if (!list.length) {
      selectedArticleId = null;
      if (label) label.textContent = '暂无历史文章';
    } else {
      if (!selectedArticleId || !list.find((h) => h.id === selectedArticleId)) {
        selectedArticleId = list[0].id;
      }
      const h = list.find((x) => x.id === selectedArticleId);
      const first = (h.title || (h.text || '').split('\n')[0] || '未命名文章').slice(0, 24);
      if (label) label.textContent = h.date ? `${first} · ${h.date}` : first;
    }
  }

  // 文章选择：打开自定义居中选择列表（代替原生下拉框展开界面）
  function openArticleSelect() {
    const list = Store.getHistory();
    if (!list.length) { UI.toast('暂无历史文章'); return; }
    const html = `
      <div class="esc-nbpick-head">
        <div class="esc-nbpick-ico">${icon('file-text')}</div>
        <div>
          <h3 class="esc-nbpick-title">选择文章</h3>
          <p class="esc-nbpick-sub">记忆练习将基于所选文章进行</p>
        </div>
      </div>
      <div class="esc-nbpick-list">
        ${list.map((h) => {
          const first = (h.title || (h.text || '').split('\n')[0] || '未命名文章');
          const isOn = h.id === selectedArticleId;
          return `
          <button type="button" class="esc-apick-item${isOn ? ' is-on' : ''}" data-id="${esc(h.id)}">
            <span class="esc-apick-ico">${icon('file-text')}</span>
            <span class="esc-apick-main">
              <span class="esc-apick-name">${esc(first)}</span>
              <span class="esc-apick-date">${esc(h.date || '')}</span>
            </span>
            <span class="esc-apick-check">${icon('check')}</span>
          </button>`;
        }).join('')}
      </div>`;
    UI.modal(html, {
      onOpen: (dlg, dlClose) => {
        dlg.querySelectorAll('.esc-apick-item').forEach((el) => {
          el.addEventListener('click', () => {
            selectedArticleId = el.getAttribute('data-id');
            paintArticleSelect();
            dlClose();
          });
        });
      }
    });
  }

  function bind(root) {
    // 标签切换
    root.querySelectorAll('#m-mmtabs button').forEach((b) => {
      b.addEventListener('click', () => selectTab(b.getAttribute('data-tab')));
    });
    // 学习统计 / 学习计划
    const statsBtn = root.querySelector('[data-act="stats"]');
    if (statsBtn) statsBtn.addEventListener('click', openStats);
    const planBtn = root.querySelector('[data-act="plan"]');
    if (planBtn) planBtn.addEventListener('click', openPlan);
    // 文章选择：打开自定义居中选择列表
    const artBtn = root.querySelector('[data-act="art-pick"]');
    if (artBtn) artBtn.addEventListener('click', openArticleSelect);
    // 生词本卡片：弹出选择浮窗
    const nbCard = root.querySelector('[data-act="select-nb"]');
    if (nbCard) nbCard.addEventListener('click', showNotebookSelect);
    // 模式卡点击（单词 + 文章 共用一个委托）
    root.querySelectorAll('.esc-mode[data-mode]').forEach((el) => {
      el.addEventListener('click', () => openExercise(el.getAttribute('data-mode')));
    });
  }

  function selectTab(name) {
    currentTab = name;
    if (!rootEl) return;
    rootEl.querySelectorAll('#m-mmtabs button').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === name);
    });
    rootEl.querySelector('#m-word').hidden = name !== 'word';
    rootEl.querySelector('#m-article').hidden = name !== 'article';
  }

  // ---------------- 生词本选择浮窗 ----------------
  // 点击顶部生词本卡片：居中模态滚动选择生词本，底部「取消 / 选择」
  function showNotebookSelect() {
    const nbs = Store.getNotebooks();
    if (!nbs.length) { UI.toast('暂无生词本'); return; }
    const curId = Store.getCurrentNotebookId();
    let selId = curId;
    const html = `
      <div class="esc-nbpick-head">
        <div class="esc-nbpick-ico">${icon('book-open')}</div>
        <div>
          <h3 class="esc-nbpick-title">选择生词本</h3>
          <p class="esc-nbpick-sub">记忆练习将使用当前选中的生词本</p>
        </div>
      </div>
      <div class="esc-nbpick-list">
        ${nbs.map((nb) => `
          <button type="button" class="esc-nbpick-item${nb.id === selId ? ' is-on' : ''}" data-id="${esc(nb.id)}">
            <span class="esc-nbpick-dot" style="--nb:${nb.color}"></span>
            <span class="esc-nbpick-name">${esc(nb.name)}</span>
            <span class="esc-nbpick-count">${nb.wordCount} 词</span>
            <span class="esc-nbpick-check">${icon('check')}</span>
          </button>`).join('')}
      </div>
      <div class="esc-modal-actions">
        <button class="esc-btn esc-btn-ghost" data-act="cancel">取消</button>
        <button class="esc-btn esc-btn-primary" data-act="select">选择</button>
      </div>`;
    UI.modal(html, {
      onOpen: (dlg, close) => {
        const list = dlg.querySelector('.esc-nbpick-list');
        list.querySelectorAll('.esc-nbpick-item').forEach((it) => {
          it.addEventListener('click', () => {
            selId = it.getAttribute('data-id');
            list.querySelectorAll('.esc-nbpick-item').forEach((o) => o.classList.toggle('is-on', o === it));
          });
        });
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        dlg.querySelector('[data-act="select"]').addEventListener('click', () => {
          if (selId && selId !== curId) {
            Store.setCurrentNotebook(selId);
            // 同步轮盘多选集合（保持同一引用，仅更新内容），让测验生词跟随当前选定的生词本
            if (nbSel) { nbSel.clear(); nbSel.add(selId); }
          }
          close();
        });
      }
    });
  }

  // ================ 生词本扇形轮盘（文章标签左侧按钮） ================
  // 点击圆按钮 → 绕按钮展开扇形轮盘，上下滑动 / 滚轮旋转选择生词本。
  // 采用「单一实例 + 全局事件只绑一次」模式，避免重复绑定。
  let nbwheel = null; // { wrap, trigger, listEl, nbs, els, total, step, visible, offset, active, dragging, pointer, sx, so, wheelTimer }

  function wheelSetup(root) {
    const wrap = root && root.querySelector('.esc-nbwheel');
    if (!wrap) return;
    const trigger = wrap.querySelector('[data-act="nbwheel"]');
    const listEl = wrap.querySelector('.esc-nbwheel-items');
    if (!trigger || !listEl) return;

    const nbs = Store.getNotebooks();
    // 首次初始化多选集合：默认只选当前生词本（保留原有高亮观感，可继续追加）
    if (!nbSel) {
      const curId = Store.getCurrentNotebookId();
      nbSel = new Set(nbs.length ? (curId && nbs.some((n) => n.id === curId) ? [curId] : [nbs[0].id]) : []);
    }
    const m = {
      wrap, trigger, listEl,
      nbs: nbs.map((nb) => ({ id: nb.id, name: nb.name, count: nb.wordCount, color: nb.color })),
      sel: nbSel,
      els: [], total: nbs.length, offset: 0,
      active: false, dragging: false, pointer: null, sx: 0, so: 0, wheelTimer: null
    };
    nbwheel = m;

    if (!m.total) {
      trigger.addEventListener('click', (e) => { e.stopPropagation(); UI.toast('暂无生词本'); });
      return;
    }
    m.step = 360 / m.total;
    m.visible = Math.min(4, m.total);

    // 生成轮盘项
    m.nbs.forEach((nb, i) => {
      const base = (i - Math.floor(m.total / 2)) * m.step;
      const li = document.createElement('li');
      li.className = 'esc-nbwheel-item';
      li.dataset.id = nb.id;
      li.dataset.base = base;
      // --nb 绑定在整项上：供「选中态背景 = 生词本颜色」使用，圆点从父级继承同一变量
      li.style.setProperty('--nb', UI.esc(nb.color || '#506080'));
      li.innerHTML = `<span class="esc-nbwheel-dot"></span>
        <span class="esc-nbwheel-name">${UI.esc(nb.name)}</span>
        <span class="esc-nbwheel-count">${nb.count}</span>
        <span class="esc-nbwheel-check">${icon('check')}</span>`;
      listEl.appendChild(li);
      m.els.push(li);
    });

    // 按钮开关（开/关切换）
    trigger.addEventListener('click', (e) => { e.stopPropagation(); if (nbwheel.active) wheelClose(); else wheelOpen(); });
  }

  function wheelAngles(m) {
    return m.els.map((el, i) => {
      let a = parseFloat(el.dataset.base) + m.offset;
      a = ((a % 360) + 360) % 360;
      if (a > 180) a -= 360;
      return { index: i, actual: a };
    });
  }

  function wheelRender(m) {
    const isMobile = window.innerWidth <= 480;
    const radius = isMobile ? 104 : 140;          // 展开半径（移动端更小，避免溢出屏幕）
    const maxArc = isMobile ? 78 : 82;            // 扇形最大半角：始终限制在按钮右侧，不越过屏幕边缘
    const angles = wheelAngles(m);
    // 按与 0° 的距离排序，取最近的前 visible 个作为可见项
    const byDist = angles.slice().sort((a, b) => Math.abs(a.actual) - Math.abs(b.actual));
    const visibleArr = byDist.slice(0, m.visible).sort((a, b) => a.actual - b.actual); // 角度升序（扇形内 左→右）
    const focusObj = visibleArr.reduce((p, c) => (Math.abs(c.actual) < Math.abs(p.actual) ? c : p), visibleArr[0]);
    // 把可见项均匀分配到右侧扇形的固定槽位，保证不重叠、不跑出屏幕
    const V = visibleArr.length;
    const spacing = V <= 1 ? 0 : (2 * maxArc) / (V - 1);
    const slotOf = new Map(visibleArr.map((it, k) => [it.index, -maxArc + spacing * k]));
    m.els.forEach((el, i) => {
      const a = slotOf.has(i) ? slotOf.get(i) : angles[i].actual;
      el.style.setProperty('--angle', a + 'deg');
      el.style.setProperty('--radius', radius + 'px');
      const visible = slotOf.has(i);
      const focused = (visible && i === focusObj.index);
      el.classList.toggle('visible', visible);
      el.classList.toggle('hidden', !visible);
      el.classList.toggle('focused', visible && focused);
      el.classList.toggle('selected', m.sel.has(el.dataset.id)); // 多选：选中态来自 nbSel 集合
    });
  }

  function wheelSnap(m) {
    // 把距离 0° 最近（即将处于扇形中心）的项吸附到中心槽位
    const sorted = wheelAngles(m).slice().sort((a, b) => Math.abs(a.actual) - Math.abs(b.actual));
    if (sorted.length) { m.offset += -sorted[0].actual; wheelRender(m); }
  }

  function wheelOpen() {
    const m = nbwheel;
    if (!m || m.active) return false;
    const curId = Store.getCurrentNotebookId();
    const idx = m.nbs.findIndex((n) => n.id === curId);
    m.offset = 0;
    if (idx >= 0) m.offset = -(idx - Math.floor(m.total / 2)) * m.step;
    m.wrap.classList.add('active');
    wheelSnap(m);
    m.active = true;
    return true;
  }
  function wheelClose() {
    if (!nbwheel || !nbwheel.active) return;
    nbwheel.wrap.classList.remove('active');
    nbwheel.active = false;
  }

  function toggleWheelItem(li, id) {
    // 多选：点一下加入 / 再点一下取消；轮盘保持展开，可连续多选
    const m = nbwheel;
    if (m.sel.has(id)) { m.sel.delete(id); li.classList.remove('selected'); }
    else { m.sel.add(id); li.classList.add('selected'); }
  }

  // 全局事件（仅注册一次）
  document.addEventListener('click', (e) => { if (nbwheel && nbwheel.active && !e.target.closest('.esc-nbwheel')) wheelClose(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nbwheel && nbwheel.active) wheelClose(); });
  document.addEventListener('pointerdown', (e) => {
    const m = nbwheel;
    if (!m || !m.active || e.target.closest('[data-act="nbwheel"]')) return;
    m.dragging = true; m.pointer = e.pointerId; m.sx = e.clientY; m.so = m.offset;
    m.dragStartEl = e.target.closest('.esc-nbwheel-item') || null; // 记录起点是否落在轮盘项上
    m.wrap.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    const m = nbwheel;
    if (!m || !m.dragging || e.pointerId !== m.pointer) return;
    m.offset = m.so + (e.clientY - m.sx) * 0.5; // 上下滑动旋转
    wheelRender(m);
    e.preventDefault();
  });
  function wheelPointerEnd(e) {
    const m = nbwheel;
    if (!m || !m.dragging || (m.pointer != null && e.pointerId !== m.pointer)) return;
    m.dragging = false; m.pointer = null;
    m.wrap.classList.remove('dragging');
    // 点按（几乎无位移）落在可见项上 → 视为「选择该生词本」。
    // 不依赖 click 事件：pointerdown 的 preventDefault 会在触屏上吞掉 click，改用 pointerup 判断最稳妥。
    const item = m.dragStartEl;
    m.dragStartEl = null;
    if (item && Math.abs(e.clientY - m.sx) < 8) {
      if (item.classList.contains('visible')) { toggleWheelItem(item, item.dataset.id); return; }
    }
    wheelSnap(m);
  }
  document.addEventListener('pointerup', wheelPointerEnd);
  document.addEventListener('pointercancel', wheelPointerEnd);
  document.addEventListener('wheel', (e) => {
    const m = nbwheel;
    if (!m || !m.active) return;
    e.preventDefault();
    m.offset += (e.deltaY > 0 ? 1 : -1) * 6;
    wheelRender(m);
    clearTimeout(m.wheelTimer);
    m.wheelTimer = setTimeout(() => wheelSnap(m), 150);
  }, { passive: false });

  // ---------------- 练习弹层 ----------------
  let overlay = null;
  let session = null;

  // ---------------- 陀螺仪（跟随手机晃动） ----------------
  let gyroActive = false, gyroTried = false;
  let gyroTargetX = 0, gyroTargetY = 0, gyroX = 0, gyroY = 0, gyroRaf = null;

  function gyroLoop() {
    gyroX += (gyroTargetX - gyroX) * 0.14; // 平滑
    gyroY += (gyroTargetY - gyroY) * 0.14;
    if (overlay) {
      const c = overlay.querySelector('#magicCard');
      if (c) c.style.transform = `perspective(1200px) rotateX(${gyroX}deg) rotateY(${gyroY}deg)`;
    }
    gyroRaf = requestAnimationFrame(gyroLoop);
  }
  function onDeviceOrientation(e) {
    if (e.gamma == null || e.beta == null) return;
    // gamma: 左右倾斜 → rotateY；beta: 前后倾斜 → rotateX
    let gy = Math.max(-24, Math.min(24, e.gamma));
    let gx = Math.max(-24, Math.min(24, -e.beta));
    gyroTargetY = gy; gyroTargetX = gx;
  }
  function startGyro() {
    if (gyroActive) return;
    gyroActive = true;
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    if (!gyroRaf) gyroRaf = requestAnimationFrame(gyroLoop);
  }
  function stopGyro() {
    if (!gyroActive) return;
    gyroActive = false;
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
    if (gyroRaf) { cancelAnimationFrame(gyroRaf); gyroRaf = null; }
  }
  function enableGyro() {
    if (gyroTried) return;
    gyroTried = true;
    if (window.DeviceOrientationEvent == null) return;
    // iOS 需要用户手势授权
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      window.DeviceOrientationEvent.requestPermission()
        .then((p) => { if (p === 'granted') startGyro(); })
        .catch(() => {});
    } else {
      startGyro();
    }
  }

  function closeOverlay() {
    if (!overlay) return;
    // 模式清理：回顾计时/speech / 生词检验计时与事件，防止关闭后残留
    reviewCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    reviewCleanups.length = 0;
    quizCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    quizCleanups.length = 0;
    clozeCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    clozeCleanups.length = 0;
    sentCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    sentCleanups.length = 0;
    stopGyro();
    const el = overlay;
    overlay = null; session = null;
    el.style.transition = 'opacity .2s ease';
    el.style.opacity = '0';
    const done = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 260);
  }

  function openExercise(mode) {
    const isArticle = ARTICLE_MODES.some((m) => m.key === mode);
    const ctx = { articleId: selectedArticleId };
    let queue = [];

    if (WORD_MODES.some((m) => m.key === mode)) {
      queue = buildWordQueue();
      if (!queue.length) { UI.toast('暂无可练习单词，先去深度解析收藏生词'); return; }
    } else if (mode === 'cloze') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      // 全文语境填空：整篇文章由 renderArticleCloze 自行分段落渲染与结算
      session = { mode, ctx, queue: [item], idx: 0, correct: 0, total: 0, graded: false };
      openOverlay();
      step();
      return;
    } else if (mode === 'sentence') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      // 逐句精读：整篇文章由 renderArticleSentence 自行管理逐句导航
      session = { mode, ctx, queue: [item], idx: 0, correct: 0, total: 0, graded: false };
      openOverlay();
      step();
      return;
    } else if (mode === 'review') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      session = { mode, ctx, queue: [item], idx: 0, correct: 0, total: 0, graded: false };
      openOverlay();
      step();
      return;
    } else if (mode === 'vocabQuiz') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      // 生词检验：整篇文章挖空 + 词库拖拽选词（对齐网页端），全屏渲染
      session = { mode, ctx, queue: [item], idx: 0, correct: 0, total: 0, graded: true };
      openOverlay();
      step();
      return;
    } else {
      return;
    }

    session = { mode, ctx, queue, idx: 0, correct: 0, total: 0, graded: true };
    openOverlay();
    step();
  }

  function openOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'esc-overlay esc-overlay-fill';
    overlay.innerHTML = `
      <div class="esc-overlay-head">
        <button class="esc-icon-btn" data-act="close" aria-label="关闭">${icon('x')}</button>
        <span class="esc-overlay-title">${esc(modeName(session.mode))}</span>
        <span class="esc-row-right" data-role="counter"></span>
      </div>
      <div class="esc-overlay-body" data-role="body"></div>`;
    document.querySelector('.esc-app').appendChild(overlay);
    overlay.querySelector('[data-act="close"]').addEventListener('click', closeOverlay);
    UI.refreshIcons(overlay);
  }

  function modeName(m) {
    const x = WORD_MODES.concat(ARTICLE_MODES).find((o) => o.key === m);
    return x ? x.name : '练习';
  }

  function step() {
    if (!session) return;
    const body = overlay.querySelector('[data-role="body"]');
    const counter = overlay.querySelector('[data-role="counter"]');
    if (session.mode !== 'review' && session.mode !== 'cloze' && session.mode !== 'sentence' && session.mode !== 'vocabQuiz') {
      counter.textContent = `${session.idx + 1} / ${session.queue.length}`;
    } else {
      counter.textContent = '';
    }
    const item = session.queue[session.idx];

    if (session.mode === 'flashcard') return renderFlash(body, item);
    if (session.mode === 'fill') return renderCloze(body, { example: item.example, word: item.word });
    if (session.mode === 'spelling') return renderDictation(body, item);
    if (session.mode === 'choice') return renderChoice(body, item);
    if (session.mode === 'cloze') return renderArticleCloze(body, item);
    if (session.mode === 'sentence') return renderArticleSentence(body, item);
    if (session.mode === 'review') return renderArticleReview(body, item);
    if (session.mode === 'vocabQuiz') return renderVocabQuiz(body, item);
  }

  function next() {
    session.idx++;
    if (session.idx >= session.queue.length) return finish();
    step();
  }

  function finish() {
    const body = overlay.querySelector('[data-role="body"]');
    if (session.graded) {
      const acc = session.total ? Math.round((session.correct / session.total) * 100) : 0;
      const p = Store.getProgress();
      // 对齐桌面端 StatsTracker 语义：计数器累加，不覆盖
      Store.recordWordsLearned(session.total);
      Store.recordWordsMastered(session.correct);
      Store.recordModuleActivity(MODULE_MAP[session.mode] || session.mode, session.total);
      Store.updateProgress({
        correctRate: acc || p.correctRate,
        reviewDue: Math.max(0, p.reviewDue - session.correct)
      });
      // 闪卡：展示评级分布（已掌握/模糊/不认识），对齐网页版本轮总结
      const lv = session.levels || {};
      const lvMeta = [
        ['已掌握', lv.known || 0, 'var(--study-success)'],
        ['模糊', lv.vague || 0, 'var(--study-warning)'],
        ['不认识', lv.unknown || 0, 'var(--study-error)']
      ];
      const lvHTML = session.mode === 'flashcard'
        ? `<div style="display:flex;gap:10px;justify-content:center;margin-top:14px;width:100%;max-width:280px">
            ${lvMeta.map(([label, val, color]) => `<div style="flex:1;text-align:center;padding:8px 4px;border-radius:12px;background:color-mix(in srgb,${color} 12%,transparent)">
              <div style="font-size:22px;font-weight:700;color:${color};line-height:1.1">${val}</div>
              <div style="font-size:12px;color:var(--study-text-dim);margin-top:4px">${label}</div>
            </div>`).join('')}
          </div>`
        : '';
      body.innerHTML = `
        <div class="esc-empty" style="padding:28px 4px">
          ${session.mode === 'flashcard' ? icon('award', 'esc-ico') : icon('check-circle', 'esc-ico')}
          <p class="esc-empty-title" style="margin-top:16px">本轮完成！</p>
          <p class="esc-empty-desc">答对 ${session.correct} / ${session.total}（正确率 ${acc}%）</p>
          ${lvHTML}
          <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;width:100%;max-width:260px">
            <button class="esc-btn esc-btn-block" data-act="again" style="flex:1">再练一轮</button>
            <button class="esc-btn esc-btn-primary esc-btn-block" data-act="done" style="flex:1">完成</button>
          </div>
        </div>`;
    } else {
      body.innerHTML = `
        <div class="esc-empty" style="padding:32px 0">
          ${icon('check-circle', 'esc-ico')}
          <p class="esc-empty-title" style="margin-top:16px">本轮完成！</p>
          <button class="esc-btn esc-btn-primary esc-btn-block" style="margin-top:20px;max-width:240px" data-act="done">完成</button>
        </div>`;
    }
    // 文章类（只读）模式：记一次模块活动，便于桌面端统计（graded 模式已在上方记过）
    if (!session.graded) {
      Store.recordModuleActivity(MODULE_MAP[session.mode] || session.mode, 1);
    }
    UI.refreshIcons(body);
    body.querySelector('[data-act="done"]').addEventListener('click', closeOverlay);
    // 再练一轮：关闭当前覆盖层后用同一模式重新开始（自动重新洗牌队列）
    body.querySelector('[data-act="again"]')?.addEventListener('click', () => {
      const mode = session.mode;
      closeOverlay();
      openExercise(mode);
    });
  }

  // 闪卡：网页版 3D 卡片风格（光晕 + 倾斜 + 评级），适配移动端主题
  const FC_STAR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
  const FC_EYE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"></line></svg>`;
  const FC_EYE_OFF = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const FC_CHEV_L = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
  const FC_CHEV_R = `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const FC_MASTERY = {
    unknown: `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>`,
    vague: `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle><line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line></svg>`,
    known: `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"></circle><polyline points="8 12 11 15 16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`
  };
  const FC_RATE_LABEL = { unknown: '不认识', vague: '模糊', known: '已掌握' };

  function renderFlash(body, w) {
    const total = session.queue.length;
    const idx = session.idx;
    const pct = total ? (((idx + 1) / total) * 100).toFixed(2) : 0;
    // 例句兼容两种形状：字符串（移动端 context）或 { en, zh }（网页版）
    const ex = (w.example && typeof w.example === 'object') ? w.example
      : (w.example ? { en: w.example, zh: '' } : { en: '', zh: '' });

    body.innerHTML = `
      <div class="esc-fc">
        <div class="fc-top">
          <div class="fill-progress-track"><div class="fill-progress-fill" id="progressBar" style="width:${pct}%"></div></div>
          <button class="fc-tool" id="flashcardGenExampleBtn" title="生成例句">${FC_STAR}</button>
          <button class="fc-tool" id="flashcardToggleTransBtn" title="隐藏/显示翻译">${FC_EYE}</button>
        </div>
        <div class="card-3d" id="magicCard">
          <div class="glare" id="glareLayer"></div>
          <div class="card-face card-front">
            <div class="word-section" id="wordSection">
              <span class="word" id="currentWord">${esc(w.word)}</span>
              ${w.phonetic ? `<span class="phon" id="currentPhon">/${esc(w.phonetic)}/</span>` : ''}
              <span class="pos" id="currentPos">${esc(w.pos || '')}</span>
              <span class="meaning" id="currentMeaning">${esc(w.meaning || '')}</span>
            </div>
            <div class="example-area" id="exampleArea">
              <div class="example-en" id="exampleEn">${ex.en ? esc(ex.en) : '点击顶部星星生成例句'}</div>
              <div class="example-zh" id="exampleZh">${ex.zh ? esc(ex.zh) : ''}</div>
            </div>
          </div>
          <div class="card-face card-back" id="cardBack"></div>
          <div class="feedback-overlay" id="feedbackOverlay" style="display:none">
            <div class="feedback-content">
              <div class="feedback-icon" id="feedbackIcon"></div>
              <div class="feedback-text" id="feedbackText"></div>
              <div class="feedback-detail" id="feedbackDetail"></div>
            </div>
          </div>
        </div>
        <div class="nav-buttons">
          <button class="nav-btn" id="prevBtn">${FC_CHEV_L}<span>上一个</span></button>
          <span class="counter" id="counter">${idx + 1} / ${total}</span>
          <button class="nav-btn" id="nextBtn"><span>下一个</span>${FC_CHEV_R}</button>
        </div>
        <div class="mastery-ratings" id="masteryRatings">
          ${['unknown', 'vague', 'known'].map((r) => `
            <button class="mastery-btn ${r}" data-rating="${r}">${FC_MASTERY[r]}<span>${FC_RATE_LABEL[r]}</span></button>`).join('')}
        </div>
      </div>`;

    // 3D 倾斜 + 光晕：有陀螺仪跟随手机晃动，否则用指针/鼠标
    const card = body.querySelector('#magicCard');
    const glare = body.querySelector('#glareLayer');
    enableGyro();
    if (!gyroActive) {
      let tX = 0, tY = 0;
      const applyTilt = () => { card.style.transform = `perspective(1200px) rotateX(${tX}deg) rotateY(${tY}deg)`; };
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        tY = (x - 0.5) * 14; tX = (y - 0.5) * -14;
        applyTilt();
        const gX = x * 100, gY = y * 100;
        glare.style.background = `radial-gradient(circle at ${gX}% ${gY}%, rgba(255,255,255,0.6) 0%, transparent 70%)`;
        glare.style.opacity = '0.9';
      });
      card.addEventListener('pointerleave', () => { tX = 0; tY = 0; applyTilt(); glare.style.opacity = '0'; });
      applyTilt();
    }

    // 导航：上/下一个（浏览不计数）
    const goPrev = () => { if (session.idx > 0) { session.idx--; step(); } };
    const goNext = () => { if (session.idx < session.queue.length - 1) { session.idx++; step(); } };
    body.querySelector('#prevBtn').addEventListener('click', goPrev);
    body.querySelector('#nextBtn').addEventListener('click', goNext);

    // 例句生成：无例句时调用 AI 生成并回写生词本（复用 Store.updateWord + api.generateExample）
    const exEn = body.querySelector('#exampleEn');
    const exZh = body.querySelector('#exampleZh');
    const genBtn = body.querySelector('#flashcardGenExampleBtn');
    genBtn.addEventListener('click', async () => {
      if (genBtn.dataset.busy) return;
      // 已有例句：直接展示
      if (ex.en) {
        exEn.textContent = ex.en;
        if (ex.zh) exZh.textContent = ex.zh;
        return;
      }
      if (!Mobile.API.hasKey()) { UI.toast('请先在设置中配置 API Key'); return; }
      genBtn.dataset.busy = '1';
      genBtn.innerHTML = icon('loader') + '';
      body.querySelector('#flashcardGenExampleBtn svg')?.classList.add('is-spin');
      exEn.textContent = '生成例句中…';
      const r = await Mobile.API.generateExample(w.word, w.meaning || w.meaning || w.zh || '');
      delete genBtn.dataset.busy;
      genBtn.innerHTML = FC_STAR;
      if (r && r.en) {
        ex.en = String(r.en).trim();
        ex.zh = String(r.zh || '').trim();
        exEn.textContent = ex.en;
        exZh.textContent = ex.zh;
        if (w.id) Store.updateWord(w.id, { context: ex.en, contextZh: ex.zh });
      } else {
        exEn.textContent = '例句生成失败，点星星重试';
        UI.toast('例句生成失败，请稍后重试');
      }
    });

    // 隐藏/显示翻译（切换示例区中文 + 图标）
    const toggleTransBtn = body.querySelector('#flashcardToggleTransBtn');
    const exampleArea = body.querySelector('#exampleArea');
    let hideZh = false;
    toggleTransBtn.addEventListener('click', () => {
      hideZh = !hideZh;
      exampleArea.classList.toggle('hide-zh', hideZh);
      toggleTransBtn.innerHTML = hideZh ? FC_EYE_OFF : FC_EYE;
      toggleTransBtn.setAttribute('title', hideZh ? '显示翻译' : '隐藏/显示翻译');
    });

    // 评级：计数 + 即时反馈 + 自动前进
    const fbOverlay = body.querySelector('#feedbackOverlay');
    const fbIcon = body.querySelector('#feedbackIcon');
    const fbText = body.querySelector('#feedbackText');
    const fbDetail = body.querySelector('#feedbackDetail');
    let _advanceLock = false;
    body.querySelectorAll('.mastery-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (_advanceLock) return;
        _advanceLock = true;
        const rating = btn.getAttribute('data-rating');
        session.total++;
        if (rating === 'known') session.correct++;
        // 累计评级分布（用于结束总结卡分项展示，对齐网页版）
        (session.levels = session.levels || { known: 0, vague: 0, unknown: 0 })[rating]++;
        // 即时反馈
        const map = {
          known: ['✓', '已掌握', 'var(--study-success)'],
          vague: ['?', '模糊', 'var(--study-warning)'],
          unknown: ['✗', '不认识', 'var(--study-error)']
        }[rating];
        fbIcon.textContent = map[0];
        fbIcon.style.color = map[2];
        fbText.textContent = map[1];
        fbText.style.color = map[2];
        const exStr = ex.en ? ` — ${ex.en}` : '';
        fbDetail.textContent = `${w.word}${w.pos ? ' ' + w.pos : ''} ${w.meaning || ''}${exStr}`;
        fbOverlay.style.display = 'flex';
        fbOverlay.style.animation = 'none'; void fbOverlay.offsetWidth; fbOverlay.style.animation = '';
        setTimeout(() => {
          fbOverlay.style.display = 'none';
          next();
        }, 500);
      });
    });
  }

  // 选词：选词填空卡（网页版 choice-card 结构，统一到 --study 主题）
  const CHOICE_VOL_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  // 选词练习：整合 5 个子模式（释义选词/听音选词/选词填空/看词选义/听音选义），对齐网页版
  // 子模式状态挂在 session.choiceMode，切换时对当前词重新渲染、不推进进度
  const CHOICE_SUBMODES = [
    ['meaning', 'book', '释义选词'],
    ['listen', 'volume-2', '听音选词'],
    ['fillblank', 'align-left', '选词填空'],
    ['wordzh', 'eye', '看词选义'],
    ['listenzh', 'ear', '听音选义']
  ];

  function renderChoice(body, w) {
    const sub = (session.choiceMode = session.choiceMode || 'meaning');
    const word = String(w.word || '');
    const meaning = w.meaning || w.mean || '(无释义)';
    const phon = w.phonetic ? `/${esc(w.phonetic)}/` : '';
    const poolAll = Store.getVocab().length ? Store.getVocab() : FALLBACK;
    const pct = session.queue.length ? (((session.idx + 1) / session.queue.length) * 100).toFixed(1) : 0;

    // 装配题目：「提示区 HTML + 正确文本 + 候选池」
    let promptHtml, correct, optPool;
    const isZhOpt = sub === 'wordzh' || sub === 'listenzh'; // 候选是中文释义
    if (isZhOpt) {
      correct = meaning;
      optPool = poolAll.map((x) => x.meaning || x.mean).filter(Boolean);
      promptHtml = sub === 'wordzh'
        ? `<span class="choice-mode-tag">看单词，选中文释义</span><span class="choice-word" data-role="word">${esc(word)}</span>${phon ? `<div class="choice-phon">${phon}</div>` : ''}`
        : `<span class="choice-mode-tag">听发音，选中文释义</span>`;
    } else {
      correct = word;
      optPool = poolAll.map((x) => String(x.word || '')).filter((x) => x && x.toLowerCase() !== word.toLowerCase());
      if (sub === 'fillblank') {
        const exTxt = (w.example && typeof w.example === 'object') ? (w.example.en || '') : (w.example || '');
        const sentenceHtml = exTxt
          ? esc(exTxt.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '␀')).split('␀').join('<span class="fill-blank">______</span>')
          : '';
        promptHtml = sentenceHtml
          ? `<span class="choice-mode-tag">选择单词，完成句子</span><div class="choice-sentence">${sentenceHtml}</div>`
          : `<span class="choice-mode-tag">选词填空</span><div class="choice-meaning">${esc(meaning)}</div>`;
      } else if (sub === 'listen') {
        promptHtml = `<span class="choice-mode-tag">听发音，选正确单词</span>`;
      } else {
        promptHtml = `<span class="choice-mode-tag">看释义，选英文单词</span><div class="choice-meaning">${esc(meaning)}</div>`;
      }
    }
    // 去重后取 4 个候选（大小写无关比对）
    const opts = shuffle([correct, ...pickRandom(optPool, correct, 3)])
      .filter((v, i, a) => a.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase()) === i)
      .slice(0, 4);
    const playable = sub === 'listen' || sub === 'listenzh';

    body.innerHTML = `
      <div class="esc-fill" data-mode="choice">
        <div class="fill-top">
          <div class="fill-progress-track"><div class="fill-progress-fill" data-role="progress" style="width:${pct}%"></div></div>
          <div class="esc-fill-progress-num"><span data-role="idx">${session.idx + 1}</span>/<span data-role="total">${session.queue.length}</span></div>
        </div>
        <div class="esc-submode-bar" data-role="submode">
          ${CHOICE_SUBMODES.map(([m, ico, label]) => `<button class="esc-submode-btn${m === sub ? ' active' : ''}" data-m="${m}">${icon(ico)}<span>${label}</span></button>`).join('')}
        </div>
        <div class="fill-card" data-role="card">
          <div class="choice-prompt">
            ${promptHtml}
            <button class="sq-play-btn" data-act="play" title="播放发音">${CHOICE_VOL_SVG}</button>
          </div>
          <div class="fill-letter-hint" data-role="hint"></div>
          <div class="choice-option-grid" data-role="opts">
            ${opts.map((o) => `<button class="choice-opt" data-correct="${String(o).toLowerCase() === String(correct).toLowerCase() ? '1' : '0'}">${esc(o)}</button>`).join('')}
          </div>
          <div class="fill-result" data-role="result"></div>
        </div>
        <div class="fill-bottom">
          <button class="fill-hint-btn" data-act="hint" title="显示首字母提示">${FILL_HINT_SVG}</button>
          <button class="fill-skip-btn" data-act="skip" title="跳过">${FILL_SKIP_SVG}</button>
        </div>
      </div>`;
    UI.refreshIcons(body);

    const card = body.querySelector('[data-role="card"]');
    const resultEl = body.querySelector('[data-role="result"]');
    const hintEl = body.querySelector('[data-role="hint"]');
    const hintBtn = body.querySelector('[data-act="hint"]');
    const wordEl = body.querySelector('[data-role="word"]');
    let answered = false, hintUsed = false;

    // 子模式切换条：切模式对当前词重渲染
    body.querySelectorAll('.esc-submode-btn').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = b.dataset.m;
        if (m === sub || answered) return;
        session.choiceMode = m;
        renderChoice(body, w);
      });
    });

    const speakCur = () => Speech.speak(word);
    body.querySelector('[data-act="play"]').addEventListener('click', (e) => { e.stopPropagation(); speakCur(); });
    if (playable) setTimeout(speakCur, 260);

    body.querySelectorAll('.choice-opt').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (answered || b.disabled) return;
        answered = true;
        session.total++;
        const ok = b.dataset.correct === '1';
        if (ok) session.correct++;
        b.classList.add(ok ? 'is-correct' : 'is-wrong');
        b.classList.add('picked');
        if (!ok) body.querySelector('.choice-opt[data-correct="1"]').classList.add('is-correct');
        body.querySelectorAll('.choice-opt').forEach((x) => (x.disabled = true));
        card.classList.add(ok ? 'fill-card-correct' : 'fill-card-wrong');
        resultEl.innerHTML = ok
          ? '<span class="fill-correct">✓ 回答正确！</span>'
          : '<span class="fill-wrong">✗ 正确答案已标出</span>';
        resultEl.className = 'fill-result ' + (ok ? 'fill-result-correct' : 'fill-result-wrong');
        setTimeout(next, ok ? 800 : 1200);
      });
    });

    const hint = () => {
      if (answered || hintUsed || sub === 'listenzh') return; // 听音选义无可提示首字母
      hintUsed = true;
      const first = word.charAt(0) || '_';
      const rest = word.length > 1 ? '·'.repeat(word.length - 1) : '';
      if (wordEl) wordEl.innerHTML = `${esc(first)}<span class="choice-mask">${esc(rest)}</span>`;
      hintEl.innerHTML = `<span class="fill-letter-box revealed">${esc(first)}</span><span class="fill-letter-box">${esc('_'.repeat(Math.max(word.length - 1, 1)))}</span>`;
      hintEl.classList.add('show');
      hintBtn.disabled = true;
    };
    body.querySelector('[data-act="hint"]').addEventListener('click', (e) => { e.stopPropagation(); hint(); });
    body.querySelector('[data-act="skip"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (answered) return;
      answered = true;
      session.total++;
      resultEl.innerHTML = '<span class="fill-skip">已跳过</span>';
      resultEl.className = 'fill-result fill-result-skip';
      setTimeout(next, 500);
    });
  }

  // 填空：例句/文章句挖空 → 网页版 fill-card 字母格（适配移动端主题）
  const FILL_HINT_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1010 10"></path><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="8" x2="12" y2="10"></line><line x1="12" y1="14" x2="12" y2="16"></line><line x1="8" y1="12" x2="10" y2="12"></line><line x1="14" y1="12" x2="16" y2="12"></line></svg>`;
  const FILL_SKIP_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>`;

  // 字母格输入（填空/听写/语境填空共用）：每个格子一个真实 <input>，
  // 兼容手机虚拟键盘 input 事件；点格聚焦、只输入当前格、
  // 删除当前格字母后回退上一格、后续字母不自动前移。
  // onEnter：按回车；onComplete：最后一个字母填完；onBackspaceFirst：在首格按删除（供跨单词跳转）
  function setupLetterGrid(grid, length, onEnter, onComplete, onBackspaceFirst) {
    const slots = new Array(length).fill('');
    const boxes = [], inputs = [];
    let active = 0;

    function render() {
      boxes.forEach((box, i) => {
        const inp = inputs[i];
        if (document.activeElement !== inp) inp.value = slots[i] || '';
        box.classList.toggle('filled', !!slots[i]);
        box.classList.toggle('active-slot', i === active);
      });
    }

    function focusAt(i) {
      if (i < 0 || i >= length) { render(); return; }
      active = i;
      render();
      inputs[i].focus();
    }

    function normalize(v) {
      return String(v)
        .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[^a-zA-Z]/g, '')
        .toLowerCase();
    }

    grid.innerHTML = '';
    for (let i = 0; i < length; i++) {
      const box = document.createElement('span');
      box.className = 'letter-box';
      box.dataset.index = i;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'letter-input';
      inp.maxLength = 1;
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.dataset.index = i;
      box.appendChild(inp);
      boxes.push(box);
      inputs.push(inp);

      inp.addEventListener('focus', () => { active = i; render(); });
      inp.addEventListener('click', (e) => e.stopPropagation());

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onEnter && onEnter(); return; }
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (slots[i]) slots[i] = '';
          if (i > 0) { focusAt(i - 1); }
          else {
            render();
            if (typeof onBackspaceFirst === 'function') onBackspaceFirst();
          }
          return;
        }
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (i > 0) focusAt(i - 1); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); if (i < length - 1) focusAt(i + 1); return; }
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
          e.preventDefault();
          slots[i] = normalize(e.key);
          inp.value = slots[i];
          render();
          if (i < length - 1) focusAt(i + 1);
          else { onComplete && onComplete(); }
        }
      });

      // 手机虚拟键盘 / IME 回退：input 事件读取输入框值
      inp.addEventListener('input', () => {
        let val = normalize(inp.value);
        if (val.length > 1) val = val.slice(-1);
        inp.value = val;
        const wasFilled = !!slots[i];
        slots[i] = val;
        if (val && i < length - 1) {
          focusAt(i + 1);
        } else if (!val && wasFilled && i > 0) {
          // 移动端删除键常只触发 input 事件（不触发 keydown）：清空后回退上一格
          focusAt(i - 1);
        } else if (!val && wasFilled && i === 0) {
          render();
          if (typeof onBackspaceFirst === 'function') onBackspaceFirst();
        } else {
          render();
          if (val && i === length - 1) onComplete && onComplete();
        }
      });

      box.addEventListener('click', (e) => { e.stopPropagation(); inp.focus(); });
      grid.appendChild(box);
    }
    render();

    return {
      slots, inputs, boxes, render, focusAt,
      setSlot(i, ch) { if (i >= 0 && i < length) { slots[i] = ch; render(); } },
      focus() { if (inputs[active]) inputs[active].focus(); else if (inputs[0]) inputs[0].focus(); }
    };
  }

  function renderCloze(body, w) {
    const word = String(w.word || '').toLowerCase();
    const meaning = w.meaning || w.mean || '(无释义)';
    const exTxt = (w.example && typeof w.example === 'object') ? (w.example.en || '') : (w.example || '');
    const sentenceHtml = exTxt
      ? esc(exTxt.replace(new RegExp(word, 'i'), '␀')).split('␀').join('<span class="fill-blank">______</span>')
      : '<span class="fill-no-sentence">（无例句）</span>';
    const pct = session.queue.length ? (((session.idx + 1) / session.queue.length) * 100).toFixed(1) : 0;

    body.innerHTML = `
      <div class="esc-fill" data-mode="fill">
        <div class="fill-top">
          <div class="fill-progress-track"><div class="fill-progress-fill" data-role="progress" style="width:${pct}%"></div></div>
        </div>
        <div class="fill-card" data-role="card">
          <div class="fill-meaning">${esc(meaning)}</div>
          <div class="fill-sentence">${sentenceHtml}</div>
          <div class="fill-letter-hint" data-role="hint"></div>
          <div class="fill-letter-grid" data-role="grid"></div>
          <button class="fill-check-btn" data-act="check">${icon('check')}<span>检查</span></button>
          <div class="fill-result" data-role="result"></div>
        </div>
        <div class="fill-bottom">
          <button class="fill-hint-btn" data-act="hint" title="逐字母提示">${FILL_HINT_SVG}</button>
          <button class="fill-skip-btn" data-act="skip" title="跳过">${FILL_SKIP_SVG}</button>
        </div>
      </div>`;
    UI.refreshIcons(body);

    const card = body.querySelector('[data-role="card"]');
    const grid = body.querySelector('[data-role="grid"]');
    const hintEl = body.querySelector('[data-role="hint"]');
    const resultEl = body.querySelector('[data-role="result"]');
    const checkBtn = body.querySelector('[data-act="check"]');
    const hintBtn = body.querySelector('[data-act="hint"]');

    let checked = false;
    const revealed = new Set();
    let gridApi = null;

    const submit = () => {
      if (checked) return; checked = true;
      const ok = gridApi.slots.join('') === word;
      session.total++;
      if (ok) session.correct++;
      resultEl.innerHTML = ok
        ? '<span class="fill-correct">✓ 正确！</span>'
        : `<span class="fill-wrong">✗ 正确答案：<strong>${esc(word)}</strong></span>`;
      resultEl.className = 'fill-result ' + (ok ? 'fill-result-correct' : 'fill-result-wrong');
      card.classList.toggle('fill-card-correct', ok);
      card.classList.toggle('fill-card-wrong', !ok);
      checkBtn.disabled = true;
      gridApi.inputs.forEach((inp) => { inp.disabled = true; });
      if (ok) {
        gridApi.boxes.forEach((b, i) => setTimeout(() => b.classList.add('correct'), i * 30));
        setTimeout(next, 900);
      } else {
        // 错字按位标注 + 展示正确答案
        gridApi.slots.forEach((ch, i) => {
          setTimeout(() => {
            const box = gridApi.boxes[i], inp = gridApi.inputs[i];
            if (ch && ch === word[i]) box.classList.add('correct');
            else { box.classList.add('wrong'); if (inp) inp.value = word[i]; }
          }, i * 40);
        });
        setTimeout(next, 1500);
      }
    };

    gridApi = setupLetterGrid(grid, word.length, submit);

    function renderHint() {
      if (revealed.size === 0) { hintEl.classList.remove('show'); hintEl.innerHTML = ''; return; }
      hintEl.innerHTML = word.split('').map((ch, i) =>
        `<span class="fill-letter-box${revealed.has(i) ? ' revealed' : ''}">${revealed.has(i) ? esc(ch) : '_'}</span>`).join('');
      hintEl.classList.add('show');
      hintBtn.disabled = revealed.size >= word.length;
    }

    const hint = () => {
      if (checked || revealed.size >= word.length) return;
      const round = revealed.size;
      let pos = round % 2 === 0 ? Math.floor(round / 2) : word.length - 1 - Math.floor(round / 2);
      if (pos < 0 || pos >= word.length || revealed.has(pos)) {
        for (let i = 0; i < word.length; i++) if (!revealed.has(i)) { pos = i; break; }
      }
      revealed.add(pos);
      gridApi.setSlot(pos, word[pos]);
      const box = gridApi.boxes[pos];
      if (box) {
        box.style.transition = 'none';
        box.style.transform = 'scale(.3) rotateX(90deg)';
        box.style.opacity = '0';
        requestAnimationFrame(() => {
          box.style.transition = 'all .35s cubic-bezier(.34,1.56,.64,1)';
          box.style.transform = '';
          box.style.opacity = '';
        });
      }
      renderHint();
      gridApi.focusAt(pos);
    };

    const skip = () => {
      if (checked) return; checked = true;
      session.total++;
      resultEl.innerHTML = '<span class="fill-skip">已跳过</span>';
      resultEl.className = 'fill-result fill-result-skip';
      checkBtn.disabled = true;
      setTimeout(next, 500);
    };

    checkBtn.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    hintBtn.addEventListener('click', (e) => { e.stopPropagation(); hint(); });
    body.querySelector('[data-act="skip"]').addEventListener('click', (e) => { e.stopPropagation(); skip(); });
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      gridApi.focus();
    });

    gridApi.focus();
  }

  // 听写：听音拼写字母格（网页版 spell-card 结构，统一到 --study 主题）
  function renderDictation(body, w) {
    const word = String(w.word || '').toLowerCase();
    const meaning = w.meaning || w.mean || '';
    const pct = session.queue.length ? (((session.idx + 1) / session.queue.length) * 100).toFixed(1) : 0;

    body.innerHTML = `
      <div class="esc-fill" data-mode="dictation">
        <div class="fill-top">
          <div class="fill-progress-track"><div class="fill-progress-fill" data-role="progress" style="width:${pct}%"></div></div>
        </div>
        <div class="fill-card" data-role="card">
          <button class="sq-play-btn" data-act="play" title="播放发音">${CHOICE_VOL_SVG}</button>
          <p class="spell-prompt">听发音，拼写单词</p>
          ${meaning ? `<p class="spell-sub">${esc(meaning)}</p>` : ''}
          <div class="fill-letter-hint" data-role="hint"></div>
          <div class="fill-letter-grid" data-role="grid"></div>
          <button class="fill-check-btn" data-act="check">${icon('check')}<span>检查</span></button>
          <div class="fill-result" data-role="result"></div>
        </div>
        <div class="fill-bottom">
          <button class="fill-hint-btn" data-act="hint" title="逐字母提示">${FILL_HINT_SVG}</button>
          <button class="fill-skip-btn" data-act="skip" title="跳过">${FILL_SKIP_SVG}</button>
        </div>
      </div>`;
    UI.refreshIcons(body);

    const card = body.querySelector('[data-role="card"]');
    const grid = body.querySelector('[data-role="grid"]');
    const hintEl = body.querySelector('[data-role="hint"]');
    const resultEl = body.querySelector('[data-role="result"]');
    const checkBtn = body.querySelector('[data-act="check"]');
    const hintBtn = body.querySelector('[data-act="hint"]');

    let checked = false;
    const revealed = new Set();
    let gridApi = null;

    const submit = () => {
      if (checked) return; checked = true;
      const ok = gridApi.slots.join('') === word;
      session.total++;
      if (ok) session.correct++;
      resultEl.innerHTML = ok
        ? '<span class="fill-correct">✓ 正确！</span>'
        : `<span class="fill-wrong">✗ 正确答案：<strong>${esc(word)}</strong></span>`;
      resultEl.className = 'fill-result ' + (ok ? 'fill-result-correct' : 'fill-result-wrong');
      card.classList.toggle('fill-card-correct', ok);
      card.classList.toggle('fill-card-wrong', !ok);
      checkBtn.disabled = true;
      gridApi.inputs.forEach((inp) => { inp.disabled = true; });
      if (ok) {
        gridApi.boxes.forEach((b, i) => setTimeout(() => b.classList.add('correct'), i * 30));
        setTimeout(next, 900);
      } else {
        gridApi.slots.forEach((ch, i) => {
          setTimeout(() => {
            const box = gridApi.boxes[i], inp = gridApi.inputs[i];
            if (ch && ch === word[i]) box.classList.add('correct');
            else { box.classList.add('wrong'); if (inp) inp.value = word[i]; }
          }, i * 40);
        });
        setTimeout(next, 1500);
      }
    };

    gridApi = setupLetterGrid(grid, word.length, submit);

    function renderHint() {
      if (revealed.size === 0) { hintEl.classList.remove('show'); hintEl.innerHTML = ''; return; }
      hintEl.innerHTML = word.split('').map((ch, i) =>
        `<span class="fill-letter-box${revealed.has(i) ? ' revealed' : ''}">${revealed.has(i) ? esc(ch) : '_'}</span>`).join('');
      hintEl.classList.add('show');
      hintBtn.disabled = revealed.size >= word.length;
    }

    const hint = () => {
      if (checked || revealed.size >= word.length) return;
      const round = revealed.size;
      let pos = round % 2 === 0 ? Math.floor(round / 2) : word.length - 1 - Math.floor(round / 2);
      if (pos < 0 || pos >= word.length || revealed.has(pos)) {
        for (let i = 0; i < word.length; i++) if (!revealed.has(i)) { pos = i; break; }
      }
      revealed.add(pos);
      gridApi.setSlot(pos, word[pos]);
      const box = gridApi.boxes[pos];
      if (box) {
        box.style.transition = 'none';
        box.style.transform = 'scale(.3) rotateX(90deg)';
        box.style.opacity = '0';
        requestAnimationFrame(() => {
          box.style.transition = 'all .35s cubic-bezier(.34,1.56,.64,1)';
          box.style.transform = '';
          box.style.opacity = '';
        });
      }
      renderHint();
      gridApi.focusAt(pos);
    };

    checkBtn.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    hintBtn.addEventListener('click', (e) => { e.stopPropagation(); hint(); });
    body.querySelector('[data-act="skip"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (checked) return; checked = true;
      session.total++;
      resultEl.innerHTML = '<span class="fill-skip">已跳过</span>';
      resultEl.className = 'fill-result fill-result-skip';
      checkBtn.disabled = true;
      setTimeout(next, 500);
    });
    body.querySelector('[data-act="play"]').addEventListener('click', (e) => { e.stopPropagation(); Speech.speak(w.word || word); });

    Speech.speak(w.word || word);
    gridApi.focus();
  }

  /* ==================================================================
     语境填空 · 全文（对齐网页端 cloze_mode_ui）
     整篇文章挖空 → 段落分组 → 逐段渲染：每个生词一个字母格输入，
     支持 检查/提示/显示答案/朗读/句首翻译气泡/连击计分/结算。
     ================================================================== */
  const CLOZE_ICONS = {
    back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    star: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>',
    bulb: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6"></path><path d="M12 17v4"></path><path d="M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.5 1 2.5h6c0-1 .5-2 1-2.5A6 6 0 0 0 12 3z"></path></svg>',
    eye: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    speak: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
    prev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    next: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    trans: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6M7 3v2M5 5c0 4-1 6-3 8M5 9c2 2 4 3 5 4M13 13l4-9 4 9M14.5 10h5M17 16v5M15 21h4"></path></svg>'
  };

  function renderArticleCloze(body, item) {
    // 重启时清理上一轮残留
    clozeCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    clozeCleanups.length = 0;

    // 生词图：当前选中生词本（词形还原后命中），对齐网页端
    const vocabMap = {};
    getSelectedVocab().forEach((w) => {
      const key = String(w.word || '').toLowerCase().trim();
      if (key) vocabMap[key] = w.meaning || '';
    });

    const articleText = item.originalText || item.text || '';
    const tokens = [];
    const re = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
    let mm;
    while ((mm = re.exec(articleText)) !== null) {
      if (mm[1]) tokens.push({ type: 'word', value: mm[1], index: mm.index });
      else tokens.push({ type: 'nonword', value: mm[2] });
    }
    // 全文章唯一命中（按词形去重），对齐网页端 clozeItems
    const clozeItems = [];
    const seenLemmas = new Set();
    tokens.forEach((token) => {
      if (token.type !== 'word') return;
      const lower = token.value.toLowerCase();
      const lemma = quizLemmatize(lower, vocabMap);
      const matchedKey = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
      if (matchedKey && !seenLemmas.has(matchedKey)) {
        seenLemmas.add(matchedKey);
        clozeItems.push({ word: token.value, lemma: matchedKey, meaning: vocabMap[matchedKey], index: token.index });
      }
    });
    if (clozeItems.length === 0) { UI.toast('该文章中没有找到生词本中的单词'); closeOverlay(); return; }

    overlay && overlay.classList.add('esc-overlay-cloze');
    body.className = '';

    // 句子分析索引：en(trim 后) -> 翻译，供句首翻译气泡查找
    const sentArr = (item.result && Array.isArray(item.result.sentences)) ? item.result.sentences : [];
    const sd = item.sentenceData || {};
    function findSentenceTranslation(sentenceText) {
      const key = String(sentenceText || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!key) return '';
      for (let i = 0; i < sentArr.length; i++) {
        const st = sentArr[i];
        if (!st) continue;
        const en = String(st.en || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!en) continue;
        if (en === key || key.indexOf(en) === 0 || en.indexOf(key) === 0) {
          return (st.zh || st.translation || '') || (sd[i] && (sd[i].translation || sd[i].zh || '')) || '';
        }
      }
      return '';
    }

    // ---- 段落分组 ----
    const paragraphs = articleText.split(/\n\n+/).filter((p) => p.trim().length > 0);
    let paraStart = 0;
    const paragraphBounds = paragraphs.map((p) => {
      const start = paraStart;
      const end = paraStart + p.length;
      paraStart = end + 2;
      return { start, end, text: p };
    });
    const paragraphGroups = [];
    const paraGroupMap = new Map();
    clozeItems.forEach((it) => {
      const pi = paragraphBounds.findIndex((b) => it.index >= b.start && it.index < b.end);
      if (pi < 0) return;
      if (!paraGroupMap.has(pi)) {
        paraGroupMap.set(pi, { paragraphIndex: pi, text: paragraphs[pi], items: [], bounds: paragraphBounds[pi] });
        paragraphGroups.push(paraGroupMap.get(pi));
      }
      paraGroupMap.get(pi).items.push(it);
    });
    paragraphGroups.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
    let currentParagraphIdx = 0;

    // ---- 状态 ----
    let clozeScore = 0, clozeStreakCount = 0, clozeMaxStreak = 0, clozeWrongCount = 0, clozeSkippedCount = 0, clozeChecked = false;
    const wordStates = new Map(); // lowerWord -> correct|revealed|incorrect
    let clozeInputItems = []; // {item, wrapper, grid, gridApi, boxes}
    let transBubble = null;

    function closeTransBubble() {
      if (transBubble) { transBubble.remove(); transBubble = null; }
    }
    function speakSentence(text, grid) {
      if (grid) grid.classList.add('speaking');
      if (typeof Speech.speak === 'function') {
        Speech.speak(text, { rate: 0.85 });
        setTimeout(() => { if (grid) grid.classList.remove('speaking'); }, 1400);
      }
    }
    function getComboBonus(streak) {
      if (streak >= 20) return 10;
      if (streak >= 10) return 5;
      if (streak >= 5) return 3;
      if (streak >= 3) return 2;
      return 0;
    }
    function updateScore() {
      const el = document.getElementById('clozeScoreNum');
      if (el) el.textContent = clozeScore;
      const badge = document.getElementById('clozeScoreBadge');
      if (badge) {
        badge.classList.remove('score-pop');
        void badge.offsetWidth;
        badge.classList.add('score-pop');
      }
    }
    function updateStreak() {
      const sEl = document.getElementById('clozeStreak');
      if (!sEl) return;
      if (clozeStreakCount >= 10) { sEl.textContent = '🔥 超级连击 ' + clozeStreakCount + ' 次！'; sEl.className = 'cloze-streak streak-10'; }
      else if (clozeStreakCount >= 5) { sEl.textContent = '🔥 连击 ' + clozeStreakCount + ' 次！'; sEl.className = 'cloze-streak streak-5'; }
      else if (clozeStreakCount >= 3) { sEl.textContent = '⚡ ' + clozeStreakCount + ' 连对'; sEl.className = 'cloze-streak streak-3'; }
      else { sEl.textContent = ''; sEl.className = 'cloze-streak'; }
    }
    function updateProgress() {
      let completed = 0;
      clozeItems.forEach((it) => {
        const st = wordStates.get(it.word.toLowerCase());
        if (st === 'correct' || st === 'revealed') completed++;
      });
      const fillEl = document.getElementById('clozeProgressFill');
      const idxEl = document.getElementById('clozeProgressText');
      const pct = clozeItems.length ? (completed / clozeItems.length * 100) : 0;
      if (fillEl) fillEl.style.width = pct + '%';
      if (idxEl) idxEl.textContent = '已攻克 ' + completed + ' / ' + clozeItems.length;
      if (completed === clozeItems.length && clozeItems.length > 0) setTimeout(() => showSummary(), 420);
    }

    // ---- 检查 / 重置 / 显示答案 ----
    function doCheck() {
      if (clozeChecked) { doReset(); return; }
      let correct = 0, wrong = 0, newlySolved = 0, gainedScore = 0;
      clozeInputItems.forEach((it) => {
        const { item, wrapper, gridApi } = it;
        if (wrapper.classList.contains('correct') || wrapper.classList.contains('revealed')) return;
        const answer = (wrapper.dataset.answer || '').toLowerCase();
        const lemma = wrapper.dataset.lemma || '';
        const userAnswer = gridApi.slots.join('');
        wrapper.classList.remove('correct', 'incorrect');
        const boxes = gridApi.boxes, inputs = gridApi.inputs;
        boxes.forEach((box, idx) => {
          box.classList.remove('correct', 'wrong', 'revealed');
          if (idx < answer.length && idx < userAnswer.length && userAnswer[idx] === answer[idx]) {
            box.classList.add('correct');
            if (inputs[idx]) inputs[idx].value = answer[idx];
          } else if (idx < userAnswer.length) {
            box.classList.add('wrong');
          }
        });
        const ok = !!userAnswer && (userAnswer === answer || userAnswer === lemma.toLowerCase() || quizLemmatize(userAnswer, vocabMap) === lemma);
        if (ok) {
          wrapper.classList.add('correct');
          wordStates.set(item.word.toLowerCase(), 'correct');
          boxes.forEach((box, idx) => {
            box.classList.remove('wrong');
            box.classList.add('correct');
            if (inputs[idx]) { inputs[idx].value = answer[idx]; inputs[idx].disabled = true; }
          });
          correct++; newlySolved++;
          clozeStreakCount++;
          if (clozeStreakCount > clozeMaxStreak) clozeMaxStreak = clozeStreakCount;
          gainedScore += 10 + getComboBonus(clozeStreakCount);
        } else {
          wrapper.classList.add('incorrect');
          wordStates.set(item.word.toLowerCase(), 'incorrect');
          clozeWrongCount++; wrong++;
          clozeStreakCount = 0;
          boxes.forEach((box, idx) => {
            box.classList.add('revealed');
            box.classList.remove('wrong');
            if (inputs[idx]) { inputs[idx].value = answer[idx]; inputs[idx].disabled = true; }
          });
          const ca = document.createElement('span');
          ca.className = 'cloze-correct-answer';
          ca.textContent = wrapper.dataset.answer;
          wrapper.appendChild(ca);
        }
      });
      clozeScore += gainedScore;
      updateScore(); updateStreak(); updateProgress();
      const resultEl = document.getElementById('clozePracticeResult');
      if (resultEl) {
        if (newlySolved > 0 && wrong === 0) {
          resultEl.innerHTML = '<span class="cloze-correct">✓ 正确 ' + correct + (gainedScore > 0 ? ' · +' + gainedScore + '分' : '') + '</span>';
          resultEl.className = 'cloze-result cloze-result-correct';
          const card = body.querySelector('.cloze-card');
          if (card) { card.classList.add('cloze-card-correct'); setTimeout(() => card.classList.remove('cloze-card-correct'), 600); }
        } else if (newlySolved === 0 && wrong === 0) {
          resultEl.innerHTML = '<span class="cloze-skip">没有需要检查的填空</span>';
          resultEl.className = 'cloze-result cloze-result-skip';
        } else {
          resultEl.innerHTML = '<span class="cloze-wrong">✗ 正确 ' + correct + ' · 错误 ' + wrong + '</span>';
          resultEl.className = 'cloze-result cloze-result-wrong';
          const card = body.querySelector('.cloze-card');
          if (card) { card.classList.add('cloze-card-wrong'); setTimeout(() => card.classList.remove('cloze-card-wrong'), 600); }
        }
      }
      if (wrong > 0) {
        clozeChecked = true;
        const cb = document.getElementById('clozeCheckBtn');
        if (cb) { cb.innerHTML = CLOZE_ICONS.refresh; cb.dataset.mode = 'reset'; cb.title = '重新尝试'; }
      }
    }

    function doReset() {
      clozeInputItems.forEach((it) => {
        const { item, wrapper, gridApi } = it;
        if (wrapper.classList.contains('correct') || wrapper.classList.contains('revealed')) return;
        wrapper.classList.remove('correct', 'incorrect');
        wordStates.delete(item.word.toLowerCase());
        const ca = wrapper.querySelector('.cloze-correct-answer');
        if (ca) ca.remove();
        gridApi.boxes.forEach((box, idx) => {
          box.classList.remove('correct', 'wrong', 'revealed', 'filled');
          if (gridApi.inputs[idx]) { gridApi.inputs[idx].value = ''; gridApi.inputs[idx].disabled = false; }
        });
        gridApi.render();
      });
      const resultEl = document.getElementById('clozePracticeResult');
      if (resultEl) { resultEl.innerHTML = ''; resultEl.className = 'cloze-result'; }
      clozeChecked = false;
      const cb = document.getElementById('clozeCheckBtn');
      if (cb) { cb.innerHTML = CLOZE_ICONS.check; delete cb.dataset.mode; cb.title = '检查答案'; }
      const firstUnsolved = clozeInputItems.find((it) => !it.wrapper.classList.contains('correct') && !it.wrapper.classList.contains('revealed'));
      if (firstUnsolved) firstUnsolved.gridApi.focus();
    }

    function doReveal() {
      let revealed = 0;
      clozeInputItems.forEach((it) => {
        const { item, wrapper, gridApi } = it;
        if (wrapper.classList.contains('correct') || wrapper.classList.contains('revealed')) return;
        const answer = item.word.toLowerCase();
        wrapper.classList.remove('incorrect');
        wrapper.classList.add('revealed');
        wordStates.set(item.word.toLowerCase(), 'revealed');
        const ca = wrapper.querySelector('.cloze-correct-answer');
        if (ca) ca.remove();
        gridApi.boxes.forEach((box, idx) => {
          box.classList.add('revealed');
          box.classList.remove('wrong');
          if (gridApi.inputs[idx]) { gridApi.inputs[idx].value = answer[idx]; gridApi.inputs[idx].disabled = true; }
        });
        revealed++;
        clozeSkippedCount++;
        clozeScore = Math.max(0, clozeScore - 5);
      });
      clozeStreakCount = 0;
      updateScore(); updateStreak(); updateProgress();
      const resultEl = document.getElementById('clozePracticeResult');
      if (resultEl) {
        if (revealed > 0) {
          resultEl.innerHTML = '<span class="cloze-skip">已显示 ' + revealed + ' 个答案 · -' + (revealed * 5) + '分</span>';
          resultEl.className = 'cloze-result cloze-result-skip';
        } else {
          resultEl.innerHTML = '<span class="cloze-skip">没有可显示的答案</span>';
          resultEl.className = 'cloze-result cloze-result-skip';
        }
      }
    }

    // ---- 句首翻译气泡 ----
    function showTranslation(btn, sentenceText) {
      if (transBubble) { closeTransBubble(); return; }
      const translation = findSentenceTranslation(sentenceText);
      if (!translation) { UI.toast('暂无翻译'); return; }
      const b = document.createElement('div');
      b.className = 'cloze-trans-bubble';
      b.textContent = translation;
      document.body.appendChild(b);
      transBubble = b;
      requestAnimationFrame(() => {
        const btnRect = btn.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        let top = btnRect.top - bRect.height - 8;
        let left = Math.max(8, Math.min(btnRect.left, window.innerWidth - bRect.width - 8));
        if (top < 8) { top = btnRect.bottom + 8; b.classList.add('below'); }
        b.style.top = top + 'px';
        b.style.left = left + 'px';
        b.classList.add('visible');
      });
      setTimeout(() => {
        const handler = (e) => {
          if (!b.contains(e.target)) { closeTransBubble(); document.removeEventListener('click', handler); }
        };
        document.addEventListener('click', handler);
      }, 10);
    }

    // ---- 渲染当前段落 ----
    function renderCurrentParagraph() {
      const contentEl = document.getElementById('clozeContent');
      if (!contentEl) return;
      contentEl.innerHTML = '';
      clozeInputItems = [];
      const indicator = document.getElementById('clozeParaIndicator');
      const prevBtn = document.getElementById('clozePrevBtn');
      const nextBtn = document.getElementById('clozeNextBtn');
      if (paragraphGroups.length === 0) {
        if (indicator) indicator.textContent = '没有可练习的段落';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
      }
      if (currentParagraphIdx < 0) currentParagraphIdx = 0;
      if (currentParagraphIdx >= paragraphGroups.length) currentParagraphIdx = paragraphGroups.length - 1;
      const group = paragraphGroups[currentParagraphIdx];
      if (indicator) indicator.textContent = '段落 ' + (currentParagraphIdx + 1) + ' / ' + paragraphGroups.length;
      if (prevBtn) prevBtn.disabled = currentParagraphIdx === 0;
      if (nextBtn) nextBtn.disabled = currentParagraphIdx >= paragraphGroups.length - 1;

      const paraText = group.text || '';
      const items = group.items.slice().sort((a, b) => a.index - b.index);
      const paraStart = group.bounds.start;

      // 段落按句分割
      const sentParts = [];
      const sentRe = /[^.!?]*[.!?]+/g;
      let lastIdx = 0, sm;
      while ((sm = sentRe.exec(paraText)) !== null) {
        sentParts.push({ text: sm[0], start: sm.index, end: sm.index + sm[0].length });
        lastIdx = sm.index + sm[0].length;
      }
      const rest = paraText.slice(lastIdx).trim();
      if (rest) sentParts.push({ text: rest, start: lastIdx, end: paraText.length });
      if (!sentParts.length && paraText.length) sentParts.push({ text: paraText, start: 0, end: paraText.length });

      const localIdxByItem = new Map();
      let gi = 0;

      sentParts.forEach((sentence) => {
        const sentItems = items.filter((it) => {
          const ls = it.index - paraStart;
          return ls >= sentence.start && ls < sentence.end;
        });
        // 句首翻译按钮
        const transBtn = document.createElement('button');
        transBtn.type = 'button';
        transBtn.className = 'cloze-sent-trans-btn';
        transBtn.title = '查看翻译';
        transBtn.innerHTML = CLOZE_ICONS.trans;
        transBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showTranslation(transBtn, sentence.text);
        });
        contentEl.appendChild(transBtn);

        let cursor = paraStart + sentence.start;
        sentItems.forEach((item) => {
          const localStart = item.index - paraStart;
          const localEnd = localStart + item.word.length;
          if (localStart > cursor - paraStart) {
            const before = paraText.substring(cursor - paraStart, localStart);
            if (before) {
              const span = document.createElement('span');
              span.className = 'cloze-text';
              span.textContent = before;
              contentEl.appendChild(span);
            }
          }
          // 字母格
          const wrapper = document.createElement('span');
          wrapper.className = 'cloze-input-wrapper';
          wrapper.dataset.answer = item.word;
          wrapper.dataset.lemma = item.lemma;
          wrapper.dataset.meaning = item.meaning;
          const prevState = wordStates.get(item.word.toLowerCase());
          if (prevState === 'correct') wrapper.classList.add('correct');
          else if (prevState === 'revealed') wrapper.classList.add('revealed');
          else if (prevState === 'incorrect') wrapper.classList.add('incorrect');

          const grid = document.createElement('span');
          grid.className = 'cloze-letter-grid';
          const wordUpper = item.word.toLowerCase();
          const gridApi = setupLetterGrid(grid, wordUpper.length, () => doCheck(), () => {
            const next = clozeInputItems[gi + 1];
            if (next) next.gridApi.focus();
          }, () => {
            const prev = clozeInputItems[gi - 1];
            if (prev) prev.gridApi.focusAt(prev.gridApi.slots.length - 1);
          });
          // 已完成状态回填
          if (prevState === 'correct' || prevState === 'revealed') {
            gridApi.slots.forEach((_, idx) => { gridApi.slots[idx] = wordUpper[idx]; });
            gridApi.boxes.forEach((box, idx) => {
              box.classList.add(prevState === 'correct' ? 'correct' : 'revealed');
              if (gridApi.inputs[idx]) { gridApi.inputs[idx].value = wordUpper[idx]; gridApi.inputs[idx].disabled = true; }
            });
            gridApi.render();
          }
          // 点击字母格：朗读该单词
          grid.addEventListener('click', (e) => {
            e.stopPropagation();
            speakSentence(item.word, grid);
          });
          wrapper.appendChild(grid);
          contentEl.appendChild(wrapper);
          localIdxByItem.set(item, gi);
          clozeInputItems.push({ item, wrapper, grid, gridApi, boxes: gridApi.boxes });
          gi++;
          cursor = paraStart + localEnd;
        });
        // 句尾剩余文本
        const tailStart = cursor - paraStart;
        if (tailStart < sentence.end) {
          const tail = paraText.substring(tailStart, sentence.end);
          if (tail) {
            const span = document.createElement('span');
            span.className = 'cloze-text';
            span.textContent = tail;
            contentEl.appendChild(span);
          }
        }
        // 句末朗读按钮
        const speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'cloze-sent-speak-btn';
        speakBtn.title = '朗读本句';
        speakBtn.innerHTML = CLOZE_ICONS.speak;
        speakBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          speakSentence(sentence.text);
        });
        contentEl.appendChild(speakBtn);
        // 句间分割线
        if (sentence !== sentParts[sentParts.length - 1]) {
          const divider = document.createElement('div');
          divider.className = 'cloze-sentence-divider';
          contentEl.appendChild(divider);
        }
      });

      // 默认聚焦第一个未完成单词
      setTimeout(() => {
        const firstUnsolved = clozeInputItems.find((it) => !it.wrapper.classList.contains('correct') && !it.wrapper.classList.contains('revealed'));
        if (firstUnsolved) firstUnsolved.gridApi.focus();
      }, 60);
    }

    function onSwitchParagraph() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      closeTransBubble();
      clozeChecked = false;
      const cb = document.getElementById('clozeCheckBtn');
      if (cb) { cb.innerHTML = CLOZE_ICONS.check; delete cb.dataset.mode; cb.title = '检查答案'; }
      const resultEl = document.getElementById('clozePracticeResult');
      if (resultEl) { resultEl.innerHTML = ''; resultEl.className = 'cloze-result'; }
      const sEl = document.getElementById('clozeStreak');
      if (sEl) { sEl.textContent = ''; sEl.className = 'cloze-streak'; }
      renderCurrentParagraph();
    }

    // ---- 结算 ----
    function showSummary() {
      if (body.querySelector('.cloze-summary')) return;
      closeTransBubble();
      const bottomEl = body.querySelector('.cloze-bottom-nav');
      if (bottomEl) bottomEl.style.display = 'none';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      const total = clozeItems.length;
      let correctCount = 0, skippedCount = 0;
      clozeItems.forEach((it) => {
        const st = wordStates.get(it.word.toLowerCase());
        if (st === 'correct') correctCount++;
        else if (st === 'revealed') skippedCount++;
      });
      const wrongAttempts = clozeWrongCount;
      const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      const isPerfect = wrongAttempts === 0 && skippedCount === 0;
      if (isPerfect) clozeScore += 20;

      Store.recordWordsLearned(correctCount);
      Store.recordWordsMastered(correctCount);
      Store.recordModuleActivity(MODULE_MAP.cloze || 'cloze', correctCount);
      const p = Store.getProgress();
      Store.updateProgress({ correctRate: rate || p.correctRate });

      let titleText = '太棒了，完成啦！', titleClass = '';
      if (isPerfect) { titleText = '完美通关！'; titleClass = 'perfect'; }
      else if (rate >= 90) titleText = '非常出色！';
      else if (rate >= 70) titleText = '做得不错！';
      else if (rate >= 50) titleText = '继续加油！';

      const card = body.querySelector('.cloze-card');
      if (card) {
        card.innerHTML = `
          <div class="cloze-summary">
            <div class="cloze-summary-icon">${CLOZE_ICONS.star}</div>
            <div class="cloze-summary-title ${titleClass}">${esc(titleText)}</div>
            <div class="cloze-summary-stats">
              <div class="cloze-summary-stat"><span class="cloze-summary-val correct">${correctCount}</span><span class="cloze-summary-lbl">正确</span></div>
              <div class="cloze-summary-stat"><span class="cloze-summary-val wrong">${wrongAttempts}</span><span class="cloze-summary-lbl">错误尝试</span></div>
              <div class="cloze-summary-stat"><span class="cloze-summary-val rate">${rate}%</span><span class="cloze-summary-lbl">正确率</span></div>
              <div class="cloze-summary-stat"><span class="cloze-summary-val streak">${clozeMaxStreak}</span><span class="cloze-summary-lbl">最大连击</span></div>
              ${skippedCount > 0 ? `<div class="cloze-summary-stat"><span class="cloze-summary-val skip">${skippedCount}</span><span class="cloze-summary-lbl">显示答案</span></div>` : ''}
              <div class="cloze-summary-stat"><span class="cloze-summary-val score">${clozeScore}</span><span class="cloze-summary-lbl">得分</span></div>
            </div>
            ${isPerfect ? '<div class="cloze-perfect-badge">完美通关！零错误零跳过，奖励 +20 分</div>' : ''}
            <div class="cloze-summary-actions">
              <button class="cloze-summary-restart" data-act="retry">再来一轮</button>
              <button class="cloze-summary-back" data-act="done">返回</button>
            </div>
          </div>`;
        card.querySelector('[data-act="retry"]').addEventListener('click', (e) => {
          e.stopPropagation();
          renderArticleCloze(body, item);
        });
        card.querySelector('[data-act="done"]').addEventListener('click', (e) => {
          e.stopPropagation();
          closeOverlay();
        });
      }
    }

    // ---- 骨架 ----
    body.innerHTML = `
      <div class="cloze-container">
        <div class="cloze-header">
          <button class="cloze-back-btn" data-act="close" title="返回">${CLOZE_ICONS.back}</button>
          <h3>语境填空 · ${clozeItems.length} 个生词</h3>
          <span class="cloze-score-badge" id="clozeScoreBadge">${CLOZE_ICONS.star}<span id="clozeScoreNum">0</span></span>
        </div>
        <div class="cloze-top-bar">
          <div class="cloze-progress-track"><div class="cloze-progress-fill" id="clozeProgressFill" style="width:0%"></div></div>
          <span class="cloze-para-indicator" id="clozeParaIndicator"></span>
          <span class="cloze-progress-text" id="clozeProgressText">已攻克 0 / ${clozeItems.length}</span>
        </div>
        <div class="cloze-card">
          <div class="cloze-main"><div class="cloze-content" id="clozeContent"></div></div>
          <div class="cloze-feedback">
            <div class="cloze-streak" id="clozeStreak"></div>
            <div class="cloze-result" id="clozePracticeResult"></div>
          </div>
          <div class="cloze-bottom-nav">
            <button class="cloze-nav-btn" id="clozePrevBtn" title="上一段">${CLOZE_ICONS.prev}</button>
            <div class="cloze-tool-group">
              <button class="cloze-tool-btn cloze-check-btn" id="clozeCheckBtn" title="检查答案">${CLOZE_ICONS.check}</button>
              <button class="cloze-tool-btn cloze-hint-btn" id="clozeHintBtn" title="提示（显示首字母）">${CLOZE_ICONS.bulb}</button>
              <button class="cloze-tool-btn cloze-reveal-btn" id="clozeRevealBtn" title="显示答案">${CLOZE_ICONS.eye}</button>
              <button class="cloze-tool-btn cloze-speak-btn" id="clozeSpeakBtn" title="朗读当前段落">${CLOZE_ICONS.speak}</button>
            </div>
            <button class="cloze-nav-btn" id="clozeNextBtn" title="下一段">${CLOZE_ICONS.next}</button>
          </div>
        </div>
      </div>`;

    body.querySelector('[data-act="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      closeTransBubble();
      closeOverlay();
    });

    const checkBtn = body.querySelector('#clozeCheckBtn');
    checkBtn.addEventListener('click', (e) => { e.stopPropagation(); if (checkBtn.dataset.mode === 'reset') doReset(); else doCheck(); });
    body.querySelector('#clozeHintBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const unsolved = clozeInputItems.find((it) => !it.wrapper.classList.contains('correct') && !it.wrapper.classList.contains('revealed'));
      if (!unsolved) { UI.toast('没有可提示的填空'); return; }
      const gridApi = unsolved.gridApi;
      const word = unsolved.item.word.toLowerCase();
      const firstIdx = gridApi.slots.findIndex((ch) => !ch);
      const idx = firstIdx >= 0 ? firstIdx : 0;
      gridApi.setSlot(idx, word[idx]);
      const box = gridApi.boxes[idx];
      if (box) {
        box.style.transition = 'none';
        box.style.transform = 'scale(.3) rotateX(90deg)';
        box.style.opacity = '0';
        requestAnimationFrame(() => {
          box.style.transition = 'all .35s cubic-bezier(.34,1.56,.64,1)';
          box.style.transform = '';
          box.style.opacity = '';
        });
      }
      gridApi.focusAt(idx);
      clozeScore = Math.max(0, clozeScore - 3);
      updateScore();
    });
    body.querySelector('#clozeRevealBtn').addEventListener('click', (e) => { e.stopPropagation(); doReveal(); });
    body.querySelector('#clozeSpeakBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (paragraphGroups.length > 0) speakSentence(paragraphGroups[currentParagraphIdx].text);
    });
    body.querySelector('#clozePrevBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentParagraphIdx > 0) { currentParagraphIdx--; onSwitchParagraph(); }
    });
    body.querySelector('#clozeNextBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentParagraphIdx < paragraphGroups.length - 1) { currentParagraphIdx++; onSwitchParagraph(); }
    });

    renderCurrentParagraph();
    updateScore();
    updateProgress();
    setTimeout(() => { if (clozeInputItems[0]) clozeInputItems[0].gridApi.focus(); }, 120);
  }

  /* ==================================================================
     逐句精读（对齐网页端 article_review_ui 的 showSentenceReviewInterface）
     逐句展示 + 词级高亮（点击看释义）/ 收藏 / 朗读高亮 /
     翻译·知识点·语法三页签 + 补拉 / 生词句列表 / 结算
     ================================================================== */
  const SENT_ICONS = {
    back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    speak: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
    bookmark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    next: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    list: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
  };

  function renderArticleSentence(body, item) {
    // 重启时清理上一轮残留
    sentCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    sentCleanups.length = 0;

    const articleId = item.id;
    // 句子数组：优先用已解析的句子对象，否则本地分句
    let sentArr = (item.result && Array.isArray(item.result.sentences)) ? item.result.sentences : [];
    if (!sentArr.length) {
      sentArr = (Shared.splitSentences ? Shared.splitSentences(item.text || '') : []).map((en) => ({ en }));
    }
    const sentences = sentArr.map((s, i) => (typeof s === 'string' ? { en: s } : s)).filter((s) => s && s.en);
    if (sentences.length === 0) { UI.toast('该文章没有解析句子数据'); closeOverlay(); return; }

    overlay && overlay.classList.add('esc-overlay-sent');
    body.className = '';

    const sd = item.sentenceData || {};
    const vocabMap = {};
    getSelectedVocab().forEach((w) => {
      const key = String(w.word || '').toLowerCase().trim();
      if (key) vocabMap[key] = w.meaning || '';
    });

    // 收藏状态（按句子索引，对齐网页端 localStorage）
    const FAV_KEY = 'sentFavorites_' + articleId;
    function getSentFavorites() {
      try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { return new Set(); }
    }
    function saveSentFavorites(set) {
      try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* ignore */ }
    }

    const ANALYSIS_TABS = [
      { key: 'translation', label: '翻译' },
      { key: 'knowledge', label: '知识点' },
      { key: 'syntax', label: '语法' }
    ];

    let currentIndex = 0;
    let currentTtsToken = 0;
    const readSentencesSet = new Set();
    const touchedVocabSet = new Set();
    let sentVocabPanelOpen = false;
    let transBubble = null;

    function closeTransBubble() {
      if (transBubble) { transBubble.remove(); transBubble = null; }
    }
    function showWordBubble(meaning, element) {
      closeTransBubble();
      const b = document.createElement('div');
      b.className = 'sent-word-bubble';
      b.textContent = meaning;
      document.body.appendChild(b);
      transBubble = b;
      requestAnimationFrame(() => {
        const r = element.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        let top = r.bottom + 8;
        let left = r.left + (r.width / 2) - (br.width / 2);
        if (left < 8) left = 8;
        if (left + br.width > window.innerWidth - 8) left = window.innerWidth - br.width - 8;
        b.style.top = top + 'px';
        b.style.left = left + 'px';
        b.classList.add('visible');
      });
      setTimeout(() => {
        const handler = (e) => {
          if (!b.contains(e.target) && e.target !== element) { closeTransBubble(); document.removeEventListener('click', handler); }
        };
        document.addEventListener('click', handler);
      }, 10);
    }

    // 词级高亮：生词可点击看释义；记录 charOffset 供朗读高亮
    function buildSentHighlightedText(text) {
      const frag = document.createDocumentFragment();
      const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
      let m;
      let wordIdx = 0, charOffset = 0;
      while ((m = regex.exec(text)) !== null) {
        if (m[1]) {
          const word = m[1];
          const lower = word.toLowerCase();
          const span = document.createElement('span');
          span.className = 'sent-word';
          span.dataset.idx = wordIdx;
          span.dataset.offset = charOffset;
          span.textContent = word;
          if (vocabMap[lower]) {
            span.classList.add('review-vocab-word');
            span.dataset.meaning = vocabMap[lower];
            span.addEventListener('click', (e) => {
              e.stopPropagation();
              showWordBubble(span.dataset.meaning, span);
            });
          }
          frag.appendChild(span);
          wordIdx++;
          charOffset += word.length;
        } else if (m[2]) {
          frag.appendChild(document.createTextNode(m[2]));
          charOffset += m[2].length;
        }
      }
      return frag;
    }

    function collectSentenceVocab(idx) {
      const text = sentences[idx].en || '';
      const regex = /([a-zA-Z'-]+)/g;
      let m;
      while ((m = regex.exec(text)) !== null) {
        const lower = m[1].toLowerCase();
        if (vocabMap[lower]) touchedVocabSet.add(lower);
      }
    }

    // 分析数据：句子对象自带字段 + sentenceData 覆盖（补拉持久化）
    function getAnalysis(idx) {
      const base = sentences[idx] || {};
      const extra = sd[idx] || {};
      return {
        translation: base.zh || base.translation || extra.translation || extra.zh || '',
        knowledge: base.knowledge || extra.knowledge || '',
        syntax: base.syntax || extra.syntax || null,
        words: base.words || extra.words || []
      };
    }
    function syntaxSummary(syntax) {
      if (!syntax || typeof syntax !== 'object') return '';
      const parts = [];
      if (syntax.structure) parts.push('结构：' + syntax.structure);
      if (syntax.function) parts.push('功能：' + syntax.function);
      if (syntax.pattern) parts.push('句型：' + syntax.pattern);
      if (syntax.syntax) parts.push(syntax.syntax);
      if (Array.isArray(syntax.constituents) && syntax.constituents.length) {
        parts.push(syntax.constituents.map((c) => (c.name ? c.name + '：' + c.text : c.text)).join('；'));
      }
      return parts.join('\n');
    }

    function ensureAnalysisTabs(analysisEl) {
      if (analysisEl.querySelector('.sentence-analysis-tabs')) return;
      analysisEl.innerHTML = '';
      const tabsBar = document.createElement('div');
      tabsBar.className = 'sentence-analysis-tabs';
      ANALYSIS_TABS.forEach((t, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sentence-tab-btn' + (i === 0 ? ' active' : '');
        btn.dataset.tab = t.key;
        btn.textContent = t.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          analysisEl.querySelectorAll('.sentence-tab-btn').forEach((b) => b.classList.remove('active'));
          analysisEl.querySelectorAll('.sentence-tab-content').forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
          const content = analysisEl.querySelector('.sentence-tab-content[data-tab="' + t.key + '"]');
          if (content) content.classList.add('active');
        });
        tabsBar.appendChild(btn);
      });
      const refreshBtn = document.createElement('button');
      refreshBtn.type = 'button';
      refreshBtn.className = 'sentence-tab-btn tab-refresh';
      refreshBtn.title = '重新分析当前句子';
      refreshBtn.innerHTML = SENT_ICONS.refresh;
      refreshBtn.addEventListener('click', (e) => { e.stopPropagation(); fetchSentenceAnalysis(currentIndex); });
      tabsBar.appendChild(refreshBtn);
      const contentsWrap = document.createElement('div');
      contentsWrap.className = 'sentence-tab-contents';
      ANALYSIS_TABS.forEach((t, i) => {
        const content = document.createElement('div');
        content.className = 'sentence-tab-content' + (i === 0 ? ' active' : '');
        content.dataset.tab = t.key;
        contentsWrap.appendChild(content);
      });
      analysisEl.appendChild(tabsBar);
      analysisEl.appendChild(contentsWrap);
    }
    function setTabContent(analysisEl, key, html, isEmpty) {
      const content = analysisEl.querySelector('.sentence-tab-content[data-tab="' + key + '"]');
      if (!content) return;
      content.innerHTML = '';
      if (isEmpty || !html) {
        const empty = document.createElement('div');
        empty.className = 'sentence-analysis-empty';
        empty.textContent = isEmpty ? html : '暂无';
        content.appendChild(empty);
        return;
      }
      const value = document.createElement('div');
      value.className = 'analysis-value';
      value.innerHTML = html;
      content.appendChild(value);
    }

    async function fetchSentenceAnalysis(idx) {
      const analysisEl = document.getElementById('sentenceReviewAnalysis');
      if (!analysisEl) return;
      const en = sentences[idx] && sentences[idx].en;
      if (!en) return;
      const loading = '<span class="analysis-loading">AI 分析中...</span>';
      setTabContent(analysisEl, 'translation', loading);
      setTabContent(analysisEl, 'knowledge', loading);
      setTabContent(analysisEl, 'syntax', loading);
      try {
        if (!Mobile.API || typeof Mobile.API.refetch !== 'function') throw new Error('no api');
        const [tRes, kRes, sRes] = await Promise.all([
          Mobile.API.refetch(en, 'translation'),
          Mobile.API.refetch(en, 'knowledge'),
          Mobile.API.refetch(en, 'syntax')
        ]);
        const merged = {
          translation: (tRes && (tRes.zh || tRes.translation)) || '',
          knowledge: (kRes && kRes.knowledge) || '',
          syntax: (kRes && kRes.syntax) || (sRes && sRes.syntax) || null
        };
        sd[idx] = Object.assign({}, sd[idx], merged);
        if (Store.updateSentenceData) Store.updateSentenceData(articleId, idx, merged);
        if (currentIndex === idx && analysisEl) {
          setTabContent(analysisEl, 'translation', merged.translation || '');
          setTabContent(analysisEl, 'knowledge', merged.knowledge || '');
          setTabContent(analysisEl, 'syntax', merged.syntax ? esc(syntaxSummary(merged.syntax)).replace(/\n/g, '<br>') : '');
        }
      } catch (e) {
        console.warn('[逐句精读] 分析失败:', e);
        if (currentIndex === idx && analysisEl) {
          setTabContent(analysisEl, 'translation', '分析失败，请重试', true);
          setTabContent(analysisEl, 'knowledge', '');
          setTabContent(analysisEl, 'syntax', '');
        }
      }
    }

    // 朗读当前句：逐词高亮（onboundary）
    function speakCurrentSentence() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const token = ++currentTtsToken;
        const sentenceTextEl = document.getElementById('sentenceReviewText');
        if (sentenceTextEl) sentenceTextEl.querySelectorAll('.sent-word-active').forEach((w) => w.classList.remove('sent-word-active'));
        const utterance = new SpeechSynthesisUtterance(sentences[currentIndex].en);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        utterance.onboundary = (ev) => {
          if (token !== currentTtsToken || !sentenceTextEl) return;
          const charIndex = ev.charIndex || 0;
          const wordEls = sentenceTextEl.querySelectorAll('.sent-word');
          if (!wordEls.length) return;
          let target = null;
          wordEls.forEach((w) => {
            const offset = parseInt(w.dataset.offset, 10);
            const len = (w.textContent || '').length;
            if (offset <= charIndex && charIndex < offset + len) target = w;
          });
          if (!target) {
            for (const w of wordEls) { if (parseInt(w.dataset.offset, 10) >= charIndex) { target = w; break; } }
          }
          if (target) {
            wordEls.forEach((w) => w.classList.remove('sent-word-active'));
            target.classList.add('sent-word-active');
          }
        };
        const clearHighlights = () => {
          if (token !== currentTtsToken) return;
          if (sentenceTextEl) sentenceTextEl.querySelectorAll('.sent-word-active').forEach((w) => w.classList.remove('sent-word-active'));
        };
        utterance.onend = clearHighlights;
        utterance.onerror = clearHighlights;
        window.speechSynthesis.speak(utterance);
      } else if (typeof Speech.speak === 'function') {
        Speech.speak(sentences[currentIndex].en);
      }
    }

    function updateFavoriteUI(idx) {
      const favs = getSentFavorites();
      const isFav = favs.has(idx);
      const favBtn = document.getElementById('sentenceFavBtn');
      if (favBtn) {
        favBtn.innerHTML = isFav ? SENT_ICONS.bookmarkFill : SENT_ICONS.bookmark;
        favBtn.classList.toggle('favorited', isFav);
      }
      const textEl = document.getElementById('sentenceReviewText');
      if (textEl) {
        let mark = textEl.querySelector('.sent-fav-mark');
        if (isFav) {
          if (!mark) {
            mark = document.createElement('span');
            mark.className = 'sent-fav-mark';
            mark.innerHTML = SENT_ICONS.bookmarkFill;
            textEl.appendChild(mark);
          }
        } else if (mark) mark.remove();
      }
    }

    function renderSentence(idx) {
      currentIndex = idx;
      currentTtsToken++;
      readSentencesSet.add(idx);
      collectSentenceVocab(idx);
      const sentenceTextEl = document.getElementById('sentenceReviewText');
      const analysisEl = document.getElementById('sentenceReviewAnalysis');
      if (sentenceTextEl) {
        sentenceTextEl.innerHTML = '';
        sentenceTextEl.appendChild(buildSentHighlightedText(sentences[idx].en));
      }
      updateFavoriteUI(idx);
      document.querySelectorAll('.sent-vocab-panel-item').forEach((it) => {
        it.classList.toggle('active', parseInt(it.dataset.idx, 10) === idx);
      });
      const indexEl = document.getElementById('sentenceIndex');
      if (indexEl) indexEl.textContent = (idx + 1) + ' / ' + sentences.length;
      const prevBtn = document.getElementById('sentencePrevBtn');
      const nextBtn = document.getElementById('sentenceNextBtn');
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === sentences.length - 1;
      const fillEl = document.getElementById('sentenceProgressFill');
      if (fillEl) fillEl.style.width = ((idx + 1) / sentences.length * 100) + '%';

      if (analysisEl) {
        ensureAnalysisTabs(analysisEl);
        const data = getAnalysis(idx);
        if (data.translation || data.knowledge || data.syntax) {
          setTabContent(analysisEl, 'translation', esc(data.translation).replace(/\n/g, '<br>'));
          setTabContent(analysisEl, 'knowledge', esc(data.knowledge).replace(/\n/g, '<br>'));
          setTabContent(analysisEl, 'syntax', data.syntax ? esc(syntaxSummary(data.syntax)).replace(/\n/g, '<br>') : '');
        } else {
          fetchSentenceAnalysis(idx);
        }
      }
    }

    // ---- 骨架 ----
    body.innerHTML = `
      <div class="sent-container">
        <div class="sent-header">
          <button class="sent-back-btn" data-act="close" title="返回">${SENT_ICONS.back}</button>
          <h3>逐句精读 · ${sentences.length} 句</h3>
          <div class="sent-header-actions">
            <button class="sent-fav-btn" id="sentenceFavBtn" title="收藏当前句子">${SENT_ICONS.bookmark}</button>
            <button class="sent-tts-btn" id="sentenceTtsBtn" title="朗读当前句子">${SENT_ICONS.speak}</button>
          </div>
        </div>
        <div class="sent-progress-wrap">
          <div class="sent-progress-track"><div class="sent-progress-fill" id="sentenceProgressFill" style="width:${(1 / sentences.length * 100)}%"></div></div>
          <span class="sent-progress-text" id="sentenceIndex">1 / ${sentences.length}</span>
        </div>
        <div class="sent-nav">
          <span class="sent-nav-hint">点生词看释义 · 点击朗读</span>
          <button class="sent-vocab-nav-btn" id="sentVocabBtn" title="生词句列表">${SENT_ICONS.list}</button>
        </div>
        <div class="sent-vocab-panel" id="sentVocabPanel" hidden></div>
        <div class="sent-main">
          <div class="sentence-review-text" id="sentenceReviewText"></div>
          <div class="sentence-review-analysis" id="sentenceReviewAnalysis"></div>
        </div>
        <div class="sent-bottom">
          <button class="sent-nav-btn" id="sentencePrevBtn" title="上一句">${SENT_ICONS.prev}</button>
          <button class="sent-done-btn" data-act="done">${SENT_ICONS.check}<span>完成</span></button>
          <button class="sent-nav-btn" id="sentenceNextBtn" title="下一句">${SENT_ICONS.next}</button>
        </div>
      </div>`;

    body.querySelector('[data-act="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      closeTransBubble();
      closeOverlay();
    });
    body.querySelector('[data-act="done"]').addEventListener('click', (e) => {
      e.stopPropagation();
      showSentenceSummary();
    });
    body.querySelector('#sentenceFavBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const favs = getSentFavorites();
      if (favs.has(currentIndex)) favs.delete(currentIndex); else favs.add(currentIndex);
      saveSentFavorites(favs);
      updateFavoriteUI(currentIndex);
    });
    body.querySelector('#sentenceTtsBtn').addEventListener('click', (e) => { e.stopPropagation(); speakCurrentSentence(); });
    body.querySelector('#sentencePrevBtn').addEventListener('click', (e) => { e.stopPropagation(); if (currentIndex > 0) renderSentence(currentIndex - 1); });
    body.querySelector('#sentenceNextBtn').addEventListener('click', (e) => { e.stopPropagation(); if (currentIndex < sentences.length - 1) renderSentence(currentIndex + 1); });

    // ---- 生词句列表 ----
    const vocabSentences = [];
    sentences.forEach((s, i) => {
      const sWords = (s.en || '').match(/[a-zA-Z'-]+/g) || [];
      const count = sWords.filter((w) => vocabMap[w.toLowerCase()]).length;
      if (count > 0) {
        vocabSentences.push({ idx: i, count, preview: s.en.replace(/\s+/g, ' ').trim().slice(0, 20) });
      }
    });
    const vocabBtn = body.querySelector('#sentVocabBtn');
    const vocabPanel = body.querySelector('#sentVocabPanel');
    if (vocabSentences.length > 0) {
      let listHtml = '<div class="sent-vocab-panel-header">生词句列表（' + vocabSentences.length + '）</div>';
      listHtml += vocabSentences.map((vs) =>
        '<button type="button" class="sent-vocab-panel-item" data-idx="' + vs.idx + '">' +
          '<span class="sent-vocab-panel-num">' + (vs.idx + 1) + '</span>' +
          '<span class="sent-vocab-panel-preview">' + esc(vs.preview) + '</span>' +
          '<span class="sent-vocab-panel-count">' + vs.count + '词</span>' +
        '</button>').join('');
      vocabPanel.innerHTML = listHtml;
      vocabPanel.querySelectorAll('.sent-vocab-panel-item').forEach((it) => {
        it.addEventListener('click', (e) => {
          e.stopPropagation();
          vocabPanel.hidden = true;
          vocabBtn.classList.remove('active');
          sentVocabPanelOpen = false;
          renderSentence(parseInt(it.dataset.idx, 10));
        });
      });
      vocabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sentVocabPanelOpen = !sentVocabPanelOpen;
        vocabPanel.hidden = !sentVocabPanelOpen;
        vocabBtn.classList.toggle('active', sentVocabPanelOpen);
      });
    } else {
      vocabBtn.style.display = 'none';
      vocabPanel.innerHTML = '<div class="sent-vocab-panel-empty">暂无含生词的句子</div>';
    }

    // ---- 结算 ----
    function showSentenceSummary() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      closeTransBubble();
      const readCount = readSentencesSet.size;
      const totalCount = sentences.length;
      const vocabCount = touchedVocabSet.size;
      const rate = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;
      const isPerfect = readCount >= totalCount;

      Store.recordModuleActivity(MODULE_MAP.sentence || 'sentenceReview', Math.max(1, readCount));
      if (vocabCount > 0) Store.recordWordsLearned(vocabCount);

      let titleText = '阅读完成！', titleClass = '';
      if (isPerfect) { titleText = '全部读完！'; titleClass = 'perfect'; }
      else if (rate >= 80) titleText = '读得不错！';
      else if (rate >= 50) titleText = '继续加油！';

      const main = body.querySelector('.sent-main');
      const bottom = body.querySelector('.sent-bottom');
      if (main) {
        main.innerHTML = `
          <div class="sent-summary">
            <div class="sent-summary-icon">${SENT_ICONS.check}</div>
            <div class="sent-summary-title ${titleClass}">${esc(titleText)}</div>
            <div class="sent-summary-stats">
              <div class="sent-summary-stat"><span class="sent-summary-val correct">${readCount}</span><span class="sent-summary-lbl">已读句数</span></div>
              <div class="sent-summary-stat"><span class="sent-summary-val total">${totalCount}</span><span class="sent-summary-lbl">总句数</span></div>
              <div class="sent-summary-stat"><span class="sent-summary-val vocab">${vocabCount}</span><span class="sent-summary-lbl">涉及生词</span></div>
              <div class="sent-summary-stat"><span class="sent-summary-val rate">${rate}%</span><span class="sent-summary-lbl">完成率</span></div>
            </div>
            ${isPerfect ? '<div class="sent-perfect-badge">已完成全部句子的精读！</div>' : ''}
            <div class="sent-summary-actions">
              <button class="sent-summary-retry" data-act="retry">再来一轮</button>
              <button class="sent-summary-back" data-act="done">返回</button>
            </div>
          </div>`;
        if (bottom) bottom.style.display = 'none';
        main.querySelector('[data-act="retry"]').addEventListener('click', (e) => {
          e.stopPropagation();
          renderArticleSentence(body, item);
        });
        main.querySelector('[data-act="done"]').addEventListener('click', (e) => {
          e.stopPropagation();
          closeOverlay();
        });
      }
    }

    renderSentence(0);
  }

  /* ================= 全文回顾 · 杂志风格（THE ENGLISH READER） =================
     只保留杂志版式，移除其它阅读风格。全屏沉浸：隐藏弹层通用头部，杂志铺满。 */
  let reviewCleanups = [];
  // 语境填空 / 逐句精读 各自的事件/定时器清理队列（关闭弹层时统一释放，防止残留）
  let clozeCleanups = [];
  let sentCleanups = [];

  // 生词释义气泡（移动端轻量固定弹层）
  function showReviewBubble(word, meaning, practiceText) {
    const old = document.querySelector('.rv-mag-bubble');
    if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'rv-mag-bubble';
    b.innerHTML = `<span class="bubble-word">${esc(word)}</span>` +
      `<span class="bubble-meaning">${esc(meaning)}</span>` +
      (practiceText ? `<span class="bubble-practice-info">${esc(practiceText)}</span>` : '');
    document.body.appendChild(b);
    const dismiss = (ev) => {
      if (!b.contains(ev.target)) { b.remove(); document.removeEventListener('click', dismiss); }
    };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
  }

  // 杂志正文渲染：按空行分段，高亮生词（唯一风格，无风格切换条）
  function buildMagazineParagraphs(container, originalText, vocabMap, onVocabClick) {
    const paras = String(originalText || '').split(/\n\s*\n/);
    const frag = document.createDocumentFragment();
    paras.forEach((paraStr) => {
      const p = document.createElement('div');
      p.className = 'review-paragraph';
      const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
      let m;
      let hasVocab = false;
      while ((m = regex.exec(paraStr)) !== null) {
        if (m[1]) {
          const word = m[1];
          const lower = word.toLowerCase();
          if (vocabMap[lower]) {
            hasVocab = true;
            const span = document.createElement('span');
            span.className = 'rv-mag-vocab mastery-0';
            span.textContent = word;
            span.dataset.word = lower;
            span.dataset.meaning = vocabMap[lower] || '';
            span.addEventListener('click', (e) => {
              e.stopPropagation();
              if (onVocabClick) onVocabClick(lower, span);
            });
            p.appendChild(span);
          } else {
            p.appendChild(document.createTextNode(word));
          }
        } else if (m[2]) {
          p.appendChild(document.createTextNode(m[2]));
        }
      }
      if (!hasVocab) p.classList.add('no-vocab');
      frag.appendChild(p);
    });
    container.appendChild(frag);
  }

  // 导出当前回顾文章为 Obsidian 风格 Markdown：文章 + 生词 [^n] 注解 + 中文翻译
  // vocabMap: { lowerKey: meaning }；每个在文中出现的生词标注 [^n]，文末汇总音标与释义
  function buildExportMarkdown(text, vocabMap, translation) {
    const meta = {};
    Object.keys(vocabMap || {}).forEach(function (k) {
      const lex = Mobile.LocalLexicon && Mobile.LocalLexicon.lookup(k);
      meta[k] = { meaning: vocabMap[k] || '', phonetic: (lex && lex.ph) || '' };
    });
    const seen = {};
    let n = 0;
    const footnotes = [];
    const annotated = (text || '').replace(/\b[A-Za-z][A-Za-z'’-]*\b/g, function (m) {
      const lower = m.toLowerCase();
      if (meta[lower] && !seen[lower]) {
        seen[lower] = true;
        n++;
        const lexSurf = Mobile.LocalLexicon && Mobile.LocalLexicon.lookup(m);
        const ph = (lexSurf && lexSurf.ph) || meta[lower].phonetic;
        footnotes.push({ n: n, surface: m, phonetic: ph || '', meaning: meta[lower].meaning });
        return m + '[^' + n + ']';
      }
      return m;
    });
    let md = annotated;
    if (translation) {
      md += '\n\n> [!翻译]-\n' + translation.split('\n').map(function (l) { return '> ' + l; }).join('\n');
    }
    if (footnotes.length) {
      md += '\n\n' + footnotes.map(function (f) {
        const ph = f.phonetic ? ' /' + f.phonetic + '/ ' : ' ';
        const meaningPart = f.meaning ? '→ ' + f.meaning : '';
        return '[^' + f.n + ']: ' + f.surface + ph + meaningPart;
      }).join('\n');
    }
    return { md: md.trim(), annotated: annotated, footnotes: footnotes };
  }

  function renderExportPreview(annotated, translation, footnotes) {
    let html = '<p class="exp-article">' + esc(annotated || '').replace(/\[\^(\d+)\]/g, '<sup class="exp-fn">[^$1]</sup>') + '</p>';
    if (translation) {
      html += '<div class="exp-tr-block"><div class="exp-tr-label">中文翻译</div><div class="exp-tr">' + esc(translation).replace(/\n/g, '<br>') + '</div></div>';
    }
    if (footnotes && footnotes.length) {
      html += '<div class="exp-fn-list"><div class="exp-tr-label">生词注解</div>';
      html += footnotes.map(function (f) {
        const ph = f.phonetic ? ' <span class="exp-ph">/' + esc(f.phonetic) + '/</span>' : '';
        const meaning = f.meaning ? ' <span class="exp-arrow">→</span> ' + esc(f.meaning) : '';
        return '<div class="exp-fn-item"><span class="exp-fn-num">[' + f.n + ']</span> <b>' + esc(f.surface) + '</b>' + ph + meaning + '</div>';
      }).join('');
      html += '</div>';
    }
    return html;
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  // 导出弹层：先展示「预览 / 代码」，再提供复制与下载 .md
  function openExportSheet(text, vocabMap, translation, title) {
    const data = buildExportMarkdown(text, vocabMap, translation);
    if (!data.md) { UI.toast('没有可导出的内容'); return; }
    const previewHtml = renderExportPreview(data.annotated, translation, data.footnotes);
    const safeName = ((title || 'english-review').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60)) || 'english-review';
    const html =
      '<div class="exp-ov">' +
        '<div class="esc-overlay-head">' +
          '<button class="exp-ov-close" data-act="close" aria-label="关闭"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg></button>' +
          '<span class="esc-overlay-title">导出 Markdown</span>' +
          '<span style="width:34px"></span>' +
        '</div>' +
        '<div class="exp-seg">' +
          '<button class="exp-seg-btn is-on" data-tab="preview">预览</button>' +
          '<button class="exp-seg-btn" data-tab="code">代码</button>' +
        '</div>' +
        '<div class="esc-overlay-body exp-ov-body">' +
          '<div class="exp-preview" data-pane="preview">' + previewHtml + '</div>' +
          '<pre class="exp-code" data-pane="code" hidden><code>' + esc(data.md) + '</code></pre>' +
        '</div>' +
        '<div class="exp-actions">' +
          '<button class="esc-btn esc-btn-ghost" data-act="copy">复制</button>' +
          '<button class="esc-btn esc-btn-primary" data-act="download">下载 .md</button>' +
        '</div>' +
      '</div>';
    UI.overlay(html, {
      onOpen: function (wrap, close) {
        wrap.querySelector('[data-act="close"]').addEventListener('click', close);
        const segBtns = wrap.querySelectorAll('.exp-seg-btn');
        const panes = wrap.querySelectorAll('[data-pane]');
        segBtns.forEach(function (b) {
          b.addEventListener('click', function () {
            const tab = b.dataset.tab;
            segBtns.forEach(function (x) { x.classList.toggle('is-on', x === b); });
            panes.forEach(function (p) { p.hidden = (p.dataset.pane !== tab); });
          });
        });
        wrap.querySelector('[data-act="copy"]').addEventListener('click', function () {
          const done = function () { UI.toast('已复制 Markdown'); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(data.md).then(done, function () { fallbackCopy(data.md); done(); });
          } else { fallbackCopy(data.md); done(); }
        });
        wrap.querySelector('[data-act="download"]').addEventListener('click', function () {
          try {
            const blob = new Blob([data.md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = safeName + '.md';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            UI.toast('已导出 ' + safeName + '.md');
          } catch (e) { UI.toast('导出失败：' + (e && e.message || e)); }
        });
      }
    });
  }

  function renderArticleReview(body, item) {
    // 生词图：遍历全部生词本，word -> meaning（本机生词无练习统计，mastery 记 0）
    const reviewVocabMap = {};
    const masteryMap = {};
    Store.getVocab().forEach((w) => {
      const key = String(w.word || '').toLowerCase().trim();
      if (!key) return;
      reviewVocabMap[key] = w.meaning || w.zh || '';
      masteryMap[key] = { reviewCount: w.reviewCount || 0, lastReviewed: w.lastReviewed || null };
    });

    const originalText = item.originalText || item.text || '';
    const wordCount = (originalText.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
    const vocabCount = Object.keys(reviewVocabMap).length;
    const reviewedVocabSet = new Set();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // 标记为全屏杂志弹层：隐藏通用头部、去掉内边距（见 theme.css .esc-overlay-review）
    if (overlay) overlay.classList.add('esc-overlay-review');

    body.className = '';
    body.innerHTML = `
      <div class="rv-mag-wrapper">
        <div class="rv-mag-topbar">
          <button class="rv-mag-back-btn" title="返回">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="rv-mag-tts-btn" title="朗读全文">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>
        <div class="rv-mag-masthead">
          <div class="rv-mag-masthead-title">THE ENGLISH READER</div>
          <div class="rv-mag-masthead-issue">VOL. I · ISSUE ${esc(item.id || '1')}</div>
        </div>
        <div class="rv-mag-thick-thin-rule"></div>
        <div class="rv-mag-kicker">FEATURE · FULL REVIEW</div>
        <h1 class="rv-mag-headline">${esc(item.title || 'Full Review')}</h1>
        <div class="rv-mag-deck">A comprehensive review of vocabulary and expressions in context.</div>
        <div class="rv-mag-byline">By English Study Club <span class="rv-mag-byline-sep">·</span> ${esc(dateStr)}</div>
        <div class="rv-mag-info review-info-bar">
          <span class="info-item">WORDS ${wordCount}</span><span class="info-sep"></span>
          <span class="info-item">VOCAB ${vocabCount}</span><span class="info-sep"></span>
          <span class="info-item review-timer" id="reviewTimer">00:00</span>
          <button class="filter-btn exp-export-btn" title="导出 Markdown">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>导出</span>
          </button>
        </div>
        <div class="rv-mag-content review-content-fill"></div>
        ${item.fullTranslation
          ? `<div class="rv-mag-editor-note"><span class="note-label">Editor's Note · 中文翻译</span><br>${esc(item.fullTranslation).replace(/\n/g, '<br>')}</div>`
          : ''}
        <div class="rv-mag-progress review-progress-wrap">
          <div class="fill-progress-track" style="height:4px;background:color-mix(in srgb, currentColor 12%, transparent);border-radius:2px;">
            <div class="fill-progress-fill" style="width:0%;height:100%;background:var(--study-primary);border-radius:2px;transition:width 0.3s;"></div>
          </div>
          <span class="fill-progress-text" style="display:block;margin-top:8px;font-size:10px;color:var(--study-muted-foreground);text-transform:uppercase;letter-spacing:1px;">Reviewed 0/${vocabCount}</span>
        </div>
        <button class="rv-mag-complete review-fill-bottom" title="完成阅读">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span class="rv-mag-complete-label">完成阅读</span>
        </button>
        <div class="rv-mag-folio"><div class="rv-mag-folio-rule"></div>THE ENGLISH READER · PAGE 1 · ${esc(dateStr)}</div>
      </div>`;

    const contentEl = body.querySelector('.rv-mag-content');
    const progressWrap = body.querySelector('.review-progress-wrap');
    const fillEl = progressWrap.querySelector('.fill-progress-fill');
    const txtEl = progressWrap.querySelector('.fill-progress-text');

    // 生词点击：标记已回顾 + 更新进度 + 释义气泡
    const onVocabClick = (word, span) => {
      reviewedVocabSet.add(word);
      span.classList.add('reviewed');
      const pct = vocabCount ? Math.round((reviewedVocabSet.size / vocabCount) * 100) : 0;
      fillEl.style.width = pct + '%';
      txtEl.textContent = `Reviewed ${reviewedVocabSet.size}/${vocabCount}`;
      const completeBtn = body.querySelector('.rv-mag-complete');
      const completeLabel = completeBtn.querySelector('.rv-mag-complete-label');
      if (reviewedVocabSet.size >= vocabCount && vocabCount > 0) {
        completeBtn.classList.add('done');
        if (completeLabel) completeLabel.textContent = '全部回顾完成';
      }
      const mm = masteryMap[word];
      const practiceText = mm && mm.reviewCount > 0 ? `已练习 ${mm.reviewCount} 次` : '';
      showReviewBubble(word, span.dataset.meaning || '', practiceText);
    };
    buildMagazineParagraphs(contentEl, originalText, reviewVocabMap, onVocabClick);

    // 计时器
    const timerStart = Date.now();
    const timerId = setInterval(() => {
      const el = document.getElementById('reviewTimer');
      if (!el) return;
      const t = Math.floor((Date.now() - timerStart) / 1000);
      el.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    }, 1000);
    reviewCleanups.push(() => clearInterval(timerId));

    // 返回：取消朗读并关闭
    body.querySelector('.rv-mag-back-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      closeOverlay();
    });

    // 朗读全文（切换 播放/暂停 图标）
    const tts = body.querySelector('.rv-mag-tts-btn');
    const speakerSVG = tts.innerHTML;
    const pauseSVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    let isSpeaking = false;
    tts.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isSpeaking) {
        window.speechSynthesis.cancel(); isSpeaking = false; tts.innerHTML = speakerSVG;
      } else {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(originalText);
          u.lang = 'en-US'; u.rate = 0.85;
          u.onend = () => { isSpeaking = false; tts.innerHTML = speakerSVG; };
          window.speechSynthesis.speak(u);
          isSpeaking = true; tts.innerHTML = pauseSVG;
        }
      }
    });
    reviewCleanups.push(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); });

    // 导出：当前文章 + 生词 [^n] 注解 + 中文翻译，生成 Obsidian 风格 Markdown
    const exportBtn = body.querySelector('.exp-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExportSheet(originalText, reviewVocabMap, item.fullTranslation, item.title);
    });

    // 完成：取消朗读并关闭
    body.querySelector('.rv-mag-complete').addEventListener('click', (e) => {
      e.stopPropagation();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      closeOverlay();
    });
  }

  /* ===== 生词检验 · 文章完形填空（对齐网页端 vocab_quiz_ui） ===== */
  let quizCleanups = [];

  // 词形还原：把变形词映射回原词，以便命中生词本（与网页端一致）
  function quizLemmatize(w, vocabMap) {
    const irregular = {
      'ran':'run','runs':'run','running':'run','runned':'run',
      'ate':'eat','eats':'eat','eating':'eat','eaten':'eat',
      'went':'go','goes':'go','going':'go','gone':'go',
      'came':'come','comes':'come','coming':'come',
      'took':'take','takes':'take','taking':'take','taken':'take',
      'saw':'see','sees':'see','seeing':'see','seen':'see',
      'gave':'give','gives':'give','giving':'give','given':'give',
      'made':'make','makes':'make','making':'make',
      'wrote':'write','writes':'write','writing':'write','written':'write',
      'spoke':'speak','speaks':'speak','speaking':'speak','spoken':'speak',
      'broke':'break','breaks':'break','breaking':'break','broken':'break',
      'drove':'drive','drives':'drive','driving':'drive','driven':'drive',
      'began':'begin','begins':'begin','beginning':'begin','begun':'begin',
      'drank':'drink','drinks':'drink','drinking':'drink','drunk':'drink',
      'sang':'sing','sings':'sing','singing':'sing','sung':'sing',
      'swam':'swim','swims':'swim','swimming':'swim','swum':'swim',
      'knew':'know','knows':'know','knowing':'know','known':'know',
      'grew':'grow','grows':'grow','growing':'grow','grown':'grow',
      'threw':'throw','throws':'throw','throwing':'throw','thrown':'throw',
      'drew':'draw','draws':'draw','drawing':'draw','drawn':'draw',
      'stole':'steal','steals':'steal','stealing':'steal','stolen':'steal',
      'woke':'wake','wakes':'wake','waking':'wake','woken':'wake',
      'froze':'freeze','freezes':'freeze','freezing':'freeze','frozen':'freeze',
      'forgot':'forget','forgets':'forget','forgetting':'forget','forgotten':'forget',
      'chose':'choose','chooses':'choose','choosing':'choose','chosen':'choose',
      'hid':'hide','hides':'hide','hiding':'hide','hidden':'hide',
      'bit':'bite','bites':'bite','biting':'bite','bitten':'bite',
      'fell':'fall','falls':'fall','falling':'fall','fallen':'fall',
      'flew':'fly','flies':'fly','flying':'fly','flown':'fly',
      'blew':'blow','blows':'blow','blowing':'blow','blown':'blow',
      'shook':'shake','shakes':'shake','shaking':'shake','shaken':'shake',
      'met':'meet','meets':'meet','meeting':'meet',
      'kept':'keep','keeps':'keep','keeping':'keep',
      'slept':'sleep','sleeps':'sleep','sleeping':'sleep',
      'left':'leave','leaves':'leave','leaving':'leave',
      'spent':'spend','spends':'spend','spending':'spend',
      'built':'build','builds':'build','building':'build',
      'said':'say','says':'say','saying':'say',
      'held':'hold','holds':'hold','holding':'hold',
      'taught':'teach','teaches':'teach','teaching':'teach',
      'thought':'think','thinks':'think','thinking':'think',
      'bought':'buy','buys':'buy','buying':'buy',
      'sent':'send','sends':'send','sending':'send',
      'found':'find','finds':'find','finding':'find',
      'felt':'feel','feels':'feel','feeling':'feel',
      'won':'win','wins':'win','winning':'win',
      'told':'tell','tells':'tell','telling':'tell',
      'sold':'sell','sells':'sell','selling':'sell',
      'lost':'lose','loses':'lose','losing':'lose',
      'lay':'lie','lies':'lie','lying':'lie','lain':'lie',
      'sat':'sit','sits':'sit','sitting':'sit',
      'became':'become','becomes':'become','becoming':'become',
      'led':'lead','leads':'lead','leading':'lead',
      'rose':'rise','rises':'rise','rising':'rise','risen':'rise',
      'better':'good','best':'good','worse':'bad','worst':'bad'
    };
    if (irregular[w]) return irregular[w];
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
    if (w.endsWith('es') && w.length > 4 && /sses|ches|shes|xes|zzes|oes$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('ing')) {
      const base = w.slice(0, -3);
      const doubled = base.replace(/(.)\1$/, '$1');
      if (vocabMap[doubled] || vocabMap[doubled + 'e']) return doubled;
      if (vocabMap[base] || vocabMap[base + 'e']) return base;
      return doubled;
    }
    if (w.endsWith('ed')) {
      const base = w.slice(0, -2);
      const doubled = base.replace(/(.)\1$/, '$1');
      if (vocabMap[doubled] || vocabMap[doubled + 'e']) return doubled;
      if (vocabMap[base] || vocabMap[base + 'e']) return base;
      return doubled;
    }
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
    return w;
  }

  function quizBuildArticleHTML(tokens, blankEntries) {
    let html = '';
    let bi = 0;
    tokens.forEach((token) => {
      if (token.type === 'word') {
        const entry = blankEntries[bi];
        if (entry) {
          html += `<span class="quiz-blank" data-blank-id="${esc(entry.id)}" data-target-word="${esc(entry.word)}">____</span>`;
          bi++;
        } else {
          html += esc(token.value);
        }
      } else {
        html += token.value.replace(/\n/g, '<br>');
      }
    });
    return html;
  }

  function renderVocabQuiz(body, item) {
    // 重启时清理上一轮残留绑定
    quizCleanups.forEach((fn) => { try { fn(); } catch (e) {} });
    quizCleanups.length = 0;

    // 生词图：当前选中生词本（词形还原后命中），对齐网页端
    const vocabMap = {};
    getSelectedVocab().forEach((w) => {
      const key = String(w.word || '').toLowerCase().trim();
      if (key) vocabMap[key] = w.meaning || '';
    });

    const articleText = item.originalText || item.text || '';
    // 分词
    const tokens = [];
    const re = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
    let mm;
    while ((mm = re.exec(articleText)) !== null) {
      if (mm[1]) tokens.push({ type: 'word', value: mm[1] });
      else tokens.push({ type: 'nonword', value: mm[2] });
    }

    // 挖空条目
    const blankEntries = [];
    tokens.forEach((token) => {
      if (token.type !== 'word') return;
      const lower = token.value.toLowerCase();
      const lemma = quizLemmatize(lower, vocabMap);
      const matchedKey = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
      if (matchedKey) {
        blankEntries.push({
          id: 'blank-' + blankEntries.length,
          word: token.value,
          targetWord: token.value,
          matchedKey,
          meaning: vocabMap[matchedKey],
          filled: false,
          filledWord: null
        });
      }
    });

    if (blankEntries.length === 0) { UI.toast('该文章中没有找到生词本中的单词'); closeOverlay(); return; }
    if (blankEntries.length < 4) { UI.toast('生词太少，至少需要 4 个生词才能开始测验'); closeOverlay(); return; }

    overlay && overlay.classList.add('esc-overlay-quiz');
    body.className = '';

    // 状态
    let quizScore = 0;
    let quizStreakCount = 0;
    let quizMaxStreak = 0;
    let quizCorrectCount = 0;
    let quizWrongCount = 0;
    const quizTotal = blankEntries.length;
    let quizFilled = 0;
    let quizCompleted = false;
    let cachedTranslation = item.fullTranslation || null;
    let translationLoading = false;
    const checkedKeys = new Set();

    function getComboBonus(streak) {
      if (streak >= 20) return 10;
      if (streak >= 10) return 5;
      if (streak >= 5) return 3;
      if (streak >= 3) return 2;
      return 0;
    }
    function updateScore() {
      // 实时分数徽章已移除，分数仍由 quizScore 累计并在结算页展示
    }
    function updateStreak() {
      const sEl = document.getElementById('quizStreak');
      if (!sEl) return;
      if (quizStreakCount >= 10) { sEl.innerHTML = '🔥 ' + quizStreakCount + ' 连击！'; sEl.className = 'quiz-streak streak-10'; }
      else if (quizStreakCount >= 5) { sEl.innerHTML = '🔥 ' + quizStreakCount + ' 连击！'; sEl.className = 'quiz-streak streak-5'; }
      else if (quizStreakCount >= 3) { sEl.innerHTML = '🔥 ' + quizStreakCount + ' 连击！'; sEl.className = 'quiz-streak streak-3'; }
      else { sEl.innerHTML = ''; sEl.className = 'quiz-streak'; }
    }
    function updateProgress() {
      const fillEl = document.getElementById('quizProgressFill');
      const textEl = document.getElementById('quizProgressText');
      const pct = quizTotal ? (quizFilled / quizTotal * 100) : 0;
      if (fillEl) fillEl.style.width = pct + '%';
      if (textEl) textEl.textContent = quizFilled + ' / ' + quizTotal + ' 个空格';
    }
    function checkCompletion() {
      if (quizFilled >= quizTotal && !quizCompleted) {
        quizCompleted = true;
        setTimeout(() => showSummary(), 420);
      }
    }
    function findChipFor(word) {
      const chips = document.querySelectorAll('.quiz-word-chip:not(.used)');
      for (const c of chips) if (c.dataset.word === word) return c;
      return null;
    }
    function fillBlank(blankEl, chipEl) {
      const blankId = blankEl.dataset.blankId;
      const targetWord = blankEl.dataset.targetWord;
      const word = chipEl.dataset.word;
      blankEl.textContent = word;
      blankEl.classList.add('filled');
      if (word === targetWord) {
        blankEl.classList.add('correct');
        blankEl.dataset.filledWord = word;
        chipEl.classList.add('used');
        const entry = blankEntries.find((e) => e.id === blankId);
        if (entry) { entry.filled = true; entry.filledWord = word; }
        quizStreakCount++;
        if (quizStreakCount > quizMaxStreak) quizMaxStreak = quizStreakCount;
        quizScore += 10 + getComboBonus(quizStreakCount);
        quizCorrectCount++;
        quizFilled++;
        updateScore(); updateStreak(); updateProgress();
        if (blankEl.scrollIntoView) blankEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        checkCompletion();
      } else {
        blankEl.classList.add('incorrect', 'shake');
        quizStreakCount = 0;
        quizWrongCount++;
        updateStreak();
        setTimeout(() => {
          blankEl.classList.remove('incorrect', 'shake', 'filled');
          blankEl.textContent = '____';
        }, 650);
      }
    }
    function removeFill(blankEl) {
      const filledWord = blankEl.dataset.filledWord;
      if (!filledWord) return;
      blankEl.textContent = '____';
      blankEl.classList.remove('filled', 'correct', 'incorrect', 'shake');
      blankEl.dataset.filledWord = '';
      const entry = blankEntries.find((e) => e.id === blankEl.dataset.blankId);
      if (entry) { entry.filled = false; entry.filledWord = null; }
      const usedChip = document.querySelector('.quiz-word-chip.used[data-word="' + CSS.escape(filledWord) + '"]');
      if (usedChip) usedChip.classList.remove('used');
      quizFilled = Math.max(0, quizFilled - 1);
      updateProgress();
    }

    function showSummary() {
      if (document.querySelector('.quiz-summary')) return;
      const bank = document.getElementById('quizWordBank');
      if (bank) bank.style.display = 'none';
      const wrap = document.querySelector('.quiz-article-wrap');
      if (wrap) wrap.style.maxHeight = '46vh';
      const rate = quizTotal ? Math.round(quizCorrectCount / quizTotal * 100) : 0;
      const isPerfect = quizWrongCount === 0 && quizCorrectCount === quizTotal;
      if (isPerfect) quizScore += 20;
      // 计分与统计对齐
      if (session) { session.correct = quizCorrectCount; session.total = quizTotal; }
      Store.recordWordsLearned(quizTotal);
      Store.recordWordsMastered(quizCorrectCount);
      Store.recordModuleActivity(MODULE_MAP.vocabQuiz || 'vocabQuiz', quizTotal);
      const p = Store.getProgress();
      Store.updateProgress({ correctRate: rate || p.correctRate });

      let titleText = '太棒了，完成啦！';
      let titleClass = '';
      if (isPerfect) { titleText = '完美通关！'; titleClass = 'perfect'; }
      else if (rate >= 90) titleText = '非常出色！';
      else if (rate >= 70) titleText = '做得不错！';
      else if (rate >= 50) titleText = '继续加油！';

      const summary = document.createElement('div');
      summary.className = 'quiz-summary';
      summary.innerHTML = ''
        + '<div class="quiz-summary-icon"><svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div>'
        + '<div class="quiz-summary-title ' + titleClass + '">' + titleText + '</div>'
        + '<div class="quiz-summary-stats">'
        +   '<div class="quiz-summary-stat"><span class="quiz-summary-val correct">' + quizCorrectCount + '</span><span class="quiz-summary-lbl">正确</span></div>'
        +   '<div class="quiz-summary-stat"><span class="quiz-summary-val wrong">' + quizWrongCount + '</span><span class="quiz-summary-lbl">错误</span></div>'
        +   '<div class="quiz-summary-stat"><span class="quiz-summary-val rate">' + rate + '%</span><span class="quiz-summary-lbl">正确率</span></div>'
        +   '<div class="quiz-summary-stat"><span class="quiz-summary-val streak">' + quizMaxStreak + '</span><span class="quiz-summary-lbl">最高连击</span></div>'
        +   '<div class="quiz-summary-stat"><span class="quiz-summary-val score">' + quizScore + '</span><span class="quiz-summary-lbl">得分</span></div>'
        + '</div>'
        + (isPerfect ? '<div class="quiz-perfect-badge">完美通关！零错误，奖励 +20 分</div>' : '')
        + '<div class="quiz-summary-actions"><button class="quiz-summary-restart">再来一轮</button><button class="quiz-summary-back">返回</button></div>';
      const containerEl = document.querySelector('.quiz-container');
      if (containerEl) containerEl.appendChild(summary);
      summary.querySelector('.quiz-summary-restart').addEventListener('click', (e) => {
        e.stopPropagation();
        renderVocabQuiz(body, item);
      });
      summary.querySelector('.quiz-summary-back').addEventListener('click', (e) => {
        e.stopPropagation();
        closeOverlay();
      });
    }

    // 搭建骨架
    body.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-header">
          <button class="esc-icon-btn" data-act="close" aria-label="关闭"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="x" aria-hidden="true" class="lucide lucide-x esc-ico"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
          <h3>生词填空 · ${quizTotal} 个空格</h3>
          <span class="quiz-header-spacer" aria-hidden="true" style="width:36px;flex-shrink:0"></span>
        </div>
        <div class="quiz-progress-wrap">
          <div class="quiz-progress-track"><div class="quiz-progress-fill" id="quizProgressFill" style="width:0%"></div></div>
          <span class="quiz-progress-text" id="quizProgressText">0 / ${quizTotal} 个空格</span>
        </div>
        <div class="quiz-streak" id="quizStreak"></div>
        <div class="quiz-article-wrap">
          <div class="quiz-article">${quizBuildArticleHTML(tokens, blankEntries)}</div>
          <div class="quiz-translation-area">
            <button class="quiz-translation-toggle">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l3 8"/><path d="M9 8l-3 8"/><path d="M19 8l-3 8"/><path d="M15 8l3 8"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="20" y2="12"/></svg>
              查看译文
            </button>
            <div class="quiz-translation" id="quizTranslation"></div>
          </div>
        </div>
        <div class="quiz-word-bank" id="quizWordBank">
          <div class="quiz-word-bank-label">词库（点选单词 → 点空格填入，或拖拽）</div>
          <div class="quiz-word-chips"></div>
        </div>
      </div>`;

    // 关闭（复用 .esc-icon-btn 规范控件）
    const closeBtn = body.querySelector('.esc-icon-btn[data-act="close"]');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeOverlay(); });
    const escHandler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeOverlay(); } };
    document.addEventListener('keydown', escHandler);
    quizCleanups.push(() => document.removeEventListener('keydown', escHandler));

    // 译文切换（保留 SVG 图标，与网页端一致）
    const transBtn = body.querySelector('.quiz-translation-toggle');
    const transEl = document.getElementById('quizTranslation');
    const TRANS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l3 8"/><path d="M9 8l-3 8"/><path d="M19 8l-3 8"/><path d="M15 8l3 8"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="20" y2="12"/></svg>';
    const setTransText = (label) => { transBtn.innerHTML = TRANS_ICON + label; };
    transBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (transEl.classList.contains('show')) {
        transEl.classList.remove('show');
        setTransText('查看译文');
      } else if (cachedTranslation) {
        transEl.textContent = cachedTranslation;
        transEl.classList.add('show');
        setTransText('隐藏译文');
      } else {
        transEl.textContent = '暂无译文';
        transEl.classList.add('show');
        setTransText('隐藏译文');
      }
    });

    // 空格槽位：点选词填入 / 点击已填空取消
    const blankEls = Array.from(body.querySelectorAll('.quiz-blank'));
    let selectedChip = null;
    blankEls.forEach((blankEl) => {
      const onBlankClick = (e) => {
        e.stopPropagation();
        if (blankEl.classList.contains('filled')) { removeFill(blankEl); return; }
        if (selectedChip && !selectedChip.classList.contains('used')) {
          fillBlank(blankEl, selectedChip);
          selectedChip.classList.remove('selected');
          selectedChip = null;
        }
      };
      blankEl.addEventListener('click', onBlankClick);
      quizCleanups.push(() => blankEl.removeEventListener('click', onBlankClick));
    });

    // 词库 chips
    const chipsWrap = body.querySelector('.quiz-word-chips');
    const shuffled = blankEntries.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach((entry, index) => {
      const chip = document.createElement('span');
      chip.className = 'quiz-word-chip';
      chip.textContent = entry.word;
      chip.dataset.word = entry.word;
      chip.dataset.blankId = entry.id;
      chip.style.animationDelay = (index * 0.05) + 's';
      chipsWrap.appendChild(chip);

      // 点选（移动端无拖拽时的可靠填入方式）
      const onChipClick = (e) => {
        e.stopPropagation();
        if (chip.classList.contains('used')) return;
        if (selectedChip === chip) { selectedChip.classList.remove('selected'); selectedChip = null; return; }
        if (selectedChip) selectedChip.classList.remove('selected');
        selectedChip = chip;
        chip.classList.add('selected');
        const lower = entry.word.toLowerCase();
        const lemma = quizLemmatize(lower, vocabMap);
        const mk = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
        const c = document.querySelector('.quiz-word-bubble');
        if (c) c.remove();
        const bubble = document.createElement('div');
        bubble.className = 'quiz-word-bubble';
        bubble.textContent = mk ? vocabMap[mk] : '(无释义)';
        const rect = chip.getBoundingClientRect();
        bubble.style.left = '16px';
        bubble.style.right = '16px';
        bubble.style.bottom = (window.innerHeight - rect.bottom + 52) + 'px';
        document.body.appendChild(bubble);
        setTimeout(() => { const b = document.querySelector('.quiz-word-bubble'); if (b) b.remove(); }, 2200);
      };
      chip.addEventListener('click', onChipClick);
      quizCleanups.push(() => chip.removeEventListener('click', onChipClick));

      // 拖拽（移动端触摸拖拽填入）
      let touchGhost = null, sx = 0, sy = 0, dragging = false, ox = 0, oy = 0;
      const ts = (e) => {
        if (e.touches.length !== 1 || chip.classList.contains('used')) return;
        const t = e.touches[0]; const r = chip.getBoundingClientRect();
        sx = t.clientX; sy = t.clientY; ox = t.clientX - r.left; oy = t.clientY - r.top; dragging = false;
      };
      const tm = (e) => {
        if (e.touches.length !== 1 || chip.classList.contains('used')) return;
        const t = e.touches[0];
        if (!dragging && (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8)) {
          dragging = true;
          const r = chip.getBoundingClientRect();
          touchGhost = chip.cloneNode(true);
          touchGhost.className = 'quiz-word-chip dragging-ghost';
          touchGhost.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:none;opacity:.85;z-index:1000;';
          document.body.appendChild(touchGhost);
        }
        if (dragging) {
          e.preventDefault();
          if (touchGhost) { touchGhost.style.left = (t.clientX - ox) + 'px'; touchGhost.style.top = (t.clientY - oy) + 'px'; }
          const el = document.elementFromPoint(t.clientX, t.clientY);
          body.querySelectorAll('.quiz-blank').forEach((b) => b.classList.remove('drag-over'));
          if (el) { const bl = el.closest && el.closest('.quiz-blank'); if (bl && !bl.classList.contains('filled')) bl.classList.add('drag-over'); }
        }
      };
      const te = (e) => {
        if (touchGhost) { touchGhost.remove(); touchGhost = null; }
        body.querySelectorAll('.quiz-blank').forEach((b) => b.classList.remove('drag-over'));
        if (dragging) {
          const t = e.changedTouches && e.changedTouches[0];
          if (t) {
            const el = document.elementFromPoint(t.clientX, t.clientY);
            if (el) {
              const bl = el.closest && el.closest('.quiz-blank');
              if (bl && !bl.classList.contains('filled')) fillBlank(bl, chip);
            }
          }
        }
        dragging = false;
      };
      const tc = () => { if (touchGhost) { touchGhost.remove(); touchGhost = null; } dragging = false; body.querySelectorAll('.quiz-blank').forEach((b) => b.classList.remove('drag-over')); };
      chip.addEventListener('touchstart', ts, { passive: true });
      chip.addEventListener('touchmove', tm, { passive: false });
      chip.addEventListener('touchend', te);
      chip.addEventListener('touchcancel', tc);
      quizCleanups.push(() => {
        chip.removeEventListener('touchstart', ts);
        chip.removeEventListener('touchmove', tm);
        chip.removeEventListener('touchend', te);
        chip.removeEventListener('touchcancel', tc);
      });
    });

    updateScore(); updateStreak(); updateProgress();
  }

  /* ================= 学习统计 / 学习计划（对齐桌面端 stats_detail / plan_detail） ================= */
  let spOverlay = null;

  function closeSp() {
    if (!spOverlay) return;
    const el = spOverlay;
    spOverlay = null;
    el.style.transition = 'opacity .2s ease';
    el.style.opacity = '0';
    const done = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 260);
  }

  function _num(key) { const n = parseInt(localStorage.getItem(key), 10); return isNaN(n) ? 0 : n; }
  function _numOr(key, fb) { const n = parseInt(localStorage.getItem(key), 10); return isNaN(n) ? fb : n; }

  // 单词侧统计数据（数据计算统一走共享层，生词本列表归一化后注入）
  function getWordStats() {
    const notebooks = Store.getNotebooks().map((nb) => ({ id: nb.id, name: nb.name, count: nb.wordCount }));
    const ws = SStats.wordStats(notebooks);
    return {
      todayLearned: ws.todayLearned || 0,
      totalLearned: ws.totalLearned || 0,
      totalWords: ws.totalWords || 0,
      masteredCount: ws.masteredCount || 0,
      streakDays: ws.streak || 0,
      masteryRate: ws.masteryRate || 0,
      notebooks: ws.notebooks || []
    };
  }
  // 文章侧统计数据（历史记录列表归一化后注入共享层）
  function getArticleStats() {
    const history = Store.getHistory().map((h) => ({ id: h.id, title: h.title, originalText: h.originalText || h.text, savedAt: h.savedAt }));
    const rs = SStats.articleStats(history);
    return {
      totalArticles: rs.totalArticles || 0,
      todayArticles: rs.todayArticles || 0,
      articleStreak: rs.articleStreak || 0,
      recent: rs.recent || []
    };
  }

  // 读取 stats_module_data 中某模块最近 7 天活动量（委托共享层 moduleDaily，点阵渲染用）
  function moduleDaily(key) {
    return SStats.moduleDaily(key).map((d) => ({ label: d.label, value: d.value }));
  }
  // 最近 7 天总学习量（type: 'word' | 'article' | null 全部，委托共享层 trend）
  function trendData(type) {
    return SStats.trend(type).map((d) => ({ label: d.label, value: d.value }));
  }

  // 模块近 7 天活动点阵（20px 圆点，透明度随活跃度变化，对齐桌面端）
  function dotChart(key, color) {
    const data = moduleDaily(key);
    const max = Math.max.apply(null, data.map((d) => d.value).concat([1]));
    const empty = max <= 1 && data.every((d) => d.value === 0);
    const op = (v) => {
      if (empty) return 0.08;
      const r = v / max;
      return r === 0 ? 0.06 : Math.min(1, 0.12 + r * 0.83);
    };
    return `<div class="esc-dot-wrap">${data.map((d) => `<span class="esc-dot-col"><span class="esc-dot" style="background:${color};opacity:${op(d.value).toFixed(2)}" title="${d.label}: ${d.value}次"></span></span>`).join('')}</div>`;
  }
  // 近 7 天趋势折线图
  function miniChart(type) {
    const data = trendData(type);
    const max = Math.max.apply(null, data.map((d) => d.value).concat([1]));
    if (max <= 1 && data.every((d) => d.value === 0)) {
      return `<div class="esc-trend-empty">${icon('trending-up')}<span>完成更多学习后，这里将展示学习趋势</span></div>`;
    }
    const n = data.length;
    const W = 100, H = 60, padT = 10, padB = 4;
    const ch = H - padT - padB;
    const pts = data.map((d, i) => ({
      x: (i / (n - 1)) * W,
      y: padT + ch - (d.value / max) * ch,
      v: d.value
    }));
    const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = line + ` ${W},${H - padB} 0,${H - padB}`;
    const dots = pts.map((p) => (p.v > 0 ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--study-accent)"></circle>` : '')).join('');
    return `
      <div class="esc-chart">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:72px;display:block">
          <polygon points="${area}" fill="var(--study-accent)" opacity=".14"></polygon>
          <polyline points="${line}" fill="none" stroke="var(--study-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
          ${dots}
        </svg>
        <div class="esc-chart-labels">${data.map((d) => `<span>${d.label}</span>`).join('')}</div>
      </div>`;
  }
  // 生词本分布：环形图 + 列表（notebooks 来自共享层 wordStats，字段为 count）
  function notebookDonut(notebooks) {
    const total = notebooks.reduce((s, nb) => s + (nb.count || 0), 0);
    if (!total) return '';
    const c = 2 * Math.PI * 36;
    let seg = '';
    let off = 0;
    notebooks.forEach((nb, i) => {
      const color = NB_COLORS[i % NB_COLORS.length];
      const len = c * ((nb.count || 0) / total);
      seg += `<circle cx="50" cy="50" r="36" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)"></circle>`;
      off += len;
    });
    return `
      <div class="esc-donut-wrap">
        <svg viewBox="0 0 100 100" class="esc-donut">${seg}
          <circle cx="50" cy="50" r="15" fill="var(--study-card)"></circle>
          <text x="50" y="47" text-anchor="middle" font-size="16" font-weight="700" fill="var(--study-foreground)">${total}</text>
          <text x="50" y="61" text-anchor="middle" font-size="7" fill="var(--study-muted-foreground)">总词数</text>
        </svg>
        <div class="esc-donut-list">${notebooks.map((nb, i) => {
          const color = NB_COLORS[i % NB_COLORS.length];
          const pct = Math.round(((nb.count || 0) / total) * 100);
          return `<div class="esc-donut-item"><span class="esc-donut-dot" style="background:${color}"></span><span class="esc-donut-name">${esc(nb.name)}</span><span class="esc-donut-bar"><i style="width:${pct}%;background:${color}"></i></span><span class="esc-donut-count">${nb.count}词 ${pct}%</span></div>`;
        }).join('')}</div>
      </div>`;
  }
  // 各模式明细（模块活动累计量取共享层 moduleStats，与桌面端一致）
  function moduleList(type) {
    const ms = SStats.moduleStats();
    const keys = Object.keys(MODULE_META).filter((k) => MODULE_META[k].type === type && (ms.all[k] || 0) > 0);
    if (!keys.length) return '';
    const head = moduleDaily('flashcard').map((d) => `<span class="esc-dot-col esc-dot-label">${d.label}</span>`).join('');
    return `
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('layers')}<span>${type === 'word' ? '单词练习' : '文章阅读'}各模式明细</span></div>
        <div class="esc-mod-head"><span class="esc-mod-name"></span><div class="esc-dot-wrap">${head}</div><span class="esc-mod-count"></span></div>
        ${keys.map((k) => `<div class="esc-mod-item"><span class="esc-mod-name">${MODULE_META[k].label}</span>${dotChart(k, MODULE_META[k].color)}<span class="esc-mod-count">${ms.all[k]}</span></div>`).join('')}
      </div>`;
  }

  function buildStatsWord() {
    const s = getWordStats();
    return `
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('book-open')}<span>单词学习概览</span></div>
        <div class="esc-grid-4">
          <div class="esc-stat"><div class="esc-num">${s.todayLearned}</div><div class="esc-label">今日学习</div></div>
          <div class="esc-stat"><div class="esc-num">${s.totalWords}</div><div class="esc-label">总单词数</div></div>
          <div class="esc-stat"><div class="esc-num">${s.masteryRate}%</div><div class="esc-label">掌握率</div></div>
          <div class="esc-stat"><div class="esc-num">${s.streakDays}</div><div class="esc-label">连续天数</div></div>
        </div>
      </div>
      ${moduleList('word')}
      ${s.notebooks.length ? `<div class="esc-stats-card"><div class="esc-stats-title">${icon('layout-grid')}<span>生词本分布</span></div>${notebookDonut(s.notebooks)}</div>` : ''}
      <div class="esc-stats-card"><div class="esc-stats-title">${icon('trending-up')}<span>学习趋势</span></div>${miniChart('word')}</div>`;
  }

  function buildStatsArticle() {
    const s = getArticleStats();
    return `
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('file-text')}<span>文章学习概览</span></div>
        <div class="esc-grid-4">
          <div class="esc-stat"><div class="esc-num">${s.todayArticles}</div><div class="esc-label">今日阅读</div></div>
          <div class="esc-stat"><div class="esc-num">${s.totalArticles}</div><div class="esc-label">总文章数</div></div>
          <div class="esc-stat"><div class="esc-num">${s.articleStreak}</div><div class="esc-label">连续天数</div></div>
          <div class="esc-stat"><div class="esc-num">${s.recent.length}</div><div class="esc-label">最近文章</div></div>
        </div>
      </div>
      ${moduleList('article')}
      ${s.recent.length ? `<div class="esc-stats-card"><div class="esc-stats-title">${icon('clock')}<span>最近阅读的文章</span></div><div class="esc-article-list">${s.recent.map((a) => `<div class="esc-article-item"><span class="esc-article-item-title">${esc(a.title)}</span><span class="esc-article-item-meta">${a.wordCount} 词 · ${esc((a.savedAt || '').slice(0, 10))}</span></div>`).join('')}</div></div>` : ''}
      <div class="esc-stats-card"><div class="esc-stats-title">${icon('trending-up')}<span>阅读趋势</span></div>${miniChart('article')}</div>`;
  }

  // 待复习文章数（委托共享层 pendingReview，与桌面端一致）
  function getPendingReviewCount(interval) {
    const history = Store.getHistory().map((h) => ({ id: h.id }));
    return SStats.pendingReview(history);
  }

  function buildPlanWord() {
    const wp = SStats.wordPlan(Store.getNotebooks().map((nb) => ({ id: nb.id, name: nb.name, count: nb.wordCount })));
    const goal = wp.dailyWordGoal;
    const timeGoal = wp.dailyTimeGoal;
    const pct = wp.wordProgressPct;
    const circ = 2 * Math.PI * 42;
    const enable = wp.enableReminder;
    const time = wp.reminderTime;
    return `
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('clock')}<span>每日单词目标</span></div>
        <div class="esc-plan-progress">
          <div class="esc-ring-wrap">
            <svg width="72" height="72" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--study-muted)" stroke-width="8"></circle>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--study-accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - pct / 100)).toFixed(2)}"></circle>
            </svg>
            <div class="esc-ring-center"><span class="esc-num">${pct}%</span></div>
          </div>
          <div class="esc-plan-progress-info">
            <div>今日已学 <b>${wp.todayLearned} / ${goal}</b> 个单词</div>
            <div class="esc-plan-sub">连续学习 ${wp.streak} 天 · 共 ${wp.totalWords} 词</div>
          </div>
        </div>
        <div class="esc-goal-row">
          <label class="esc-goal-label">每日单词数</label>
          <input type="number" class="esc-input esc-goal-input" id="sp-word-goal" value="${goal}" min="1" max="200">
          <span class="esc-goal-unit">个</span>
          <label class="esc-goal-label">学习时长</label>
          <input type="number" class="esc-input esc-goal-input" id="sp-word-time" value="${timeGoal}" min="1" max="180">
          <span class="esc-goal-unit">分钟</span>
          <button class="esc-btn esc-btn-primary" data-act="sp-save-goal" style="margin-left:auto">保存</button>
        </div>
      </div>
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('bell')}<span>单词学习提醒</span></div>
        <div class="esc-reminder">
          <div class="esc-reminder-row">
            <label class="esc-goal-label">启用学习提醒</label>
            <label class="esc-toggle"><input type="checkbox" id="sp-word-remind" ${enable ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
          <div class="esc-reminder-row" id="sp-word-time-row" style="${enable ? '' : 'display:none'}">
            <label class="esc-goal-label">提醒时间</label>
            <input type="time" class="esc-input" id="sp-word-remind-time" value="${time}" style="width:auto;flex:1">
          </div>
          <button class="esc-btn esc-btn-primary" data-act="sp-save-word-remind" style="align-self:flex-end">保存</button>
        </div>
      </div>`;
  }

  function buildPlanArticle() {
    const ap = SStats.articlePlan(Store.getHistory().map((h) => ({ id: h.id })));
    const aGoal = ap.dailyArticleGoal;
    const aTimeGoal = ap.dailyArticleTimeGoal;
    const todayArticles = ap.todayArticles;
    const aStreak = ap.articleStreak;
    const totalArticles = ap.totalArticles;
    const pct = ap.articleProgressPct;
    const circ = 2 * Math.PI * 42;
    const interval = ap.reviewInterval;
    const pending = getPendingReviewCount(interval);
    const enable = ap.enableReminder;
    const time = ap.reminderTime;
    return `
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('file-text')}<span>每日文章目标</span></div>
        <div class="esc-plan-progress">
          <div class="esc-ring-wrap">
            <svg width="72" height="72" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--study-muted)" stroke-width="8"></circle>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--study-accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - pct / 100)).toFixed(2)}"></circle>
            </svg>
            <div class="esc-ring-center"><span class="esc-num">${pct}%</span></div>
          </div>
          <div class="esc-plan-progress-info">
            <div>今日已读 <b>${todayArticles} / ${aGoal}</b> 篇文章</div>
            <div class="esc-plan-sub">连续阅读 ${aStreak} 天 · 共 ${totalArticles} 篇</div>
          </div>
        </div>
        <div class="esc-goal-row">
          <label class="esc-goal-label">每日文章数</label>
          <input type="number" class="esc-input esc-goal-input" id="sp-article-goal" value="${aGoal}" min="1" max="20">
          <span class="esc-goal-unit">篇</span>
          <label class="esc-goal-label">阅读时长</label>
          <input type="number" class="esc-input esc-goal-input" id="sp-article-time" value="${aTimeGoal}" min="1" max="180">
          <span class="esc-goal-unit">分钟</span>
          <button class="esc-btn esc-btn-primary" data-act="sp-save-article-goal" style="margin-left:auto">保存</button>
        </div>
      </div>
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('rotate-cw')}<span>文章复习计划</span></div>
        <div class="esc-goal-row">
          <label class="esc-goal-label">复习间隔</label>
          <input type="number" class="esc-input esc-goal-input" id="sp-review-interval" value="${interval}" min="1" max="30">
          <span class="esc-goal-unit">天</span>
          <span class="esc-goal-label" style="margin-left:auto">待复习 <b style="color:var(--study-warning)">${pending}</b> 篇</span>
          <button class="esc-btn esc-btn-primary" data-act="sp-save-review" style="margin-left:auto">保存</button>
        </div>
      </div>
      <div class="esc-stats-card">
        <div class="esc-stats-title">${icon('bell')}<span>文章阅读提醒</span></div>
        <div class="esc-reminder">
          <div class="esc-reminder-row">
            <label class="esc-goal-label">启用阅读提醒</label>
            <label class="esc-toggle"><input type="checkbox" id="sp-article-remind" ${enable ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
          <div class="esc-reminder-row" id="sp-article-time-row" style="${enable ? '' : 'display:none'}">
            <label class="esc-goal-label">提醒时间</label>
            <input type="time" class="esc-input" id="sp-article-remind-time" value="${time}" style="width:auto;flex:1">
          </div>
          <button class="esc-btn esc-btn-primary" data-act="sp-save-article-remind" style="align-self:flex-end">保存</button>
        </div>
      </div>`;
  }

  // 绑定学习统计 / 学习计划弹层内的按钮事件
  function bindSp(key) {
    const ov = spOverlay;
    if (!ov) return;

    const bindRemind = (toggleId, timeRowId, saveAct, remindKey, timeKey, timeId, toastMsg) => {
      const t = document.getElementById(toggleId);
      const row = document.getElementById(timeRowId);
      if (!t) return;
      t.addEventListener('change', () => { row.style.display = t.checked ? '' : 'none'; });
      const save = ov.querySelector(`[data-act="${saveAct}"]`);
      if (save) save.addEventListener('click', () => {
        localStorage.setItem(remindKey, t.checked ? 'true' : 'false');
        localStorage.setItem(timeKey, (document.getElementById(timeId) || {}).value || '09:00');
        UI.toast(toastMsg);
      });
    };

    if (key === 'word') {
      const saveG = ov.querySelector('[data-act="sp-save-goal"]');
      if (saveG) saveG.addEventListener('click', () => {
        const g = Math.max(1, parseInt((document.getElementById('sp-word-goal') || {}).value, 10) || 10);
        const t = Math.max(1, parseInt((document.getElementById('sp-word-time') || {}).value, 10) || 15);
        localStorage.setItem('dailyWordGoal', String(g));
        localStorage.setItem('dailyTimeGoal', String(t));
        Store.updateSettings({ dailyGoal: g }); // 同步移动端设置，记忆页进度卡实时一致
        UI.toast('每日单词目标已保存');
        if (ov._showTab) ov._showTab('word'); // 重绘以更新环形进度
      });
      bindRemind('sp-word-remind', 'sp-word-time-row', 'sp-save-word-remind', 'enableReminder', 'reminderTime', 'sp-word-remind-time', '单词提醒设置已保存');
    } else if (key === 'article') {
      const saveG = ov.querySelector('[data-act="sp-save-article-goal"]');
      if (saveG) saveG.addEventListener('click', () => {
        const g = Math.max(1, parseInt((document.getElementById('sp-article-goal') || {}).value, 10) || 1);
        const t = Math.max(1, parseInt((document.getElementById('sp-article-time') || {}).value, 10) || 20);
        localStorage.setItem('dailyArticleGoal', String(g));
        localStorage.setItem('dailyArticleTimeGoal', String(t));
        UI.toast('每日文章目标已保存');
        if (ov._showTab) ov._showTab('article');
      });
      const saveR = ov.querySelector('[data-act="sp-save-review"]');
      if (saveR) saveR.addEventListener('click', () => {
        const iv = Math.max(1, parseInt((document.getElementById('sp-review-interval') || {}).value, 10) || 3);
        localStorage.setItem('articleReviewInterval', String(iv));
        UI.toast('复习计划已保存');
        if (ov._showTab) ov._showTab('article');
      });
      bindRemind('sp-article-remind', 'sp-article-time-row', 'sp-save-article-remind', 'enableArticleReminder', 'articleReminderTime', 'sp-article-remind-time', '文章提醒设置已保存');
    }
  }

  // 通用带标签页全屏弹层
  function openTabsOverlay(title, tabs, buildFn) {
    closeSp();
    const ov = document.createElement('div');
    ov.className = 'esc-overlay';
    ov.innerHTML = `
      <div class="esc-overlay-head">
        <button class="esc-icon-btn" data-act="sp-close" aria-label="关闭">${icon('x')}</button>
        <span class="esc-overlay-title">${esc(title)}</span>
        <div class="esc-seg esc-sp-seg">${tabs.map((t) => `<button data-tab="${t.key}">${esc(t.label)}</button>`).join('')}</div>
      </div>
      <div class="esc-overlay-body" data-role="sp-body"></div>`;
    document.querySelector('.esc-app').appendChild(ov);
    spOverlay = ov;
    UI.refreshIcons(ov);
    ov.querySelector('[data-act="sp-close"]').addEventListener('click', closeSp);
    const body = ov.querySelector('[data-role="sp-body"]');
    const seg = ov.querySelector('.esc-sp-seg');
    const show = (key) => {
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-tab') === key));
      body.innerHTML = buildFn(key);
      UI.refreshIcons(body);
      bindSp(key);
    };
    ov._showTab = show;
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => show(b.getAttribute('data-tab'))));
    show(tabs[0].key);
  }

  function openStats() {
    openTabsOverlay('学习统计', [
      { key: 'word', label: '单词统计' },
      { key: 'article', label: '文章统计' }
    ], (key) => (key === 'word' ? buildStatsWord() : buildStatsArticle()));
  }
  function openPlan() {
    openTabsOverlay('学习计划', [
      { key: 'word', label: '单词计划' },
      { key: 'article', label: '文章计划' }
    ], (key) => (key === 'word' ? buildPlanWord() : buildPlanArticle()));
  }

  // 工具
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickRandom(arr, exclude, n) {
    const pool = arr.filter((x) => x && x !== exclude);
    return shuffle(pool).slice(0, n);
  }

  // 数据变化自动刷新（练习弹层打开时不刷新，避免打断）
  Store.on('vocab', () => { if (rootEl && !rootEl.hidden && !overlay) { const t = currentTab; render(rootEl); selectTab(t); } });
  Store.on('history', () => { if (rootEl && !rootEl.hidden && !overlay) { paintArticleSelect(); } });
  Store.on('progress', () => { if (rootEl && !rootEl.hidden && !overlay) { const t = currentTab; render(rootEl); selectTab(t); } });

  // 点击底部导航离开时关闭练习/统计/计划弹层（修复残留/泄漏）
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-nav-key]')) return;
    if (overlay) closeOverlay();
    if (spOverlay) closeSp();
  });

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.memory = { render, closeOverlay };
})(window);
