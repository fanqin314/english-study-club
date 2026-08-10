(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('VocabQuizUI', ['GlobalManager'], function(GlobalManager) {

        const BACK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
        const STAR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>';
        const TROPHY_SVG = '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
        const CHECK_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        const TRANSLATE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l3 8"/><path d="M9 8l-3 8"/><path d="M19 8l-3 8"/><path d="M15 8l3 8"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="20" y2="12"/></svg>';

        function showVocabQuizInterface(container, articleId, selectedNotebookIds) {
            const historyItem = window.HistoryManager ? window.HistoryManager.getHistory().find(h => h.id === articleId) : null;
            if (!historyItem) {
                _showToast('文章数据未找到');
                return;
            }

            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};

            const vocabMap = {};
            for (const [id, nb] of Object.entries(allNotebooks)) {
                if (selectedNotebookIds.has(id) && nb.words) {
                    nb.words.forEach(w => {
                        const key = w.word.toLowerCase().trim();
                        if (key) vocabMap[key] = w.meaning || '';
                    });
                }
            }
            const vocabLemmas = Object.keys(vocabMap);

            if (vocabLemmas.length === 0) {
                _showToast('生词本为空，请先添加单词');
                return;
            }

            function lemmatize(word) {
                const w = word.toLowerCase();
                const irregular = {
                    'ran':'run','runs':'run','running':'run','runned':'run',
                    'ate':'eat','eats':'eat','eating':'eat','eaten':'eat',
                    'went':'go','goes':'go','going':'go','gone':'go',
                    'came':'come','comes':'come','coming':'come',
                    'took':'take','takes':'take','taking':'take','taken':'take',
                    'saw':'see','sees':'see','seeing':'see','seen':'see',
                    'gave':'give','gives':'give','giving':'give','given':'give',
                    'made':'make','makes':'make','making':'make',
                    'wrote':'write','writes':'write','writing':'write','written':'write',
                    'spoke':'speak','speaks':'speak','speaking':'speak','spoken':'speak',
                    'broke':'break','breaks':'break','breaking':'break','broken':'break',
                    'drove':'drive','drives':'drive','driving':'drive','driven':'drive',
                    'began':'begin','begins':'begin','beginning':'begin','begun':'begin',
                    'drank':'drink','drinks':'drink','drinking':'drink','drunk':'drink',
                    'sang':'sing','sings':'sing','singing':'sing','sung':'sing',
                    'swam':'swim','swims':'swim','swimming':'swim','swum':'swim',
                    'knew':'know','knows':'know','knowing':'know','known':'know',
                    'grew':'grow','grows':'grow','growing':'grow','grown':'grow',
                    'threw':'throw','throws':'throw','throwing':'throw','thrown':'throw',
                    'drew':'draw','draws':'draw','drawing':'draw','drawn':'draw',
                    'stole':'steal','steals':'steal','stealing':'steal','stolen':'steal',
                    'woke':'wake','wakes':'wake','waking':'wake','woken':'wake',
                    'froze':'freeze','freezes':'freeze','freezing':'freeze','frozen':'freeze',
                    'forgot':'forget','forgets':'forget','forgetting':'forget','forgotten':'forget',
                    'chose':'choose','chooses':'choose','choosing':'choose','chosen':'choose',
                    'hid':'hide','hides':'hide','hiding':'hide','hidden':'hide',
                    'bit':'bite','bites':'bite','biting':'bite','bitten':'bite',
                    'fell':'fall','falls':'fall','falling':'fall','fallen':'fall',
                    'flew':'fly','flies':'fly','flying':'fly','flown':'fly',
                    'blew':'blow','blows':'blow','blowing':'blow','blown':'blow',
                    'shook':'shake','shakes':'shake','shaking':'shake','shaken':'shake',
                    'met':'meet','meets':'meet','meeting':'meet',
                    'kept':'keep','keeps':'keep','keeping':'keep',
                    'slept':'sleep','sleeps':'sleep','sleeping':'sleep',
                    'left':'leave','leaves':'leave','leaving':'leave',
                    'spent':'spend','spends':'spend','spending':'spend',
                    'built':'build','builds':'build','building':'build',
                    'said':'say','says':'say','saying':'say',
                    'held':'hold','holds':'hold','holding':'hold',
                    'taught':'teach','teaches':'teach','teaching':'teach',
                    'thought':'think','thinks':'think','thinking':'think',
                    'bought':'buy','buys':'buy','buying':'buy',
                    'sent':'send','sends':'send','sending':'send',
                    'found':'find','finds':'find','finding':'find',
                    'felt':'feel','feels':'feel','feeling':'feel',
                    'won':'win','wins':'win','winning':'win',
                    'told':'tell','tells':'tell','telling':'tell',
                    'sold':'sell','sells':'sell','selling':'sell',
                    'lost':'lose','loses':'lose','losing':'lose',
                    'lay':'lie','lies':'lie','lying':'lie','lain':'lie',
                    'sat':'sit','sits':'sit','sitting':'sit',
                    'became':'become','becomes':'become','becoming':'become',
                    'led':'lead','leads':'lead','leading':'lead',
                    'rose':'rise','rises':'rise','rising':'rise','risen':'rise',
                    'better':'good','best':'good','worse':'bad','worst':'bad'
                };
                if (irregular[w]) return irregular[w];
                if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
                if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
                if (w.endsWith('es') && w.length > 4) {
                    if (/sses|ches|shes|xes|zzes|oes$/.test(w)) return w.slice(0, -2);
                }
                if (w.endsWith('ing')) {
                    const base = w.slice(0, -3);
                    const doubled = base.replace(/(.)\1$/, '$1');
                    if (vocabMap[doubled] || vocabMap[doubled + 'e']) return doubled;
                    if (vocabMap[base] || vocabMap[base + 'e']) return base;
                    return doubled;
                }
                if (w.endsWith('ed')) {
                    const base = w.slice(0, -2);
                    const doubled = base.replace(/(.)\1$/, '$1');
                    if (vocabMap[doubled] || vocabMap[doubled + 'e']) return doubled;
                    if (vocabMap[base] || vocabMap[base + 'e']) return base;
                    return doubled;
                }
                if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
                return w;
            }

            function tokenize(text) {
                const tokens = [];
                const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (match[1]) {
                        tokens.push({ type: 'word', value: match[1], index: match.index });
                    } else if (match[2]) {
                        tokens.push({ type: 'nonword', value: match[2], index: match.index });
                    }
                }
                return tokens;
            }

            function escapeHtml(str) {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            function shuffleArray(arr) {
                const a = [...arr];
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }

            const articleText = historyItem.originalText || '';
            const tokens = tokenize(articleText);

            const blankEntries = [];
            let blankIdCounter = 0;
            tokens.forEach(token => {
                if (token.type === 'word') {
                    const lower = token.value.toLowerCase();
                    const lemma = lemmatize(lower);
                    const matchedKey = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
                    if (matchedKey) {
                        blankEntries.push({
                            id: 'blank-' + (blankIdCounter++),
                            word: token.value,
                            originalWord: token.value,
                            matchedKey: matchedKey,
                            meaning: vocabMap[matchedKey],
                            filled: false,
                            filledWord: null
                        });
                    }
                }
            });

            if (blankEntries.length === 0) {
                _showToast('该文章中没有找到生词本中的单词');
                return;
            }

            if (blankEntries.length < 4) {
                _showToast('生词太少，至少需要 4 个生词才能开始测验');
                return;
            }

            const appHeader = document.getElementById('app-header');
            const cardHeader = document.querySelector('.card-header');
            const cardBody = document.querySelector('.card-body');
            if (appHeader) appHeader.style.display = 'none';
            if (cardHeader) cardHeader.style.display = 'none';
            if (cardBody) cardBody.style.display = 'none';

            container.innerHTML = '';

            const _cleanupFns = [];

            let quizScore = 0;
            let quizStreakCount = 0;
            let quizMaxStreak = 0;
            let quizCorrectCount = 0;
            let quizWrongCount = 0;
            let quizTotalBlanks = blankEntries.length;
            let quizFilledCount = 0;
            let quizCompleted = false;
            let cachedTranslation = historyItem.fullTranslation || (window.CacheManager && window.CacheManager.getFullTranslation ? window.CacheManager.getFullTranslation() : null) || null;
            let translationLoading = false;

            function exitToMemoryMode() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                _cleanupFns.forEach(fn => fn());
                _cleanupFns.length = 0;
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
                const tabBarEl = container.querySelector('.memory-mode-tabs');
                if (tabBarEl) {
                    tabBarEl.querySelectorAll('.memory-mode-tab').forEach(t => t.classList.remove('active'));
                    const articleTabEl = tabBarEl.querySelector('[data-tab="article"]');
                    if (articleTabEl) articleTabEl.classList.add('active');
                    const modeSelect = container.querySelector('.mode-select-section');
                    if (modeSelect) {
                        modeSelect.querySelectorAll('.memory-mode-tab-content').forEach(c => c.style.display = 'none');
                        const artContent = modeSelect.querySelector('.article-tab-content');
                        if (artContent) artContent.style.display = 'block';
                    }
                }
            }

            function getComboBonus(streak) {
                if (streak >= 20) return 10;
                if (streak >= 10) return 5;
                if (streak >= 5) return 3;
                if (streak >= 3) return 2;
                return 0;
            }

            function updateScore() {
                const scoreEl = document.getElementById('quizScoreNum');
                if (scoreEl) scoreEl.textContent = quizScore;
                const badge = document.getElementById('quizScoreBadge');
                if (badge) {
                    badge.classList.remove('score-pop');
                    void badge.offsetWidth;
                    badge.classList.add('score-pop');
                }
            }

            function updateStreak() {
                const streakEl = document.getElementById('quizStreak');
                if (!streakEl) return;
                if (quizStreakCount >= 10) {
                    streakEl.innerHTML = '🔥 ' + quizStreakCount + '连击！';
                    streakEl.className = 'quiz-streak streak-10 super';
                } else if (quizStreakCount >= 5) {
                    streakEl.innerHTML = '🔥 ' + quizStreakCount + '连击！';
                    streakEl.className = 'quiz-streak streak-5';
                } else if (quizStreakCount >= 3) {
                    streakEl.innerHTML = '🔥 ' + quizStreakCount + '连击！';
                    streakEl.className = 'quiz-streak streak-3';
                } else {
                    streakEl.innerHTML = '';
                    streakEl.className = 'quiz-streak';
                }
            }

            function updateProgress() {
                const fillEl = document.getElementById('quizProgressFill');
                const textEl = document.getElementById('quizProgressText');
                const pct = quizTotalBlanks > 0 ? (quizFilledCount / quizTotalBlanks * 100) : 0;
                if (fillEl) fillEl.style.width = pct + '%';
                if (textEl) textEl.textContent = quizFilledCount + ' / ' + quizTotalBlanks + ' 个空格';
            }

            function checkCompletion() {
                if (quizFilledCount >= quizTotalBlanks && !quizCompleted) {
                    quizCompleted = true;
                    setTimeout(() => showSummary(), 400);
                }
            }

            function getChipForWord(word) {
                const chips = document.querySelectorAll('.quiz-word-chip:not(.used)');
                for (const chip of chips) {
                    if (chip.dataset.word === word) return chip;
                }
                return null;
            }

            function fillBlank(blankEl, chipEl, word) {
                const blankId = blankEl.dataset.blankId;
                const targetWord = blankEl.dataset.targetWord;

                blankEl.textContent = word;
                blankEl.classList.add('filled');

                if (word === targetWord) {
                    blankEl.classList.add('correct');
                    blankEl.dataset.filledWord = word;
                    chipEl.classList.add('used');
                    chipEl.draggable = false;

                    quizStreakCount++;
                    if (quizStreakCount > quizMaxStreak) quizMaxStreak = quizStreakCount;
                    const bonus = getComboBonus(quizStreakCount);
                    const gained = 10 + bonus;
                    quizScore += gained;
                    quizCorrectCount++;
                    quizFilledCount++;

                    const entry = blankEntries.find(e => e.id === blankId);
                    if (entry) {
                        entry.filled = true;
                        entry.filledWord = word;
                    }

                    updateScore();
                    updateStreak();
                    updateProgress();
                    if (window.feedbackOverlay && typeof window.feedbackOverlay.showConfetti === 'function') {
                        window.feedbackOverlay.showConfetti();
                    }
                    checkCompletion();
                } else {
                    blankEl.classList.add('incorrect', 'shake');
                    quizStreakCount = 0;
                    quizWrongCount++;
                    updateStreak();

                    setTimeout(() => {
                        blankEl.classList.remove('incorrect', 'shake', 'filled');
                        blankEl.textContent = '____';
                    }, 600);
                }
            }

            function removeFill(blankEl) {
                const blankId = blankEl.dataset.blankId;
                const filledWord = blankEl.dataset.filledWord;
                if (!filledWord) return;

                blankEl.textContent = '____';
                blankEl.classList.remove('filled', 'correct', 'incorrect', 'shake');
                blankEl.dataset.filledWord = '';

                const entry = blankEntries.find(e => e.id === blankId);
                if (entry) {
                    entry.filled = false;
                    entry.filledWord = null;
                }

                const usedChip = document.querySelector('.quiz-word-chip.used[data-word="' + CSS.escape(filledWord) + '"][data-blank-id="' + CSS.escape(blankId) + '"]');
                if (usedChip) {
                    usedChip.classList.remove('used');
                    usedChip.draggable = true;
                }

                quizFilledCount = Math.max(0, quizFilledCount - 1);
                updateProgress();
            }

            function showSummary() {
                const existing = document.querySelector('.quiz-summary');
                if (existing) return;

                const wordBank = document.getElementById('quizWordBank');
                if (wordBank) wordBank.style.display = 'none';

                const articleWrap = document.querySelector('.quiz-article-wrap');
                if (articleWrap) articleWrap.style.maxHeight = '200px';

                const total = quizTotalBlanks;
                const correctCount = quizCorrectCount;
                const wrongCount = quizWrongCount;
                const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
                const isPerfect = (wrongCount === 0 && correctCount === total);

                if (isPerfect) quizScore += 20;

                if (window.StatsTracker) {
                    window.StatsTracker.recordModuleActivity('vocabQuiz', correctCount);
                    window.StatsTracker.recordWordsLearned(correctCount);
                }

                let titleText = '太棒了，完成啦！';
                let titleClass = '';
                if (isPerfect) { titleText = '完美通关！'; titleClass = 'perfect'; }
                else if (rate >= 90) titleText = '非常出色！';
                else if (rate >= 70) titleText = '做得不错！';
                else if (rate >= 50) titleText = '继续加油！';

                const summary = document.createElement('div');
                summary.className = 'quiz-summary';
                summary.innerHTML = ''
                    +   '<div class="quiz-summary-icon">' + TROPHY_SVG + '</div>'
                    +   '<div class="quiz-summary-title ' + titleClass + '">' + titleText + '</div>'
                    +   '<div class="quiz-summary-stats">'
                    +     '<div class="quiz-summary-stat" style="animation-delay:0.05s"><span class="quiz-summary-val correct">' + correctCount + '</span><span class="quiz-summary-lbl">正确</span></div>'
                    +     '<div class="quiz-summary-stat" style="animation-delay:0.12s"><span class="quiz-summary-val wrong">' + wrongCount + '</span><span class="quiz-summary-lbl">错误</span></div>'
                    +     '<div class="quiz-summary-stat" style="animation-delay:0.19s"><span class="quiz-summary-val rate">' + rate + '%</span><span class="quiz-summary-lbl">正确率</span></div>'
                    +     '<div class="quiz-summary-stat" style="animation-delay:0.26s"><span class="quiz-summary-val streak">' + quizMaxStreak + '</span><span class="quiz-summary-lbl">最高连击</span></div>'
                    +     '<div class="quiz-summary-stat" style="animation-delay:0.33s"><span class="quiz-summary-val score">' + quizScore + '</span><span class="quiz-summary-lbl">得分</span></div>'
                    +   '</div>'
                    +   (isPerfect ? '<div class="quiz-perfect-badge">完美通关！零错误，奖励 +20分</div>' : '')
                    +   '<button class="quiz-summary-restart">再来一轮</button>';

                const containerEl = document.querySelector('.quiz-container');
                if (containerEl) {
                    containerEl.appendChild(summary);
                }

                const retryBtn = summary.querySelector('.quiz-summary-restart');
                if (retryBtn) {
                    const onRetryClick = (e) => {
                        e.stopPropagation();
                        _cleanupFns.forEach(fn => fn());
                        _cleanupFns.length = 0;
                        showVocabQuizInterface(container, articleId, selectedNotebookIds);
                    };
                    retryBtn.addEventListener('click', onRetryClick);
                    _cleanupFns.push(() => retryBtn.removeEventListener('click', onRetryClick));
                }
            }

            function buildArticleHTML() {
                let html = '';
                let blankIdx = 0;
                tokens.forEach(token => {
                    if (token.type === 'word') {
                        const lower = token.value.toLowerCase();
                        const lemma = lemmatize(lower);
                        const matchedKey = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
                        if (matchedKey) {
                            const entry = blankEntries[blankIdx];
                            html += '<span class="quiz-blank" data-blank-id="' + entry.id + '" data-target-word="' + escapeHtml(entry.word) + '">____</span>';
                            blankIdx++;
                        } else {
                            html += escapeHtml(token.value);
                        }
                    } else {
                        html += token.value.replace(/\n/g, '<br>');
                    }
                });
                return html;
            }

            function setupBlankEvents(blankEl) {
                const onDragOver = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!blankEl.classList.contains('filled')) {
                        blankEl.classList.add('drag-over');
                    }
                };
                const onDragLeave = (e) => {
                    e.stopPropagation();
                    blankEl.classList.remove('drag-over');
                };
                const onDrop = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    blankEl.classList.remove('drag-over');
                    if (blankEl.classList.contains('filled')) return;
                    const word = e.dataTransfer.getData('text/plain');
                    const blankId = e.dataTransfer.getData('blank-id');
                    if (word) {
                        const chipEl = document.querySelector('.quiz-word-chip[data-blank-id="' + CSS.escape(blankId) + '"]:not(.used)');
                        if (chipEl) {
                            fillBlank(blankEl, chipEl, word);
                        }
                    }
                };
                const onClick = (e) => {
                    e.stopPropagation();
                    if (blankEl.classList.contains('filled')) {
                        removeFill(blankEl);
                    }
                };

                blankEl.addEventListener('dragover', onDragOver);
                blankEl.addEventListener('dragleave', onDragLeave);
                blankEl.addEventListener('drop', onDrop);
                blankEl.addEventListener('click', onClick);
                _cleanupFns.push(() => {
                    blankEl.removeEventListener('dragover', onDragOver);
                    blankEl.removeEventListener('dragleave', onDragLeave);
                    blankEl.removeEventListener('drop', onDrop);
                    blankEl.removeEventListener('click', onClick);
                });
            }

            function setupChipDrag(chipEl, word, blankId) {
                const onDragStart = (e) => {
                    if (chipEl.classList.contains('used')) {
                        e.preventDefault();
                        return;
                    }
                    e.dataTransfer.setData('text/plain', word);
                    e.dataTransfer.setData('blank-id', blankId);
                    e.dataTransfer.effectAllowed = 'move';
                    chipEl.classList.add('dragging');
                };
                const onDragEnd = () => {
                    chipEl.classList.remove('dragging');
                };

                chipEl.addEventListener('dragstart', onDragStart);
                chipEl.addEventListener('dragend', onDragEnd);
                _cleanupFns.push(() => {
                    chipEl.removeEventListener('dragstart', onDragStart);
                    chipEl.removeEventListener('dragend', onDragEnd);
                });

                setupChipTouchDrag(chipEl, word, blankId);
            }

            function setupChipTouchDrag(chipEl, word, blankId) {
                let touchGhost = null;
                let touchStartX = 0;
                let touchStartY = 0;
                let isDragging = false;
                let touchOffsetX = 0;
                let touchOffsetY = 0;

                const onTouchStart = (e) => {
                    if (e.touches.length !== 1) return;
                    if (chipEl.classList.contains('used')) return;
                    const touch = e.touches[0];
                    const rect = chipEl.getBoundingClientRect();
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                    touchOffsetX = touch.clientX - rect.left;
                    touchOffsetY = touch.clientY - rect.top;
                    isDragging = false;
                };

                const onTouchMove = (e) => {
                    if (e.touches.length !== 1) return;
                    const touch = e.touches[0];
                    const dx = touch.clientX - touchStartX;
                    const dy = touch.clientY - touchStartY;
                    if (!isDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                        isDragging = true;
                        chipEl.classList.add('dragging');
                        const rect = chipEl.getBoundingClientRect();
                        touchGhost = chipEl.cloneNode(true);
                        touchGhost.style.position = 'fixed';
                        touchGhost.style.left = rect.left + 'px';
                        touchGhost.style.top = rect.top + 'px';
                        touchGhost.style.width = rect.width + 'px';
                        touchGhost.style.height = rect.height + 'px';
                        touchGhost.style.pointerEvents = 'none';
                        touchGhost.style.opacity = '0.85';
                        touchGhost.style.zIndex = '1000';
                        touchGhost.dataset.word = word;
                        touchGhost.dataset.blankId = blankId;
                        touchGhost.classList.remove('dragging');
                        document.body.appendChild(touchGhost);
                    }
                    if (isDragging) {
                        e.preventDefault();
                        if (touchGhost) {
                            touchGhost.style.left = (touch.clientX - touchOffsetX) + 'px';
                            touchGhost.style.top = (touch.clientY - touchOffsetY) + 'px';
                        }
                        const el = document.elementFromPoint(touch.clientX, touch.clientY);
                        document.querySelectorAll('.quiz-blank').forEach(b => b.classList.remove('drag-over'));
                        if (el) {
                            const blank = el.closest('.quiz-blank');
                            if (blank && !blank.classList.contains('filled')) {
                                blank.classList.add('drag-over');
                            }
                        }
                    }
                };

                const onTouchEnd = (e) => {
                    if (!isDragging) return;
                    const touch = e.changedTouches[0];
                    if (touchGhost) {
                        touchGhost.remove();
                        touchGhost = null;
                    }
                    chipEl.classList.remove('dragging');
                    document.querySelectorAll('.quiz-blank').forEach(b => b.classList.remove('drag-over'));
                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (el) {
                        const blank = el.closest('.quiz-blank');
                        if (blank && !blank.classList.contains('filled')) {
                            fillBlank(blank, chipEl, word);
                        }
                    }
                    isDragging = false;
                };

                const onTouchCancel = () => {
                    if (touchGhost) {
                        touchGhost.remove();
                        touchGhost = null;
                    }
                    chipEl.classList.remove('dragging');
                    document.querySelectorAll('.quiz-blank').forEach(b => b.classList.remove('drag-over'));
                    isDragging = false;
                };

                chipEl.addEventListener('touchstart', onTouchStart, { passive: true });
                chipEl.addEventListener('touchmove', onTouchMove, { passive: false });
                chipEl.addEventListener('touchend', onTouchEnd);
                chipEl.addEventListener('touchcancel', onTouchCancel);
                _cleanupFns.push(() => {
                    chipEl.removeEventListener('touchstart', onTouchStart);
                    chipEl.removeEventListener('touchmove', onTouchMove);
                    chipEl.removeEventListener('touchend', onTouchEnd);
                    chipEl.removeEventListener('touchcancel', onTouchCancel);
                });
            }

            function setupChipBubble(chipEl, word) {
                const lower = word.toLowerCase();
                const lemma = lemmatize(lower);
                const matchedKey = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
                const meaning = matchedKey ? vocabMap[matchedKey] : '';

                let bubbleEl = null;

                const showBubble = () => {
                    if (chipEl.classList.contains('used')) return;
                    if (bubbleEl) return;
                    bubbleEl = document.createElement('div');
                    bubbleEl.className = 'quiz-word-bubble';
                    bubbleEl.textContent = meaning || '(无释义)';
                    const rect = chipEl.getBoundingClientRect();
                    bubbleEl.style.position = 'fixed';
                    bubbleEl.style.left = rect.left + 'px';
                    bubbleEl.style.top = (rect.top - 36) + 'px';
                    bubbleEl.style.zIndex = '1001';
                    document.body.appendChild(bubbleEl);
                };

                const hideBubble = () => {
                    if (bubbleEl) {
                        bubbleEl.remove();
                        bubbleEl = null;
                    }
                };

                const onMouseEnter = () => { showBubble(); };
                const onMouseLeave = () => { hideBubble(); };
                const onClick = (e) => {
                    e.stopPropagation();
                    if (bubbleEl) {
                        hideBubble();
                    } else {
                        showBubble();
                    }
                };

                chipEl.addEventListener('mouseenter', onMouseEnter);
                chipEl.addEventListener('mouseleave', onMouseLeave);
                chipEl.addEventListener('click', onClick);
                _cleanupFns.push(() => {
                    chipEl.removeEventListener('mouseenter', onMouseEnter);
                    chipEl.removeEventListener('mouseleave', onMouseLeave);
                    chipEl.removeEventListener('click', onClick);
                    hideBubble();
                });
            }

            function buildWordBank() {
                const bank = document.createElement('div');
                bank.className = 'quiz-word-bank';
                bank.id = 'quizWordBank';

                const label = document.createElement('div');
                label.className = 'quiz-word-bank-label';
                label.textContent = '词库（拖拽单词到文章空格中）';
                bank.appendChild(label);

                const chipsWrap = document.createElement('div');
                chipsWrap.className = 'quiz-word-chips';

                const shuffled = shuffleArray(blankEntries.map(e => ({ word: e.word, blankId: e.id })));

                shuffled.forEach((item, index) => {
                    const chip = document.createElement('span');
                    chip.className = 'quiz-word-chip';
                    chip.textContent = item.word;
                    chip.draggable = true;
                    chip.dataset.word = item.word;
                    chip.dataset.blankId = item.blankId;
                    chip.style.animationDelay = (index * 0.05) + 's';
                    setupChipDrag(chip, item.word, item.blankId);
                    setupChipBubble(chip, item.word);
                    chipsWrap.appendChild(chip);
                });

                bank.appendChild(chipsWrap);
                return bank;
            }

            function buildTranslationToggle() {
                const wrap = document.createElement('div');
                wrap.className = 'quiz-translation-area';

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'quiz-translation-toggle';
                toggleBtn.innerHTML = TRANSLATE_SVG + ' 查看译文';
                const onToggleClick = (e) => {
                    e.stopPropagation();
                    const transEl = document.getElementById('quizTranslation');
                    if (!transEl) return;
                    if (transEl.classList.contains('show')) {
                        transEl.classList.remove('show');
                        toggleBtn.innerHTML = TRANSLATE_SVG + ' 查看译文';
                    } else {
                        if (cachedTranslation) {
                            transEl.textContent = cachedTranslation;
                            transEl.classList.add('show');
                            const articleWrap = document.querySelector('.quiz-article-wrap');
                            if (articleWrap) {
                                articleWrap.scrollTo({ top: articleWrap.scrollHeight, behavior: 'smooth' });
                            }
                            toggleBtn.innerHTML = TRANSLATE_SVG + ' 隐藏译文';
                        } else if (!translationLoading) {
                            translationLoading = true;
                            toggleBtn.innerHTML = TRANSLATE_SVG + ' 加载中...';
                            toggleBtn.disabled = true;
                            if (window.APIRequest && typeof window.APIRequest.requestFullTranslation === 'function') {
                                window.APIRequest.requestFullTranslation(articleText).then(result => {
                                    cachedTranslation = result;
                                    if (window.CacheManager && window.CacheManager.setFullTranslation) {
                                        window.CacheManager.setFullTranslation(result);
                                    }
                                    if (window.HistoryManager && window.HistoryManager.updateHistoryItem) {
                                        window.HistoryManager.updateHistoryItem(articleId, { fullTranslation: result });
                                    }
                                    transEl.textContent = result;
                                    transEl.classList.add('show');
                                    toggleBtn.innerHTML = TRANSLATE_SVG + ' 隐藏译文';
                                    toggleBtn.disabled = false;
                                    translationLoading = false;
                                }).catch(() => {
                                    cachedTranslation = '译文加载失败，请稍后重试';
                                    transEl.textContent = cachedTranslation;
                                    transEl.classList.add('show');
                                    toggleBtn.innerHTML = TRANSLATE_SVG + ' 隐藏译文';
                                    toggleBtn.disabled = false;
                                    translationLoading = false;
                                });
                            } else {
                                cachedTranslation = '译文功能暂不可用';
                                transEl.textContent = cachedTranslation;
                                transEl.classList.add('show');
                                toggleBtn.innerHTML = TRANSLATE_SVG + ' 隐藏译文';
                                toggleBtn.disabled = false;
                                translationLoading = false;
                            }
                        }
                    }
                };
                toggleBtn.addEventListener('click', onToggleClick);
                _cleanupFns.push(() => toggleBtn.removeEventListener('click', onToggleClick));
                wrap.appendChild(toggleBtn);

                const transContent = document.createElement('div');
                transContent.className = 'quiz-translation';
                transContent.id = 'quizTranslation';
                wrap.appendChild(transContent);

                return wrap;
            }

            const quizContainer = document.createElement('div');
            quizContainer.className = 'quiz-container';
            quizContainer.style.animation = 'quizContainerIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)';

            const quizHeader = document.createElement('div');
            quizHeader.className = 'quiz-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = BACK_SVG;
            const onBackClick = (e) => {
                e.stopPropagation();
                exitToMemoryMode();
            };
            backBtn.addEventListener('click', onBackClick);
            _cleanupFns.push(() => backBtn.removeEventListener('click', onBackClick));
            quizHeader.appendChild(backBtn);

            const quizTitle = document.createElement('h3');
            quizTitle.textContent = '生词填空 · ' + quizTotalBlanks + ' 个空格';
            quizHeader.appendChild(quizTitle);

            const quizScoreBadge = document.createElement('span');
            quizScoreBadge.className = 'quiz-score-badge';
            quizScoreBadge.id = 'quizScoreBadge';
            quizScoreBadge.innerHTML = STAR_SVG + ' <span id="quizScoreNum">0</span>';
            quizHeader.appendChild(quizScoreBadge);

            quizContainer.appendChild(quizHeader);

            const quizProgressWrap = document.createElement('div');
            quizProgressWrap.className = 'quiz-progress-wrap';
            quizProgressWrap.innerHTML = ''
                + '<div class="quiz-progress-track">'
                +   '<div class="quiz-progress-fill" id="quizProgressFill" style="width:0%"></div>'
                + '</div>'
                + '<span class="quiz-progress-text" id="quizProgressText">0 / ' + quizTotalBlanks + ' 个空格</span>';
            quizContainer.appendChild(quizProgressWrap);

            const quizStreakEl = document.createElement('div');
            quizStreakEl.className = 'quiz-streak';
            quizStreakEl.id = 'quizStreak';
            quizContainer.appendChild(quizStreakEl);

            const quizArticleWrap = document.createElement('div');
            quizArticleWrap.className = 'quiz-article-wrap';

            const quizArticle = document.createElement('div');
            quizArticle.className = 'quiz-article';
            quizArticle.innerHTML = buildArticleHTML();
            quizArticleWrap.appendChild(quizArticle);

            quizArticle.querySelectorAll('.quiz-blank').forEach(blankEl => {
                setupBlankEvents(blankEl);
            });

            quizContainer.appendChild(quizArticleWrap);

            const translationArea = buildTranslationToggle();
            quizArticleWrap.appendChild(translationArea);

            const wordBank = buildWordBank();
            quizContainer.appendChild(wordBank);

            container.appendChild(quizContainer);

            const keydownHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    exitToMemoryMode();
                }
            };
            document.addEventListener('keydown', keydownHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', keydownHandler));

            if (window.StatsTracker) {
                window.StatsTracker.recordArticleRead(articleId);
                window.StatsTracker.recordModuleActivity('vocabQuiz', 1);
            }

            updateScore();
            updateStreak();
            updateProgress();
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showVocabQuizInterface,
            init: init
        };
    });
})();