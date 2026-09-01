(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('PlanDetailUI', ['GlobalManager'], function(GlobalManager) {

        // 数据计算统一走共享层（core/shared/study_stats.js），仅做字段命名适配
        function getSharedStats() {
            const EnglishStudyShared = window.EnglishStudyShared || {};
            return EnglishStudyShared.Stats || null;
        }

        function getWordPlanData() {
            const SStats = getSharedStats();
            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const notebookArr = [];
            for (const [id, nb] of Object.entries(allNotebooks)) {
                if (nb && nb.words) {
                    notebookArr.push({ id, name: nb.name || id, color: nb.color || '#3b82f6', count: nb.words.length });
                }
            }
            const wp = SStats ? SStats.wordPlan(notebookArr) : {};
            return {
                dailyWordGoal: wp.dailyWordGoal != null ? wp.dailyWordGoal : 10,
                dailyTimeGoal: wp.dailyTimeGoal != null ? wp.dailyTimeGoal : 15,
                todayLearned: wp.todayLearned || 0,
                streakDays: wp.streak || 0,
                totalWords: wp.totalWords || 0,
                wordProgressPct: wp.wordProgressPct || 0
            };
        }

        function getArticlePlanData() {
            const SStats = getSharedStats();
            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            const historyArr = historyList.map(h => ({ id: h.id, title: h.title, originalText: h.originalText, savedAt: h.savedAt }));
            const ap = SStats ? SStats.articlePlan(historyArr) : {};
            return {
                dailyArticleGoal: ap.dailyArticleGoal != null ? ap.dailyArticleGoal : 1,
                dailyArticleTimeGoal: ap.dailyArticleTimeGoal != null ? ap.dailyArticleTimeGoal : 20,
                todayArticles: ap.todayArticles || 0,
                articleStreakDays: ap.articleStreak || 0,
                reviewInterval: ap.reviewInterval != null ? ap.reviewInterval : 3,
                totalArticles: ap.totalArticles || 0,
                articleProgressPct: ap.articleProgressPct || 0,
                todayArticleIds: JSON.parse(localStorage.getItem('stats_today_article_ids') || '[]'),
                todayDateStr: new Date().toDateString()
            };
        }

        function showPlanDetailInterface(container) {
            const planAppHeader = document.getElementById('app-header');
            const planCardHeader = document.querySelector('.card-header');
            const planCardBody = document.querySelector('.card-body');
            if (planAppHeader) planAppHeader.style.display = 'none';
            if (planCardHeader) planCardHeader.style.display = 'none';
            if (planCardBody) planCardBody.style.display = 'none';

            container.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'memory-mode-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            backBtn.onclick = () => {
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
            };
            header.appendChild(backBtn);

            const title = document.createElement('h3');
            title.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> 学习计划';
            header.appendChild(title);

            const planTabBar = document.createElement('div');
            planTabBar.className = 'memory-mode-tabs stats-sub-tabs';
            planTabBar.innerHTML = `
                <div class="memory-mode-tab active" data-plan-tab="word">单词计划</div>
                <div class="memory-mode-tab" data-plan-tab="article">文章计划</div>
            `;
            header.appendChild(planTabBar);

            container.appendChild(header);

            const planContainer = document.createElement('div');
            planContainer.className = 'plan-detail-container';

            const wordPlanPanel = buildWordPlanPanel();
            wordPlanPanel.className = 'memory-mode-tab-content word-tab-content';
            wordPlanPanel.style.display = 'block';
            planContainer.appendChild(wordPlanPanel);

            const articlePlanPanel = buildArticlePlanPanel();
            articlePlanPanel.className = 'memory-mode-tab-content article-tab-content';
            articlePlanPanel.style.display = 'none';
            planContainer.appendChild(articlePlanPanel);

            planTabBar.addEventListener('click', (e) => {
                const tab = e.target.closest('.memory-mode-tab');
                if (!tab) return;
                planTabBar.querySelectorAll('.memory-mode-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.planTab;
                planContainer.querySelectorAll('.memory-mode-tab-content').forEach(c => c.style.display = 'none');
                planContainer.dataset.planType = tabName;
                if (tabName === 'word') {
                    wordPlanPanel.style.display = 'block';
                } else {
                    articlePlanPanel.style.display = 'block';
                }
            });

            container.appendChild(planContainer);

            bindPlanEvents();
        }

        function buildWordPlanPanel() {
            const planData = getWordPlanData();
            const panel = document.createElement('div');

            const savedEnableReminder = localStorage.getItem('enableReminder') === 'true';
            const savedReminderTime = localStorage.getItem('reminderTime') || '09:00';

            // 今日到期待复习的单词数（构建面板时读取）
            const dueCount = window.VocabData && typeof window.VocabData.getDueCount === 'function'
                ? window.VocabData.getDueCount() : 0;

            const dailyGoalCard = document.createElement('div');
            dailyGoalCard.className = 'plan-section-card stats-animate-in';
            dailyGoalCard.style.animationDelay = '0.05s';
            dailyGoalCard.innerHTML = `
                <h4>
                    <svg class="plan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    每日单词目标
                </h4>
                <div class="plan-progress-wrap">
                    <div class="plan-progress-ring">
                        <svg viewBox="0 0 100 100" class="plan-progress-svg">
                            <circle cx="50" cy="50" r="42" class="plan-progress-bg"></circle>
                            <circle cx="50" cy="50" r="42" class="plan-progress-fg" id="wordPlanRing" stroke-dasharray="${planData.wordProgressPct * 2.64}, 264"></circle>
                        </svg>
                        <span class="plan-progress-text" id="wordPlanPct">${planData.wordProgressPct}%</span>
                    </div>
                    <div class="plan-progress-info">
                        <span>今日已学 <strong>${planData.todayLearned} / ${planData.dailyWordGoal}</strong> 个单词</span>
                        <span class="plan-progress-sub">连续学习 ${planData.streakDays} 天 · 共 ${planData.totalWords} 词</span>
                    </div>
                </div>
                <div class="goal-setting" style="margin-top:16px;padding-top:8px;border-top:1px solid var(--border);">
                    <span class="goal-label">每日单词数</span>
                    <input type="number" value="${planData.dailyWordGoal}" min="1" max="200" class="goal-input" id="dailyWordGoal">
                    <span class="goal-unit">个</span>
                    <span class="goal-label" style="margin-left:12px">学习时长</span>
                    <input type="number" value="${planData.dailyTimeGoal}" min="1" max="180" class="goal-input" id="dailyTimeGoal">
                    <span class="goal-unit">分钟</span>
                    <button class="save-plan-btn" id="saveDailyGoalBtn">保存</button>
                </div>
            `;
            panel.appendChild(dailyGoalCard);

            const reviewCard = document.createElement('div');
            reviewCard.className = 'plan-section-card stats-animate-in';
            reviewCard.style.animationDelay = '0.15s';
            reviewCard.innerHTML = `
                <h4>
                    <svg class="plan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    今日待复习
                </h4>
                <div class="plan-review-info">
                    <div class="plan-review-item">
                        <span class="review-item-label">待复习单词</span>
                        <span class="review-item-value">${dueCount} 词</span>
                    </div>
                </div>
            `;
            panel.appendChild(reviewCard);

            const remindCard = document.createElement('div');
            remindCard.className = 'plan-section-card stats-animate-in';
            remindCard.style.animationDelay = '0.25s';
            remindCard.innerHTML = `
                <h4>
                    <svg class="plan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    单词学习提醒
                </h4>
                <div class="reminder-setting">
                    <div class="reminder-item">
                        <input type="checkbox" id="enableReminder" ${savedEnableReminder ? 'checked' : ''}>
                        <label for="enableReminder">启用学习提醒</label>
                    </div>
                    <div class="reminder-item" id="reminderTimeContainer" style="display: ${savedEnableReminder ? 'flex' : 'none'};">
                        <span>提醒时间</span>
                        <input type="time" id="reminderTime" value="${savedReminderTime}" class="goal-input" style="width:auto;margin-left:8px;">
                    </div>
                    <button class="save-plan-btn" id="saveReminderBtn">保存</button>
                </div>
            `;
            panel.appendChild(remindCard);

            return panel;
        }

        function buildArticlePlanPanel() {
            const planData = getArticlePlanData();
            const panel = document.createElement('div');

            const savedArtReminder = localStorage.getItem('enableArticleReminder') === 'true';
            const savedArtReminderTime = localStorage.getItem('articleReminderTime') || '20:00';

            const dailyGoalCard = document.createElement('div');
            dailyGoalCard.className = 'plan-section-card stats-animate-in';
            dailyGoalCard.style.animationDelay = '0.05s';
            dailyGoalCard.innerHTML = `
                <h4>
                    <svg class="plan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9"/>
                        <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
                    </svg>
                    每日文章目标
                </h4>
                <div class="plan-progress-wrap">
                    <div class="plan-progress-ring">
                        <svg viewBox="0 0 100 100" class="plan-progress-svg">
                            <circle cx="50" cy="50" r="42" class="plan-progress-bg"></circle>
                            <circle cx="50" cy="50" r="42" class="plan-progress-fg" id="articlePlanRing" stroke-dasharray="${planData.articleProgressPct * 2.64}, 264"></circle>
                        </svg>
                        <span class="plan-progress-text" id="articlePlanPct">${planData.articleProgressPct}%</span>
                    </div>
                    <div class="plan-progress-info">
                        <span>今日已读 <strong>${planData.todayArticles} / ${planData.dailyArticleGoal}</strong> 篇文章</span>
                        <span class="plan-progress-sub">连续阅读 ${planData.articleStreakDays} 天 · 共 ${planData.totalArticles} 篇</span>
                    </div>
                </div>
                <div class="goal-setting" style="margin-top:16px;padding-top:8px;border-top:1px solid var(--border);">
                    <span class="goal-label">每日文章数</span>
                    <input type="number" value="${planData.dailyArticleGoal}" min="1" max="20" class="goal-input" id="dailyArticleGoal">
                    <span class="goal-unit">篇</span>
                    <span class="goal-label" style="margin-left:12px">阅读时长</span>
                    <input type="number" value="${planData.dailyArticleTimeGoal}" min="1" max="180" class="goal-input" id="dailyArticleTimeGoal">
                    <span class="goal-unit">分钟</span>
                    <button class="save-plan-btn" id="saveArticleGoalBtn">保存</button>
                </div>
            `;
            panel.appendChild(dailyGoalCard);

            const reviewCard = document.createElement('div');
            reviewCard.className = 'plan-section-card stats-animate-in';
            reviewCard.style.animationDelay = '0.15s';
            reviewCard.innerHTML = `
                <h4>
                    <svg class="plan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    文章复习计划
                </h4>
                <div class="plan-review-info">
                    <div class="plan-review-item">
                        <span class="review-item-label">复习间隔</span>
                        <div class="review-interval-set">
                            <input type="number" value="${planData.reviewInterval}" min="1" max="30" class="goal-input" id="articleReviewInterval" style="width:56px;">
                            <span class="goal-unit">天</span>
                        </div>
                    </div>
                    <div class="plan-review-item">
                        <span class="review-item-label">待复习文章</span>
                        <span class="review-item-value" id="pendingReviewCount">${getPendingReviewCount(planData)}</span>
                    </div>
                </div>
                <button class="save-plan-btn" id="saveReviewBtn" style="margin-top:12px;">保存</button>
            `;
            panel.appendChild(reviewCard);

            const remindCard = document.createElement('div');
            remindCard.className = 'plan-section-card stats-animate-in';
            remindCard.style.animationDelay = '0.25s';
            remindCard.innerHTML = `
                <h4>
                    <svg class="plan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    文章阅读提醒
                </h4>
                <div class="reminder-setting">
                    <div class="reminder-item">
                        <input type="checkbox" id="enableArticleReminder" ${savedArtReminder ? 'checked' : ''}>
                        <label for="enableArticleReminder">启用阅读提醒</label>
                    </div>
                    <div class="reminder-item" id="articleReminderTimeContainer" style="display: ${savedArtReminder ? 'flex' : 'none'};">
                        <span>提醒时间</span>
                        <input type="time" id="articleReminderTime" value="${savedArtReminderTime}" class="goal-input" style="width:auto;margin-left:8px;">
                    </div>
                    <button class="save-plan-btn" id="saveArticleReminderBtn">保存</button>
                </div>
            `;
            panel.appendChild(remindCard);

            return panel;
        }

        function getPendingReviewCount(planData) {
            const SStats = getSharedStats();
            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            const historyArr = historyList.map(h => ({ id: h.id, title: h.title, originalText: h.originalText, savedAt: h.savedAt }));
            return SStats ? SStats.pendingReview(historyArr) : 0;
        }

        function bindPlanEvents() {
            setTimeout(() => {
                const enableReminderEl = document.getElementById('enableReminder');
                const reminderTimeContainerEl = document.getElementById('reminderTimeContainer');
                if (enableReminderEl && reminderTimeContainerEl) {
                    enableReminderEl.onchange = () => {
                        reminderTimeContainerEl.style.display = enableReminderEl.checked ? 'flex' : 'none';
                    };
                }

                const enableArticleReminderEl = document.getElementById('enableArticleReminder');
                const articleReminderTimeEl = document.getElementById('articleReminderTimeContainer');
                if (enableArticleReminderEl && articleReminderTimeEl) {
                    enableArticleReminderEl.onchange = () => {
                        articleReminderTimeEl.style.display = enableArticleReminderEl.checked ? 'flex' : 'none';
                    };
                }

                const saveDailyGoalBtn = document.getElementById('saveDailyGoalBtn');
                if (saveDailyGoalBtn) {
                    saveDailyGoalBtn.onclick = () => {
                        const wordGoal = document.getElementById('dailyWordGoal').value;
                        const timeGoal = document.getElementById('dailyTimeGoal').value;
                        localStorage.setItem('dailyWordGoal', wordGoal);
                        localStorage.setItem('dailyTimeGoal', timeGoal);
                        _showToast('每日单词目标已保存');
                    };
                }

                const saveReminderBtn = document.getElementById('saveReminderBtn');
                if (saveReminderBtn) {
                    saveReminderBtn.onclick = () => {
                        const enableReminder = document.getElementById('enableReminder').checked;
                        const reminderTime = document.getElementById('reminderTime').value;
                        localStorage.setItem('enableReminder', enableReminder);
                        localStorage.setItem('reminderTime', reminderTime);
                        _showToast('单词提醒设置已保存');
                    };
                }

                const saveArticleGoalBtn = document.getElementById('saveArticleGoalBtn');
                if (saveArticleGoalBtn) {
                    saveArticleGoalBtn.onclick = () => {
                        const articleGoal = document.getElementById('dailyArticleGoal').value;
                        const articleTimeGoal = document.getElementById('dailyArticleTimeGoal').value;
                        localStorage.setItem('dailyArticleGoal', articleGoal);
                        localStorage.setItem('dailyArticleTimeGoal', articleTimeGoal);
                        _showToast('每日文章目标已保存');
                    };
                }

                const saveReviewBtn = document.getElementById('saveReviewBtn');
                if (saveReviewBtn) {
                    saveReviewBtn.onclick = () => {
                        const interval = document.getElementById('articleReviewInterval').value;
                        localStorage.setItem('articleReviewInterval', interval);
                        _showToast('复习计划已保存');
                    };
                }

                const saveArticleReminderBtn = document.getElementById('saveArticleReminderBtn');
                if (saveArticleReminderBtn) {
                    saveArticleReminderBtn.onclick = () => {
                        const enableReminder = document.getElementById('enableArticleReminder').checked;
                        const reminderTime = document.getElementById('articleReminderTime').value;
                        localStorage.setItem('enableArticleReminder', enableReminder);
                        localStorage.setItem('articleReminderTime', reminderTime);
                        _showToast('文章提醒设置已保存');
                    };
                }
            }, 0);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showPlanDetailInterface,
            init: init
        };
    });
})();