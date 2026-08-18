/* ============================================================
   app.js — 移动端引导
   · 应用已保存的主题（深色）/ 字体大小
   · 初始化路由（渲染当前视图 + 绑定底部导航）
   · 订阅 settings 事件，主题/字体变化即时生效
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const Store = Mobile.Store;

  function applyPrefs() {
    const s = Store.getSettings();
    document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-fontsize', s.fontSize || 'medium');
  }

  function boot() {
    applyPrefs();
    Store.on('settings', applyPrefs);
    Mobile.Router.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
