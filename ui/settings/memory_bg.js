// 记忆模式彩虹背景开关.js

(function() {
    let rainbowEnabled = false;
    try {
        localStorage.removeItem('memoryRainbowDefaultOff');
        localStorage.removeItem('memoryRainbowMigrated');

        const mig = localStorage.getItem('memoryRainbowV2');
        if (!mig) {
            localStorage.setItem('memoryRainbow', 'false');
            localStorage.setItem('memoryRainbowV2', '1');
        }
        rainbowEnabled = localStorage.getItem('memoryRainbow') === 'true';
    } catch (e) {
        rainbowEnabled = false;
    }

    function applyRainbow() {
        const card = document.getElementById('memoryModeInterface');
        if (!card) return;

        if (rainbowEnabled) {
            card.classList.remove('memory-rainbow-off');
        } else {
            card.classList.add('memory-rainbow-off');
        }
    }

    function toggleRainbow() {
        rainbowEnabled = !rainbowEnabled;
        try {
            localStorage.setItem('memoryRainbow', rainbowEnabled);
        } catch (e) {}
        applyRainbow();

        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = rainbowEnabled ? '🌈 彩虹背景已开启' : '🔲 彩虹背景已关闭';
            toast.style.opacity = '1';
            setTimeout(function() { toast.style.opacity = '0'; }, 1500);
        }
    }

    function fillMemoryBackgroundSettings(modalContainer) {
        var section = document.createElement('div');
        section.innerHTML = '<div class="setting-header-row">' +
            '<h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 7 3"/></svg> 记忆模式背景</h3>' +
            '<div class="glass-toggle" id="rainbowToggle">' +
                '<input type="checkbox" id="rainbowCheck"' + (rainbowEnabled ? ' checked' : '') + '>' +
                '<label for="rainbowCheck" class="toggle-label">' +
                    '<span class="toggle-slider">' +
                        '<svg class="toggle-icon rainbow-on-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="M22 17a10 10 0 0 0-20 0"/>' +
                            '<path d="M19 17a7 7 0 0 0-14 0"/>' +
                            '<path d="M16 17a4 4 0 0 0-8 0"/>' +
                            '<circle cx="12" cy="17" r="1" fill="currentColor"/>' +
                        '</svg>' +
                        '<svg class="toggle-icon rainbow-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                            '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                            '<line x1="9" y1="9" x2="15" y2="15"/>' +
                            '<line x1="15" y1="9" x2="9" y2="15"/>' +
                        '</svg>' +
                    '</span>' +
                '</label>' +
            '</div>' +
        '</div>';

        modalContainer.appendChild(section);

        var toggleCheck = document.getElementById('rainbowCheck');
        if (toggleCheck) {
            toggleCheck.addEventListener('change', function() {
                toggleRainbow();
            });
        }
    }

    window.fillMemoryBackgroundSettings = fillMemoryBackgroundSettings;
    window.isMemoryRainbowEnabled = function() { return rainbowEnabled; };
    window.applyMemoryRainbow = applyRainbow;

    document.addEventListener('DOMContentLoaded', applyRainbow);
})();