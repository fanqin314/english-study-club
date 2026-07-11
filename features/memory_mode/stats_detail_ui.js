(function() {
    let _showToast = null;
    let _getVocabData = null;
    let _currentStatsNotebookId = null;
    let _cleanupFns = [];

    ModuleRegistry.register('StatsDetailUI', ['GlobalManager'], function(GlobalManager) {

        function getWordStats(notebookId) {
            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};

            if (notebookId) {
                const nb = allNotebooks[notebookId];
                if (!nb) return {
                    totalWords: 0, masteredWords: 0, totalLearned: 0,
                    todayLearned: 0, streakDays: 0, masteryRate: 0,
                    notebookStats: []
                };
                const wordCount = nb.words ? nb.words.length : 0;
                const masteredWords = parseInt(localStorage.getItem('stats_mastered_words') || '0');
                const totalLearned = parseInt(localStorage.getItem('stats_total_learned') || wordCount.toString());
                const todayLearned = parseInt(localStorage.getItem('stats_today_learned') || '0');
                const streakDays = parseInt(localStorage.getItem('stats_streak_days') || '0');
                const masteryRate = wordCount > 0 ? Math.round((masteredWords / wordCount) * 100) : 0;

                return {
                    totalWords: wordCount,
                    masteredWords,
                    totalLearned: Math.max(totalLearned, wordCount),
                    todayLearned,
                    streakDays,
                    masteryRate,
                    notebookStats: [{
                        id: notebookId,
                        name: nb.name || notebookId,
                        count: wordCount,
                        color: nb.color || '#3b82f6'
                    }]
                };
            }

            let totalWords = 0;
            const notebookStats = [];

            for (const [id, nb] of Object.entries(allNotebooks)) {
                if (nb.words) {
                    totalWords += nb.words.length;
                    notebookStats.push({
                        id: id,
                        name: nb.name || id,
                        count: nb.words.length,
                        color: nb.color || '#3b82f6'
                    });
                }
            }

            const masteredWords = parseInt(localStorage.getItem('stats_mastered_words') || '0');
            const totalLearned = parseInt(localStorage.getItem('stats_total_learned') || totalWords.toString());
            const todayLearned = parseInt(localStorage.getItem('stats_today_learned') || '0');
            const streakDays = parseInt(localStorage.getItem('stats_streak_days') || '0');
            const masteryRate = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;

            return {
                totalWords,
                masteredWords,
                totalLearned: Math.max(totalLearned, totalWords),
                todayLearned,
                streakDays,
                masteryRate,
                notebookStats
            };
        }

        function getArticleStats() {
            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            const totalArticles = historyList.length;

            const totalArticleLearned = parseInt(localStorage.getItem('stats_total_articles_learned') || totalArticles.toString());
            const todayArticles = parseInt(localStorage.getItem('stats_today_articles') || '0');
            const articleStreakDays = parseInt(localStorage.getItem('stats_article_streak_days') || '0');

            const recentArticles = historyList.slice(0, 5).map(h => {
                const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
                const vocabMap = {};
                for (const nb of Object.values(allNotebooks)) {
                    if (nb.words) {
                        nb.words.forEach(w => {
                            vocabMap[w.word.toLowerCase().trim()] = true;
                        });
                    }
                }
                const words = (h.originalText || '').split(/[^a-zA-Z'-]+/).filter(w => w.length > 0);
                const vocabInArticle = words.filter(w => vocabMap[w.toLowerCase()]).length;
                return {
                    id: h.id,
                    title: (h.originalText || '').split('\n')[0].substring(0, 40) || '(无标题)',
                    savedAt: h.savedAt,
                    wordCount: words.length,
                    vocabCount: vocabInArticle
                };
            });

            return {
                totalArticles: Math.max(totalArticleLearned, totalArticles),
                todayArticles,
                articleStreakDays,
                recentArticles
            };
        }

        function buildModuleDetailCard(moduleType, allTimeStats) {
            const filtered = allTimeStats.filter(m => m.meta.type === moduleType);
            if (filtered.length === 0) return null;

            const card = document.createElement('div');
            card.className = 'stats-section-card';

            const typeLabel = moduleType === 'word' ? '单词练习' : '文章阅读';
            let html = `<h4>🎯 各模式${typeLabel}明细</h4><div class="stats-module-list">`;

            const maxCount = Math.max(...filtered.map(m => m.count), 1);

            filtered.forEach(mod => {
                const pct = Math.round((mod.count / maxCount) * 100);
                html += `
                    <div class="stats-module-item">
                        <span class="stats-module-icon">${mod.meta.icon}</span>
                        <span class="stats-module-name">${mod.meta.label}</span>
                        <span class="stats-module-bar-wrap"><span class="stats-module-bar" style="width:${pct}%;background:${mod.meta.color};"></span></span>
                        <span class="stats-module-count">${mod.count}</span>
                    </div>
                `;
            });

            html += '</div>';
            card.innerHTML = html;
            return card;
        }

        function buildNotebookSelector(currentId, onSelect) {
            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const currentNotebook = currentId ? allNotebooks[currentId] : null;

            const selector = document.createElement('div');
            selector.className = 'stats-nb-selector';

            const current = document.createElement('div');
            current.className = 'stats-nb-current';

            const dot = document.createElement('span');
            dot.className = 'stats-sel-dot';
            if (currentNotebook) {
                dot.style.background = currentNotebook.color || '#6366f1';
            } else {
                dot.style.background = '#94a3b8';
            }
            current.appendChild(dot);

            const name = document.createElement('span');
            name.className = 'stats-sel-name';
            name.textContent = currentNotebook ? currentNotebook.name : '全部生词本';
            current.appendChild(name);

            const count = document.createElement('span');
            count.className = 'stats-sel-count';
            count.textContent = currentNotebook ? (currentNotebook.words ? currentNotebook.words.length : 0) + ' 词' : '';
            current.appendChild(count);

            const arrow = document.createElement('span');
            arrow.className = 'stats-sel-arrow';
            arrow.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
            current.appendChild(arrow);

            const dropdown = document.createElement('div');
            dropdown.className = 'stats-nb-dropdown';

            const allOption = document.createElement('div');
            allOption.className = 'stats-nb-option' + (!currentId ? ' active' : '');
            allOption.innerHTML = `<span class="stats-sel-dot" style="background:#94a3b8;"></span><span class="stats-sel-name">全部生词本</span>`;
            allOption.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelect(null, null);
                dot.style.background = '#94a3b8';
                name.textContent = '全部生词本';
                count.textContent = '';
                dropdown.querySelectorAll('.stats-nb-option').forEach(o => o.classList.remove('active'));
                allOption.classList.add('active');
                dropdown.classList.remove('open');
                selector.classList.remove('open');
            });
            dropdown.appendChild(allOption);

            for (const [id, nb] of Object.entries(allNotebooks)) {
                const option = document.createElement('div');
                option.className = 'stats-nb-option' + (id === currentId ? ' active' : '');
                option.innerHTML = `<span class="stats-sel-dot" style="background:${nb.color || '#6366f1'};"></span><span class="stats-sel-name">${nb.name}</span><span class="stats-sel-count">${nb.words ? nb.words.length : 0} 词</span>`;
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSelect(id, nb);
                    dot.style.background = nb.color || '#6366f1';
                    name.textContent = nb.name;
                    count.textContent = (nb.words ? nb.words.length : 0) + ' 词';
                    dropdown.querySelectorAll('.stats-nb-option').forEach(o => o.classList.remove('active'));
                    option.classList.add('active');
                    dropdown.classList.remove('open');
                    selector.classList.remove('open');
                });
                dropdown.appendChild(option);
            }

            current.appendChild(dropdown);
            selector.appendChild(current);

            current.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
                selector.classList.toggle('open');
            });

            const closeOnOutside = function(e) {
                if (dropdown.contains(e.target) || current.contains(e.target)) return;
                dropdown.classList.remove('open');
            };
            document.addEventListener('click', closeOnOutside);
            _cleanupFns.push(function() { document.removeEventListener('click', closeOnOutside); });

            return selector;
        }

        function buildWordPanel(statsContainer, wordStatsPanel) {
            const notebookId = _currentStatsNotebookId;
            const stats = getWordStats(notebookId);
            const moduleStats = window.StatsTracker.getModuleAllTimeStatsForNotebook(notebookId);

            wordStatsPanel.innerHTML = '';

            const overviewCard = document.createElement('div');
            overviewCard.className = 'stats-section-card';
            overviewCard.innerHTML = `
                <h4>📖 单词学习概览</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.todayLearned}</span>
                        <span class="stat-label">今日学习</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalWords}</span>
                        <span class="stat-label">总单词数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.masteryRate}%</span>
                        <span class="stat-label">掌握率</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.streakDays}</span>
                        <span class="stat-label">连续天数</span>
                    </div>
                </div>
            `;
            wordStatsPanel.appendChild(overviewCard);

            const wordModuleCard = buildModuleDetailCard('word', moduleStats);
            if (wordModuleCard) wordStatsPanel.appendChild(wordModuleCard);

            if (stats.notebookStats.length > 0) {
                const notebookCard = document.createElement('div');
                notebookCard.className = 'stats-section-card';
                let nbHtml = '<h4>📋 生词本分布</h4><div class="stats-nb-list">';

                const maxCount = Math.max(...stats.notebookStats.map(n => n.count), 1);

                stats.notebookStats.forEach(nb => {
                    const pct = Math.round((nb.count / stats.totalWords) * 100);
                    const barW = Math.round((nb.count / maxCount) * 100);
                    nbHtml += `
                        <div class="stats-nb-item">
                            <span class="stats-nb-color" style="background:${nb.color};"></span>
                            <span class="stats-nb-name">${nb.name}</span>
                            <span class="stats-nb-bar-wrap"><span class="stats-nb-bar" style="width:${barW}%;background:${nb.color};"></span></span>
                            <span class="stats-nb-count">${nb.count}词 (${pct}%)</span>
                        </div>
                    `;
                });

                nbHtml += '</div>';
                notebookCard.innerHTML = nbHtml;
                wordStatsPanel.appendChild(notebookCard);
            }

            const trendCard = document.createElement('div');
            trendCard.className = 'stats-section-card';
            trendCard.innerHTML = `
                <h4>📈 学习趋势</h4>
                <div class="trend-chart-placeholder">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    完成更多学习后，这里将展示您的单词学习趋势图
                </div>
            `;
            wordStatsPanel.appendChild(trendCard);
        }

        function buildArticleStatsPanel() {
            const stats = getArticleStats();
            const panel = document.createElement('div');

            const overviewCard = document.createElement('div');
            overviewCard.className = 'stats-section-card';
            overviewCard.innerHTML = `
                <h4>📰 文章学习概览</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.todayArticles}</span>
                        <span class="stat-label">今日阅读</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalArticles}</span>
                        <span class="stat-label">总文章数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.articleStreakDays}</span>
                        <span class="stat-label">连续天数</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.recentArticles.length}</span>
                        <span class="stat-label">最近文章</span>
                    </div>
                </div>
            `;
            panel.appendChild(overviewCard);

            const articleModuleCard = buildModuleDetailCard('article', window.StatsTracker.getModuleAllTimeStats());
            if (articleModuleCard) panel.appendChild(articleModuleCard);

            if (stats.recentArticles.length > 0) {
                const recentCard = document.createElement('div');
                recentCard.className = 'stats-section-card';
                let recentHtml = '<h4>🕐 最近阅读的文章</h4><div class="stats-article-list">';

                stats.recentArticles.forEach(art => {
                    const date = new Date(art.savedAt);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                    recentHtml += `
                        <div class="stats-article-item">
                            <span class="stats-article-title">${art.title}</span>
                            <span class="stats-article-meta">${art.wordCount}词 · ${art.vocabCount}个生词 · ${dateStr}</span>
                        </div>
                    `;
                });

                recentHtml += '</div>';
                recentCard.innerHTML = recentHtml;
                panel.appendChild(recentCard);
            }

            const articleTrendCard = document.createElement('div');
            articleTrendCard.className = 'stats-section-card';
            articleTrendCard.innerHTML = `
                <h4>📈 阅读趋势</h4>
                <div class="trend-chart-placeholder">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    阅读更多文章后，这里将展示您的文章阅读趋势图
                </div>
            `;
            panel.appendChild(articleTrendCard);

            return panel;
        }

        function showStatsDetailInterface(container) {
            _cleanupFns = [];

            const statsAppHeader = document.getElementById('app-header');
            const statsCardHeader = document.querySelector('.card-header');
            const statsCardBody = document.querySelector('.card-body');
            if (statsAppHeader) statsAppHeader.style.display = 'none';
            if (statsCardHeader) statsCardHeader.style.display = 'none';
            if (statsCardBody) statsCardBody.style.display = 'none';

            container.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'memory-mode-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            backBtn.onclick = () => {
                _cleanupFns.forEach(fn => fn());
                _cleanupFns = [];
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
            };
            header.appendChild(backBtn);

            const title = document.createElement('h3');
            title.textContent = '📊 学习统计';
            header.appendChild(title);

            const notebookSelector = buildNotebookSelector(_currentStatsNotebookId, function(id, nb) {
                _currentStatsNotebookId = id;
                const wordPanel = container.querySelector('.word-tab-content');
                if (wordPanel) buildWordPanel(null, wordPanel);
            });

            const statsTabBar = document.createElement('div');
            statsTabBar.className = 'memory-mode-tabs stats-sub-tabs';
            statsTabBar.innerHTML = `
                <div class="memory-mode-tab active" data-stats-tab="word">单词统计</div>
                <div class="memory-mode-tab" data-stats-tab="article">文章统计</div>
            `;

            const nbCurrent = notebookSelector.querySelector('.stats-nb-current');
            if (nbCurrent) statsTabBar.appendChild(nbCurrent);
            header.appendChild(statsTabBar);

            container.appendChild(header);

            const statsContainer = document.createElement('div');
            statsContainer.className = 'stats-detail-container';

            const wordStatsPanel = document.createElement('div');
            wordStatsPanel.className = 'memory-mode-tab-content word-tab-content';
            wordStatsPanel.style.display = 'block';
            statsContainer.appendChild(wordStatsPanel);

            const articleStatsPanel = buildArticleStatsPanel();
            articleStatsPanel.className = 'memory-mode-tab-content article-tab-content';
            articleStatsPanel.style.display = 'none';
            statsContainer.appendChild(articleStatsPanel);

            buildWordPanel(statsContainer, wordStatsPanel);

            statsTabBar.addEventListener('click', (e) => {
                const tab = e.target.closest('.memory-mode-tab');
                if (!tab) return;
                statsTabBar.querySelectorAll('.memory-mode-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.statsTab;
                statsContainer.querySelectorAll('.memory-mode-tab-content').forEach(c => c.style.display = 'none');
                if (tabName === 'word') {
                    wordStatsPanel.style.display = 'block';
                    if (nbCurrent) nbCurrent.style.display = '';
                } else {
                    articleStatsPanel.style.display = 'block';
                    if (nbCurrent) nbCurrent.style.display = 'none';
                }
            });

            container.appendChild(statsContainer);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showStatsDetailInterface,
            init: init
        };
    });
})();