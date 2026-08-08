// memory_button.js - 管理记忆模式按钮的显示和主按钮交互

(function() {
    let mainButtonManager = null;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 50;

    function init() {
        if (window.MainButtonManager) {
            mainButtonManager = window.MainButtonManager;
            mainButtonManager.setMemoryModule({
                showMemoryInterface: showMemoryInterface
            });
            console.log('MemoryButton: 成功注册到 MainButtonManager');
        } else {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                setTimeout(init, 100);
            } else {
                console.error('MemoryButton: MainButtonManager 未加载');
            }
        }
    }

    function showMemoryInterface(contentArea, sentencesContainer) {
        const vocabContainer = document.getElementById('vocabInterface');
        if (vocabContainer && window.VocabInterface && window.VocabInterface.showMemoryModeInterface) {
            window.VocabInterface.showMemoryModeInterface(vocabContainer);
        } else {
            console.warn('MemoryButton: VocabInterface 模块未加载');
            renderMemoryInterfaceDirectly(contentArea);
        }
    }

    function renderMemoryInterfaceDirectly(contentArea) {
        if (!contentArea) return;

        const existing = document.getElementById('memoryModeInterface');
        if (existing) existing.remove();

        const memoryDiv = document.createElement('div');
        memoryDiv.id = 'memoryModeInterface';
        memoryDiv.className = 'vocab-card memory-mode-card';
        memoryDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-light);">
                <p>正在加载记忆模式界面...</p>
            </div>
        `;
        contentArea.appendChild(memoryDiv);
    }

    window.MemoryButton = {
        init: init,
        showMemoryInterface: showMemoryInterface
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();