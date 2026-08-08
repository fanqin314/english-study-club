(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('ClozeModeUI', ['GlobalManager'], function(GlobalManager) {

        function showClozeModeInterface(container, articleId, selectedNotebookIds) {
            const historyItem = window.HistoryManager.getHistory().find(h => h.id === articleId);
            if (!historyItem) {
                _showToast('文章数据未找到');
                return;
            }

            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};

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

            const articleText = historyItem.originalText;
            const tokens = tokenize(articleText);
            const clozeItems = [];
            const seenLemmas = new Set();

            tokens.forEach(token => {
                if (token.type === 'word') {
                    const lower = token.value.toLowerCase();
                    const lemma = lemmatize(lower);
                    const matchedKey = vocabMap[lower] ? lower : (vocabMap[lemma] ? lemma : null);
                    if (matchedKey && !seenLemmas.has(matchedKey)) {
                        seenLemmas.add(matchedKey);
                        clozeItems.push({
                            word: token.value,
                            lemma: matchedKey,
                            meaning: vocabMap[matchedKey],
                            index: token.index
                        });
                    }
                }
            });

            if (clozeItems.length === 0) {
                _showToast('该文章中没有找到生词本中的单词');
                return;
            }

            const clozeAppHeader = document.getElementById('app-header');
            const clozeCardHeader = document.querySelector('.card-header');
            const clozeCardBody = document.querySelector('.card-body');
            if (clozeAppHeader) clozeAppHeader.style.display = 'none';
            if (clozeCardHeader) clozeCardHeader.style.display = 'none';
            if (clozeCardBody) clozeCardBody.style.display = 'none';
            // 隐藏其他模式可能残留的进度条
            const existingProgress = document.querySelector('.fill-progress-wrap');
            if (existingProgress) existingProgress.style.display = 'none';

            container.innerHTML = '';

            const _cleanupFns = [];

            /* ---- 状态变量 ---- */
            let clozeScore = 0;
            let clozeStreakCount = 0;
            let clozeMaxStreak = 0;
            let clozeWrongCount = 0;
            let clozeSkippedCount = 0;
            let clozeChecked = false;
            let clozeInputItems = [];
            let _transBubbleCloseHandler = null;

            /* ---- 头部 (.cloze-header) ---- */
            const clozeHeader = document.createElement('div');
            clozeHeader.className = 'cloze-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            const onBackClick = (e) => {
                e.stopPropagation();
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                // 关闭翻译气泡
                const bubble = document.querySelector('.cloze-trans-bubble');
                if (bubble) bubble.remove();
                if (_transBubbleCloseHandler) {
                    document.removeEventListener('click', _transBubbleCloseHandler);
                    _transBubbleCloseHandler = null;
                }
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
            };
            backBtn.addEventListener('click', onBackClick);
            _cleanupFns.push(() => backBtn.removeEventListener('click', onBackClick));
            clozeHeader.appendChild(backBtn);

            const clozeTitle = document.createElement('h3');
            clozeTitle.textContent = `语境填空 · ${clozeItems.length} 个生词`;
            clozeHeader.appendChild(clozeTitle);

            const clozeScoreBadge = document.createElement('span');
            clozeScoreBadge.className = 'cloze-score-badge';
            clozeScoreBadge.id = 'clozeScoreBadge';
            clozeScoreBadge.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> <span id="clozeScoreNum">0</span>`;
            clozeHeader.appendChild(clozeScoreBadge);

            /* ---- ESC 键退出 ---- */
            const clozeEscHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    backBtn.click();
                }
            };
            document.addEventListener('keydown', clozeEscHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', clozeEscHandler));

            /* ---- 主卡片 ---- */
            const clozeCard = document.createElement('div');
            clozeCard.className = 'cloze-card';
            clozeCard.id = 'clozePracticeCard';
            container.appendChild(clozeCard);

            /* ---- 句子定位 ---- */
            const sentences = historyItem.sentences || [];
            function findSentenceForWord(wordIndex) {
                let charCount = 0;
                for (const sent of sentences) {
                    if (wordIndex >= charCount && wordIndex < charCount + sent.length) {
                        return sent;
                    }
                    charCount += sent.length; // 注意：sentences 已包含前导空格/换行，无需 +1
                }
                return null;
            }
            function getSentenceIndexForWord(wordIndex) {
                let charCount = 0;
                for (let si = 0; si < sentences.length; si++) {
                    const sent = sentences[si];
                    if (wordIndex >= charCount && wordIndex < charCount + sent.length) {
                        return si;
                    }
                    charCount += sent.length; // 注意：sentences 已包含前导空格/换行，无需 +1
                }
                return -1;
            }

            /* ---- 段落分组：把 clozeItems 按所在段落聚合 ---- */
            const paragraphs = historyItem.originalText.split(/\n\n+/).filter(p => p.trim().length > 0);
            let paraStart = 0;
            const paragraphBounds = paragraphs.map(p => {
                const start = paraStart;
                const end = paraStart + p.length;
                paraStart = end + 2;
                return { start, end, text: p };
            });

            const paragraphGroups = [];
            const paraGroupMap = new Map();
            clozeItems.forEach((item) => {
                const pi = paragraphBounds.findIndex(b => item.index >= b.start && item.index < b.end);
                if (pi < 0) return;
                if (!paraGroupMap.has(pi)) {
                    paraGroupMap.set(pi, { paragraphIndex: pi, text: paragraphs[pi], items: [], bounds: paragraphBounds[pi] });
                    paragraphGroups.push(paraGroupMap.get(pi));
                }
                paraGroupMap.get(pi).items.push(item);
            });
            paragraphGroups.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
            let currentParagraphIdx = 0;

            /* ---- 跨句子的答题状态：'correct' | 'revealed' | 'incorrect' ---- */
            const wordStates = new Map(); // key: word (小写) -> 'correct' | 'revealed' | 'incorrect'

            /* ---- 获取单词填写的值（串联所有字母格输入） ---- */
            function getWordValue(grid) {
                if (!grid) return '';
                const inputs = grid.querySelectorAll('.letter-input');
                let val = '';
                inputs.forEach(inp => { val += inp.value.toLowerCase(); });
                return val;
            }

            /* ---- 朗读 + 字母格绿色阴影动画 ---- */
            function speakSentence(text, letterGrid) {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    startWaveAnimation(letterGrid);
                    utterance.onend = () => stopWaveAnimation(letterGrid);
                    utterance.onerror = () => stopWaveAnimation(letterGrid);
                    window.speechSynthesis.speak(utterance);
                }
            }

            function startWaveAnimation(letterGrid) {
                stopWaveAnimation(letterGrid);
                if (letterGrid) {
                    letterGrid.classList.add('speaking');
                }
            }

            function stopWaveAnimation(letterGrid) {
                document.querySelectorAll('.cloze-letter-grid.speaking').forEach(el => {
                    el.classList.remove('speaking');
                });
            }

            /* ---- 计分 / 连击 / 进度 ---- */
            function getComboBonus(streak) {
                if (streak >= 20) return 10;
                if (streak >= 10) return 5;
                if (streak >= 5) return 3;
                if (streak >= 3) return 2;
                return 0;
            }

            function updateScore() {
                const scoreEl = document.getElementById('clozeScoreNum');
                if (scoreEl) scoreEl.textContent = clozeScore;
                const badge = document.getElementById('clozeScoreBadge');
                if (badge) {
                    badge.classList.remove('score-pop');
                    void badge.offsetWidth;
                    badge.classList.add('score-pop');
                }
            }

            function updateStreak() {
                const streakEl = document.getElementById('clozeStreak');
                if (!streakEl) return;
                if (clozeStreakCount >= 10) {
                    streakEl.innerHTML = `<span class="streak-fire-super">🌟🔥🌟 超级连击 ${clozeStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                } else if (clozeStreakCount >= 5) {
                    streakEl.innerHTML = `<span class="streak-fire">🔥 连击 ${clozeStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                } else if (clozeStreakCount >= 3) {
                    streakEl.innerHTML = `<span class="streak-fire">⚡ ${clozeStreakCount} 连对</span>`;
                    streakEl.classList.add('active');
                } else {
                    streakEl.innerHTML = '';
                    streakEl.classList.remove('active');
                }
            }

            function updateProgress() {
                let completed = 0;
                clozeItems.forEach(item => {
                    const st = wordStates.get(item.word.toLowerCase());
                    if (st === 'correct' || st === 'revealed') completed++;
                });
                const fillEl = document.getElementById('clozeProgressFill');
                const idxEl = document.getElementById('clozePracticeIndex');
                const pct = clozeItems.length > 0 ? (completed / clozeItems.length * 100) : 0;
                if (fillEl) fillEl.style.width = pct + '%';
                if (idxEl) idxEl.textContent = '已攻克 ' + completed + ' / ' + clozeItems.length;
                if (completed === clozeItems.length && clozeItems.length > 0) {
                    setTimeout(() => showSummary(), 500);
                }
            }

            /* ---- 检查 / 重试 / 显示答案 ---- */
            function doCheck() {
                if (clozeChecked) {
                    doReset();
                    return;
                }
                let correct = 0;
                let wrong = 0;
                let newlySolved = 0;
                let gainedScore = 0;

                clozeInputItems.forEach(it => {
                    const { item, wrapper, letterGrid, boxes } = it;
                    if (wrapper.classList.contains('correct') || wrapper.classList.contains('revealed')) return;
                    const answer = wrapper.dataset.answer;
                    const lemma = wrapper.dataset.lemma;
                    const userAnswer = getWordValue(letterGrid);
                    const correctAnswer = answer.toLowerCase();

                    wrapper.classList.remove('correct', 'incorrect');

                    // 更新格子状态
                    const gridBoxes = letterGrid.querySelectorAll('.letter-box:not(.space-box)');
                    gridBoxes.forEach((box, idx) => {
                        const inp = box.querySelector('.letter-input');
                        box.classList.remove('correct', 'wrong', 'revealed');
                        if (idx < correctAnswer.length) {
                            if (idx < userAnswer.length && userAnswer[idx] === correctAnswer[idx]) {
                                box.classList.add('correct');
                                if (inp) { inp.value = correctAnswer[idx]; inp.disabled = true; }
                            } else if (idx < userAnswer.length) {
                                box.classList.add('wrong');
                            }
                        }
                    });

                    if (userAnswer && (userAnswer === correctAnswer || userAnswer === lemma.toLowerCase() || lemmatize(userAnswer.toLowerCase()) === lemma)) {
                        wrapper.classList.add('correct');
                        wordStates.set(item.word.toLowerCase(), 'correct');
                        gridBoxes.forEach((box, idx) => {
                            const inp = box.querySelector('.letter-input');
                            box.classList.remove('wrong');
                            box.classList.add('correct');
                            if (inp) { inp.value = correctAnswer[idx]; inp.disabled = true; }
                        });
                        correct++;
                        newlySolved++;
                        clozeStreakCount++;
                        if (clozeStreakCount > clozeMaxStreak) clozeMaxStreak = clozeStreakCount;
                        const bonus = getComboBonus(clozeStreakCount);
                        gainedScore += 10 + bonus;
                    } else {
                        wrapper.classList.add('incorrect');
                        wordStates.set(item.word.toLowerCase(), 'incorrect');
                        clozeWrongCount++;
                        wrong++;
                        clozeStreakCount = 0;
                        // 显示正确答案
                        gridBoxes.forEach((box, idx) => {
                            const inp = box.querySelector('.letter-input');
                            box.classList.add('revealed');
                            box.classList.remove('wrong');
                            if (inp) { inp.value = correctAnswer[idx]; inp.disabled = true; }
                        });
                        const correctSpan = document.createElement('span');
                        correctSpan.className = 'cloze-correct-answer';
                        correctSpan.textContent = answer;
                        wrapper.appendChild(correctSpan);
                    }
                });

                clozeScore += gainedScore;
                updateScore();
                updateStreak();
                updateProgress();

                const resultEl = document.getElementById('clozePracticeResult');
                if (resultEl) {
                    if (newlySolved > 0 && wrong === 0) {
                        let html = `<span class="cloze-correct">✓ 正确 ${correct}`;
                        if (gainedScore > 0) html += ` · +${gainedScore}分`;
                        html += '</span>';
                        resultEl.innerHTML = html;
                        resultEl.className = 'cloze-result cloze-result-correct';
                        clozeCard.classList.add('cloze-card-correct');
                        setTimeout(() => clozeCard.classList.remove('cloze-card-correct'), 600);
                    } else if (newlySolved === 0 && wrong === 0) {
                        resultEl.innerHTML = '<span class="cloze-skip">没有需要检查的填空</span>';
                        resultEl.className = 'cloze-result cloze-result-skip';
                    } else {
                        resultEl.innerHTML = `<span class="cloze-wrong">✗ 正确 ${correct} · 错误 ${wrong}</span>`;
                        resultEl.className = 'cloze-result cloze-result-wrong';
                        clozeCard.classList.add('cloze-card-wrong');
                        setTimeout(() => clozeCard.classList.remove('cloze-card-wrong'), 600);
                    }
                }

                if (wrong > 0) {
                    clozeChecked = true;
                    const cbEl = document.getElementById('clozeCheckBtn');
                    if (cbEl) {
                        cbEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
                        cbEl.title = '重新尝试';
                    }
                }
            }

            function doReset() {
                clozeInputItems.forEach(it => {
                    const { item, wrapper, letterGrid } = it;
                    if (wrapper.classList.contains('correct') || wrapper.classList.contains('revealed')) return;
                    wrapper.classList.remove('correct', 'incorrect');
                    wordStates.delete(item.word.toLowerCase());
                    const ca = wrapper.querySelector('.cloze-correct-answer');
                    if (ca) ca.remove();
                    // 重置格子
                    const gridBoxes = letterGrid.querySelectorAll('.letter-box:not(.space-box)');
                    gridBoxes.forEach(box => {
                        const inp = box.querySelector('.letter-input');
                        box.classList.remove('correct', 'wrong', 'revealed', 'filled');
                        if (inp) { inp.value = ''; inp.disabled = false; }
                    });
                });
                const resultEl = document.getElementById('clozePracticeResult');
                if (resultEl) resultEl.innerHTML = '';
                clozeChecked = false;
                const cbEl = document.getElementById('clozeCheckBtn');
                if (cbEl) {
                    cbEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
                    cbEl.title = '检查答案';
                }
                const firstUnsolved = clozeInputItems.find(it => !it.wrapper.classList.contains('correct') && !it.wrapper.classList.contains('revealed'));
                if (firstUnsolved) {
                    firstUnsolved.letterGrid.classList.add('active-slot');
                    const firstInput = firstUnsolved.letterGrid.querySelector('.letter-input');
                    if (firstInput) firstInput.focus();
                }
            }

            function doReveal() {
                let revealed = 0;
                clozeInputItems.forEach(it => {
                    const { item, wrapper, letterGrid } = it;
                    if (wrapper.classList.contains('correct') || wrapper.classList.contains('revealed')) return;
                    const answer = item.word.toLowerCase();
                    wrapper.classList.remove('incorrect');
                    wrapper.classList.add('revealed');
                    wordStates.set(item.word.toLowerCase(), 'revealed');
                    const ca = wrapper.querySelector('.cloze-correct-answer');
                    if (ca) ca.remove();
                    // 显示格子
                    const gridBoxes = letterGrid.querySelectorAll('.letter-box:not(.space-box)');
                    gridBoxes.forEach((box, idx) => {
                        const inp = box.querySelector('.letter-input');
                        box.classList.add('revealed');
                        box.classList.remove('wrong');
                        if (inp) { inp.value = answer[idx]; inp.disabled = true; }
                    });
                    revealed++;
                    clozeSkippedCount++;
                    clozeScore = Math.max(0, clozeScore - 5);
                });
                clozeStreakCount = 0;
                updateScore();
                updateStreak();
                updateProgress();
                const resultEl = document.getElementById('clozePracticeResult');
                if (resultEl) {
                    if (revealed > 0) {
                        resultEl.innerHTML = `<span class="cloze-skip">⏭ 已显示 ${revealed} 个答案 · -${revealed * 5}分</span>`;
                        resultEl.className = 'cloze-result cloze-result-skip';
                    } else {
                        resultEl.innerHTML = '<span class="cloze-skip">没有可显示的答案</span>';
                        resultEl.className = 'cloze-result cloze-result-skip';
                    }
                }
            }

            /* ---- 总结页面 ---- */
            function showSummary() {
                if (clozeCard.querySelector('.cloze-summary')) return;
                // 关闭翻译气泡
                const bubble = document.querySelector('.cloze-trans-bubble');
                if (bubble) bubble.remove();
                if (_transBubbleCloseHandler) {
                    document.removeEventListener('click', _transBubbleCloseHandler);
                    _transBubbleCloseHandler = null;
                }
                const bottomEl = clozeCard.querySelector('.cloze-bottom-nav');
                if (bottomEl) bottomEl.style.display = 'none';
                stopWaveAnimation();

                const total = clozeItems.length;
                let correctCount = 0;
                let skippedCount = 0;
                clozeItems.forEach(it => {
                    const st = wordStates.get(it.word.toLowerCase());
                    if (st === 'correct') correctCount++;
                    else if (st === 'revealed') skippedCount++;
                });
                const wrongAttempts = clozeWrongCount;
                const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
                const isPerfect = (wrongAttempts === 0 && skippedCount === 0);

                if (isPerfect) clozeScore += 20;

                if (window.StatsTracker) {
                    window.StatsTracker.recordArticleRead(articleId);
                    window.StatsTracker.recordWordsLearned(correctCount);
                    window.StatsTracker.recordModuleActivity('cloze', correctCount);
                }

                let titleText = '太棒了，完成啦！';
                let titleClass = '';
                if (isPerfect) { titleText = '完美通关！'; titleClass = 'perfect'; }
                else if (rate >= 90) titleText = '非常出色！';
                else if (rate >= 70) titleText = '做得不错！';
                else if (rate >= 50) titleText = '继续加油！';

                clozeCard.innerHTML = `
                    <div class="cloze-summary">
                        <div class="cloze-summary-icon">
                            <div class="trophy-star">
                                <div class="star-eight"></div>
                            </div>
                            <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="${isPerfect ? '#f59e0b' : '#e94822'}">
                                <path d="M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z"/>
                            </svg>
                        </div>
                        <div class="cloze-summary-title ${titleClass}">${titleText}</div>
                        <div class="cloze-summary-stats">
                            <div class="cloze-summary-stat" style="animation-delay:0.05s">
                                <span class="cloze-summary-val correct">${correctCount}</span>
                                <span class="cloze-summary-lbl">正确</span>
                            </div>
                            <div class="cloze-summary-stat" style="animation-delay:0.12s">
                                <span class="cloze-summary-val wrong">${wrongAttempts}</span>
                                <span class="cloze-summary-lbl">错误尝试</span>
                            </div>
                            <div class="cloze-summary-stat" style="animation-delay:0.19s">
                                <span class="cloze-summary-val rate">${rate}%</span>
                                <span class="cloze-summary-lbl">正确率</span>
                            </div>
                            <div class="cloze-summary-stat" style="animation-delay:0.26s">
                                <span class="cloze-summary-val streak">${clozeMaxStreak}</span>
                                <span class="cloze-summary-lbl">最大连击</span>
                            </div>
                            ${skippedCount > 0 ? `<div class="cloze-summary-stat" style="animation-delay:0.33s">
                                <span class="cloze-summary-val skip">${skippedCount}</span>
                                <span class="cloze-summary-lbl">显示答案</span>
                            </div>` : ''}
                            <div class="cloze-summary-stat" style="animation-delay:0.40s">
                                <span class="cloze-summary-val score">${clozeScore}</span>
                                <span class="cloze-summary-lbl">得分</span>
                            </div>
                        </div>
                        ${isPerfect ? '<div class="cloze-perfect-badge">完美通关！零错误零跳过，奖励 +20分</div>' : ''}
                        <button class="summary-retry-btn">再来一轮</button>
                    </div>
                `;

                const retryBtn = clozeCard.querySelector('.summary-retry-btn');
                if (retryBtn) {
                    const onRetryClick = (e) => {
                        e.stopPropagation();
                        // 关闭翻译气泡
                        const bubble = document.querySelector('.cloze-trans-bubble');
                        if (bubble) bubble.remove();
                        if (_transBubbleCloseHandler) {
                            document.removeEventListener('click', _transBubbleCloseHandler);
                            _transBubbleCloseHandler = null;
                        }
                        _cleanupFns.forEach(fn => fn());
                        _cleanupFns.length = 0;

                        backBtn.addEventListener('click', onBackClick);
                        _cleanupFns.push(() => backBtn.removeEventListener('click', onBackClick));
                        document.addEventListener('keydown', clozeEscHandler);
                        _cleanupFns.push(() => document.removeEventListener('keydown', clozeEscHandler));

                        clozeScore = 0;
                        clozeStreakCount = 0;
                        clozeMaxStreak = 0;
                        clozeWrongCount = 0;
                        clozeSkippedCount = 0;
                        clozeChecked = false;
                        wordStates.clear();
                        currentParagraphIdx = 0;

                        buildCardDOM();
                        updateScore();
                        updateStreak();
                        updateProgress();
                        setTimeout(() => {
                            if (clozeInputItems[0]) {
                                clozeInputItems[0].letterGrid.classList.add('active-slot');
                                const fi = clozeInputItems[0].letterGrid.querySelector('.letter-input');
                                if (fi) fi.focus();
                            }
                        }, 100);
                    };
                    retryBtn.addEventListener('click', onRetryClick);
                    _cleanupFns.push(() => retryBtn.removeEventListener('click', onRetryClick));
                }
            }

            /* ---- 句首翻译气泡 ---- */
            function showSentenceTranslation(btn, sentenceStart) {
                // 移除已有的气泡（toggle 关闭）
                const existing = document.querySelector('.cloze-trans-bubble');
                if (existing) {
                    existing.remove();
                    if (_transBubbleCloseHandler) {
                        document.removeEventListener('click', _transBubbleCloseHandler);
                        _transBubbleCloseHandler = null;
                    }
                    return;
                }

                // 获取翻译
                const absPos = paragraphGroups[currentParagraphIdx].bounds.start + sentenceStart;
                const sentIdx = getSentenceIndexForWord(absPos);
                const sd = historyItem.sentenceData;
                console.log('[翻译调试]', {
                    sentenceStart,
                    currentParagraphIdx,
                    boundsStart: paragraphGroups[currentParagraphIdx].bounds.start,
                    absPos,
                    sentIdx,
                    sentencesLen: sentences.length,
                    sentences: sentences.map(s => s.substring(0, 20) + '...'),
                    sdKeys: sd ? Object.keys(sd) : 'null',
                    sdHasSentIdx: sd && sd[sentIdx] ? 'YES' : 'NO',
                    sdTranslation: sd && sd[sentIdx] ? (sd[sentIdx].translation ? sd[sentIdx].translation.substring(0, 30) : 'EMPTY') : 'N/A'
                });
                let translation = '';
                if (sentIdx >= 0 && sd && sd[sentIdx] && sd[sentIdx].translation) {
                    translation = sd[sentIdx].translation;
                }

                if (!translation) {
                    _showToast('暂无翻译');
                    return;
                }

                // 创建气泡
                const bubble = document.createElement('div');
                bubble.className = 'cloze-trans-bubble';
                bubble.textContent = translation;
                document.body.appendChild(bubble);

                // 定位气泡
                requestAnimationFrame(() => {
                    const btnRect = btn.getBoundingClientRect();
                    const bubbleRect = bubble.getBoundingClientRect();
                    let top = btnRect.top - bubbleRect.height - 8;
                    let left = Math.max(8, Math.min(btnRect.left, window.innerWidth - bubbleRect.width - 8));
                    if (top < 0) {
                        top = btnRect.bottom + 8;
                        bubble.classList.add('below');
                    }
                    bubble.style.top = top + 'px';
                    bubble.style.left = left + 'px';
                    bubble.classList.add('visible');
                });

                // 点击外部关闭
                const closeHandler = (e) => {
                    if (!bubble.contains(e.target) && e.target !== btn) {
                        bubble.remove();
                        document.removeEventListener('click', closeHandler);
                        _transBubbleCloseHandler = null;
                    }
                };
                _transBubbleCloseHandler = closeHandler;
                setTimeout(() => document.addEventListener('click', closeHandler), 0);
            }

            /* ---- 卡片 DOM 构建（初始化与再来一轮共用） ---- */
            function buildCardDOM() {
                clozeCard.innerHTML = '';
                clozeCard.prepend(clozeHeader);
                clozeCard.classList.remove('cloze-card-correct', 'cloze-card-wrong');
                clozeInputItems = [];

                /* ---- 顶部信息栏（进度条 + 页码指示器） ---- */
                const topBar = document.createElement('div');
                topBar.className = 'cloze-top-bar';
                topBar.innerHTML = `
                    <div class="cloze-progress-track">
                        <div class="cloze-progress-fill" id="clozeProgressFill" style="width:0%"></div>
                    </div>
                    <span class="cloze-sentence-indicator" id="clozeSentenceIndicator"></span>
                    <span class="cloze-progress-text" id="clozePracticeIndex">已攻克 0 / ${clozeItems.length}</span>
                `;
                clozeCard.appendChild(topBar);

                /* ---- 主内容区（flex row） ---- */
                const clozeMain = document.createElement('div');
                clozeMain.className = 'cloze-main';

                /* 句子内容区 */
                const clozeContent = document.createElement('div');
                clozeContent.className = 'cloze-content';
                clozeContent.id = 'clozeContent';
                clozeMain.appendChild(clozeContent);

                /* 右侧垂直工具栏 */
                const clozeToolbar = document.createElement('div');
                clozeToolbar.className = 'cloze-toolbar';

                /* 检查按钮 */
                const checkBtnEl = document.createElement('button');
                checkBtnEl.className = 'cloze-toolbar-btn cloze-check-btn';
                checkBtnEl.id = 'clozeCheckBtn';
                checkBtnEl.title = '检查答案';
                checkBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
                const onCheckClick = (e) => { e.stopPropagation(); doCheck(); };
                checkBtnEl.addEventListener('click', onCheckClick);
                _cleanupFns.push(() => checkBtnEl.removeEventListener('click', onCheckClick));
                clozeToolbar.appendChild(checkBtnEl);

                /* 提示按钮（灯泡图标，显示首字母） */
                const hintBtnEl = document.createElement('button');
                hintBtnEl.className = 'cloze-toolbar-btn cloze-hint-btn';
                hintBtnEl.id = 'clozeHintBtn';
                hintBtnEl.title = '提示（显示首字母）';
                hintBtnEl.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6"/><path d="M12 17v4"/><path d="M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.5 1 2.5h6c0-1 .5-2 1-2.5A6 6 0 0 0 12 3z"/></svg>';
                const onHintClick = (e) => {
                    e.stopPropagation();
                    const unsolved = clozeInputItems.find(it =>
                        !it.wrapper.classList.contains('correct') &&
                        !it.wrapper.classList.contains('revealed')
                    );
                    if (unsolved) {
                        const firstInput = unsolved.letterGrid.querySelector('.letter-input');
                        if (firstInput) {
                            const answer = unsolved.item.word.toLowerCase();
                            firstInput.value = answer.charAt(0);
                            firstInput.closest('.letter-box').classList.add('filled');
                        }
                        unsolved.letterGrid.classList.add('active-slot');
                        if (firstInput) firstInput.focus();
                        clozeScore = Math.max(0, clozeScore - 3);
                        updateScore();
                    } else {
                        _showToast && _showToast('没有可提示的填空');
                    }
                };
                hintBtnEl.addEventListener('click', onHintClick);
                _cleanupFns.push(() => hintBtnEl.removeEventListener('click', onHintClick));
                clozeToolbar.appendChild(hintBtnEl);

                /* 显示答案按钮 */
                const revealBtnEl = document.createElement('button');
                revealBtnEl.className = 'cloze-toolbar-btn cloze-reveal-btn';
                revealBtnEl.id = 'clozeRevealBtn';
                revealBtnEl.title = '显示答案';
                revealBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
                const onRevealClick = (e) => { e.stopPropagation(); doReveal(); };
                revealBtnEl.addEventListener('click', onRevealClick);
                _cleanupFns.push(() => revealBtnEl.removeEventListener('click', onRevealClick));
                clozeToolbar.appendChild(revealBtnEl);

                /* 朗读按钮 */
                const speakSentBtnEl = document.createElement('button');
                speakSentBtnEl.className = 'cloze-toolbar-btn cloze-speak-sent-btn';
                speakSentBtnEl.id = 'clozeSpeakSentBtn';
                speakSentBtnEl.title = '朗读当前段落';
                speakSentBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
                const onSpeakSentClick = (e) => {
                    e.stopPropagation();
                    let paraText = '';
                    if (paragraphGroups.length > 0) {
                        paraText = paragraphGroups[currentParagraphIdx].text;
                    }
                    if (paraText) speakSentence(paraText);
                };
                speakSentBtnEl.addEventListener('click', onSpeakSentClick);
                _cleanupFns.push(() => speakSentBtnEl.removeEventListener('click', onSpeakSentClick));
                clozeToolbar.appendChild(speakSentBtnEl);

                clozeMain.appendChild(clozeToolbar);
                clozeCard.appendChild(clozeMain);

                /* ---- 底部翻页导航 ---- */
                const clozeFooter = document.createElement('div');
                clozeFooter.className = 'cloze-bottom-nav';

                const prevBtn = document.createElement('button');
                prevBtn.className = 'cloze-toolbar-btn cloze-nav-btn cloze-prev-btn';
                prevBtn.id = 'clozePrevBtn';
                prevBtn.title = '上一段';
                prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
                const onPrevClick = (e) => {
                    e.stopPropagation();
                    if (currentParagraphIdx > 0) {
                        currentParagraphIdx--;
                        onSwitchParagraph();
                    }
                };
                prevBtn.addEventListener('click', onPrevClick);
                _cleanupFns.push(() => prevBtn.removeEventListener('click', onPrevClick));
                clozeFooter.appendChild(prevBtn);

                const nextBtn = document.createElement('button');
                nextBtn.className = 'cloze-toolbar-btn cloze-nav-btn cloze-next-btn';
                nextBtn.id = 'clozeNextBtn';
                nextBtn.title = '下一段';
                nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
                const onNextClick = (e) => {
                    e.stopPropagation();
                    if (currentParagraphIdx < paragraphGroups.length - 1) {
                        currentParagraphIdx++;
                        onSwitchParagraph();
                    }
                };
                nextBtn.addEventListener('click', onNextClick);
                _cleanupFns.push(() => nextBtn.removeEventListener('click', onNextClick));
                clozeFooter.appendChild(nextBtn);

                clozeCard.appendChild(clozeFooter);

                /* ---- 反馈区域 ---- */
                const clozeFeedback = document.createElement('div');
                clozeFeedback.className = 'cloze-feedback';

                const clozeStreak = document.createElement('div');
                clozeStreak.className = 'cloze-streak';
                clozeStreak.id = 'clozeStreak';
                clozeFeedback.appendChild(clozeStreak);

                const clozeResult = document.createElement('div');
                clozeResult.className = 'cloze-result';
                clozeResult.id = 'clozePracticeResult';
                clozeFeedback.appendChild(clozeResult);

                clozeCard.appendChild(clozeFeedback);

                /* 渲染当前段落 */
                renderCurrentParagraph();
            }

            /* ---- 切换段落时的清理 ---- */
            function onSwitchParagraph() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                stopWaveAnimation();
                clozeChecked = false;
                const cbEl = document.getElementById('clozeCheckBtn');
                if (cbEl) {
                    cbEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
                    cbEl.title = '检查答案';
                }
                const resultEl = document.getElementById('clozePracticeResult');
                if (resultEl) {
                    resultEl.innerHTML = '';
                    resultEl.className = 'cloze-result';
                }
                const streakEl = document.getElementById('clozeStreak');
                if (streakEl) {
                    streakEl.innerHTML = '';
                    streakEl.classList.remove('active');
                }
                // 关闭翻译气泡
                const bubble = document.querySelector('.cloze-trans-bubble');
                if (bubble) {
                    bubble.remove();
                    if (_transBubbleCloseHandler) {
                        document.removeEventListener('click', _transBubbleCloseHandler);
                        _transBubbleCloseHandler = null;
                    }
                }
                renderCurrentParagraph();
            }

            /* ---- 渲染当前段落（显示该段落中所有生词填空） ---- */
            function renderCurrentParagraph() {
                const clozeContent = document.getElementById('clozeContent');
                if (!clozeContent) return;

                clozeContent.innerHTML = '';
                // 清空当前 clozeInputItems（事件已通过 _cleanupFns 卸载）
                clozeInputItems = [];

                const indicator = document.getElementById('clozeSentenceIndicator');
                const prevBtn = document.getElementById('clozePrevBtn');
                const nextBtn = document.getElementById('clozeNextBtn');

                if (paragraphGroups.length === 0) {
                    if (indicator) indicator.textContent = '没有可练习的段落';
                    if (prevBtn) prevBtn.disabled = true;
                    if (nextBtn) nextBtn.disabled = true;
                    return;
                }

                // 边界保护
                if (currentParagraphIdx < 0) currentParagraphIdx = 0;
                if (currentParagraphIdx >= paragraphGroups.length) currentParagraphIdx = paragraphGroups.length - 1;

                const group = paragraphGroups[currentParagraphIdx];
                if (indicator) {
                    indicator.textContent = `段落 ${currentParagraphIdx + 1} / ${paragraphGroups.length}`;
                }
                if (prevBtn) prevBtn.disabled = currentParagraphIdx === 0;
                if (nextBtn) nextBtn.disabled = currentParagraphIdx >= paragraphGroups.length - 1;

                // 段落原文
                const paraText = group.text || '';
                // 段落内的生词（按字符位置升序）
                const items = group.items.slice().sort((a, b) => a.index - b.index);

                // 段落起始字符偏移
                const paraStart = group.bounds.start;

                // ---- 将段落按句分割 ---- //
                function splitSentences(text) {
                    const result = [];
                    const regex = /[^.!?]*[.!?]+/g;
                    let lastIdx = 0;
                    let m;
                    while ((m = regex.exec(text)) !== null) {
                        result.push({ text: m[0], start: m.index, end: m.index + m[0].length });
                        lastIdx = m.index + m[0].length;
                    }
                    const rest = text.slice(lastIdx).trim();
                    if (rest) result.push({ text: rest, start: lastIdx, end: text.length });
                    if (result.length === 0 && text.length > 0) result.push({ text, start: 0, end: text.length });
                    return result;
                }
                const sentences = splitSentences(paraText);

                // ---- 逐句渲染 ---- //
                sentences.forEach((sentence, sentIdx) => {
                    const sentStart = sentence.start;
                    const sentEnd = sentence.end;
                    const sentItems = items.filter(it => {
                        const ls = it.index - paraStart;
                        return ls >= sentStart && ls < sentEnd;
                    });

                    // 句首翻译按钮
                    const transBtn = document.createElement('button');
                    transBtn.className = 'cloze-sent-trans-btn';
                    transBtn.title = '查看翻译';
                    transBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6M7 3v2M5 5c0 4-1 6-3 8M5 9c2 2 4 3 5 4M13 13l4-9 4 9M14.5 10h5M17 16v5M15 21h4"/></svg>`;
                    const onTransBtnClick = (e) => {
                        e.stopPropagation();
                        showSentenceTranslation(transBtn, sentStart);
                    };
                    transBtn.addEventListener('click', onTransBtnClick);
                    _cleanupFns.push(() => transBtn.removeEventListener('click', onTransBtnClick));
                    clozeContent.appendChild(transBtn);

                    let cursor = paraStart + sentStart;
                    sentItems.forEach((item) => {
                        const localStart = item.index - paraStart;
                        const localEnd = localStart + item.word.length;

                        if (localStart > cursor - paraStart) {
                            const beforeText = paraText.substring(cursor - paraStart, localStart);
                            if (beforeText) {
                                const span = document.createElement('span');
                                span.className = 'cloze-text';
                                span.textContent = beforeText;
                                clozeContent.appendChild(span);
                            }
                        }

                        const inputWrapper = document.createElement('span');
                        inputWrapper.className = 'cloze-input-wrapper';
                        inputWrapper.dataset.answer = item.word;
                        inputWrapper.dataset.lemma = item.lemma;
                        inputWrapper.dataset.meaning = item.meaning;
                        inputWrapper.dataset.index = clozeItems.indexOf(item);

                        const prevState = wordStates.get(item.word.toLowerCase());
                        if (prevState === 'correct') inputWrapper.classList.add('correct');
                        else if (prevState === 'revealed') inputWrapper.classList.add('revealed');
                        else if (prevState === 'incorrect') inputWrapper.classList.add('incorrect');

                        const inputGroup = document.createElement('span');
                        inputGroup.className = 'cloze-input-group';

                        const wordUpper = item.word.toLowerCase();
                        const letterGrid = document.createElement('div');
                        letterGrid.className = 'cloze-letter-grid';
                        letterGrid.dataset.wordLength = wordUpper.length;

                        const boxes = [];
                        const isCompleted = (prevState === 'correct' || prevState === 'revealed');
                        for (let ci = 0; ci < wordUpper.length; ci++) {
                            const box = document.createElement('span');
                            box.className = 'letter-box';
                            box.dataset.index = ci;
                            if (wordUpper[ci] === ' ') {
                                box.classList.add('space-box');
                                box.textContent = ' ';
                                letterGrid.appendChild(box);
                                boxes.push(box);
                                continue;
                            }
                            // 每个字母格内含独立输入框，支持独立选择/输入/删除
                            const letterInput = document.createElement('input');
                            letterInput.type = 'text';
                            letterInput.maxLength = 1;
                            letterInput.className = 'letter-input';
                            letterInput.autocomplete = 'off';
                            letterInput.spellcheck = false;
                            letterInput.dataset.index = ci;
                            if (isCompleted) {
                                letterInput.value = wordUpper[ci];
                                letterInput.disabled = true;
                                if (prevState === 'correct') box.classList.add('correct');
                                else if (prevState === 'revealed') box.classList.add('revealed');
                            }

                            // ---- 键盘事件：Backspace, Arrow, Tab, Enter, 字符键 ---- //
                            const onBoxKeydown = (e) => {
                                // 字符键：直接在 keydown 中设置值并阻止默认行为，避免 input 事件重复触发
                                if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                                    e.preventDefault();
                                    if (inputWrapper.classList.contains('correct') || inputWrapper.classList.contains('incorrect') || inputWrapper.classList.contains('revealed')) return;
                                    const ch = e.key.toLowerCase();
                                    letterInput.value = ch;
                                    box.classList.add('filled');
                                    if (inputWrapper.classList.contains('correct') || inputWrapper.classList.contains('incorrect')) {
                                        inputWrapper.classList.remove('correct', 'incorrect');
                                    }
                                    wordStates.delete(item.word.toLowerCase());
                                    // 自动跳转到下一个格子
                                    const nextBox = letterGrid.querySelector(`.letter-box:not(.space-box)[data-index="${ci + 1}"]`);
                                    if (nextBox) {
                                        const ni = nextBox.querySelector('.letter-input');
                                        if (ni) ni.focus();
                                    } else {
                                        // 整个单词填满 → 跳下一个单词
                                        const allBoxes = letterGrid.querySelectorAll('.letter-box:not(.space-box)');
                                        let allFilled = true;
                                        allBoxes.forEach(b => {
                                            const inp = b.querySelector('.letter-input');
                                            if (!inp || !inp.value) allFilled = false;
                                        });
                                        if (allFilled) {
                                            setTimeout(() => {
                                                const nextGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx + 1}"]`);
                                                if (nextGrid) {
                                                    letterGrid.classList.remove('active-slot');
                                                    nextGrid.classList.add('active-slot');
                                                    const allNi = nextGrid.querySelectorAll('.letter-input');
                                                    if (allNi.length) allNi[0].focus();
                                                }
                                            }, 200);
                                        }
                                    }
                                    return;
                                }
                                if (e.key === 'Backspace') {
                                    if (letterInput.value) {
                                        // 有内容：让原生清空，无需额外操作
                                        return;
                                    }
                                    e.preventDefault();
                                    const prevBox = letterGrid.querySelector(`.letter-box:not(.space-box)[data-index="${ci - 1}"]`);
                                    if (prevBox) {
                                        const pi = prevBox.querySelector('.letter-input');
                                        if (pi) { pi.focus(); pi.select(); }
                                    } else {
                                        const prevGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx - 1}"]`);
                                        if (prevGrid) {
                                            letterGrid.classList.remove('active-slot');
                                            prevGrid.classList.add('active-slot');
                                            const allPi = prevGrid.querySelectorAll('.letter-input');
                                            if (allPi.length) allPi[allPi.length - 1].focus();
                                        }
                                    }
                                    return;
                                }
                                if (e.key === 'Delete') {
                                    e.preventDefault();
                                    const nextBox = letterGrid.querySelector(`.letter-box:not(.space-box)[data-index="${ci + 1}"]`);
                                    if (nextBox) {
                                        const ni = nextBox.querySelector('.letter-input');
                                        if (ni) { ni.focus(); ni.select(); }
                                    } else {
                                        const nextGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx + 1}"]`);
                                        if (nextGrid) {
                                            letterGrid.classList.remove('active-slot');
                                            nextGrid.classList.add('active-slot');
                                            const allNi = nextGrid.querySelectorAll('.letter-input');
                                            if (allNi.length) allNi[0].focus();
                                        }
                                    }
                                    return;
                                }
                                if (e.key === 'ArrowLeft') {
                                    e.preventDefault();
                                    const prevBox = letterGrid.querySelector(`.letter-box:not(.space-box)[data-index="${ci - 1}"]`);
                                    if (prevBox) {
                                        const pi = prevBox.querySelector('.letter-input');
                                        if (pi) pi.focus();
                                    } else {
                                        const prevGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx - 1}"]`);
                                        if (prevGrid) {
                                            letterGrid.classList.remove('active-slot');
                                            prevGrid.classList.add('active-slot');
                                            const allPi = prevGrid.querySelectorAll('.letter-input');
                                            if (allPi.length) allPi[allPi.length - 1].focus();
                                        }
                                    }
                                    return;
                                }
                                if (e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    const nextBox = letterGrid.querySelector(`.letter-box:not(.space-box)[data-index="${ci + 1}"]`);
                                    if (nextBox) {
                                        const ni = nextBox.querySelector('.letter-input');
                                        if (ni) ni.focus();
                                    } else {
                                        const nextGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx + 1}"]`);
                                        if (nextGrid) {
                                            letterGrid.classList.remove('active-slot');
                                            nextGrid.classList.add('active-slot');
                                            const allNi = nextGrid.querySelectorAll('.letter-input');
                                            if (allNi.length) allNi[0].focus();
                                        }
                                    }
                                    return;
                                }
                                if (e.key === 'Tab' || e.key === 'Enter') {
                                    e.preventDefault();
                                    const nextGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx + 1}"]`);
                                    if (nextGrid) {
                                        letterGrid.classList.remove('active-slot');
                                        nextGrid.classList.add('active-slot');
                                        const allNi = nextGrid.querySelectorAll('.letter-input');
                                        if (allNi.length) allNi[0].focus();
                                    } else if (e.key === 'Enter') {
                                        doCheck();
                                    }
                                    return;
                                }
                            };
                            letterInput.addEventListener('keydown', onBoxKeydown);
                            const cleanBoxKd = () => letterInput.removeEventListener('keydown', onBoxKeydown);
                            _cleanupFns.push(cleanBoxKd);

                            // ---- 输入事件（仅作为粘贴/IME 回退）：保持1个小写字母，自动跳转 ---- //
                            letterInput.addEventListener('input', () => {
                                // 如果 input 已有值且是单字符，说明已被 keydown 处理，跳过
                                if (letterInput.value.length === 1 && /^[a-z0-9]$/.test(letterInput.value)) {
                                    return;
                                }
                                let val = letterInput.value.toLowerCase().replace(/[^a-z]/g, '');
                                if (val.length > 1) val = val.slice(-1);
                                letterInput.value = val;
                                box.classList.toggle('filled', val.length > 0);
                                if (inputWrapper.classList.contains('correct') || inputWrapper.classList.contains('incorrect')) {
                                    inputWrapper.classList.remove('correct', 'incorrect');
                                }
                                wordStates.delete(item.word.toLowerCase());
                                // 填满后自动跳转到下一个格子
                                if (val.length > 0) {
                                    const nextBox = letterGrid.querySelector(`.letter-box:not(.space-box)[data-index="${ci + 1}"]`);
                                    if (nextBox) {
                                        const ni = nextBox.querySelector('.letter-input');
                                        if (ni) ni.focus();
                                    } else {
                                        // 整个单词填满 → 跳下一个单词
                                        const allBoxes = letterGrid.querySelectorAll('.letter-box:not(.space-box)');
                                        let allFilled = true;
                                        allBoxes.forEach(b => {
                                            const inp = b.querySelector('.letter-input');
                                            if (!inp || !inp.value) allFilled = false;
                                        });
                                        if (allFilled) {
                                            setTimeout(() => {
                                                const nextGrid = clozeContent.querySelector(`.cloze-letter-grid[data-idx="${localIdx + 1}"]`);
                                                if (nextGrid) {
                                                    letterGrid.classList.remove('active-slot');
                                                    nextGrid.classList.add('active-slot');
                                                    const allNi = nextGrid.querySelectorAll('.letter-input');
                                                    if (allNi.length) allNi[0].focus();
                                                }
                                            }, 200);
                                        }
                                    }
                                }
                            });

                            // ---- 获取焦点时激活 active-slot ---- //
                            letterInput.addEventListener('focus', () => {
                                document.querySelectorAll('.cloze-letter-grid.active-slot').forEach(g => g.classList.remove('active-slot'));
                                letterGrid.classList.add('active-slot');
                            });

                            box.appendChild(letterInput);
                            letterGrid.appendChild(box);
                            boxes.push(box);
                        }

                        const localIdx = clozeInputItems.length;

                        // ---- 点击字母格朗读 + 聚焦对应输入框 ---- //
                        const onGridClick = (e) => {
                            e.stopPropagation();
                            // 优先找点击的输入框，否则找当前格子的输入框
                            let clickedInput = e.target.closest('.letter-input');
                            if (!clickedInput) {
                                const clickedBox = e.target.closest('.letter-box');
                                if (clickedBox) {
                                    clickedInput = clickedBox.querySelector('.letter-input');
                                }
                            }
                            if (clickedInput) clickedInput.focus();
                            speakSentence(item.word, letterGrid);
                        };
                        letterGrid.addEventListener('click', onGridClick);
                        _cleanupFns.push(() => letterGrid.removeEventListener('click', onGridClick));

                        inputGroup.appendChild(letterGrid);
                        inputWrapper.appendChild(inputGroup);
                        clozeContent.appendChild(inputWrapper);
                        letterGrid.dataset.idx = localIdx;
                        clozeInputItems.push({ item, wrapper: inputWrapper, letterGrid, boxes });

                        cursor = paraStart + localEnd;
                    });

                    // 句尾剩余文本
                    const tailStart = cursor - paraStart;
                    if (tailStart < sentEnd) {
                        const tailText = paraText.substring(tailStart, sentEnd);
                        if (tailText) {
                            const span = document.createElement('span');
                            span.className = 'cloze-text';
                            span.textContent = tailText;
                            clozeContent.appendChild(span);
                        }
                    }

                    // 句末朗读按钮
                    const sentSpeakBtn = document.createElement('button');
                    sentSpeakBtn.className = 'cloze-sent-speak-btn';
                    sentSpeakBtn.type = 'button';
                    sentSpeakBtn.title = '朗读本句';
                    sentSpeakBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
                    const onSentSpeak = (e) => {
                        e.stopPropagation();
                        speakSentence(sentence.text);
                    };
                    sentSpeakBtn.addEventListener('click', onSentSpeak);
                    _cleanupFns.push(() => sentSpeakBtn.removeEventListener('click', onSentSpeak));
                    clozeContent.appendChild(sentSpeakBtn);

                    // 句间分割线（最后一句不用）
                    if (sentIdx < sentences.length - 1) {
                        const divider = document.createElement('div');
                        divider.className = 'cloze-sentence-divider';
                        clozeContent.appendChild(divider);
                    }
                });

                // 默认激活第一个未完成的格子
                setTimeout(() => {
                    const firstUnsolved = clozeInputItems.find(it =>
                        !it.wrapper.classList.contains('correct') &&
                        !it.wrapper.classList.contains('revealed')
                    );
                    if (firstUnsolved) {
                        firstUnsolved.letterGrid.classList.add('active-slot');
                        firstUnsolved.letterGrid.focus();
                    }
                }, 30);
            }

            buildCardDOM();

            updateScore();
            updateProgress();

            setTimeout(() => {
                if (clozeInputItems[0]) clozeInputItems[0].letterGrid.focus();
            }, 100);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showClozeModeInterface,
            init: init
        };
    });
})();
