// settings_ui.js - 设置滑动面板（对齐设计稿 sidebar-v5）
// 设置面板从右侧滑入，覆盖半透明遮罩，点击遮罩或关闭按钮退出

(function() {
    'use strict';

    const overlay = document.getElementById('settingsOverlay');
    const panel = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettingsBtn');
    const contentEl = document.getElementById('settingsContent');

    let contentLoaded = false;

    // 打开设置面板
    function openSettings() {
        if (!panel || !overlay) {
            console.warn('设置面板或遮罩未找到');
            return;
        }

        // 首次打开时加载设置内容
        if (!contentLoaded) {
            loadSettingsContent();
            contentLoaded = true;
        }

        // 刷新动态数据（用量、状态等）
        if (typeof window.refreshSettingsContent === 'function') {
            window.refreshSettingsContent();
        }

        overlay.classList.add('open');
        panel.classList.add('open');
        document.body.classList.add('settings-open');
        // 焦点交给面板，便于 Esc 关闭
        if (closeBtn) closeBtn.focus();
    }

    // 关闭设置面板
    async function closeSettings() {
        if (!panel || !overlay) return;

        // 关闭前自动确认导出
        if (typeof window.triggerExportIfDirty === 'function') {
            try { await window.triggerExportIfDirty(); } catch (e) { /* 忽略导出异常 */ }
        }

        overlay.classList.remove('open');
        panel.classList.remove('open');
        document.body.classList.remove('settings-open');
    }

    function init() {
        if (!panel || !overlay) {
            console.warn('设置滑动面板结构未找到');
            return;
        }

        // 打开：设置按钮（侧边栏底部 / 桌面端）
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openSettings();
            });
        }

        // 打开：移动端顶栏设置按钮（≤768px 显示）
        // 单独绑定，避免依赖 main_button 的移动侧边栏初始化（否则侧边栏元素缺失时设置按钮失效）
        const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
        if (mobileSettingsBtn) {
            mobileSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openSettings();
            });
        }

        // 关闭：右上角关闭按钮
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeSettings();
            });
        }

        // 关闭：点击遮罩
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeSettings();
            }
        });

        // 关闭：Esc 键
        document.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape' && panel.classList.contains('open')) {
                await closeSettings();
            }
        });
    }

    // 加载设置内容到面板 body
    function loadSettingsContent() {
        if (!contentEl) return;

        contentEl.innerHTML = '';

        if (typeof window.fillAPISettings === 'function') {
            window.fillAPISettings(contentEl);
        }
        if (typeof window.fillDarkModeSettings === 'function') {
            window.fillDarkModeSettings(contentEl);
        }
        if (typeof window.fillThemeColorSettings === 'function') {
            window.fillThemeColorSettings(contentEl);
        }
        if (typeof window.fillMemoryBackgroundSettings === 'function') {
            window.fillMemoryBackgroundSettings(contentEl);
        }
        if (typeof window.fillLocalStorageSettings === 'function') {
            window.fillLocalStorageSettings(contentEl);
        }
        if (typeof window.fillSaveSettings === 'function') {
            window.fillSaveSettings(contentEl);
        }
        if (typeof window.refreshSettingsContent === 'function') {
            window.refreshSettingsContent();
        }
    }

    // 暴露公共接口（保持与其他模块的兼容）
    window.settingsModalContainer = panel;
    window.loadSettingsContent = loadSettingsContent;
    window.closeSettingsModal = closeSettings;
    window.openSettingsModal = openSettings;

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();