/* ============================================================
   router.js — 移动端视图路由 + 底部导航状态管理
   · 视图在 Mobile.Views[key] 注册（每个含 render(container, params)）。
   · go(key, params)：切换可见视图、更新导航 active、调用视图渲染。
   · 支持 hash 深链（#/home 等）与导航栏点击事件绑定。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});
  const doc = document;

  const NAV_KEYS = ['home', 'vocab', 'history', 'memory', 'settings'];

  // 二级页面：仅通过顶栏/内部入口进入，需返回键，且不显示底部 tab 栏
  const SUB_VIEWS = ['history', 'detail'];

  let current = null;
  let switching = false;

  function viewContainer(key) {
    return doc.querySelector(`.esc-view[data-view="${key}"]`);
  }

  function setNavActive(key) {
    doc.querySelectorAll('[data-nav-key]').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-nav-key') === key);
    });
  }

  function renderView(key, container, params) {
    const view = Mobile.Views && Mobile.Views[key];
    if (view && typeof view.render === 'function') {
      try { view.render(container, params || {}); }
      catch (e) { console.error('[router] render error', key, e); container.innerHTML = `<div class="esc-page"><div class="esc-empty"><p class="esc-empty-title">页面渲染出错</p></div></div>`; }
    }
  }

  function go(key, params) {
    if (switching) return;
    if (!NAV_KEYS.includes(key) && !SUB_VIEWS.includes(key)) key = 'home';
    const container = viewContainer(key);
    if (!container) return;
    const prevKey = current;

    // 转场：新视图淡入，旧视图立即隐藏（避免绝对叠放布局问题）
    container.hidden = false;
    container.classList.remove('is-leaving');
    container.classList.add('is-entering');
    setNavActive(key);
    current = key;

    // 二级页面：隐藏底部 tab 栏
    const isSub = SUB_VIEWS.includes(key);
    const nav = doc.querySelector('.esc-nav[data-mobile-nav="global"]');
    if (nav) nav.hidden = isSub;
    doc.body.classList.toggle('esc-sub-view', isSub);
    // 滚动复位
    const main = doc.querySelector('.esc-main');
    if (main) main.scrollTop = 0;
    // 渲染视图
    renderView(key, container, params);

    // 转场收尾：旧视图隐藏，新视图淡入完成
    switching = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      doc.querySelectorAll('.esc-view').forEach((v) => { if (v !== container) v.hidden = true; });
      container.classList.remove('is-entering');
      switching = false;
    }));

    if (location.hash !== '#/' + key) {
      try { history.replaceState(null, '', '#/' + key); } catch (e) { /* ignore */ }
    }
  }

  // 相邻导航切换（用于左右滑动手势）
  function goByOffset(offset) {
    if (!current) return;
    const i = NAV_KEYS.indexOf(current);
    if (i < 0) return; // 二级页面（detail 等）不响应滑动切换
    const next = NAV_KEYS[i + offset];
    if (next) go(next);
  }

  // 左右滑动手势：在内容区水平滑动切换底部导航视图
  function bindSwipe(root) {
    let x0 = null, y0 = null, t0 = 0;
    const THRESH = 60;
    root.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    root.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      const dt = Date.now() - t0;
      x0 = y0 = null;
      if (dt > 600) return;                 // 过慢忽略
      if (Math.abs(dx) < THRESH || Math.abs(dx) < Math.abs(dy)) return; // 主要水平、达阈值
      goByOffset(dx < 0 ? 1 : -1);          // 左滑→下一个；右滑→上一个
    }, { passive: true });
  }

  // 下拉刷新：在内容容器顶部下拉超过阈值触发当前视图重绘
  function bindPullRefresh(root) {
    const main = root;
    let startY = null, ptrEl = null;
    function ensurePtr() {
      if (ptrEl) return ptrEl;
      ptrEl = doc.createElement('div');
      ptrEl.className = 'esc-ptr';
      ptrEl.innerHTML = '<span class="esc-spinner"></span><span>下拉刷新…</span>';
      main.appendChild(ptrEl);
      return ptrEl;
    }
    main.addEventListener('touchstart', (e) => {
      if (main.scrollTop <= 0 && e.touches.length === 1) startY = e.touches[0].clientY;
      else startY = null;
    }, { passive: true });
    main.addEventListener('touchmove', (e) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { if (ptrEl) ptrEl.style.height = '0'; return; }
      ensurePtr();
      ptrEl.style.height = Math.min(dy * 0.5, 56) + 'px';
      ptrEl.querySelector('span:last-child') && (ptrEl.children[1].textContent = dy > 64 ? '松开刷新…' : '下拉刷新…');
    }, { passive: true });
    main.addEventListener('touchend', (e) => {
      if (startY == null || !ptrEl) return;
      const dy = (e.changedTouches[0].clientY) - startY;
      startY = null;
      if (dy > 64) {
        ptrEl.style.height = '44px';
        ptrEl.children[1].textContent = '刷新中…';
        const key = current;
        setTimeout(() => {
          renderView(key, viewContainer(key), {});
          ptrEl.style.height = '0';
          if (Mobile.UI && Mobile.UI.toast) Mobile.UI.toast('已刷新');
        }, 480);
      } else {
        ptrEl.style.height = '0';
      }
    }, { passive: true });
  }

  function init() {
    // 导航点击
    doc.querySelectorAll('[data-nav-key]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        go(el.getAttribute('data-nav-key'));
      });
    });
    // 顶部「设置」图标快捷入口
    doc.querySelectorAll('[data-action="go-settings"]').forEach((el) => {
      el.addEventListener('click', () => go('settings'));
    });
    // 顶部「历史记录」图标快捷入口
    doc.querySelectorAll('[data-action="go-history"]').forEach((el) => {
      el.addEventListener('click', () => go('history'));
    });
    // 滑动手势 + 下拉刷新（绑定在 .esc-main 内容区，避免误触底部导航）
    const main = doc.querySelector('.esc-main') || doc.querySelector('.esc-app') || doc.body;
    bindSwipe(main);
    bindPullRefresh(main);
    // 初始路由
    const fromHash = (location.hash || '').replace('#/', '');
    go(NAV_KEYS.includes(fromHash) ? fromHash : 'home');
  }

  Mobile.Router = { go, goByOffset, init, get current() { return current; } };
})(window);
