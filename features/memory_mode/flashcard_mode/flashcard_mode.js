// 闪卡模式.js - 闪卡模式的核心模块

(function() {
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    }

    // 将模块挂载到 window 对象
    window.FlashcardMode = {
        showFlashcardModeInterface: function(container) {
            const flashcardUI = window.FlashcardUI;
            if (flashcardUI && flashcardUI.showFlashcardModeInterface) {
                flashcardUI.showFlashcardModeInterface(container);
            } else {
                showToast('闪卡界面模块未加载');
            }
        }
    };

    ModuleRegistry.register('FlashcardMode', ['GlobalManager'], function(GlobalManager) {
        function showFlashcardModeInterface(container) {
            const flashcardUI = ModuleRegistry.get('FlashcardUI');
            if (flashcardUI && flashcardUI.showFlashcardModeInterface) {
                flashcardUI.showFlashcardModeInterface(container);
            } else {
                showToast('闪卡界面模块未加载');
            }
        }

        return {
            showFlashcardModeInterface
        };
    });
})();