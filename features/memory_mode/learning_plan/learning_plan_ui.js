// 学习计划界面.js - 学习计划界面的HTML渲染和交互

(function() {
    ModuleRegistry.register('LearningPlanUI', ['GlobalManager'], function(GlobalManager) {
        // 显示学习计划界面
        function showLearningPlanInterface(container) {
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
            title.innerText = '📅 学习计划';
            header.appendChild(title);
            
            container.appendChild(header);
            
            // 计划内容区域
            const planContent = document.createElement('div');
            planContent.className = 'plan-detail-content';
            
            // 每日目标设置
            const dailyGoal = document.createElement('div');
            dailyGoal.className = 'plan-section';
            dailyGoal.innerHTML = `
                <h4>每日学习目标</h4>
                <div class="goal-setting">
                    <div class="goal-item">
                        <span>每日学习单词数: </span>
                        <input type="number" value="10" min="1" max="100" class="goal-input" id="dailyWordGoal">
                        <span>个</span>
                    </div>
                    <div class="goal-item">
                        <span>每日学习时长: </span>
                        <input type="number" value="15" min="1" max="120" class="goal-input" id="dailyTimeGoal">
                        <span>分钟</span>
                    </div>
                    <button class="save-plan-btn" id="saveDailyGoalBtn">保存每日目标</button>
                </div>
            `;
            planContent.appendChild(dailyGoal);
            
            // 学习提醒设置
            const reminderSetting = document.createElement('div');
            reminderSetting.className = 'plan-section';
            reminderSetting.innerHTML = `
                <h4>学习提醒</h4>
                <div class="reminder-setting">
                    <div class="reminder-item">
                        <input type="checkbox" id="enableReminder">
                        <label for="enableReminder">启用学习提醒</label>
                    </div>
                    <div class="reminder-item" id="reminderTimeContainer" style="display: none;">
                        <span>提醒时间: </span>
                        <input type="time" id="reminderTime" value="09:00">
                    </div>
                    <button class="save-plan-btn" id="saveReminderBtn">保存提醒设置</button>
                </div>
            `;
            planContent.appendChild(reminderSetting);
            
            // 学习计划历史
            const planHistory = document.createElement('div');
            planHistory.className = 'plan-section';
            planHistory.innerHTML = `
                <h4>计划完成情况</h4>
                <div class="history-placeholder">
                    <p>📊 计划完成情况统计</p>
                    <p>功能即将上线</p>
                </div>
            `;
            planContent.appendChild(planHistory);
            
            container.appendChild(planContent);
            
            // 添加事件监听器
            addEventListeners();
            
            function addEventListeners() {
                // 启用/禁用提醒时间设置
                const enableReminder = document.getElementById('enableReminder');
                const reminderTimeContainer = document.getElementById('reminderTimeContainer');
                if (enableReminder && reminderTimeContainer) {
                    enableReminder.onchange = () => {
                        reminderTimeContainer.style.display = enableReminder.checked ? 'block' : 'none';
                    };
                }
                
                // 保存每日目标
                const saveDailyGoalBtn = document.getElementById('saveDailyGoalBtn');
                if (saveDailyGoalBtn) {
                    saveDailyGoalBtn.onclick = () => {
                        const dailyWordGoal = document.getElementById('dailyWordGoal').value;
                        const dailyTimeGoal = document.getElementById('dailyTimeGoal').value;
                        // 保存目标到本地存储
                        localStorage.setItem('dailyWordGoal', dailyWordGoal);
                        localStorage.setItem('dailyTimeGoal', dailyTimeGoal);
                        showToast('每日目标已保存');
                    };
                }
                
                // 保存提醒设置
                const saveReminderBtn = document.getElementById('saveReminderBtn');
                if (saveReminderBtn) {
                    saveReminderBtn.onclick = () => {
                        const enableReminder = document.getElementById('enableReminder').checked;
                        const reminderTime = document.getElementById('reminderTime').value;
                        // 保存提醒设置到本地存储
                        localStorage.setItem('enableReminder', enableReminder);
                        localStorage.setItem('reminderTime', reminderTime);
                        showToast('提醒设置已保存');
                    };
                }
            }
            
            // 加载已保存的设置
            loadSavedSettings();
            
            function loadSavedSettings() {
                // 加载每日目标
                const savedWordGoal = localStorage.getItem('dailyWordGoal');
                const savedTimeGoal = localStorage.getItem('dailyTimeGoal');
                if (savedWordGoal) {
                    document.getElementById('dailyWordGoal').value = savedWordGoal;
                }
                if (savedTimeGoal) {
                    document.getElementById('dailyTimeGoal').value = savedTimeGoal;
                }
                
                // 加载提醒设置
                const savedEnableReminder = localStorage.getItem('enableReminder') === 'true';
                const savedReminderTime = localStorage.getItem('reminderTime');
                const enableReminder = document.getElementById('enableReminder');
                const reminderTime = document.getElementById('reminderTime');
                const reminderTimeContainer = document.getElementById('reminderTimeContainer');
                
                if (enableReminder) {
                    enableReminder.checked = savedEnableReminder;
                    if (reminderTimeContainer) {
                        reminderTimeContainer.style.display = savedEnableReminder ? 'block' : 'none';
                    }
                }
                if (reminderTime && savedReminderTime) {
                    reminderTime.value = savedReminderTime;
                }
            }
            
            // 显示提示消息
            function showToast(msg) {
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.innerText = msg;
                    toast.style.opacity = '1';
                    setTimeout(() => toast.style.opacity = '0', 2000);
                }
            }
        }
        
        return {
            showLearningPlanInterface: showLearningPlanInterface
        };
    });
})();