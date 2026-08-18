/* ============================================================
   views/memory.js — 记忆模式（底部导航 memory）
   组件与交互：
   · 顶部栏：标题 + 连续学习 N 天徽章
   · 学习进度卡：SVG 环形进度 + 今日目标/已完成 + 预计时间
   · 模式选择网格：闪卡 / 填空 / 听写 / 选择 / 单词测验 / 全文回顾
   · 学习计划卡：每日目标 + 进度 + 下次复习
   · 快速统计：待复习 / 已掌握 / 正确率
   · 快速复习入口
   · 练习弹层（overlay）：闪卡翻转、选择题、填空、听写、全文回顾
   状态：来自 Store.progress + settings.dailyGoal
   事件：模式卡点击（启动对应练习）、快速复习、练习内 认识/不认识、选项点击、提交
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, Speech = Mobile.Speech, Router = Mobile.Router;
  const esc = UI.esc, icon = UI.icon;

  const MODES = [
    { key: 'flashcard', name: '闪卡模式', desc: '翻转卡片记忆单词', ico: 'layers' },
    { key: 'cloze', name: '填空练习', desc: '根据上下文填写单词', ico: 'text-cursor-input' },
    { key: 'dictation', name: '听写练习', desc: '听发音拼写单词', ico: 'volume-2' },
    { key: 'choice', name: '选择练习', desc: '选择题形式巩固记忆', ico: 'list-checks' },
    { key: 'quiz', name: '单词测验', desc: '综合测试词汇掌握', ico: 'brain' },
    { key: 'fullreview', name: '全文回顾', desc: '回顾完整文章内容', ico: 'book-open' }
  ];

  const FALLBACK = [
    { word: 'serendipity', phonetic: 'ˌser.ənˈdɪp.ə.ti', meaning: '意外发现珍奇事物的本领', example: 'Life is full of serendipity.', exampleZh: '生活中处处充满意外惊喜。' },
    { word: 'eloquent', phonetic: 'ˈel.ə.kwənt', meaning: '雄辩的；有口才的', example: 'She gave an eloquent speech.', exampleZh: '她发表了一场感人至深的演讲。' },
    { word: 'ephemeral', phonetic: 'ɪˈfem.ər.əl', meaning: '短暂的；转瞬即逝的', example: 'Trends are ephemeral.', exampleZh: '潮流转瞬即逝。' },
    { word: 'pragmatic', phonetic: 'præɡˈmæt.ɪk', meaning: '务实的；实用主义的', example: 'A pragmatic approach.', exampleZh: '务实的方法。' },
    { word: 'resilient', phonetic: 'rɪˈzɪl.i.ənt', meaning: '有韧性的；能恢复的', example: 'Children are resilient.', exampleZh: '孩子更有韧性。' }
  ];

  let rootEl = null;

  function getQueue() {
    const vocab = Store.getVocab();
    let pool = vocab.length ? vocab.slice() : FALLBACK.map((w) => Object.assign({ id: 'fb-' + w.word }, w));
    // 未掌握优先
    pool.sort((a, b) => (a.status === 'mastered' ? 1 : 0) - (b.status === 'mastered' ? 1 : 0));
    return pool.slice(0, 10);
  }

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

    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('flame', 'esc-logo')}<h1>记忆模式</h1></div>
          <div class="esc-badge">${icon('flame')}<span>连续学习 <b style="color:var(--study-warning)">${esc(p.streak)}</b> 天</span></div>
        </header>

        <section class="esc-card" style="margin-top:20px">
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
        </section>

        <section style="margin-top:20px">
          <div class="esc-section-title">${icon('layers')}<span>选择练习模式</span></div>
          <div class="esc-mode-grid">
            ${MODES.map((m) => `
              <button class="esc-mode" data-mode="${m.key}">
                <div class="esc-mode-ico">${icon(m.ico)}</div>
                <div><p class="esc-mode-name">${esc(m.name)}</p><p class="esc-mode-desc">${esc(m.desc)}</p></div>
              </button>`).join('')}
          </div>
        </section>

        <section style="margin-top:20px">
          <div class="esc-section-title">${icon('trophy')}<span>当前学习计划</span></div>
          <div class="esc-card">
            <div class="esc-plan"><span class="esc-plan-name">每日 ${goal} 词</span><span class="esc-plan-state">进行中</span></div>
            <div class="esc-progress" style="margin-bottom:12px"><i style="width:${pct}%;background:linear-gradient(90deg,var(--study-primary),var(--study-success))"></i></div>
            <div class="esc-plan-foot"><span>进度 ${done}/${goal}</span><span style="display:flex;align-items:center;gap:4px">${icon('alarm-clock')}下次复习：明天 09:00</span></div>
          </div>
        </section>

        <section style="margin-top:20px">
          <div class="esc-grid-3">
            <div class="esc-stat"><div class="esc-num">${esc(p.reviewDue)}</div><div class="esc-label">待复习</div></div>
            <div class="esc-stat"><div class="esc-num is-success">${esc(p.masteredCount)}</div><div class="esc-label">已掌握</div></div>
            <div class="esc-stat"><div class="esc-num is-foreground">${esc(p.correctRate)}<span style="font-size:12px">%</span></div><div class="esc-label">正确率</div></div>
          </div>
        </section>

        <section style="margin-top:20px">
          <div class="esc-quick" data-mode="flashcard">
            <div class="esc-quick-ico">${icon('zap')}</div>
            <div style="flex:1"><p class="esc-quick-title">快速复习</p><p class="esc-quick-desc">基于遗忘曲线，复习今日薄弱词汇</p></div>
            ${icon('chevron-right')}
          </div>
        </section>
      </div>`;

    rootEl = container;
    container.querySelectorAll('[data-mode]').forEach((el) => {
      el.addEventListener('click', () => openExercise(el.getAttribute('data-mode')));
    });
    UI.refreshIcons(container);
  }

  // ---------------- 练习弹层 ----------------
  let overlay = null;
  let session = null;

  function closeOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; session = null;
  }

  function openExercise(mode) {
    const queue = getQueue();
    if (!queue.length) { UI.toast('暂无可练习单词'); return; }
    session = { mode, queue, idx: 0, correct: 0, total: 0 };
    overlay = document.createElement('div');
    overlay.className = 'esc-overlay';
    overlay.innerHTML = `
      <div class="esc-overlay-head">
        <button class="esc-icon-btn" data-act="close" aria-label="关闭">${icon('x')}</button>
        <span class="esc-overlay-title">${esc(modeName(mode))}</span>
        <span class="esc-row-right" data-role="counter"></span>
      </div>
      <div class="esc-overlay-body" data-role="body"></div>`;
    document.querySelector('.esc-app').appendChild(overlay);
    overlay.querySelector('[data-act="close"]').addEventListener('click', closeOverlay);
    UI.refreshIcons(overlay);
    step();
  }

  function modeName(m) { const x = MODES.find((o) => o.key === m); return x ? x.name : '练习'; }

  function step() {
    if (!session) return;
    const body = overlay.querySelector('[data-role="body"]');
    const counter = overlay.querySelector('[data-role="counter"]');
    counter.textContent = `${session.idx + 1} / ${session.queue.length}`;
    const w = session.queue[session.idx];

    if (session.mode === 'flashcard') return renderFlash(body, w);
    if (session.mode === 'cloze') return renderCloze(body, w);
    if (session.mode === 'dictation') return renderDictation(body, w);
    if (session.mode === 'fullreview') return renderFullReview(body);
    return renderChoice(body, w); // choice / quiz
  }

  function next() {
    session.idx++;
    if (session.idx >= session.queue.length) return finish();
    step();
  }

  function finish() {
    const acc = session.total ? Math.round((session.correct / session.total) * 100) : 0;
    // 更新进度（轻量）
    const p = Store.getProgress();
    const s = Store.getSettings();
    Store.updateProgress({
      todayCount: Math.min(s.dailyGoal || 20, p.todayCount + session.total),
      correctRate: acc || p.correctRate,
      reviewDue: Math.max(0, p.reviewDue - session.correct)
    });
    const body = overlay.querySelector('[data-role="body"]');
    body.innerHTML = `
      <div class="esc-empty" style="padding:32px 0">
        ${icon('check-circle', 'esc-ico')}
        <p class="esc-empty-title" style="margin-top:16px">本轮完成！</p>
        <p class="esc-empty-desc">答对 ${session.correct} / ${session.total}（正确率 ${acc}%）</p>
        <button class="esc-btn esc-btn-primary esc-btn-block" style="margin-top:20px;max-width:240px" data-act="done">完成</button>
      </div>`;
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
            <p class="esc-flash-back">${esc(w.pos ? w.pos + '. ' : '')}${esc(w.meaning || '')}</p>
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
        if (ok) session.correct++; else {
          body.querySelector('.esc-quiz-opt[data-correct="1"]').classList.add('is-correct');
        }
        body.querySelectorAll('.esc-quiz-opt').forEach((x) => (x.disabled = true));
        fb.textContent = ok ? '回答正确！' : '正确答案已标出';
        fb.className = 'esc-quiz-feedback ' + (ok ? 'is-ok' : 'is-bad');
        setTimeout(next, 800);
      });
    });
  }

  // 填空：例句挖空，填写单词
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

  // 全文回顾：展示最近一篇历史文章
  function renderFullReview(body) {
    const hist = Store.getHistory();
    const item = hist[0];
    body.innerHTML = `
      <p class="esc-quiz-q">${esc(item ? item.title || '文章回顾' : '暂无文章')}</p>
      <p class="esc-quiz-ex">${esc(item ? item.date || '' : '')}</p>
      <div style="font-size:15px;line-height:1.8;color:var(--study-foreground);white-space:pre-wrap">${esc(item ? item.text : '去深度解析一篇英文文章，这里就能回顾全文。')}</div>`;
    UI.refreshIcons(body);
  }

  // 工具
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickRandom(arr, exclude, n) {
    const pool = arr.filter((x) => x && x !== exclude);
    return shuffle(pool).slice(0, n);
  }

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.memory = { render };
})(window);
