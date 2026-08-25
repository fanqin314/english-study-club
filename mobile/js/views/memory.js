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

  // ---------- 数据辅助 ----------
  function getVocabSet() {
    return new Set(Store.getVocab().map((w) => (w.word || '').toLowerCase()).filter(Boolean));
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
  // 单词练习队列：取前 10（桌面端不区分「已掌握」，故不再按 status 排序）
  function buildWordQueue() {
    const vocab = Store.getVocab();
    const pool = vocab.length ? vocab.slice() : FALLBACK.map((w) => Object.assign({ id: 'fb-' + w.word }, w));
    return pool.slice(0, 10);
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
  // 文章「生词测验」队列：文章中出现过的生词
  function buildArticleVocabQueue(item) {
    const text = (item.text || '').toLowerCase();
    const found = Store.getVocab().filter((w) => w.word && text.includes(w.word.toLowerCase()));
    return (found.length ? found : Store.getVocab()).slice(0, 10);
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
            <div class="esc-select-wrap">
              <select id="m-art" class="esc-select"></select>
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
    selectTab(currentTab);
    UI.refreshIcons(container);
  }

  function paintArticleSelect() {
    const sel = rootEl && rootEl.querySelector('#m-art');
    if (!sel) return;
    const list = Store.getHistory();
    if (!list.length) {
      sel.innerHTML = `<option value="">暂无历史文章</option>`;
      selectedArticleId = null;
    } else {
      if (!selectedArticleId || !list.find((h) => h.id === selectedArticleId)) {
        selectedArticleId = list[0].id;
      }
      sel.innerHTML = list.map((h) => {
        const first = (h.title || (h.text || '').split('\n')[0] || '未命名文章').slice(0, 24);
        return `<option value="${esc(h.id)}">${esc(first)} · ${esc(h.date || '')}</option>`;
      }).join('');
      sel.value = selectedArticleId;
    }
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
    // 文章选择
    const sel = root.querySelector('#m-art');
    if (sel) sel.addEventListener('change', () => { selectedArticleId = sel.value; });
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
          if (selId && selId !== curId) Store.setCurrentNotebook(selId);
          close();
        });
      }
    });
  }

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
      queue = buildArticleClozeQueue(item);
      if (!queue.length) { UI.toast('该文章没有可用句子'); return; }
    } else if (mode === 'vocabQuiz') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      queue = buildArticleVocabQueue(item);
      if (!queue.length) { UI.toast('该文章没有匹配生词'); return; }
    } else if (mode === 'sentence') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      queue = splitSentences(item.text);
      if (!queue.length) { UI.toast('该文章为空'); return; }
    } else if (mode === 'review') {
      const item = getArticle(ctx.articleId);
      if (!item) { UI.toast('请先在文章标签选择一篇文章'); return; }
      session = { mode, ctx, queue: [item], idx: 0, correct: 0, total: 0, graded: false };
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
    overlay.className = 'esc-overlay';
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
    if (session.mode !== 'review') {
      counter.textContent = `${session.idx + 1} / ${session.queue.length}`;
    } else {
      counter.textContent = '';
    }
    const item = session.queue[session.idx];

    if (session.mode === 'flashcard') return renderFlash(body, item);
    if (session.mode === 'fill') return renderCloze(body, { example: item.example, word: item.word });
    if (session.mode === 'spelling') return renderDictation(body, item);
    if (session.mode === 'choice' || session.mode === 'vocabQuiz') return renderChoice(body, item);
    if (session.mode === 'cloze') return renderCloze(body, { example: item.example, word: item.word });
    if (session.mode === 'sentence') return renderArticleSentence(body, item);
    if (session.mode === 'review') return renderArticleReview(body, item);
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
      body.innerHTML = `
        <div class="esc-empty" style="padding:32px 0">
          ${icon('check-circle', 'esc-ico')}
          <p class="esc-empty-title" style="margin-top:16px">本轮完成！</p>
          <p class="esc-empty-desc">答对 ${session.correct} / ${session.total}（正确率 ${acc}%）</p>
          <button class="esc-btn esc-btn-primary esc-btn-block" style="margin-top:20px;max-width:240px" data-act="done">完成</button>
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

    // 例句生成：无例句时补一个默认例句
    const exEn = body.querySelector('#exampleEn');
    const exZh = body.querySelector('#exampleZh');
    body.querySelector('#flashcardGenExampleBtn').addEventListener('click', () => {
      if (!ex.en) {
        ex.en = `"${w.word}" is a great word.`;
        ex.zh = '';
        exEn.textContent = ex.en;
        exZh.textContent = '';
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
  function renderChoice(body, w) {
    const word = String(w.word || '');
    const correct = w.meaning || w.mean || '(无释义)';
    const all = (Store.getVocab().length ? Store.getVocab() : FALLBACK).map((x) => x.meaning || x.mean).filter(Boolean);
    const opts = shuffle([correct, ...pickRandom(all, correct, 3)]).slice(0, 4);
    const pct = session.queue.length ? (((session.idx + 1) / session.queue.length) * 100).toFixed(1) : 0;

    body.innerHTML = `
      <div class="esc-fill">
        <div class="fill-top">
          <div class="fill-progress-track"><div class="fill-progress-fill" data-role="progress" style="width:${pct}%"></div></div>
        </div>
        <div class="fill-card" data-role="card">
          <div class="choice-prompt">
            <span class="choice-word" data-role="word">${esc(word)}</span>
            <button class="sq-play-btn" data-act="play" title="播放发音">${CHOICE_VOL_SVG}</button>
          </div>
          <div class="fill-letter-hint" data-role="hint"></div>
          <div class="choice-option-grid" data-role="opts">
            ${opts.map((o, i) => `<button class="choice-opt" data-i="${i}" data-correct="${o === correct ? '1' : '0'}">${esc(o)}</button>`).join('')}
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

    body.querySelector('[data-act="play"]').addEventListener('click', (e) => { e.stopPropagation(); Speech.speak(w.word || word); });
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
      if (answered || hintUsed) return;
      hintUsed = true;
      const first = word.charAt(0) || '_';
      const rest = word.length > 1 ? '·'.repeat(word.length - 1) : '';
      wordEl.innerHTML = `${esc(first)}<span class="choice-mask">${esc(rest)}</span>`;
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
  function renderCloze(body, w) {
    const word = String(w.word || '').toLowerCase();
    const meaning = w.meaning || w.mean || '(无释义)';
    const exTxt = (w.example && typeof w.example === 'object') ? (w.example.en || '') : (w.example || '');
    const sentenceHtml = exTxt
      ? esc(exTxt.replace(new RegExp(word, 'i'), '␀')).split('␀').join('<span class="fill-blank">______</span>')
      : '<span class="fill-no-sentence">（无例句）</span>';
    const pct = session.queue.length ? (((session.idx + 1) / session.queue.length) * 100).toFixed(1) : 0;

    body.innerHTML = `
      <div class="esc-fill">
        <div class="fill-top">
          <div class="fill-progress-track"><div class="fill-progress-fill" data-role="progress" style="width:${pct}%"></div></div>
        </div>
        <div class="fill-card" data-role="card">
          <div class="fill-meaning">${esc(meaning)}</div>
          <div class="fill-sentence">${sentenceHtml}</div>
          <div class="fill-letter-hint" data-role="hint"></div>
          <div class="fill-letter-grid" data-role="grid"></div>
          <button class="fill-check-btn" data-act="check">${icon('check')}<span>检查</span></button>
          <input type="text" class="fill-hidden-input" data-role="ans" autocomplete="off" spellcheck="false" maxlength="50" />
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
    const ans = body.querySelector('[data-role="ans"]');
    const checkBtn = body.querySelector('[data-act="check"]');
    const hintBtn = body.querySelector('[data-act="hint"]');

    const slotChars = new Array(word.length).fill('');
    let active = 0, checked = false;
    const revealed = new Set();

    function renderBoxes() {
      grid.querySelectorAll('.letter-box').forEach((b, i) => {
        b.textContent = slotChars[i] || '';
        b.classList.toggle('filled', !!slotChars[i]);
        b.classList.toggle('active-slot', i === active);
      });
    }

    function buildGrid() {
      grid.innerHTML = '';
      for (let i = 0; i < word.length; i++) {
        const box = document.createElement('span');
        box.className = 'letter-box';
        box.dataset.index = i;
        box.addEventListener('click', (e) => { e.stopPropagation(); active = i; renderBoxes(); ans.focus(); });
        grid.appendChild(box);
      }
      renderBoxes();
    }

    function renderHint() {
      if (revealed.size === 0) { hintEl.classList.remove('show'); hintEl.innerHTML = ''; return; }
      hintEl.innerHTML = word.split('').map((ch, i) =>
        `<span class="fill-letter-box${revealed.has(i) ? ' revealed' : ''}">${revealed.has(i) ? esc(ch) : '_'}</span>`).join('');
      hintEl.classList.add('show');
      hintBtn.disabled = revealed.size >= word.length;
    }

    function normalizeInput(val) {
      return val
        .replace(/[\uFF41-\uFF5A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[\uFF21-\uFF3A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[^a-zA-Z]/g, '');
    }

    // 错字按位标注 + 展示正确答案
    function revealWrong() {
      const boxes = grid.querySelectorAll('.letter-box');
      boxes.forEach((b, i) => {
        const ch = slotChars[i];
        setTimeout(() => {
          if (ch && ch === word[i]) b.classList.add('correct');
          else { b.classList.add('wrong'); b.textContent = word[i]; }
        }, i * 40);
      });
    }

    const submit = () => {
      if (checked) return; checked = true;
      const ok = slotChars.join('') === word;
      session.total++;
      if (ok) session.correct++;
      resultEl.innerHTML = ok
        ? '<span class="fill-correct">✓ 正确！</span>'
        : `<span class="fill-wrong">✗ 正确答案：<strong>${esc(word)}</strong></span>`;
      resultEl.className = 'fill-result ' + (ok ? 'fill-result-correct' : 'fill-result-wrong');
      card.classList.toggle('fill-card-correct', ok);
      card.classList.toggle('fill-card-wrong', !ok);
      checkBtn.disabled = true;
      ans.readOnly = true;
      if (ok) {
        grid.querySelectorAll('.letter-box').forEach((b, i) => setTimeout(() => b.classList.add('correct'), i * 30));
        setTimeout(next, 900);
      } else {
        revealWrong();
        setTimeout(next, 1500);
      }
    };

    const hint = () => {
      if (checked || revealed.size >= word.length) return;
      const round = revealed.size;
      let pos = round % 2 === 0 ? Math.floor(round / 2) : word.length - 1 - Math.floor(round / 2);
      if (pos < 0 || pos >= word.length || revealed.has(pos)) {
        for (let i = 0; i < word.length; i++) if (!revealed.has(i)) { pos = i; break; }
      }
      revealed.add(pos);
      slotChars[pos] = word[pos];
      active = pos;
      const box = grid.querySelector(`[data-index="${pos}"]`);
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
      renderBoxes();
      renderHint();
      ans.focus();
    };

    const skip = () => {
      if (checked) return; checked = true;
      session.total++;
      resultEl.innerHTML = '<span class="fill-skip">已跳过</span>';
      resultEl.className = 'fill-result fill-result-skip';
      checkBtn.disabled = true;
      setTimeout(next, 500);
    };

    ans.addEventListener('keydown', (e) => {
      if (checked) { e.preventDefault(); return; }
      if (e.key === 'Enter') { submit(); e.preventDefault(); return; }
      if (e.key === 'Backspace') {
        if (slotChars[active]) { slotChars[active] = ''; renderBoxes(); }
        else if (active > 0) { active--; renderBoxes(); }
        e.preventDefault(); return;
      }
      if (e.key === 'ArrowLeft') { active = Math.max(0, active - 1); renderBoxes(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { active = Math.min(word.length - 1, active + 1); renderBoxes(); e.preventDefault(); return; }
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        slotChars[active] = normalizeInput(e.key);
        renderBoxes();
        if (active < word.length - 1) { active++; renderBoxes(); }
        e.preventDefault();
      }
    });

    checkBtn.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    hintBtn.addEventListener('click', (e) => { e.stopPropagation(); hint(); });
    body.querySelector('[data-act="skip"]').addEventListener('click', (e) => { e.stopPropagation(); skip(); });
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      ans.focus();
    });

    buildGrid();
    ans.focus();
  }

  // 听写：听音拼写字母格（网页版 spell-card 结构，统一到 --study 主题）
  function renderDictation(body, w) {
    const word = String(w.word || '').toLowerCase();
    const meaning = w.meaning || w.mean || '';
    const pct = session.queue.length ? (((session.idx + 1) / session.queue.length) * 100).toFixed(1) : 0;

    body.innerHTML = `
      <div class="esc-fill">
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
          <input type="text" class="fill-hidden-input" data-role="ans" autocomplete="off" spellcheck="false" maxlength="50" />
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
    const ans = body.querySelector('[data-role="ans"]');
    const checkBtn = body.querySelector('[data-act="check"]');
    const hintBtn = body.querySelector('[data-act="hint"]');

    const slotChars = new Array(word.length).fill('');
    let active = 0, checked = false;
    const revealed = new Set();

    function renderBoxes() {
      grid.querySelectorAll('.letter-box').forEach((b, i) => {
        b.textContent = slotChars[i] || '';
        b.classList.toggle('filled', !!slotChars[i]);
        b.classList.toggle('active-slot', i === active);
      });
    }

    grid.innerHTML = '';
    for (let i = 0; i < word.length; i++) {
      const box = document.createElement('span');
      box.className = 'letter-box';
      box.dataset.index = i;
      box.addEventListener('click', (e) => { e.stopPropagation(); active = i; renderBoxes(); ans.focus(); });
      grid.appendChild(box);
    }
    renderBoxes();

    function renderHint() {
      if (revealed.size === 0) { hintEl.classList.remove('show'); hintEl.innerHTML = ''; return; }
      hintEl.innerHTML = word.split('').map((ch, i) =>
        `<span class="fill-letter-box${revealed.has(i) ? ' revealed' : ''}">${revealed.has(i) ? esc(ch) : '_'}</span>`).join('');
      hintEl.classList.add('show');
      hintBtn.disabled = revealed.size >= word.length;
    }

    function normalizeInput(val) {
      return val
        .replace(/[\uFF41-\uFF5A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[\uFF21-\uFF3A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[^a-zA-Z]/g, '');
    }

    const submit = () => {
      if (checked) return; checked = true;
      const ok = slotChars.join('') === word;
      session.total++;
      if (ok) session.correct++;
      resultEl.innerHTML = ok
        ? '<span class="fill-correct">✓ 正确！</span>'
        : `<span class="fill-wrong">✗ 正确答案：<strong>${esc(word)}</strong></span>`;
      resultEl.className = 'fill-result ' + (ok ? 'fill-result-correct' : 'fill-result-wrong');
      card.classList.toggle('fill-card-correct', ok);
      card.classList.toggle('fill-card-wrong', !ok);
      checkBtn.disabled = true;
      ans.readOnly = true;
      if (ok) {
        grid.querySelectorAll('.letter-box').forEach((b, i) => setTimeout(() => b.classList.add('correct'), i * 30));
        setTimeout(next, 900);
      } else {
        grid.querySelectorAll('.letter-box').forEach((b, i) => {
          const ch = slotChars[i];
          setTimeout(() => {
            if (ch && ch === word[i]) b.classList.add('correct');
            else { b.classList.add('wrong'); b.textContent = word[i]; }
          }, i * 40);
        });
        setTimeout(next, 1500);
      }
    };

    const hint = () => {
      if (checked || revealed.size >= word.length) return;
      const round = revealed.size;
      let pos = round % 2 === 0 ? Math.floor(round / 2) : word.length - 1 - Math.floor(round / 2);
      if (pos < 0 || pos >= word.length || revealed.has(pos)) {
        for (let i = 0; i < word.length; i++) if (!revealed.has(i)) { pos = i; break; }
      }
      revealed.add(pos);
      slotChars[pos] = word[pos];
      active = pos;
      const box = grid.querySelector(`[data-index="${pos}"]`);
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
      renderBoxes();
      renderHint();
      ans.focus();
    };

    ans.addEventListener('keydown', (e) => {
      if (checked) { e.preventDefault(); return; }
      if (e.key === 'Enter') { submit(); e.preventDefault(); return; }
      if (e.key === 'Backspace') {
        if (slotChars[active]) { slotChars[active] = ''; renderBoxes(); }
        else if (active > 0) { active--; renderBoxes(); }
        e.preventDefault(); return;
      }
      if (e.key === 'ArrowLeft') { active = Math.max(0, active - 1); renderBoxes(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { active = Math.min(word.length - 1, active + 1); renderBoxes(); e.preventDefault(); return; }
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        slotChars[active] = normalizeInput(e.key);
        renderBoxes();
        if (active < word.length - 1) { active++; renderBoxes(); }
        e.preventDefault();
      }
    });

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
    ans.focus();
  }

  // 逐句精读：逐句展示（不评分）
  function renderArticleSentence(body, sentence) {
    body.innerHTML = `
      <p class="esc-quiz-q">逐句精读</p>
      <div class="esc-sentence-block">${esc(sentence)}</div>
      <div style="display:flex;gap:12px;margin-top:20px">
        <button class="esc-btn esc-btn-ghost" data-act="prev" style="flex:1">上一句</button>
        <button class="esc-btn esc-btn-primary" data-act="next" style="flex:1">${session.idx + 1 >= session.queue.length ? '完成' : '下一句'}</button>
      </div>`;
    UI.refreshIcons(body);
    body.querySelector('[data-act="next"]').addEventListener('click', () => {
      if (session.idx + 1 >= session.queue.length) finish(); else next();
    });
    const prev = body.querySelector('[data-act="prev"]');
    if (prev) prev.addEventListener('click', () => { if (session.idx > 0) { session.idx--; step(); } });
  }

  // 全文回顾：展示整篇文章（只读，不评分）+ 7 种阅读风格切换
  const READING_STYLES = [
    { key: 'book', name: '书本' },
    { key: 'magazine', name: '杂志' },
    { key: 'newspaper', name: '报纸' },
    { key: 'cute', name: '可爱' },
    { key: 'pixel', name: '像素' },
    { key: 'minimal', name: '极简' },
    { key: 'classic', name: '典籍' }
  ];
  function renderArticleReview(body, item) {
    const current = Store.getReadingStyle();
    const styleBar = READING_STYLES.map((s) =>
      `<button class="esc-reading-style${s.key === current ? ' is-active' : ''}" data-style="${esc(s.key)}">${esc(s.name)}</button>`
    ).join('');
    body.innerHTML = `
      <p class="esc-quiz-q">${esc((item.title || (item.text || '').split('\n')[0] || '文章回顾').slice(0, 40))}</p>
      <p class="esc-quiz-ex">${esc(item.date || '')}</p>
      <div class="esc-reading-style-bar">${styleBar}</div>
      <div class="esc-review-text"><div class="esc-rs-${esc(current)}">${esc(item.text || '去深度解析一篇英文文章，这里就能回顾全文。')}</div></div>
      <button class="esc-btn esc-btn-primary esc-btn-block" style="margin-top:20px" data-act="done">完成</button>`;
    UI.refreshIcons(body);
    body.querySelector('[data-act="done"]').addEventListener('click', closeOverlay);
    body.querySelectorAll('.esc-reading-style').forEach((b) => {
      b.addEventListener('click', () => {
        const style = b.getAttribute('data-style');
        Store.setReadingStyle(style);
        // 仅更新风格条高亮与文本容器 class，避免重建整段导致滚动跳动
        body.querySelectorAll('.esc-reading-style').forEach((x) => x.classList.toggle('is-active', x === b));
        const reviewText = body.querySelector('.esc-review-text');
        reviewText.className = 'esc-review-text';
        reviewText.innerHTML = `<div class="esc-rs-${esc(style)}">${esc(item.text || '去深度解析一篇英文文章，这里就能回顾全文。')}</div>`;
      });
    });
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
