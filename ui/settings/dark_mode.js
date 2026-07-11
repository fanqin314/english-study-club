// 深色模式调节按钮.js - 深色模式切换逻辑

(function() {
    // 深色模式状态（从 localStorage 读取）
    let isDarkMode = false;
    try {
        isDarkMode = localStorage.getItem('darkMode') === 'true';
    } catch (e) {
        console.warn('读取深色模式设置失败:', e);
        isDarkMode = false;
    }

    // 应用深色模式
    function applyDarkMode() {
        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.classList.remove('dark');
        }
        try {
            localStorage.setItem('darkMode', isDarkMode);
        } catch (e) {
            console.warn('保存深色模式设置失败:', e);
        }
    }

    // 切换深色模式（带水波扩散动画）
    function toggleDarkMode(rippleOrigin) {
        const targetDarkMode = !isDarkMode;
        
        if (document.startViewTransition && rippleOrigin) {
            // 设置波纹起点位置，供 CSS View Transition 动画使用
            document.documentElement.style.setProperty('--ripple-x', rippleOrigin.x + 'px');
            document.documentElement.style.setProperty('--ripple-y', rippleOrigin.y + 'px');
            
            // 使用 View Transitions API 捕获新旧状态，执行波纹揭示动画
            const transition = document.startViewTransition(() => {
                isDarkMode = targetDarkMode;
                applyDarkMode();
            });
            
            transition.finished.then(() => showToast()).catch(() => showToast());
        } else if (rippleOrigin) {
            // 降级方案：先切换主题，再用旧背景色 overlay 做反向收缩动画
            isDarkMode = targetDarkMode;
            applyDarkMode();
            
            const corners = [
                {x: 0, y: 0},
                {x: window.innerWidth, y: 0},
                {x: 0, y: window.innerHeight},
                {x: window.innerWidth, y: window.innerHeight}
            ];
            let maxDist = 0;
            corners.forEach(c => {
                const dist = Math.sqrt(Math.pow(c.x - rippleOrigin.x, 2) + Math.pow(c.y - rippleOrigin.y, 2));
                maxDist = Math.max(maxDist, dist);
            });
            
            const oldColor = targetDarkMode ? '#ffffff' : '#0f172a';
            
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 10000;
                background: ${oldColor};
                clip-path: circle(${maxDist}px at ${rippleOrigin.x}px ${rippleOrigin.y}px);
                pointer-events: none;
            `;
            
            const modal = document.getElementById('settingsModal');
            if (modal) {
                modal.appendChild(overlay);
            } else {
                document.body.appendChild(overlay);
            }
            
            const duration = 450;
            const startTime = performance.now();
            
            function easeInOut(t) {
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            }
            
            function animateOverlay(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeInOut(progress);
                
                const radius = (1 - easedProgress) * maxDist;
                overlay.style.clipPath = `circle(${radius}px at ${rippleOrigin.x}px ${rippleOrigin.y}px)`;
                
                if (progress < 1) {
                    requestAnimationFrame(animateOverlay);
                } else {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    showToast();
                }
            }
            
            requestAnimationFrame(animateOverlay);
        } else {
            isDarkMode = targetDarkMode;
            applyDarkMode();
            showToast();
        }
    }

    // 显示切换提示
    function showToast() {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = isDarkMode ? '🌙 已切换到深色模式' : '☀️ 已切换到浅色模式';
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 1500);
        }
    }

    // 填充深色模式设置到弹窗
    function fillDarkModeSettings(modalContainer) {
        // 创建深色模式设置区域
        const darkModeSection = document.createElement('div');
        darkModeSection.innerHTML = `
            <div class="setting-header-row">
                <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> 外观</h3>
                <div class="glass-toggle" id="darkModeToggle">
                    <input type="checkbox" id="darkModeCheck" ${isDarkMode ? 'checked' : ''}>
                    <label for="darkModeCheck" class="toggle-label">
                        <span class="toggle-slider">
                            <svg class="toggle-icon light-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                            <svg class="toggle-icon dark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        </span>
                    </label>
                </div>
            </div>
        `;
        
        modalContainer.appendChild(darkModeSection);
        
        // 绑定切换事件（带水波扩散效果）
        const toggleCheck = document.getElementById('darkModeCheck');
        if (toggleCheck) {
            toggleCheck.addEventListener('change', (e) => {
                // 获取 label 位置作为水波扩散起点
                const label = document.querySelector('.toggle-label');
                let rippleOrigin = null;
                if (label) {
                    const rect = label.getBoundingClientRect();
                    rippleOrigin = {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    };
                }
                toggleDarkMode(rippleOrigin);
            });
        }
    }

    // 暴露接口
    window.fillDarkModeSettings = fillDarkModeSettings;
    window.isDarkModeEnabled = function() {
        return isDarkMode;
    };
    
    // 页面加载时应用深色模式
    document.addEventListener('DOMContentLoaded', applyDarkMode);
})();