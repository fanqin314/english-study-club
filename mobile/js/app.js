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
    applyColors(s);
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
