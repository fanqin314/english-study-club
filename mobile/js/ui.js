/* ============================================================
   ui.js — 移动端视图共享辅助（转义 / 图标 / toast / lucide 刷新）
   所有视图统一通过这些函数生成 DOM，避免 XSS 并保证图标渲染。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});

  // HTML 转义，防止用户输入/解析结果注入
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 生成 lucide 图标占位（渲染后需 refreshIcons）
  function icon(name, cls) {
    return `<i data-lucide="${esc(name)}" class="${cls || 'esc-ico'}"></i>`;
  }

  // 刷新 lucide 图标（lucide 1.x 扫描整个文档；已转换的 <i> 会变成 <svg> 不会重复）
  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      try { global.lucide.createIcons(); } catch (e) { /* ignore */ }
    }
  }

  // 轻提示（复用桌面端 toast 风格）
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('esc-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
  }

  // 简易确认（移动端友好）
  function confirmDialog(msg) {
    return global.confirm(msg);
  }

  Mobile.UI = { esc, icon, refreshIcons, toast, confirmDialog };
})(window);
