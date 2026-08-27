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

  // 触摸水波纹：在宿主元素内生成一个扩散圆点（自动清理）
  function ripple(host, ev) {
    if (!host || host.classList.contains('esc-ripple-host')) {
      // 确保宿主具备定位上下文
      host.classList.add('esc-ripple-host');
    }
    const rect = host.getBoundingClientRect();
    // 波纹限制在点按处的一小块（≤56px），避免整卡铺满的大圆视觉上像是点了 header
    const size = Math.min(56, Math.max(rect.width, rect.height));
    const x = (ev && ev.clientX != null ? ev.clientX : rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (ev && ev.clientY != null ? ev.clientY : rect.top + rect.height / 2) - rect.top - size / 2;
    const dot = document.createElement('span');
    dot.className = 'esc-ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    host.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
    // 兜底清理
    setTimeout(() => { if (dot.parentNode) dot.remove(); }, 600);
  }

  // 统一底部弹层：从屏幕底部平滑滑入，背景同步模糊淡入
  // 返回 close()；opts.onClose 在关闭动画结束后触发
  function bottomSheet(html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'esc-bsheet-backdrop';
    wrap.innerHTML = `<div class="esc-bsheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const sheet = wrap.querySelector('.esc-bsheet');
    const close = function () {
      wrap.classList.remove('is-show');
      const done = () => { if (wrap.parentNode) wrap.remove(); if (typeof opts.onClose === 'function') opts.onClose(); };
      sheet.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 320); // 兜底
    };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    // 触发进场动画
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('is-show')));
    if (typeof opts.onOpen === 'function') opts.onOpen(sheet, close);
    return close;
  }

  // 全屏转场弹层（封装 .esc-overlay）：返回 close()
  function overlay(html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'esc-overlay';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const close = function () {
      wrap.style.transition = 'opacity .2s ease';
      wrap.style.opacity = '0';
      const done = () => { if (wrap.parentNode) wrap.remove(); if (typeof opts.onClose === 'function') opts.onClose(); };
      wrap.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 260);
    };
    if (typeof opts.onOpen === 'function') opts.onOpen(wrap, close);
    return close;
  }

  // 居中浮窗（模态）：屏幕中央弹出，背景遮罩；点击遮罩关闭。返回 close()
  function modal(html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'esc-modal-backdrop';
    wrap.innerHTML = `<div class="esc-modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const dlg = wrap.querySelector('.esc-modal');
    const close = function () {
      wrap.classList.remove('is-show');
      const done = () => { if (wrap.parentNode) wrap.remove(); if (typeof opts.onClose === 'function') opts.onClose(); };
      dlg.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 260);
    };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('is-show')));
    if (typeof opts.onOpen === 'function') opts.onOpen(dlg, close);
    return close;
  }

  Mobile.UI = { esc, icon, refreshIcons, toast, confirmDialog, ripple, bottomSheet, overlay, modal };
})(window);
