/* ============================================================
   themes/theme_plugin.js — 主题插件加载器（桌面端 + 移动端共享）
   ------------------------------------------------------------
   职责：
   · 枚举主题（内置清单，与 themes/index.json 保持一致）
   · 启用 / 回退：切换 html[data-theme-plugin]，动态注入 <link>
   · 持久化：localStorage['themePlugin'] 保存所选主题 id
   · 提供 web 设置面板区块（fillThemePluginSettings）
   契约：
   · 主题 CSS 全部挂在 html[data-theme-plugin="<id>"] 前缀下，启停互不污染。
   · 通过 window.THEME_PLUGIN_BASE 指定主题根路径
     （桌面端 'themes/'，移动端 '../themes/'）。
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'themePlugin';
  // 主题 CSS 缓存版本基准：具体版本以主题清单中的 version 字段为准（见 versionFor），
  // 避免浏览器命中旧缓存。仅当某主题未声明 version 时回退此常量。
  const DEFAULT_CACHE_VER = '0';

  // 主题清单单一来源：由入口页在 window.THEME_PLUGIN_THEMES 注入（与 themes/index.json 同源）。
  // 本加载器保持「主题无关」，不内置任何主题，避免清单在多处漂移。
  // 元素形如 { id, name, path, css, version }；css 省略时默认 'theme.css'，version 用于缓存刷新。
  const THEMES = Array.isArray(global.THEME_PLUGIN_THEMES) ? global.THEME_PLUGIN_THEMES : [];

  // 缓存版本唯一来源：以当前主题在清单中声明的 version 作为 CSS 的 ?v= 参数。
  // 修改主题 CSS 后只需 bump 主题 version，桌面 + 移动两端 CSS 即自动失效刷新。
  function versionFor(theme) {
    const v = theme && theme.version ? String(theme.version) : DEFAULT_CACHE_VER;
    try { return encodeURIComponent(v); } catch (e) { return DEFAULT_CACHE_VER; }
  }

  let base = global.THEME_PLUGIN_BASE || 'themes/';
  let active = null;

  function getSelected() {
    try { return global.localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function setSelected(id) {
    try { id ? global.localStorage.setItem(KEY, id) : global.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function find(id) {
    return THEMES.find((t) => t.id === id) || null;
  }
  function themeHrefs(theme) {
    const b = (base || '').replace(/\/+$/, '');
    const generic = b + '/' + theme.path + '/' + (theme.css || 'theme.css');
    // 桌面端只需共享 theme.css；移动端需共享 theme.css + theme.mobile.css
    const isMobile = !!global.document.documentElement.getAttribute('data-platform');
    return isMobile ? [generic, generic.replace(/(\.css)$/i, '.mobile$1')] : [generic];
  }

  // 注入/排他替换主题样式 <link>（幂等，用 data-theme-plugin-css 标记）。
  // hrefs 为 theme.css（必须）可能外加的平台化文件（如 theme.mobile.css，可选）。
  // onready(olds) 存在时由调用方决定旧 link 的移除时机（用于切换防闪回）；缺失时全部加载完即移除。
  // theme.css 本身 404 才自愈回退默认；平台化辅助文件缺失则忽略（仍保留 theme.css）。
  function replaceThemeCss(hrefs, theme, onready) {
    const olds = Array.from(global.document.querySelectorAll('link[data-theme-plugin-css]'));
    if (!theme || !hrefs || !hrefs.length) { olds.forEach((l) => l.remove()); return; }
    const root = global.document.documentElement;
    const b = (base || '').replace(/\/+$/, '');
    const primary = b + '/' + theme.path + '/' + (theme.css || 'theme.css');

    let pending = hrefs.length;
    let settled = false;
    const fatal = () => {
      olds.forEach((l) => l.remove());
      root.removeAttribute('data-theme-plugin');
      active = null;
      setSelected('');
      // 回退默认后重放自定义配色（若存在）
      if (global.applyThemeColors) global.applyThemeColors();
    };
    const settle = () => {
      if (--pending <= 0 && !settled) { settled = true; if (typeof onready === 'function') onready(olds); else olds.forEach((l) => l.remove()); }
    };

    hrefs.forEach((h) => {
      const link = global.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = h + '?v=' + versionFor(theme);
      link.setAttribute('data-theme-plugin-css', '1');
      link.onload = settle;
      link.onerror = () => {
        link.remove();
        if (h === primary) fatal();      // 主 css 缺失 → 自愈
        else settle();                    // 平台辅助文件缺失 → 忽略，仍以 theme.css 生效
      };
      global.document.head.appendChild(link);
    });
  }

  // 直接应用主题（不持久化）
  function apply(id) {
    const root = global.document.documentElement;
    const theme = id ? find(id) : null;
    if (!theme) {
      root.removeAttribute('data-theme-plugin');
      replaceThemeCss(null, null);
      active = null;
      return;
    }
    if (active && active.id !== theme.id) {
      // 主题间切换：先加载新 css，onload 后再切属性并移除旧 link，避免闪回默认样式
      replaceThemeCss(themeHrefs(theme), theme, (olds) => {
        root.setAttribute('data-theme-plugin', theme.id);
        olds.forEach((l) => l.remove());
        active = theme;
      });
    } else {
      // 首次应用：立即设属性，让 css 边下载边生效（避免首屏默认闪烁）
      root.setAttribute('data-theme-plugin', theme.id);
      replaceThemeCss(themeHrefs(theme), theme);
      active = theme;
    }
  }

  // 启用主题并持久化；id 为空字符串或非法时回退默认并清除选择
  function enable(id) {
    const theme = id ? find(id) : null;
    setSelected(theme ? theme.id : '');
    apply(theme ? theme.id : '');
  }

  function isEnabled() { return !!getSelected() && !!active; }
  function getActive() { return active; }
  function list() { return THEMES.slice(); }

  /* ---------- Web 设置面板区块（移动端使用自身 settings.js 渲染） ---------- */
  function fillThemePluginSettings(modalContainer) {
    if (!modalContainer || !THEMES.length) return;
    const activeId = getSelected();
    const section = document.createElement('div');
    section.innerHTML = `
      <style>
        .tp-picker { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0 2px; }
        .tp-picker button { padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer;
          border: 1px solid var(--border, #E2E6EB); border-radius: 8px; background: var(--card, #fff); color: var(--text, #202020); }
        .tp-picker button.is-active { background: var(--study-primary, #506080); color: #fff; border-color: var(--study-primary, #506080); }
        .tp-note { font-size: 11px; color: var(--text-light, #7A8494); padding-top: 4px; }
      </style>
      <div class="setting-header-row">
        <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:middle;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> 界面主题</h3>
      </div>
      <div class="tp-picker">
        <button data-tp="" class="${activeId ? '' : 'is-active'}">默认</button>
        ${THEMES.map((t) => `<button data-tp="${t.id}" class="${activeId === t.id ? 'is-active' : ''}">${t.name}</button>`).join('')}
      </div>
      <div class="tp-note">切换即时生效并保存；启用主题后由主题接管配色（自定义配色将被跳过）。</div>`;
    modalContainer.appendChild(section);

    section.querySelectorAll('.tp-picker button').forEach((b) => {
      b.addEventListener('click', () => {
        section.querySelectorAll('.tp-picker button').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        const id = b.getAttribute('data-tp');
        enable(id);
        // 回退默认时重新应用自定义配色；启用主题时 applyThemeColors 会自行跳过
        if (global.applyThemeColors) global.applyThemeColors();
      });
    });
  }

  global.ThemePlugin = { list, getActive, isEnabled, getSelected, enable, apply };
  global.fillThemePluginSettings = fillThemePluginSettings;

  // 脚本加载后立即应用已保存的主题（早于 DOMContentLoaded，避免闪烁）
  try { apply(getSelected()); } catch (e) { /* ignore */ }
})(window);
