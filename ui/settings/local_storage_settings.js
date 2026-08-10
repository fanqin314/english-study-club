// local_storage_settings.js - 设置面板中的本地文件夹存储开关
(function() {
    'use strict';

    const FOLDER_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`;

    const CHECK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>`;

    let _active = false;

    function updateStatus() {
        _active = window.LocalFileStorage && window.LocalFileStorage.isActive();
    }

    // ========== 进度提示 overlay ==========
    function showProgressOverlay() {
        // 移除旧的
        const existing = document.getElementById('migrateProgressOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'migrateProgressOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 10001;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
        `;
        overlay.innerHTML = `
            <div style="background:var(--card-bg);border-radius:16px;padding:28px 36px;min-width:280px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                <div id="migrateProgressIcon" style="margin-bottom:16px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="63" stroke-dashoffset="63" id="migrateSpinner">
                            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                </div>
                <div id="migrateProgressTitle" style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px;">
                    正在迁移数据...
                </div>
                <div id="migrateProgressBar" style="width:100%;height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:8px;">
                    <div id="migrateProgressFill" style="height:100%;width:0%;background:var(--accent);border-radius:3px;transition:width 0.3s ease;"></div>
                </div>
                <div id="migrateProgressLabel" style="font-size:12px;color:var(--text-light);"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function updateProgress(step, total, label) {
        const fill = document.getElementById('migrateProgressFill');
        const labelEl = document.getElementById('migrateProgressLabel');
        if (fill) fill.style.width = `${(step / total) * 100}%`;
        if (labelEl) labelEl.textContent = `${label} (${step}/${total})`;
    }

    function showProgressComplete(historyCount, vocabCount) {
        const icon = document.getElementById('migrateProgressIcon');
        const title = document.getElementById('migrateProgressTitle');
        const bar = document.getElementById('migrateProgressBar');
        const label = document.getElementById('migrateProgressLabel');

        if (icon) {
            icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>`;
        }
        if (title) title.textContent = '迁移完成';
        if (bar) bar.style.display = 'none';
        if (label) {
            const parts = [];
            if (historyCount > 0) parts.push(`${historyCount} 条历史记录`);
            if (vocabCount > 0) parts.push(`${vocabCount} 个生词`);
            label.textContent = parts.length > 0 ? parts.join('、') : '暂无数据';
        }

        setTimeout(() => {
            const overlay = document.getElementById('migrateProgressOverlay');
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.3s';
                setTimeout(() => overlay.remove(), 300);
            }
        }, 1500);
    }

    function hideProgressOverlay() {
        const overlay = document.getElementById('migrateProgressOverlay');
        if (overlay) overlay.remove();
    }

    function fillLocalStorageSettings(modalContainer) {
        updateStatus();

        const section = document.createElement('div');
        section.className = 'settings-section';

        const isSupported = window.LocalFileStorage && window.LocalFileStorage.isSupported();

        section.innerHTML = `
            <div class="setting-header-row">
                <h3>${FOLDER_ICON} 本地数据存储</h3>
            </div>
            <div class="setting-description" style="font-size:12px;color:var(--text-light);margin-bottom:10px;">
                将历史记录和生词本保存到本地文件夹，清除浏览器缓存也不会丢失数据
            </div>
            <div id="localStorageStatus" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;">
                ${_active
                    ? `<span style="color:var(--success);display:flex;align-items:center;gap:4px;">${CHECK_ICON} 已连接到本地文件夹</span>`
                    : '<span style="color:var(--text-light);">未连接本地文件夹</span>'
                }
            </div>
            <div style="display:flex;gap:8px;">
                ${isSupported
                    ? `<button id="selectLocalFolderBtn" class="settings-action-btn" style="flex:1;">
                        ${_active ? '更换文件夹' : '选择本地文件夹'}
                    </button>`
                    : '<span style="font-size:12px;color:var(--danger);">当前浏览器不支持本地文件存储，请使用 Chrome 或 Edge</span>'
                }
                ${_active
                    ? `<button id="disconnectLocalFolderBtn" class="settings-action-btn settings-action-btn-danger" style="flex:1;">断开连接</button>`
                    : ''
                }
            </div>
        `;

        modalContainer.appendChild(section);

        // 绑定选择文件夹按钮
        const selectBtn = document.getElementById('selectLocalFolderBtn');
        if (selectBtn) {
            selectBtn.addEventListener('click', async () => {
                selectBtn.disabled = true;
                selectBtn.textContent = '正在打开文件夹选择器...';
                try {
                    const success = await window.LocalFileStorage.selectFolder();
                    if (success) {
                        // 自动迁移浏览器数据到本地文件夹
                        showProgressOverlay();
                        try {
                            const result = await window.LocalFileStorage.migrateFromLocalStorage(updateProgress);
                            showProgressComplete(result.history, result.vocab);
                        } catch (e) {
                            console.error('数据迁移失败:', e);
                            hideProgressOverlay();
                            if (typeof showToast === 'function') {
                                showToast('数据迁移失败，请重试', 'error');
                            }
                        }

                        // 触发事件让数据模块从本地文件重新加载
                        if (window.EventBus && window.EventBus.emit) {
                            window.EventBus.emit('localStorageReady');
                        }

                        // 刷新设置面板
                        setTimeout(() => {
                            const modalContainer = document.getElementById('settingsModal');
                            if (modalContainer) {
                                const content = modalContainer.querySelector('.modal-content');
                                if (content && typeof window.loadSettingsContent === 'function') {
                                    window.loadSettingsContent();
                                }
                            }
                        }, 1800);
                    }
                } catch (e) {
                    console.error('选择文件夹失败:', e);
                    if (typeof showToast === 'function') {
                        showToast(e.message || '选择文件夹失败');
                    }
                } finally {
                    selectBtn.disabled = false;
                }
            });
        }

        // 绑定断开连接按钮
        const disconnectBtn = document.getElementById('disconnectLocalFolderBtn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', async () => {
                if (confirm('断开连接后，数据将只保存在浏览器中。本地文件夹中的文件不会被删除。确定要断开吗？')) {
                    await window.LocalFileStorage.disconnect();
                    updateStatus();
                    if (typeof showToast === 'function') {
                        showToast('已断开本地文件夹连接');
                    }
                    const modalContainer = document.getElementById('settingsModal');
                    if (modalContainer) {
                        const content = modalContainer.querySelector('.modal-content');
                        if (content && typeof window.loadSettingsContent === 'function') {
                            window.loadSettingsContent();
                        }
                    }
                }
            });
        }
    }

    // 暴露到全局
    window.fillLocalStorageSettings = fillLocalStorageSettings;
})();