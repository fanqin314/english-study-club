// settings_ui.js - 控制设置按钮的点击和弹窗显示

(function() {
    // 获取设置按钮和弹窗容器
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');

    // 等待 DOM 加载完成
    function init() {
        if (!settingsBtn || !settingsModal) {
            console.warn('设置按钮或弹窗容器未找到');
            return;
        }

        // 点击设置按钮：显示弹窗
        settingsBtn.addEventListener('click', () => {
            // 如果弹窗内容尚未加载，先加载
            if (settingsModal.innerHTML === '') {
                loadSettingsContent();
            }
            
            // 获取按钮位置和尺寸
            const btnRect = settingsBtn.getBoundingClientRect();
            const modalContent = settingsModal.querySelector('.modal-content');
            
            if (modalContent) {
                // 确保按钮在视口内
                const safeX = Math.max(0, Math.min(btnRect.left, window.innerWidth - btnRect.width));
                const safeY = Math.max(0, Math.min(btnRect.top, window.innerHeight - btnRect.height));
                
                // 设置初始样式（从按钮位置开始）
                modalContent.style.position = 'fixed';
                modalContent.style.left = `${safeX}px`;
                modalContent.style.top = `${safeY}px`;
                modalContent.style.width = `${btnRect.width}px`;
                modalContent.style.height = `${btnRect.height}px`;
                modalContent.style.transform = 'scale(0.1)';
                modalContent.style.opacity = '0';
                modalContent.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                modalContent.style.zIndex = '1001';
            }
            
            // 显示弹窗
            settingsModal.style.display = 'flex';
            settingsModal.style.backgroundColor = 'transparent';
            
            // 触发重排，然后执行动画
            requestAnimationFrame(() => {
                if (modalContent) {
                    // 计算屏幕中央位置
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    
                    // 设置目标样式（移动到屏幕中央并放大）
                    modalContent.style.left = '50%';
                    modalContent.style.top = '50%';
                    modalContent.style.width = '90%';
                    modalContent.style.maxWidth = '500px';
                    modalContent.style.height = 'auto';
                    modalContent.style.transform = 'translate(-50%, -50%) scale(1)';
                    modalContent.style.opacity = '1';
                }
                
                // 模糊背景
                settingsModal.style.backdropFilter = 'blur(8px)';
            });
        });

        // 点击弹窗外部关闭（点击背景关闭）
        settingsModal.addEventListener('click', async (e) => {
            if (e.target === settingsModal) {
                // 关闭前自动确认导出
                if (typeof window.triggerExportIfDirty === 'function') {
                    await window.triggerExportIfDirty();
                }
                const modalContent = settingsModal.querySelector('.modal-content');
                if (modalContent) {
                    // 关闭动画：缩小并回到按钮位置
                    const btnRect = settingsBtn.getBoundingClientRect();
                    modalContent.style.left = `${btnRect.left}px`;
                    modalContent.style.top = `${btnRect.top}px`;
                    modalContent.style.width = `${btnRect.width}px`;
                    modalContent.style.height = `${btnRect.height}px`;
                    modalContent.style.transform = 'scale(0.1)';
                    modalContent.style.opacity = '0';
                    
                    // 移除背景模糊
                    settingsModal.style.backdropFilter = 'none';
                    
                    // 动画结束后隐藏弹窗
                    setTimeout(() => {
                        settingsModal.style.display = 'none';
                    }, 300);
                } else {
                    settingsModal.style.display = 'none';
                }
            }
        });
    }

// 在 loadSettingsContent 中
function loadSettingsContent() {
    // 清空弹窗并创建 .modal-content 容器
    settingsModal.innerHTML = '';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    settingsModal.appendChild(modalContent);

    if (typeof window.fillAPISettings === 'function') {
        window.fillAPISettings(modalContent);
    }
    if (typeof window.fillDarkModeSettings === 'function') {
        window.fillDarkModeSettings(modalContent);
    }
    if (typeof window.fillMemoryBackgroundSettings === 'function') {
        window.fillMemoryBackgroundSettings(modalContent);
    }
    if (typeof window.fillLocalStorageSettings === 'function') {
        window.fillLocalStorageSettings(modalContent);
    }
    if (typeof window.fillSaveSettings === 'function') {
        window.fillSaveSettings(modalContent);
    }
}

    // 暴露给其他模块，用于关闭弹窗和刷新内容
    window.closeSettingsModal = async function() {
        if (settingsModal) {
            // 关闭前自动确认导出
            if (typeof window.triggerExportIfDirty === 'function') {
                await window.triggerExportIfDirty();
            }
            const modalContent = settingsModal.querySelector('.modal-content');
            if (modalContent) {
                // 关闭动画：缩小并回到按钮位置
                const btnRect = settingsBtn.getBoundingClientRect();
                modalContent.style.left = `${btnRect.left}px`;
                modalContent.style.top = `${btnRect.top}px`;
                modalContent.style.width = `${btnRect.width}px`;
                modalContent.style.height = `${btnRect.height}px`;
                modalContent.style.transform = 'scale(0.1)';
                modalContent.style.opacity = '0';
                
                // 移除背景模糊
                settingsModal.style.backdropFilter = 'none';
                
                // 动画结束后隐藏弹窗
                setTimeout(() => {
                    settingsModal.style.display = 'none';
                }, 300);
            } else {
                settingsModal.style.display = 'none';
            }
        }
    };

    // 暴露填充内容的钩子，供其他模块调用
    window.settingsModalContainer = settingsModal;
    window.loadSettingsContent = loadSettingsContent;

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();