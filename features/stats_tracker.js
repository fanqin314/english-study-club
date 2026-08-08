(function() {
    'use strict';

    var MODULE_META = {
        flashcard:      { label: '闪卡模式',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M9 12h12"/></svg>', color: '#3b82f6', type: 'word' },
        fillPractice:   { label: '填空练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>', color: '#10b981', type: 'word' },
        spelling:       { label: '听写练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', color: '#8b5cf6', type: 'word' },
        choicePractice: { label: '选词练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>', color: '#f59e0b', type: 'word' },
        listening:      { label: '听力练习',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>', color: '#06b6d4', type: 'word' },
        cloze:          { label: '语境填空',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', color: '#10b981', type: 'article' },
        fullReview:     { label: '全文回顾',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', color: '#3b82f6', type: 'article' },
        sentenceReview: { label: '逐句精读',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>', color: '#8b5cf6', type: 'article' },
        vocabQuiz:      { label: '生词测验',     icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>', color: '#ef4444', type: 'article' }
    };

    function getTodayStr() {
        return new Date().toDateString();
    }

    function ensureWordStats() {
        var todayStr = getTodayStr();
        var savedDate = localStorage.getItem('stats_word_date');
        if (savedDate !== todayStr) {
            localStorage.setItem('stats_word_date', todayStr);
            localStorage.setItem('stats_today_learned', '0');

            var streak = parseInt(localStorage.getItem('stats_streak_days') || '0');
            var yesterday = new Date(Date.now() - 86400000).toDateString();
            if (savedDate === yesterday) {
                localStorage.setItem('stats_streak_days', String(streak + 1));
            } else if (savedDate !== todayStr) {
                localStorage.setItem('stats_streak_days', '1');
            }
        }
    }

    function ensureArticleStats() {
        var todayStr = getTodayStr();
        var savedDate = localStorage.getItem('stats_article_date');
        if (savedDate !== todayStr) {
            localStorage.setItem('stats_article_date', todayStr);
            localStorage.setItem('stats_today_articles', '0');
            localStorage.setItem('stats_today_article_ids', '[]');

            var streak = parseInt(localStorage.getItem('stats_article_streak_days') || '0');
            var yesterday = new Date(Date.now() - 86400000).toDateString();
            if (savedDate === yesterday) {
                localStorage.setItem('stats_article_streak_days', String(streak + 1));
            } else if (savedDate !== todayStr) {
                localStorage.setItem('stats_article_streak_days', '1');
            }
        }
    }

    function getModuleData() {
        var raw = localStorage.getItem('stats_module_data');
        if (raw) {
            try { return JSON.parse(raw); } catch(e) {}
        }
        return {};
    }

    function saveModuleData(data) {
        localStorage.setItem('stats_module_data', JSON.stringify(data));
    }

    function getPerNbModuleData() {
        var raw = localStorage.getItem('stats_module_data_per_nb');
        if (raw) {
            try { return JSON.parse(raw); } catch(e) {}
        }
        return {};
    }

    function savePerNbModuleData(data) {
        localStorage.setItem('stats_module_data_per_nb', JSON.stringify(data));
    }

    window.StatsTracker = {
        MODULE_META: MODULE_META,

        recordWordsLearned: function(count) {
            if (!count || count <= 0) return;
            ensureWordStats();
            var today = parseInt(localStorage.getItem('stats_today_learned') || '0');
            localStorage.setItem('stats_today_learned', String(today + count));

            var total = parseInt(localStorage.getItem('stats_total_learned') || '0');
            localStorage.setItem('stats_total_learned', String(total + count));
        },

        recordWordsMastered: function(count) {
            if (!count || count <= 0) return;
            var mastered = parseInt(localStorage.getItem('stats_mastered_words') || '0');
            localStorage.setItem('stats_mastered_words', String(mastered + count));
        },

        recordModuleActivity: function(moduleName, count, notebookId) {
            if (!moduleName || !count || count <= 0) return;

            var data = getModuleData();
            var todayStr = getTodayStr();
            if (!data[todayStr]) data[todayStr] = {};
            if (!data[todayStr][moduleName]) data[todayStr][moduleName] = 0;
            data[todayStr][moduleName] += count;
            saveModuleData(data);

            if (notebookId) {
                var nbData = getPerNbModuleData();
                if (!nbData[notebookId]) nbData[notebookId] = {};
                if (!nbData[notebookId][todayStr]) nbData[notebookId][todayStr] = {};
                if (!nbData[notebookId][todayStr][moduleName]) nbData[notebookId][todayStr][moduleName] = 0;
                nbData[notebookId][todayStr][moduleName] += count;
                savePerNbModuleData(nbData);
            }
        },

        recordArticleRead: function(articleId) {
            if (!articleId) return;
            ensureArticleStats();

            var todayStr = getTodayStr();
            var todayIds = JSON.parse(localStorage.getItem('stats_today_article_ids') || '[]');

            if (!todayIds.includes(articleId)) {
                todayIds.push(articleId);
                localStorage.setItem('stats_today_article_ids', JSON.stringify(todayIds));
                localStorage.setItem('stats_today_articles', String(todayIds.length));
            }

            var total = parseInt(localStorage.getItem('stats_total_articles_learned') || '0');
            var savedIds = JSON.parse(localStorage.getItem('stats_all_article_ids') || '[]');
            if (!savedIds.includes(articleId)) {
                savedIds.push(articleId);
                localStorage.setItem('stats_all_article_ids', JSON.stringify(savedIds));
                localStorage.setItem('stats_total_articles_learned', String(savedIds.length));
            }
        },

        recordArticleReviewComplete: function(articleId, correctCount, totalCount) {
            if (!articleId) return;
            this.recordArticleRead(articleId);
            if (correctCount && correctCount > 0) {
                this.recordWordsLearned(correctCount);
            }
        },

        getModuleStats: function() {
            var data = getModuleData();
            var todayStr = getTodayStr();
            var todayData = data[todayStr] || {};
            var result = [];

            for (var key in MODULE_META) {
                if (MODULE_META.hasOwnProperty(key)) {
                    var count = todayData[key] || 0;
                    if (count > 0) {
                        result.push({
                            key: key,
                            count: count,
                            meta: MODULE_META[key]
                        });
                    }
                }
            }

            result.sort(function(a, b) { return b.count - a.count; });
            return result;
        },

        getModuleAllTimeStats: function() {
            var data = getModuleData();
            var totals = {};
            for (var dateStr in data) {
                if (data.hasOwnProperty(dateStr)) {
                    for (var mod in data[dateStr]) {
                        if (data[dateStr].hasOwnProperty(mod)) {
                            if (!totals[mod]) totals[mod] = 0;
                            totals[mod] += data[dateStr][mod];
                        }
                    }
                }
            }
            var result = [];
            for (var key in MODULE_META) {
                if (MODULE_META.hasOwnProperty(key)) {
                    var count = totals[key] || 0;
                    result.push({
                        key: key,
                        count: count,
                        meta: MODULE_META[key]
                    });
                }
            }
            result.sort(function(a, b) { return b.count - a.count; });
            return result;
        },

        getModuleAllTimeStatsForNotebook: function(notebookId) {
            if (!notebookId) return this.getModuleAllTimeStats();

            var nbData = getPerNbModuleData();
            var notebookData = nbData[notebookId] || {};
            var totals = {};

            for (var dateStr in notebookData) {
                if (notebookData.hasOwnProperty(dateStr)) {
                    for (var mod in notebookData[dateStr]) {
                        if (notebookData[dateStr].hasOwnProperty(mod)) {
                            if (!totals[mod]) totals[mod] = 0;
                            totals[mod] += notebookData[dateStr][mod];
                        }
                    }
                }
            }

            var result = [];
            for (var key in MODULE_META) {
                if (MODULE_META.hasOwnProperty(key)) {
                    var count = totals[key] || 0;
                    result.push({
                        key: key,
                        count: count,
                        meta: MODULE_META[key]
                    });
                }
            }
            result.sort(function(a, b) { return b.count - a.count; });
            return result;
        }
    };

    ensureWordStats();
    ensureArticleStats();
})();