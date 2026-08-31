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

  /* ---------- 主题配色工具（60-25-15 三色自定义） ---------- */
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex || '');
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return { r: hue2rgb(p, q, h + 1 / 3) * 255, g: hue2rgb(p, q, h) * 255, b: hue2rgb(p, q, h - 1 / 3) * 255 };
  }
  function hslToHex(h, s, l) { const c = hslToRgb(h, s, l); return rgbToHex(c.r, c.g, c.b); }
  function pickForeground(hex) {
    const c = hexToRgb(hex);
    if (!c) return '#FFFFFF';
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.6 ? '#1A1C1E' : '#FFFFFF';
  }
  function adjustL(hex, delta) {
    const c = hexToRgb(hex); if (!c) return hex;
    const hsl = rgbToHsl(c.r, c.g, c.b);
    return hslToHex(hsl.h, hsl.s, Math.max(0, Math.min(100, hsl.l + delta)));
  }

  const THEME_COLOR_VARS = [
    '--study-primary', '--study-primary-foreground', '--study-ring',
    '--study-accent', '--study-accent-foreground', '--study-accent-hover',
    '--study-background', '--study-foreground', '--study-card', '--study-card-foreground',
    '--study-muted', '--study-muted-foreground', '--study-border', '--study-input'
  ];

  function applyColors(s) {
    const root = document.documentElement;
    const dark = !!s.darkMode;
    // 先清空旧的内联自定义变量，避免残留
    THEME_COLOR_VARS.forEach((v) => root.style.removeProperty(v));

    // 25% 主品牌色：导航 / 底部Tab / 标题
    if (s.themePrimary) {
      root.style.setProperty('--study-primary', s.themePrimary);
      root.style.setProperty('--study-ring', s.themePrimary);
      root.style.setProperty('--study-primary-foreground', pickForeground(s.themePrimary));
    }
    // 15% 强调色：关键按钮 / 选中态 / 小红点
    if (s.themeAccent) {
      root.style.setProperty('--study-accent', s.themeAccent);
      root.style.setProperty('--study-accent-foreground', pickForeground(s.themeAccent));
      root.style.setProperty('--study-accent-hover', adjustL(s.themeAccent, -8));
    }
    // 60% 中性色：背景 / 卡片 / 输入框（作为基调，派生明/暗两套灰阶保证可读性）
    if (s.themeNeutral) {
      const c = hexToRgb(s.themeNeutral);
      if (c) {
        const hsl = rgbToHsl(c.r, c.g, c.b);
        if (dark) {
          root.style.setProperty('--study-background', hslToHex(hsl.h, Math.min(hsl.s, 12), 13));
          root.style.setProperty('--study-card', hslToHex(hsl.h, Math.min(hsl.s, 12), 17));
          root.style.setProperty('--study-muted', hslToHex(hsl.h, Math.min(hsl.s, 12), 21));
          root.style.setProperty('--study-border', hslToHex(hsl.h, Math.min(hsl.s, 10), 26));
          root.style.setProperty('--study-input', hslToHex(hsl.h, Math.min(hsl.s, 10), 26));
          root.style.setProperty('--study-foreground', '#E8E8E8');
          root.style.setProperty('--study-card-foreground', '#E8E8E8');
          root.style.setProperty('--study-muted-foreground', '#9A9EA8');
        } else {
          root.style.setProperty('--study-background', s.themeNeutral);
          root.style.setProperty('--study-card', adjustL(s.themeNeutral, 10));
          root.style.setProperty('--study-muted', adjustL(s.themeNeutral, -4));
          root.style.setProperty('--study-border', adjustL(s.themeNeutral, -10));
          root.style.setProperty('--study-input', adjustL(s.themeNeutral, -7));
          root.style.setProperty('--study-foreground', '#202020');
          root.style.setProperty('--study-card-foreground', '#202020');
          root.style.setProperty('--study-muted-foreground', '#7A8494');
        }
      }
    }
  }

  function applyPrefs() {
    const s = Store.getSettings();
    document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-fontsize', s.fontSize || 'medium');
    document.body.classList.toggle('theme-brutal', !!s.brutalMode);
    applyColors(s);
  }

  // index.html 内含一份「冻结的旧版」静态预渲染快照（生词本 51 张卡、历史、记忆、设置等）。
  // 运行时所有视图都由 JS 重建/填充，这份静态快照只在 paint 尚未执行或偶发失败时闪现，
  // 导致「已删除的旧界面/功能」复现。启动阶段先清空这些挂载点，让 JS 成为唯一真相源。
  function clearStalePrerender() {
    ['m-nb-tabs', 'm-vocab-stats', 'm-vocab-list', 'm-hist-stats', 'm-hist-list'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    // memory / settings 由 render(container) 整体重建，清空其静态内容以防回退时闪现旧 UI
    document.querySelectorAll('.esc-view[data-view="memory"], .esc-view[data-view="settings"]')
      .forEach((s) => { if (!s.dataset.rendered) s.innerHTML = ''; });
  }

  // 软键盘感知：依据 visualViewport 计算键盘高度写入 --esc-kb，并给 <html> 加 .is-kb-open。
  // 练习界面的固定底栏与卡片内容据此自动上移、避开占据屏幕下半部的软键盘。
  function setupKeyboardAware() {
    const root = document.documentElement;
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    let ticking = false;
    const update = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        // 键盘 = 布局视口底部 与 可视视口底部 之间的间隙；
        // 部分安卓键盘会直接收缩布局视口（此时 vv.height≈innerHeight，间隙为 0，
        // 固定底栏本就落在可视区内，无需上移）。
        const kb = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
        root.style.setProperty('--esc-kb', kb + 'px');
        root.classList.toggle('is-kb-open', kb > 50);
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();
  }

  function boot() {
    applyPrefs();
    Store.on('settings', applyPrefs);
    clearStalePrerender();
    setupKeyboardAware();
    Mobile.Router.init();
    // 本地文件夹持久化（Obsidian 式）：进入软件即同步一次，并订阅数据变更自动落盘
    if (Mobile.FolderSync) {
      Mobile.FolderSync.bindStore();
      Mobile.FolderSync.syncOnStartup();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
