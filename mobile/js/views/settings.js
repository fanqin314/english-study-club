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
  const UI = Mobile.UI, Store = Mobile.Store;
  const esc = UI.esc, icon = UI.icon;

  function applyTheme(dark) { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); }
  function applyFont(size) { document.documentElement.setAttribute('data-fontsize', size); }

  function render(container) {
    const s = Store.getSettings();
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
            <div class="esc-row-left">${icon('volume-2')}<span class="esc-row-label">自动发音</span></div>
            <label class="esc-toggle"><input type="checkbox" id="m-set-pron" ${s.autoPronounce ? 'checked' : ''}><span class="esc-slider"></span></label>
          </div>
          <div class="esc-row">
            <div class="esc-row-left">${icon('bookmark')}<span class="esc-row-label">生词自动收藏</span></div>
            <label class="esc-toggle"><input type="checkbox" id="m-set-collect" ${s.autoCollect ? 'checked' : ''}><span class="esc-slider"></span></label>
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
