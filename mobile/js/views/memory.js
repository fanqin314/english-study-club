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
  // 单词练习队列：生词优先，未掌握在前，取前 10
  function buildWordQueue() {
    const vocab = Store.getVocab();
    let pool = vocab.length ? vocab.slice() : FALLBACK.map((w) => Object.assign({ id: 'fb-' + w.word }, w));
    pool.sort((a, b) => (a.status === 'mastered' ? 1 : 0) - (b.status === 'mastered' ? 1 : 0));
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

    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('flame', 'esc-logo')}<h1>记忆模式</h1></div>
          <div class="esc-badge">${icon('flame')}<span>连续学习 <b style="color:var(--study-warning)">${esc(p.streak)}</b> 天</span></div>
        </header>

        <!-- 学习进度卡 -->
        <section class="esc-card" style="margin-top:16px">
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
          <div class="esc-nbcard">
            <div class="esc-nb-ico">${icon('book-open')}</div>
            <div class="esc-nb-info">
              <div class="esc-nb-name">默认生词本</div>
              <div class="esc-nb-sub">${vocabCount} 个生词</div>
            </div>
            <div class="esc-nb-count">${vocabCount} 词</div>
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
    // 文章选择
    const sel = root.querySelector('#m-art');
    if (sel) sel.addEventListener('change', () => { selectedArticleId = sel.value; });
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

  // ---------------- 练习弹层 ----------------
  let overlay = null;
  let session = null;

  function closeOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    session = null;
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
      const s = Store.getSettings();
      Store.updateProgress({
        todayCount: p.todayCount + session.total,          // 不截断，真实累计练习量
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
    UI.refreshIcons(body);
    body.querySelector('[data-act="done"]').addEventListener('click', closeOverlay);
  }

  // 闪卡：点击翻转，认识/不认识
  function renderFlash(body, w) {
    body.innerHTML = `
      <div class="esc-flash">
        <div class="esc-flash-inner" data-act="flip">
          <p class="esc-flash-word">${esc(w.word)}</p>
          ${w.phonetic ? `<p class="esc-flash-phon">/${esc(w.phonetic)}/</p>` : ''}
          <div class="esc-flash-back esc-hidden">
            <p>${esc((w.pos ? w.pos + '. ' : '') + (w.meaning || ''))}</p>
            ${w.example ? `<p class="esc-flash-back esc-muted">"${esc(w.example)}"</p>` : ''}
          </div>
          <p class="esc-flash-hint">点击卡片查看释义</p>
        </div>
      </div>
      <div class="esc-flash-actions">
        <button class="esc-btn esc-btn-ghost" data-act="no">不认识</button>
        <button class="esc-btn esc-btn-primary" data-act="yes">认识</button>
      </div>`;
    UI.refreshIcons(body);
    const inner = body.querySelector('[data-act="flip"]');
    const back = inner.querySelector('.esc-flash-back');
    const hint = inner.querySelector('.esc-flash-hint');
    inner.addEventListener('click', () => {
      back.classList.toggle('esc-hidden');
      hint.textContent = back.classList.contains('esc-hidden') ? '点击卡片查看释义' : '点击收起';
    });
    body.querySelector('[data-act="yes"]').addEventListener('click', () => { session.total++; session.correct++; next(); });
    body.querySelector('[data-act="no"]').addEventListener('click', () => { session.total++; next(); });
  }

  // 选择：选出正确释义
  function renderChoice(body, w) {
    const all = (Store.getVocab().length ? Store.getVocab() : FALLBACK).map((x) => x.meaning || x.mean).filter(Boolean);
    const opts = shuffle([w.meaning || w.mean, ...pickRandom(all, w.meaning || w.mean, 3)]).slice(0, 4);
    body.innerHTML = `
      <p class="esc-quiz-q">${esc(w.word)}</p>
      ${w.example ? `<p class="esc-quiz-ex">${esc(w.example)}</p>` : ''}
      <div class="esc-quiz-options">
        ${opts.map((o, i) => `<button class="esc-quiz-opt" data-opt="${i}" data-correct="${o === (w.meaning || w.mean) ? '1' : '0'}">${esc(o)}</button>`).join('')}
      </div>
      <p class="esc-quiz-feedback"></p>`;
    UI.refreshIcons(body);
    const fb = body.querySelector('.esc-quiz-feedback');
    body.querySelectorAll('.esc-quiz-opt').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        session.total++;
        const ok = b.getAttribute('data-correct') === '1';
        b.classList.add(ok ? 'is-correct' : 'is-wrong');
        if (ok) session.correct++;
        else body.querySelector('.esc-quiz-opt[data-correct="1"]').classList.add('is-correct');
        body.querySelectorAll('.esc-quiz-opt').forEach((x) => (x.disabled = true));
        fb.textContent = ok ? '回答正确！' : '正确答案已标出';
        fb.className = 'esc-quiz-feedback ' + (ok ? 'is-ok' : 'is-bad');
        setTimeout(next, 800);
      });
    });
  }

  // 填空：例句/文章句挖空，填写单词
  function renderCloze(body, w) {
    const ex = w.example || (w.word + ' 是一个例子。');
    const filled = ex.replace(new RegExp(w.word, 'i'), '______');
    body.innerHTML = `
      <p class="esc-quiz-q">根据上下文填写单词</p>
      <p class="esc-quiz-ex">${esc(filled)}</p>
      <input class="esc-input esc-quiz-input" data-role="ans" placeholder="输入单词..." />
      <button class="esc-btn esc-btn-primary esc-btn-block" data-act="submit">提交</button>
      <p class="esc-quiz-feedback"></p>`;
    UI.refreshIcons(body);
    const ans = body.querySelector('[data-role="ans"]');
    const fb = body.querySelector('.esc-quiz-feedback');
    ans.focus();
    const submit = () => {
      session.total++;
      const ok = ans.value.trim().toLowerCase() === w.word.toLowerCase();
      if (ok) session.correct++;
      fb.textContent = ok ? '正确！' : `正确答案：${w.word}`;
      fb.className = 'esc-quiz-feedback ' + (ok ? 'is-ok' : 'is-bad');
      setTimeout(next, 900);
    };
    body.querySelector('[data-act="submit"]').addEventListener('click', submit);
    ans.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  // 听写：听发音，拼写单词
  function renderDictation(body, w) {
    body.innerHTML = `
      <p class="esc-quiz-q">听发音，拼写单词</p>
      <button class="esc-btn esc-btn-ghost esc-btn-block" data-act="play" style="margin-bottom:16px">${icon('volume-2')}<span>播放发音</span></button>
      <input class="esc-input esc-quiz-input" data-role="ans" placeholder="输入拼写..." />
      <button class="esc-btn esc-btn-primary esc-btn-block" data-act="submit">提交</button>
      <p class="esc-quiz-feedback"></p>`;
    UI.refreshIcons(body);
    const ans = body.querySelector('[data-role="ans"]');
    const fb = body.querySelector('.esc-quiz-feedback');
    Speech.speak(w.word);
    ans.focus();
    body.querySelector('[data-act="play"]').addEventListener('click', () => Speech.speak(w.word));
    const submit = () => {
      session.total++;
      const ok = ans.value.trim().toLowerCase() === w.word.toLowerCase();
      if (ok) session.correct++;
      fb.textContent = ok ? '正确！' : `正确答案：${w.word}`;
      fb.className = 'esc-quiz-feedback ' + (ok ? 'is-ok' : 'is-bad');
      setTimeout(next, 900);
    };
    body.querySelector('[data-act="submit"]').addEventListener('click', submit);
    ans.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
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

  // 全文回顾：展示整篇文章（只读，不评分）
  function renderArticleReview(body, item) {
    body.innerHTML = `
      <p class="esc-quiz-q">${esc((item.title || (item.text || '').split('\n')[0] || '文章回顾').slice(0, 40))}</p>
      <p class="esc-quiz-ex">${esc(item.date || '')}</p>
      <div class="esc-article-text">${esc(item.text || '去深度解析一篇英文文章，这里就能回顾全文。')}</div>
      <button class="esc-btn esc-btn-primary esc-btn-block" style="margin-top:20px" data-act="done">完成</button>`;
    UI.refreshIcons(body);
    body.querySelector('[data-act="done"]').addEventListener('click', closeOverlay);
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

  // 点击底部导航离开时关闭练习弹层（修复残留/泄漏）
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav-key]') && overlay) closeOverlay();
  });

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.memory = { render, closeOverlay };
})(window);
