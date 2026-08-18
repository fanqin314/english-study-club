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
  const SUB_VIEWS = ['history'];

  let current = null;

  function viewContainer(key) {
    return doc.querySelector(`.esc-view[data-view="${key}"]`);
  }

  function setNavActive(key) {
    doc.querySelectorAll('[data-nav-key]').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-nav-key') === key);
    });
  }

  function go(key, params) {
    if (!NAV_KEYS.includes(key)) key = 'home';
    const container = viewContainer(key);
    if (!container) return;
    // 切换可见性
    doc.querySelectorAll('.esc-view').forEach((v) => { v.hidden = true; });
    container.hidden = false;
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
    const view = Mobile.Views && Mobile.Views[key];
    if (view && typeof view.render === 'function') {
      try { view.render(container, params || {}); }
      catch (e) { console.error('[router] render error', key, e); container.innerHTML = `<div class="esc-page"><div class="esc-empty"><p class="esc-empty-title">页面渲染出错</p></div></div>`; }
    }
    if (location.hash !== '#/' + key) {
      try { history.replaceState(null, '', '#/' + key); } catch (e) { /* ignore */ }
    }
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
    // 初始路由
    const fromHash = (location.hash || '').replace('#/', '');
    go(NAV_KEYS.includes(fromHash) ? fromHash : 'home');
  }

  Mobile.Router = { go, init, get current() { return current; } };
})(window);
