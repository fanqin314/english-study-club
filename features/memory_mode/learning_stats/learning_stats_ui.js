// 学习统计界面.js - 学习统计界面的HTML渲染和交互

(function() {
    ModuleRegistry.register('LearningStatsUI', ['GlobalManager'], function(GlobalManager) {
        // 显示学习统计界面
        function showLearningStatsInterface(container) {
            // 清空容器
            container.innerHTML = '';
            
            // 头部区域（包含返回按钮）
            const header = document.createElement('div');
            header.className = 'memory-mode-header';
            
            // 返回按钮
            const backBtn = document.createElement('button');
            backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            backBtn.className = 'back-btn';
            backBtn.onclick = () => {
                // 返回到记忆模式主界面
                const vocabUI = GlobalManager.getGlobalObject('VocabUI');
                if (vocabUI && vocabUI.showMemoryModeInterface) {
                    // 获取生词本界面容器
                    const vocabContainer = document.getElementById('vocabInterface');
                    if (vocabContainer) {
                        vocabUI.showMemoryModeInterface(vocabContainer);
                    }
                }
            };
            header.appendChild(backBtn);
            
            // 标题
            const title = document.createElement('h3');
            title.innerText = '📊 学习统计';
            header.appendChild(title);
            
            container.appendChild(header);
            
            // 统计内容区域
            const statsContent = document.createElement('div');
            statsContent.className = 'stats-detail-content';
            
            // 今日学习统计
            const todayStats = document.createElement('div');
            todayStats.className = 'stats-section';
            todayStats.innerHTML = `
                <h4>今日学习</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">0</span>
                        <span class="stat-label">学习单词数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">0</span>
                        <span class="stat-label">掌握单词数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">0%</span>
                        <span class="stat-label">今日掌握率</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">0</span>
                        <span class="stat-label">学习时长(分钟)</span>
                    </div>
                </div>
            `;
            statsContent.appendChild(todayStats);
            
            // 总体学习统计
            const overallStats = document.createElement('div');
            overallStats.className = 'stats-section';
            overallStats.innerHTML = `
                <h4>总体学习</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">0</span>
                        <span class="stat-label">总学习单词数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">0</span>
                        <span class="stat-label">总掌握单词数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">0%</span>
                        <span class="stat-label">总体掌握率</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">0</span>
                        <span class="stat-label">总学习时长(分钟)</span>
                    </div>
                </div>
            `;
            statsContent.appendChild(overallStats);
            
            // 学习趋势
            const trendStats = document.createElement('div');
            trendStats.className = 'stats-section';
            trendStats.innerHTML = `
                <h4>学习趋势</h4>
                <div class="trend-chart">
                    <div class="chart-placeholder">
                        <p>📈 学习趋势图表</p>
                        <p>功能即将上线</p>
                    </div>
                </div>
            `;
            statsContent.appendChild(trendStats);
            
            container.appendChild(statsContent);
        }
        
        return {
            showLearningStatsInterface: showLearningStatsInterface
        };
    });
})();