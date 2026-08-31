/* ============================================================
   theme_color.js — 60-25-15 主题配色自定义（桌面端）
   · 三种色（60% 中性 / 25% 主品牌 / 15% 强调）可自定义并存 localStorage。
   · 应用 CSS 变量（--study-*），自动派生前景色与明暗灰阶。
   · 通过 fillThemeColorSettings 向设置面板注入配色 UI。
   ============================================================ */
(function() {
  'use strict';

  /* ---------- 颜色工具 ---------- */
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

  const KEYS = { neutral: 'themeNeutral', primary: 'themePrimary', accent: 'themeAccent' };

  function getStored() {
    const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    return { neutral: read(KEYS.neutral), primary: read(KEYS.primary), accent: read(KEYS.accent) };
  }
  function save(key, val) {
    try { val ? localStorage.setItem(KEYS[key], val) : localStorage.removeItem(KEYS[key]); } catch (e) { /* ignore */ }
  }
  function resetAll() { ['neutral', 'primary', 'accent'].forEach((k) => save(k, null)); }

  const THEME_COLOR_VARS = [
    '--study-primary', '--study-primary-foreground', '--study-ring',
    '--study-accent', '--study-accent-foreground', '--study-accent-hover',
    '--study-background', '--study-foreground', '--study-card', '--study-card-foreground',
    '--study-popover', '--study-popover-foreground', '--study-muted', '--study-muted-foreground',
    '--study-border', '--study-input'
  ];

  function applyColorTheme(colors, dark) {
    const root = document.documentElement;
    THEME_COLOR_VARS.forEach((v) => root.style.removeProperty(v));

    // 25% 主品牌色
    if (colors.primary) {
      root.style.setProperty('--study-primary', colors.primary);
      root.style.setProperty('--study-ring', colors.primary);
      root.style.setProperty('--study-primary-foreground', pickForeground(colors.primary));
    }
    // 15% 强调色
    if (colors.accent) {
      root.style.setProperty('--study-accent', colors.accent);
      root.style.setProperty('--study-accent-foreground', pickForeground(colors.accent));
      root.style.setProperty('--study-accent-hover', adjustL(colors.accent, -8));
    }
    // 60% 中性色
    if (colors.neutral) {
      const c = hexToRgb(colors.neutral);
      if (c) {
        const hsl = rgbToHsl(c.r, c.g, c.b);
        if (dark) {
          root.style.setProperty('--study-background', hslToHex(hsl.h, Math.min(hsl.s, 12), 13));
          root.style.setProperty('--study-card', hslToHex(hsl.h, Math.min(hsl.s, 12), 17));
          root.style.setProperty('--study-popover', hslToHex(hsl.h, Math.min(hsl.s, 12), 19));
          root.style.setProperty('--study-muted', hslToHex(hsl.h, Math.min(hsl.s, 12), 21));
          root.style.setProperty('--study-border', hslToHex(hsl.h, Math.min(hsl.s, 10), 26));
          root.style.setProperty('--study-input', hslToHex(hsl.h, Math.min(hsl.s, 10), 26));
          root.style.setProperty('--study-foreground', '#E8E8E8');
          root.style.setProperty('--study-card-foreground', '#E8E8E8');
          root.style.setProperty('--study-popover-foreground', '#E8E8E8');
          root.style.setProperty('--study-muted-foreground', '#9A9EA8');
        } else {
          root.style.setProperty('--study-background', colors.neutral);
          root.style.setProperty('--study-card', adjustL(colors.neutral, 10));
          root.style.setProperty('--study-popover', adjustL(colors.neutral, 10));
          root.style.setProperty('--study-muted', adjustL(colors.neutral, -4));
          root.style.setProperty('--study-border', adjustL(colors.neutral, -10));
          root.style.setProperty('--study-input', adjustL(colors.neutral, -7));
          root.style.setProperty('--study-foreground', '#202020');
          root.style.setProperty('--study-card-foreground', '#202020');
          root.style.setProperty('--study-popover-foreground', '#202020');
          root.style.setProperty('--study-muted-foreground', '#7A8494');
        }
      }
    }
  }

  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  // 启用主题插件时跳过自定义配色，避免内联变量覆盖主题的语义色
  function pluginActive() { return !!(window.ThemePlugin && window.ThemePlugin.isEnabled()); }
  function apply() { if (pluginActive()) return; applyColorTheme(getStored(), isDark()); }

  function defaults(dark) {
    const c = getStored();
    return {
      neutral: c.neutral || (dark ? '#1A1C1E' : '#FFFFFF'),
      primary: c.primary || (dark ? '#7A8AAA' : '#506080'),
      accent: c.accent || (dark ? '#D07A5A' : '#E07B5A')
    };
  }

  function fillThemeColorSettings(modalContainer) {
    if (!modalContainer) return;
    const dark = isDark();
    const col = defaults(dark);
    const section = document.createElement('div');
    section.innerHTML = `
      <style>
        .tc-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; }
        .tc-label { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--text, #202020); }
        .tc-label small { color: var(--text-light, #7A8494); font-size: 11px; }
        .tc-swatch { position: relative; width: 46px; height: 28px; border-radius: 8px; overflow: hidden; cursor: pointer; box-shadow: inset 0 0 0 1px var(--border, #E2E6EB); flex: 0 0 auto; }
        .tc-swatch input[type=color] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; padding: 0; }
        .tc-reset { margin-top: 6px; font-size: 12px; color: var(--text-light, #7A8494); cursor: pointer; text-decoration: underline; user-select: none; }
        .tc-reset:hover { color: var(--text, #202020); }
      </style>
      <div class="setting-header-row">
        <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg> 主题配色（60·25·15）</h3>
      </div>
      <div class="tc-row"><span class="tc-label">中性色 <small>60%</small></span><label class="tc-swatch" style="background:${col.neutral}"><input type="color" data-color="neutral" value="${col.neutral}"></label></div>
      <div class="tc-row"><span class="tc-label">主品牌色 <small>25%</small></span><label class="tc-swatch" style="background:${col.primary}"><input type="color" data-color="primary" value="${col.primary}"></label></div>
      <div class="tc-row"><span class="tc-label">强调色 <small>15%</small></span><label class="tc-swatch" style="background:${col.accent}"><input type="color" data-color="accent" value="${col.accent}"></label></div>
      <div class="tc-reset" data-act="tc-reset">恢复默认配色</div>
    `;
    modalContainer.appendChild(section);

    section.querySelectorAll('input[type=color]').forEach((input) => {
      input.addEventListener('change', () => {
        save(input.getAttribute('data-color'), input.value || null);
        const sw = input.closest('.tc-swatch'); if (sw) sw.style.background = input.value;
        apply();
      });
    });
    section.querySelector('[data-act="tc-reset"]').addEventListener('click', () => {
      resetAll();
      apply();
      const c = defaults(isDark());
      section.querySelectorAll('input[type=color]').forEach((input) => {
        const k = input.getAttribute('data-color');
        input.value = c[k];
        const sw = input.closest('.tc-swatch'); if (sw) sw.style.background = c[k];
      });
    });
  }

  window.fillThemeColorSettings = fillThemeColorSettings;
  window.applyThemeColors = apply;

  function init() {
    apply();
    try {
      new MutationObserver(() => apply()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) { /* ignore */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();