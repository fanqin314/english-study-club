// backup_settings.js - 设置面板中的「数据备份/恢复」区块
// 复用 core/shared/backup.js（EnglishStudyShared.Backup）做整包导出/导入
(function() {
    'use strict';

    const BACKUP_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`;

    function getBackup() {
        return window.EnglishStudyShared && window.EnglishStudyShared.Backup;
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type || 'success');
        } else if (window.alert) {
            window.alert(msg);
        }
    }

    function dateStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function handleExport() {
        const Backup = getBackup();
        if (!Backup || !Backup.build || !Backup.serialize || !Backup.download) {
            toast('备份功能未加载', 'error');
            return;
        }
        try {
            const pack = Backup.build();
            const text = Backup.serialize(pack);
            Backup.download(`english-study-backup-${dateStr()}.json`, text);
            const count = Object.keys(pack.data || {}).length;
            toast(`备份已导出（${count} 项）`);
        } catch (e) {
            console.error('导出备份失败', e);
            toast('导出备份失败，请重试', 'error');
        }
    }

    function handleImport() {
        const Backup = getBackup();
        if (!Backup || !Backup.parse || !Backup.restore) {
            toast('备份功能未加载', 'error');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const result = Backup.parse(reader.result);
                if (!result.ok) {
                    toast(result.reason, 'error');
                    return;
                }
                const count = Object.keys(result.pack.data || {}).length;
                const ok = window.confirm(`将用备份覆盖当前 ${count} 项数据（含生词本、历史、统计、设置、主题选择）。确定恢复吗？`);
                if (!ok) return;
                const restored = Backup.restore(result.pack.data);
                if (restored.ok) {
                    toast(`恢复完成，已写入 ${restored.applied} 项`);
                    // 触发数据模块重载，刷新界面
                    if (window.EventBus && window.EventBus.emit) {
                        window.EventBus.emit('localStorageReady');
                        window.EventBus.emit('dataChanged');
                    }
                    if (typeof window.VocabData && window.VocabData.loadData) {
                        window.VocabData.loadData();
                    }
                } else {
                    toast(restored.reason, 'error');
                }
            };
            reader.onerror = () => toast('读取备份文件失败', 'error');
            reader.readAsText(file);
        });
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    function fillBackupSettings(modalContainer) {
        const section = document.createElement('div');
        section.className = 'settings-section';

        section.innerHTML = `
            <div class="setting-header-row">
                <h3>${BACKUP_ICON} 数据备份 / 恢复</h3>
            </div>
            <div class="setting-description" style="font-size:12px;color:var(--text-light);margin-bottom:10px;">
                一键将生词本、历史、统计、设置与主题选择导出为 JSON 备份文件，换浏览器或清缓存前可下载留档，之后随时导入恢复。
            </div>
            <div style="display:flex;gap:8px;">
                <button id="exportBackupBtn" class="settings-action-btn" style="flex:1;">导出备份</button>
                <button id="importBackupBtn" class="settings-action-btn" style="flex:1;">导入恢复</button>
            </div>
        `;

        modalContainer.appendChild(section);

        const exportBtn = document.getElementById('exportBackupBtn');
        if (exportBtn) exportBtn.addEventListener('click', handleExport);

        const importBtn = document.getElementById('importBackupBtn');
        if (importBtn) importBtn.addEventListener('click', handleImport);
    }

    window.fillBackupSettings = fillBackupSettings;
})();