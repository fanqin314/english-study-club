// 生词本按钮.js - 管理生词本按钮的显示和主按钮交互

(function() {
    // 主按钮交互模块引用
    let mainButtonManager = null;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 50; // 最多尝试50次
    
    // 初始化：注册到主按钮管理器
    function init() {
        // 获取主按钮管理器
        if (window.MainButtonManager) {
            mainButtonManager = window.MainButtonManager;
            // 注册生词本模块
            mainButtonManager.setVocabModule({
                showVocabInterface: showVocabInterface
            });
            console.log('VocabButton: 成功注册到 MainButtonManager');
        } else {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                console.log(`VocabButton: MainButtonManager 未就绪，第${initAttempts}次重试...`);
                setTimeout(init, 100); // 100ms后重试
            } else {
                console.error('VocabButton: MainButtonManager 未加载，生词本按钮将无法正常工作');
            }
        }
    }
    
    // 显示生词本界面
    function showVocabInterface(contentArea, sentencesContainer) {
        console.log('VocabButton: 尝试显示生词本界面');
        if (window.VocabInterface && window.VocabInterface.show) {
            window.VocabInterface.show(contentArea, sentencesContainer);
            console.log('VocabButton: 生词本界面已显示');
        } else {
            console.warn('VocabButton: VocabInterface 模块未加载');
            // 尝试直接调用
            if (window.VocabData) {
                console.log('VocabButton: VocabData 已加载，尝试手动渲染界面');
                // 如果 VocabInterface 未加载，尝试手动创建界面
                renderVocabInterfaceDirectly(contentArea, sentencesContainer);
            }
        }
    }
    
    // 直接渲染生词本界面（备用方案）
    function renderVocabInterfaceDirectly(contentArea, sentencesContainer) {
        if (!contentArea) {
            console.error('VocabButton: contentArea 不存在');
            return;
        }
        
        // 隐藏句子容器
        if (sentencesContainer) {
            sentencesContainer.style.display = 'none';
        }
        
        // 移除已存在的生词本界面
        const existing = document.getElementById('vocabInterface');
        if (existing) existing.remove();
        
        // 创建简单的生词本界面
        const vocabDiv = document.createElement('div');
        vocabDiv.id = 'vocabInterface';
        vocabDiv.className = 'vocab-card';
        vocabDiv.innerHTML = `
            <div class="vocab-header">
                <h3>📚 我的生词本</h3>
                <div class="vocab-stats">
                    <span>${Object.keys(window.VocabData.getAllNotebooks()).length} 个生词本</span>
                </div>
            </div>
            <div class="notebook-tabs"></div>
            <div style="padding: 20px; text-align: center; color: var(--text-light);">
                <p>正在加载生词本界面...</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">如果长时间未显示，请刷新页面</p>
            </div>
        `;
        
        contentArea.insertBefore(vocabDiv, sentencesContainer);
        
        // 尝试加载完整的 vocab_ui.js 功能
        if (window.VocabInterface && window.VocabInterface.show) {
            window.VocabInterface.show(contentArea, sentencesContainer);
        }
    }
    
    // 隐藏生词本界面（如果当前显示）
    function hideVocabInterface() {
        if (window.VocabInterface && window.VocabInterface.hide) {
            window.VocabInterface.hide();
        }
    }
    
    // 刷新生词本界面
    function refreshVocabInterface() {
        if (window.VocabInterface && window.VocabInterface.refresh) {
            window.VocabInterface.refresh();
        }
    }
    
    // 获取当前是否在生词本模式
    function isVocabMode() {
        return window.MainButtonManager && window.MainButtonManager.getCurrentMode() === 'vocab';
    }
    
    // 切换到生词本模式
    function switchToVocabMode() {
        if (window.MainButtonManager && window.MainButtonManager.switchMode) {
            window.MainButtonManager.switchMode('vocab');
        }
    }
    
    // 切换到深度分析模式
    function switchToAnalysisMode() {
        if (window.MainButtonManager && window.MainButtonManager.switchMode) {
            window.MainButtonManager.switchMode('analysis');
        }
    }
    
    // 导出接口
    window.VocabButton = {
        init,
        showVocabInterface,
        hideVocabInterface,
        refreshVocabInterface,
        isVocabMode,
        switchToVocabMode,
        switchToAnalysisMode
    };
    
    // 自动初始化 - 延迟执行以确保 MainButtonManager 已加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 0);
        });
    } else {
        setTimeout(init, 0);
    }
})();
