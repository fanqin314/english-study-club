(function() {
    let _showToast = null;
    let _getVocabData = null;
    let _cleanupFns = [];

    ModuleRegistry.register('StatsDetailUI', ['GlobalManager'], function(GlobalManager) {

        function getWordStats() {
            // 数据计算统一走共享层（core/shared/study_stats.js），仅做字段命名适配
            const EnglishStudyShared = window.EnglishStudyShared || {};
            const SStats = EnglishStudyShared.Stats;
            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};

            const notebookArr = [];
            for (const [id, nb] of Object.entries(allNotebooks)) {
                notebookArr.push({
                    id,
                    name: nb.name || id,
                    color: nb.color || '#3b82f6',
                    count: (nb.words || []).length
                });
            }

            const ws = SStats.wordStats(notebookArr);

            return {
                totalWords: ws.totalWords,
                masteredWords: ws.masteredCount,
                totalLearned: ws.totalLearned,
                todayLearned: ws.todayLearned,
                streakDays: ws.streak,
                masteryRate: ws.masteryRate,
                notebookStats: ws.notebooks
            };
        }

        function getArticleStats() {
            // 聚合项统一走共享层（study_stats.js），仅此页 needs vocabCount 补充统计生词数
            const EnglishStudyShared = window.EnglishStudyShared || {};
            const SStats = EnglishStudyShared.Stats;
            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            const historyArr = historyList.map(h => ({
                id: h.id,
                title: h.title,
                originalText: h.originalText || '',
                savedAt: h.savedAt
            }));

            const as = SStats.articleStats(historyArr);

            // 补充「文章内生词数」（桌面端独有展示字段）
            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const vocabMap = {};
            for (const nb of Object.values(allNotebooks)) {
                if (nb.words) {
                    nb.words.forEach(w => { vocabMap[(w.word || '').toLowerCase().trim()] = true; });
                }
            }
            const recentArticles = as.recent.map(r => {
                const words = (r.originalText || '').split(/[^a-zA-Z'-]+/).filter(w => w.length > 0);
                return {
                    id: r.id,
                    title: r.title,
                    savedAt: r.savedAt,
                    wordCount: words.length,
                    vocabCount: words.filter(w => vocabMap[w.toLowerCase()]).length
                };
            });

            return {
                totalArticles: as.totalArticles,
                todayArticles: as.todayArticles,
                articleStreakDays: as.articleStreak,
                recentArticles
            };
        }

        function buildModuleDetailCard(moduleType, allTimeStats) {
            const filtered = allTimeStats.filter(m => m.meta.type === moduleType && m.count > 0);
            if (filtered.length === 0) return null;

            const card = document.createElement('div');
            card.className = 'stats-section-card stats-animate-in';

            const typeLabel = moduleType === 'word' ? '单词练习' : '文章阅读';
            const iconSvg = moduleType === 'word'
                ? `<svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
                : `<svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`;

            let html = `<h4>${iconSvg}各模式${typeLabel}明细</h4><div class="stats-module-list">`;

            // 周标签头行（只显示一次）
            html += buildDailyChartHeader();

            filtered.forEach(mod => {
                const iconHtml = mod.meta.icon || '';
                html += `
                    <div class="stats-module-item" data-module-key="${mod.key}">
                        <span class="stats-module-icon">${iconHtml}</span>
                        <span class="stats-module-name">${mod.meta.label}</span>
                        ${buildCompactDailyChart(mod.key, mod.meta.color)}
                        <span class="stats-module-count">${mod.count}</span>
                    </div>
                `;
            });

            html += '</div>';

            card.innerHTML = html;

            return card;
        }

        function buildDailyChartHeader() {
            const days = ['六', '日', '一', '二', '三', '四', '五'];
            const now = new Date();
            let html = '<div class="stats-module-item stats-module-header"><span class="stats-module-icon"></span><span class="stats-module-name"></span><span class="stats-module-dot-wrap">';
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const label = days[(d.getDay() + 6) % 7];
                html += `<span class="stats-module-dot-col"><span class="stats-module-dot-label">${label}</span></span>`;
            }
            html += '</span><span class="stats-module-count"></span></div>';
            return html;
        }

        function getDailyTrendData(moduleType) {
            // 从 localStorage 读取真实每日活动数据，返回最近 7 天的日总量
            // moduleType: 'word' | 'article' | undefined (全部)
            const raw = localStorage.getItem('stats_module_data');
            let data = {};
            if (raw) {
                try { data = JSON.parse(raw); } catch(e) {}
            }

            // 获取指定类型的模块key列表
            let typeKeys = null;
            if (moduleType) {
                typeKeys = [];
                for (const key in window.StatsTracker.MODULE_META) {
                    if (window.StatsTracker.MODULE_META[key].type === moduleType) {
                        typeKeys.push(key);
                    }
                }
            }

            const result = [];
            const days = ['一', '二', '三', '四', '五', '六', '日'];
            const now = new Date();

            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const key = d.toDateString();
                const dayData = data[key] || {};
                let total = 0;
                for (const modKey of Object.keys(dayData)) {
                    if (!typeKeys || typeKeys.includes(modKey)) {
                        total += dayData[modKey];
                    }
                }
                result.push({
                    label: '周' + days[(d.getDay() + 6) % 7],
                    value: total,
                    dateStr: key
                });
            }

            return result;
        }

        function getModuleDailyBreakdown(moduleKey) {
            const raw = localStorage.getItem('stats_module_data');
            let data = {};
            if (raw) {
                try { data = JSON.parse(raw); } catch(e) {}
            }
            const result = [];
            const days = ['一', '二', '三', '四', '五', '六', '日'];
            const now = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const key = d.toDateString();
                const dayData = data[key] || {};
                const value = dayData[moduleKey] || 0;
                result.push({
                    label: '周' + days[(d.getDay() + 6) % 7],
                    value: value,
                    dateStr: key
                });
            }
            return result;
        }

        function getDotOpacity(value, maxVal) {
            if (maxVal <= 0) return 0.06;
            const ratio = value / maxVal;
            if (ratio === 0) return 0.06;
            return 0.12 + ratio * 0.83;
        }

        function buildCompactDailyChart(moduleKey, color) {
            const dailyData = getModuleDailyBreakdown(moduleKey);
            const maxVal = Math.max(...dailyData.map(d => d.value), 1);
            const dotSize = 20;

            if (maxVal <= 1 && dailyData.every(d => d.value === 0)) {
                return '<span class="stats-module-dot-wrap">' +
                    dailyData.map(d => {
                        const opacity = getDotOpacity(0, 1);
                        return `<span class="stats-module-dot-col"><span class="stats-module-dot" style="width:${dotSize}px;height:${dotSize}px;background:${color};opacity:${opacity};"></span></span>`;
                    }).join('') +
                    '</span>';
            }

            let html = '<span class="stats-module-dot-wrap">';
            dailyData.forEach(d => {
                const opacity = getDotOpacity(d.value, maxVal);
                html += `<span class="stats-module-dot-col">
                    <span class="stats-module-dot" style="width:${dotSize}px;height:${dotSize}px;background:${color};opacity:${opacity};" title="${d.label}: ${d.value}次"></span>
                </span>`;
            });
            html += '</span>';
            return html;
        }

        function buildMiniChart(moduleType) {
            const dailyData = getDailyTrendData(moduleType);
            const maxVal = Math.max(...dailyData.map(d => d.value), 1);

            // 如果没有任何数据
            if (maxVal <= 1 && dailyData.every(d => d.value === 0)) {
                const wrap = document.createElement('div');
                wrap.className = 'trend-chart-placeholder';
                wrap.innerHTML = `
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 10px;opacity:0.35;">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    完成更多学习后，这里将展示您的学习趋势图
                `;
                return wrap;
            }

            const wrap = document.createElement('div');
            wrap.className = 'stats-chart-wrap';

            const n = dailyData.length;
            // SVG 尺寸参数
            const svgW = 100;
            const svgH = 100;
            const padL = 0;
            const padR = 0;
            const padT = 18;
            const padB = 0;
            const chartW = svgW - padL - padR;
            const chartH = svgH - padT - padB;

            // 计算点坐标
            const points = dailyData.map((d, i) => {
                const x = padL + (i / (n - 1)) * chartW;
                const y = padT + chartH - (d.value / maxVal) * chartH;
                return { x, y, value: d.value, label: d.label, dateStr: d.dateStr };
            });

            // 构建 SVG path 的 points 字符串
            const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
            const areaPoints = points.map(p => `${p.x},${p.y}`).join(' ') + ` ${points[n-1].x},${padT + chartH} ${points[0].x},${padT + chartH}`;

            // 生成 SVG（带渐变填充面积 + 折线 + 圆点）
            let svgContent = `
                <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100px" style="display:block;overflow:visible;">
                    <defs>
                        <linearGradient id="trendGrad_${moduleType || 'all'}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
                            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
                        </linearGradient>
                    </defs>
                    <polygon points="${areaPoints}" fill="url(#trendGrad_${moduleType || 'all'})"/>
                    <polyline points="${linePoints}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
            `;

            points.forEach((p, i) => {
                const r = p.value > 0 ? 4 : 0;
                if (r > 0) {
                    svgContent += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="var(--accent)" stroke="var(--card-bg)" stroke-width="1.5"/>`;
                    // 在圆点上方显示数值标签
                    svgContent += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="7" fill="var(--text-light)" font-weight="700">${p.value}</text>`;
                }
            });

            svgContent += '</svg>';

            // 底部星期标签
            let labelsHtml = '<div class="stats-chart-labels">';
            dailyData.forEach((d, i) => {
                labelsHtml += `<span class="stats-chart-day">${d.label}</span>`;
            });
            labelsHtml += '</div>';

            wrap.innerHTML = svgContent + labelsHtml;
            return wrap;
        }

        // 坚持热力图（GitHub 贡献网格，12 周 = 84 天）
        function buildHeatmap() {
            const EnglishStudyShared = window.EnglishStudyShared || {};
            const SStats = EnglishStudyShared.Stats;
            const series = (SStats && SStats.heatmap) ? SStats.heatmap(12) : { days: [], max: 0 };
            const days = series.days || [];
            const max = series.max || 0;

            // 空数据占位
            if (max <= 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'trend-chart-placeholder';
                placeholder.innerHTML = `
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 10px;opacity:0.35;">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    完成学习后点亮坚持地图
                `;
                return placeholder.outerHTML;
            }

            // 分档着色：0 / 1 / 2-3 / 4-6 / 7+（var(--accent) + opacity）
            const tiers = [
                { top: 0, opacity: 0, empty: true },
                { top: 1, opacity: 0.22 },
                { top: 3, opacity: 0.45 },
                { top: 6, opacity: 0.70 },
                { top: Infinity, opacity: 1 }
            ];
            function tierOf(value) {
                for (const t of tiers) {
                    if (value <= t.top) return t;
                }
                return tiers[tiers.length - 1];
            }
            function cellStyle(t) {
                if (t.empty) return 'background:var(--btn-bg);box-shadow:inset 0 0 0 1px var(--border);';
                return `background:var(--accent);opacity:${t.opacity};`;
            }
            function fmtDate(dateStr) {
                const d = new Date(dateStr);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${d.getFullYear()}/${mm}/${dd}`;
            }

            const WEEKS = 12;
            const ROWS = 7;
            let html = '<div class="stats-heatmap-body">';
            html += '<div class="stats-heatmap-rows"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>';
            html += '<div class="stats-heatmap-grid">';

            for (let w = 0; w < WEEKS; w++) {
                html += '<div class="stats-heatmap-col">';
                for (let r = 0; r < ROWS; r++) {
                    const day = days[w * ROWS + r];
                    const value = day ? day.value : 0;
                    const t = tierOf(value);
                    const title = day ? `${fmtDate(day.dateStr)}：${value}次` : '';
                    html += `<span class="stats-heatmap-cell" style="${cellStyle(t)}" title="${title}"></span>`;
                }
                html += '</div>';
            }

            html += '</div></div>';

            // 图例（少 → 多）
            html += '<div class="stats-heatmap-legend"><span>少</span>';
            tiers.forEach(t => {
                html += `<span class="stats-heatmap-cell" style="${cellStyle(t)}"></span>`;
            });
            html += '<span>多</span></div>';

            return html;
        }

        function buildNotebookDonut(notebookStats) {
            const total = notebookStats.reduce((sum, nb) => sum + nb.count, 0);
            if (total === 0) return '';
            const circumference = 2 * Math.PI * 36;
            let segments = '';
            let cumulativeOffset = 0;
            notebookStats.forEach((nb) => {
                const pct = nb.count / total;
                const length = circumference * pct;
                segments += `<circle cx="50" cy="50" r="36" fill="none" stroke="${nb.color}" stroke-width="20"
                    stroke-dasharray="${length} ${circumference - length}"
                    stroke-dashoffset="${-cumulativeOffset}"
                    transform="rotate(-90 50 50)"
                    class="stats-nb-donut-seg" data-nb-name="${nb.name}"/>`;
                cumulativeOffset += length;
            });
            return `
                <svg viewBox="0 0 100 100" class="stats-nb-donut">
                    ${segments}
                    <circle cx="50" cy="50" r="16" fill="var(--card-bg)" stroke="var(--border)" stroke-width="1"/>
                    <text x="50" y="46" text-anchor="middle" font-size="18" font-weight="800" fill="var(--text)" font-family="'Plus Jakarta Sans',sans-serif">${total}</text>
                    <text x="50" y="62" text-anchor="middle" font-size="8" fill="var(--text-light)" font-family="'DM Sans',sans-serif">总词数</text>
                </svg>
            `;
        }

        function buildWordPanel(statsContainer, wordStatsPanel) {
            const stats = getWordStats();
            const moduleStats = window.StatsTracker.getModuleAllTimeStats();

            wordStatsPanel.innerHTML = '';

            const overviewCard = document.createElement('div');
            overviewCard.className = 'stats-section-card stats-animate-in';
            overviewCard.style.animationDelay = '0.05s';
            overviewCard.innerHTML = `
                <h4>
                    <svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    单词学习概览
                </h4>
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
            if (wordModuleCard) {
                wordModuleCard.style.animationDelay = '0.15s';
                wordStatsPanel.appendChild(wordModuleCard);
            }

            if (stats.notebookStats.length > 0) {
                const notebookCard = document.createElement('div');
                notebookCard.className = 'stats-section-card stats-animate-in';
                notebookCard.style.animationDelay = '0.25s';
                let nbHtml = '<h4><svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>生词本分布</h4>';

                // 添加环形图概览
                nbHtml += '<div class="stats-nb-overview">' + buildNotebookDonut(stats.notebookStats) + '<div class="stats-nb-list">';

                const totalNbCount = stats.notebookStats.reduce((sum, n) => sum + n.count, 0);

                stats.notebookStats.forEach(nb => {
                    const pct = totalNbCount > 0 ? Math.round((nb.count / totalNbCount) * 100) : 0;
                    nbHtml += `
                        <div class="stats-nb-item">
                            <span class="stats-nb-color" style="background:${nb.color};"></span>
                            <span class="stats-nb-name">${nb.name}</span>
                            <span class="stats-nb-bar-wrap"><span class="stats-nb-bar" style="width:${pct}%;background:${nb.color};"></span></span>
                            <span class="stats-nb-count">${nb.count}词 (${pct}%)</span>
                        </div>
                    `;
                });

                nbHtml += '</div></div>';
                notebookCard.innerHTML = nbHtml;
                wordStatsPanel.appendChild(notebookCard);
            }

            const trendCard = document.createElement('div');
            trendCard.className = 'stats-section-card stats-animate-in';
            trendCard.style.animationDelay = '0.35s';
            trendCard.innerHTML = `
                <h4>
                    <svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    学习趋势
                </h4>
            `;
            trendCard.appendChild(buildMiniChart('word'));
            wordStatsPanel.appendChild(trendCard);

            const heatmapCard = document.createElement('div');
            heatmapCard.className = 'stats-section-card stats-animate-in';
            heatmapCard.style.animationDelay = '0.45s';
            heatmapCard.innerHTML = `
                <h4>
                    <svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    坚持热力图
                </h4>
            ` + buildHeatmap();
            wordStatsPanel.appendChild(heatmapCard);
        }

        function buildArticleStatsPanel() {
            const stats = getArticleStats();
            const panel = document.createElement('div');

            const overviewCard = document.createElement('div');
            overviewCard.className = 'stats-section-card stats-animate-in';
            overviewCard.style.animationDelay = '0.05s';
            overviewCard.innerHTML = `
                <h4>
                    <svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9"/>
                        <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
                    </svg>
                    文章学习概览
                </h4>
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
            if (articleModuleCard) {
                articleModuleCard.style.animationDelay = '0.15s';
                panel.appendChild(articleModuleCard);
            }

            if (stats.recentArticles.length > 0) {
                const recentCard = document.createElement('div');
                recentCard.className = 'stats-section-card stats-animate-in';
                recentCard.style.animationDelay = '0.25s';
                let recentHtml = '<h4><svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>最近阅读的文章</h4><div class="stats-article-list">';

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
            articleTrendCard.className = 'stats-section-card stats-animate-in';
            articleTrendCard.style.animationDelay = '0.35s';
            articleTrendCard.innerHTML = `
                <h4>
                    <svg class="stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    阅读趋势
                </h4>
            `;
            articleTrendCard.appendChild(buildMiniChart('article'));
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
            title.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> 学习统计';
            header.appendChild(title);

            const statsTabBar = document.createElement('div');
            statsTabBar.className = 'memory-mode-tabs stats-sub-tabs';
            statsTabBar.innerHTML = `
                <div class="memory-mode-tab active" data-stats-tab="word">单词统计</div>
                <div class="memory-mode-tab" data-stats-tab="article">文章统计</div>
            `;
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
                } else {
                    articleStatsPanel.style.display = 'block';
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