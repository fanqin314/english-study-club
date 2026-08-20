/* ============================================================
   views/settings.js — 设置（底部导航 settings）
   组件与交互：
   · 资料卡：头像 + 昵称 + 邮箱 + 编辑资料（修改昵称）
   · 学习偏好：每日目标（±步进）、默认解析模式（分段）、自动发音（开关）、生词自动收藏（开关）
   · 显示设置：深色模式（开关，即时应用）、字体大小（分段 small/medium/large，即时应用）
   · 数据管理：导出学习数据（下载 JSON）、清除缓存（确认）、重置所有数据（确认）
   · 关于：版本 / 用户协议 / 隐私政策 / 关于英研社
   状态：来自 Store.getSettings()
   事件：步进、分段切换、开关切换（持久化+即时生效）、导出/清除/重置、链接点击
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = global.Mobile;
  const UI = Mobile.UI, Store = Mobile.Store, API = Mobile.API;
  const esc = UI.esc, icon = UI.icon;

  function applyTheme(dark) { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); }
  function applyFont(size) { document.documentElement.setAttribute('data-fontsize', size); }

  // 返回三种色当前「有效值」（自定义值优先，否则按明暗给默认，用于色块展示）
  function defaultColors(s) {
    const dark = !!s.darkMode;
    return {
      neutral: s.themeNeutral || (dark ? '#1A1C1E' : '#FFFFFF'),
      primary: s.themePrimary || (dark ? '#7A8AAA' : '#506080'),
      accent: s.themeAccent || (dark ? '#D07A5A' : '#E07B5A')
    };
  }

  function render(container) {
    const s = Store.getSettings();
    const col = defaultColors(s);
    // 词性高亮共享状态（由 home.js 暴露；设置页与首页共用同一份 localStorage 状态）
    const Highlight = Mobile.Highlight || { isEnabled: () => false, isPosOn: () => true, setEnabled() {}, setPos() {}, save() {}, posName: (c) => c, POS_COLORS: {} };
    if (Mobile.Highlight) Mobile.Highlight.load();
    const hlEnabled = Highlight.isEnabled();
    const hlItems = Object.keys(Highlight.POS_COLORS).map((k) =>
      `<label class="esc-hl-item">
         <input type="checkbox" data-pos="${k}" ${Highlight.isPosOn(k) ? 'checked' : ''} />
         <span class="esc-hl-swatch" style="background:${Highlight.POS_COLORS[k]}"></span>
         ${Highlight.posName(k)}
       </label>`).join('');
    container.innerHTML = `
      <div class="esc-page">
        <header class="esc-header">
          <div class="esc-title-row">${icon('settings', 'esc-logo')}<h1>设置</h1></div>
        </header>

        <div style="margin-top:20px">
          <div class="esc-card">
            <div class="esc-profile">
              <div class="esc-avatar">${icon('user')}</div>
              <div style="flex:1;min-width:0">
                <div class="esc-profile-name">${esc(s.profileName)}</div>
                <div class="esc-profile-mail">${esc(s.profileEmail)}</div>
              </div>
              <button id="m-set-edit" class="esc-pill">编辑资料</button>
            </div>
          </div>
        </div>

        <div class="esc-group-title">学习偏好</div>
        <div class="esc-list">
          <div class="esc-row">
            <span class="esc-row-label">每日学习目标</span>
            <div class="esc-stepper">
              <button class="esc-step-btn" data-act="goal-minus">${icon('minus')}</button>
              <span class="esc-step-val" id="m-set-goal">${s.dailyGoal} 词/天</span>
              <button class="esc-step-btn" data-act="goal-plus">${icon('plus')}</button>
            </div>
          </div>
          <div class="esc-row">
            <span class="esc-row-label">默认解析模式</span>
            <div class="esc-seg" id="m-set-mode">
              <button data-v="deep" class="${s.parseMode === 'deep' ? 'is-active' : ''}">深度模式</button>
              <button data-v="fast" class="${s.parseMode === 'fast' ? 'is-active' : ''}">快速模式</button>
            </div>
          </div>
          <div class="esc-row">
            <span class="esc-row-label">AI 调用方式</span>
            <div class="esc-seg" id="m-set-method">
              <button data-v="perSentence" class="${s.parseMethod !== 'fullText' ? 'is-active' : ''}">逐句解析</button>
              <button data-v="fullText" class="${s.parseMethod === 'fullText' ? 'is-active' : ''}">整篇解析</button>
            </div>
          </div>
          <div class="esc-row">
            <div class="esc-row-left">${icon('volume-2')}<span class="esc-row-label">自动发音</span></div>
            <label class="esc-toggle"><input type="checkbox" id="m-set-pron" ${s.autoPronounce ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
          <div class="esc-row">
            <div class="esc-row-left">${icon('bookmark')}<span class="esc-row-label">生词自动收藏</span></div>
            <label class="esc-toggle"><input type="checkbox" id="m-set-collect" ${s.autoCollect ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
        </div>

        <div class="esc-group-title">AI 服务</div>
        <div class="esc-list">
          <div class="esc-row" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px">
            <div class="esc-row-left">${icon('link')}<span class="esc-row-label">Base URL</span></div>
            <input id="m-set-base" class="esc-input" type="text" value="${esc(s.baseUrl)}" placeholder="https://api-inference.modelscope.cn/v1" />
            <div class="esc-row-left">${icon('key')}<span class="esc-row-label">API Key</span></div>
            <input id="m-set-key" class="esc-input" type="password" placeholder="留空则保留当前 Key（内置默认魔搭 Key）" autocomplete="off" />
            <div class="esc-row-left">${icon('cpu')}<span class="esc-row-label">模型名称</span></div>
            <input id="m-set-model" class="esc-input" type="text" value="${esc(s.model)}" placeholder="Qwen/Qwen3.5-35B-A3B" />
          </div>
          <div class="esc-row" style="gap:8px;padding:12px">
            <button class="esc-btn esc-btn-primary" data-act="api-save" style="flex:1">保存配置</button>
            <button class="esc-btn esc-btn-ghost" data-act="api-test" style="flex:1">测试连接</button>
          </div>
        </div>

        <div class="esc-group-title">显示设置</div>
        <div class="esc-list">
          <div class="esc-row">
            <div class="esc-row-left">${icon('moon')}<span class="esc-row-label">深色模式</span></div>
            <label class="esc-toggle"><input type="checkbox" id="m-set-dark" ${s.darkMode ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
          <div class="esc-row">
            <div class="esc-row-left">${icon('type')}<span class="esc-row-label">字体大小</span></div>
            <div class="esc-seg is-square" id="m-set-font">
              <button data-v="small" class="${s.fontSize === 'small' ? 'is-active' : ''}">小</button>
              <button data-v="medium" class="${s.fontSize === 'medium' ? 'is-active' : ''}">中</button>
              <button data-v="large" class="${s.fontSize === 'large' ? 'is-active' : ''}">大</button>
            </div>
          </div>
        </div>

        <div class="esc-group-title">词性高亮</div>
        <div class="esc-list">
          <div class="esc-row">
            <div class="esc-row-left">${icon('highlighter')}<span class="esc-row-label">启用词性高亮</span></div>
            <label class="esc-toggle"><input type="checkbox" id="m-set-hl" ${hlEnabled ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
          <div class="esc-hl-grid" style="padding: 12px 12px 4px">${hlItems}</div>
          <div class="esc-row" style="padding-top: 0">
            <button class="esc-btn esc-btn-primary" data-act="hl-apply" style="flex:1">应用高亮设置</button>
          </div>
        </div>

        <div class="esc-group-title">主题配色</div>
        <div class="esc-list">
          <div class="esc-row">
            <div class="esc-row-left">${icon('square')}<span class="esc-row-label">中性色 <span style="color:var(--study-muted-foreground);font-size:12px">60%</span></span></div>
            <label class="esc-color-swatch" id="m-c-neutral" style="background:${esc(col.neutral)}"><input type="color" data-color="neutral" value="${esc(col.neutral)}"></label>
          </div>
          <div class="esc-row">
            <div class="esc-row-left">${icon('palette')}<span class="esc-row-label">主品牌色 <span style="color:var(--study-muted-foreground);font-size:12px">25%</span></span></div>
            <label class="esc-color-swatch" id="m-c-primary" style="background:${esc(col.primary)}"><input type="color" data-color="primary" value="${esc(col.primary)}"></label>
          </div>
          <div class="esc-row">
            <div class="esc-row-left">${icon('zap')}<span class="esc-row-label">强调色 <span style="color:var(--study-muted-foreground);font-size:12px">15%</span></span></div>
            <label class="esc-color-swatch" id="m-c-accent" style="background:${esc(col.accent)}"><input type="color" data-color="accent" value="${esc(col.accent)}"></label>
          </div>
          <div class="esc-color-row-note">选色后即时生效；切换深色模式会按基调自动适配灰阶。</div>
          <div class="esc-row esc-clickable" data-act="reset-colors"><div class="esc-row-left">${icon('rotate-ccw')}<span class="esc-row-label">恢复默认配色</span></div>${icon('chevron-right')}</div>
        </div>

        <div class="esc-group-title">数据管理</div>
        <div class="esc-list">
          <div class="esc-row esc-clickable" data-act="export"><div class="esc-row-left">${icon('download')}<span class="esc-row-label">导出学习数据</span></div>${icon('chevron-right')}</div>
          <div class="esc-row esc-clickable" data-act="clear"><div class="esc-row-left">${icon('trash-2')}<span class="esc-row-label">清除缓存</span></div>${icon('chevron-right')}</div>
          <div class="esc-row esc-clickable" data-act="reset"><div class="esc-row-left">${icon('alert-triangle')}<span class="esc-row-label esc-danger">重置所有数据</span></div>${icon('chevron-right')}</div>
        </div>

        <div class="esc-group-title">关于</div>
        <div class="esc-list">
          <div class="esc-row"><div class="esc-row-left">${icon('info')}<span class="esc-row-label">版本</span></div><span class="esc-row-right">v1.0.0</span></div>
          <div class="esc-row esc-clickable" data-act="about"><div class="esc-row-left">${icon('file-text')}<span class="esc-row-label">用户协议</span></div>${icon('chevron-right')}</div>
          <div class="esc-row esc-clickable" data-act="about"><div class="esc-row-left">${icon('shield')}<span class="esc-row-label">隐私政策</span></div>${icon('chevron-right')}</div>
          <div class="esc-row esc-clickable" data-act="about-app"><div class="esc-row-left">${icon('book-open')}<span class="esc-row-label">关于英研社</span></div>${icon('chevron-right')}</div>
        </div>
        <div style="height:8px"></div>
      </div>`;

    bind(container);
    UI.refreshIcons(container);
  }

  function bind(root) {
    // 编辑资料
    root.querySelector('#m-set-edit').addEventListener('click', () => {
      const name = global.prompt('修改昵称', Store.getSettings().profileName);
      if (name != null && name.trim()) { Store.updateSettings({ profileName: name.trim() }); UI.toast('已更新昵称'); root.querySelector('.esc-profile-name').textContent = name.trim(); }
    });

    // 每日目标 ±
    const goalEl = root.querySelector('#m-set-goal');
    const setGoal = (delta) => {
      const g = Math.max(5, Math.min(100, Store.getSettings().dailyGoal + delta));
      Store.updateSettings({ dailyGoal: g });
      goalEl.textContent = g + ' 词/天';
    };
    root.querySelector('[data-act="goal-minus"]').addEventListener('click', () => setGoal(-5));
    root.querySelector('[data-act="goal-plus"]').addEventListener('click', () => setGoal(5));

    // 解析模式分段
    root.querySelectorAll('#m-set-mode button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('#m-set-mode button').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        Store.updateSettings({ parseMode: b.getAttribute('data-v') });
      });
    });

    // AI 调用方式分段（逐句解析 / 整篇解析）
    root.querySelectorAll('#m-set-method button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('#m-set-method button').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        Store.updateSettings({ parseMethod: b.getAttribute('data-v') });
      });
    });

    // API 配置（Base URL / API Key / 模型名）
    const baseEl = root.querySelector('#m-set-base');
    const keyEl = root.querySelector('#m-set-key');
    const modelEl = root.querySelector('#m-set-model');
    root.querySelector('[data-act="api-save"]').addEventListener('click', () => {
      const patch = {};
      const base = baseEl.value.trim();
      const model = modelEl.value.trim();
      const key = keyEl.value.trim();
      if (base) patch.baseUrl = base;
      if (model) patch.model = model;
      if (key) patch.apiKey = key; // 留空则保留当前 Key
      Store.updateSettings(patch);
      UI.toast('API 配置已保存');
    });
    root.querySelector('[data-act="api-test"]').addEventListener('click', async () => {
      const cfg = Store.getSettings();
      if (!API.hasKey()) { UI.toast('请先填写 API Key 或使用内置默认 Key'); return; }
      UI.toast('正在测试连接...');
      try {
        const url = `${(cfg.baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 })
        });
        UI.toast(res.ok ? 'API 连接成功' : `连接失败 HTTP ${res.status}`);
      } catch (e) {
        UI.toast('连接失败：' + (e.message || '网络错误'));
      }
    });

    // 开关
    root.querySelector('#m-set-pron').addEventListener('change', (e) => Store.updateSettings({ autoPronounce: e.target.checked }));
    root.querySelector('#m-set-collect').addEventListener('change', (e) => Store.updateSettings({ autoCollect: e.target.checked }));
    root.querySelector('#m-set-dark').addEventListener('change', (e) => { Store.updateSettings({ darkMode: e.target.checked }); applyTheme(e.target.checked); });
    root.querySelectorAll('#m-set-font button').forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll('#m-set-font button').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        const v = b.getAttribute('data-v');
        Store.updateSettings({ fontSize: v }); applyFont(v);
      });
    });

    // 词性高亮（与首页共用 Mobile.Highlight 状态）
    const Highlight = Mobile.Highlight;
    if (Highlight) {
      root.querySelector('#m-set-hl').addEventListener('change', (e) => {
        Highlight.setEnabled(e.target.checked);
        Highlight.save();
        UI.toast(e.target.checked ? '词性高亮已开启' : '词性高亮已关闭');
      });
      root.querySelectorAll('#m-set-hl + .esc-hl-grid input, .esc-hl-grid input[data-pos]').forEach((cb) => {
        cb.addEventListener('change', () => {
          Highlight.setPos(cb.getAttribute('data-pos'), cb.checked);
          Highlight.save();
        });
      });
      root.querySelector('[data-act="hl-apply"]').addEventListener('click', () => {
        Highlight.save();
        UI.toast('已应用，返回解析页后生效');
      });
    }

    // 主题配色取色器（60-25-15）
    root.querySelectorAll('.esc-color-swatch input[type="color"]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.getAttribute('data-color');
        const val = input.value || null;
        const patch = {};
        if (key === 'neutral') patch.themeNeutral = val;
        else if (key === 'primary') patch.themePrimary = val;
        else if (key === 'accent') patch.themeAccent = val;
        Store.updateSettings(patch);
        const swatch = input.closest('.esc-color-swatch');
        if (swatch) swatch.style.background = val;
        UI.toast('配色已更新');
      });
    });
    root.querySelector('[data-act="reset-colors"]').addEventListener('click', () => {
      Store.updateSettings({ themeNeutral: null, themePrimary: null, themeAccent: null });
      const col = defaultColors(Store.getSettings());
      [['neutral', col.neutral], ['primary', col.primary], ['accent', col.accent]].forEach(([k, def]) => {
        const inp = root.querySelector(`.esc-color-swatch input[data-color="${k}"]`);
        if (inp) { inp.value = def; const sw = inp.closest('.esc-color-swatch'); if (sw) sw.style.background = def; }
      });
      UI.toast('已恢复默认配色');
    });

    // 数据管理
    root.querySelector('[data-act="export"]').addEventListener('click', exportData);
    root.querySelector('[data-act="clear"]').addEventListener('click', () => {
      if (UI.confirmDialog('确定清除生词本与历史记录缓存？（设置会保留）')) { Store.clearCache(); UI.toast('缓存已清除'); }
    });
    root.querySelector('[data-act="reset"]').addEventListener('click', () => {
      if (UI.confirmDialog('重置将删除全部生词、历史、设置与进度，且不可恢复。确定继续？')) {
        Store.resetAll(); applyTheme(false); applyFont('medium');
        UI.toast('已重置所有数据'); location.reload();
      }
    });

    // 关于链接
    root.querySelectorAll('[data-act="about"]').forEach((el) => el.addEventListener('click', () => UI.toast('用户协议 / 隐私政策（演示）')));
    root.querySelector('[data-act="about-app"]').addEventListener('click', () => UI.toast('英研社 · 文章驱动的 AI 英语精读工具'));

    // 触摸反馈：设置项与按钮统一水波纹
    root.querySelectorAll('.esc-setting, .esc-btn, .esc-pill, .esc-color-swatch').forEach((el) => {
      el.classList.add('esc-tap');
      el.addEventListener('touchstart', (ev) => UI.ripple(el, ev), { passive: true });
    });
  }

  function exportData() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'yingyanshe-data.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('已导出学习数据');
  }

  Mobile.Views = Mobile.Views || {};
  Mobile.Views.settings = { render };
})(window);
