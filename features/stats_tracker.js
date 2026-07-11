(function() {
    'use strict';

    var MODULE_META = {
        flashcard:      { label: '闪卡模式',     icon: '🃏', color: '#3b82f6', type: 'word' },
        fillPractice:   { label: '填空练习',     icon: '✍️', color: '#10b981', type: 'word' },
        spelling:       { label: '听写练习',     icon: '🎧', color: '#8b5cf6', type: 'word' },
        choicePractice: { label: '选词练习',     icon: '🔤', color: '#f59e0b', type: 'word' },
        cloze:          { label: '语境填空',     icon: '📝', color: '#10b981', type: 'article' },
        fullReview:     { label: '全文回顾',     icon: '📖', color: '#3b82f6', type: 'article' },
        sentenceReview: { label: '逐句精读',     icon: '🔍', color: '#8b5cf6', type: 'article' }
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