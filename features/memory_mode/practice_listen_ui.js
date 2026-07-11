(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('PracticeListenUI', ['GlobalManager'], function(GlobalManager) {

        function showListeningPracticeInterface(container) {
            const vocabData = _getVocabData();
            const notebook = vocabData ? vocabData.getCurrentNotebook() : null;
            const words = (notebook && notebook.words && notebook.words.length > 0) ? [...notebook.words] : [];

            if (words.length === 0) {
                _showToast('当前生词本没有单词');
                return;
            }

            const appHeader = document.getElementById('app-header');
            const cardHeader = document.querySelector('.card-header');
            const cardBody = document.querySelector('.card-body');
            if (appHeader) appHeader.style.display = 'none';
            if (cardHeader) cardHeader.style.display = 'none';
            if (cardBody) cardBody.style.display = 'none';

            container.innerHTML = '';
            container.id = 'memoryModeInterface';
            container.className = 'vocab-card memory-mode-card';

            const listenHeader = document.createElement('div');
            listenHeader.className = 'fill-header';
            listenHeader.innerHTML = `
                <button class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                <h3>听力练习</h3>
                <span class="fill-score-badge" id="listenScoreBadge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span id="listenScoreNum">0</span>
                </span>
            `;
            listenHeader.querySelector('.back-btn').onclick = () => {
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
            };
            container.appendChild(listenHeader);

            const listenProgressWrap = document.createElement('div');
            listenProgressWrap.className = 'fill-progress-wrap';
            listenProgressWrap.innerHTML = `
                <div class="fill-progress-track" id="listenProgressTrack">
                    <div class="fill-progress-fill" id="listenProgressFill" style="width:0%"></div>
                </div>
                <span class="fill-progress-text" id="listenPracticeIndex">已听懂 0 / ${words.length}</span>
            `;
            container.appendChild(listenProgressWrap);

            const listenCard = document.createElement('div');
            listenCard.className = 'fill-card';
            listenCard.id = 'listenPracticeCard';

            const listenWaveContainer = document.createElement('div');
            listenWaveContainer.className = 'listen-wave-container';
            listenWaveContainer.id = 'listenWaveContainer';
            listenWaveContainer.innerHTML = `
                <div class="listen-wave-icon">
                    <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" class="wave-mic"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                </div>
                <div class="listen-wave-bars" id="listenWaveBars">
                    <span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span>
                    <span class="wave-bar"></span><span class="wave-bar"></span>
                </div>
            `;
            listenCard.appendChild(listenWaveContainer);

            const listenPlayBtn = document.createElement('button');
            listenPlayBtn.className = 'listen-play-btn';
            listenPlayBtn.id = 'listenPlayBtn';
            listenPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> 播放单词';
            listenPlayBtn.onclick = () => { listenSpeak(words[listenCurrentIndex]); };
            listenCard.appendChild(listenPlayBtn);

            const listenPlayDots = document.createElement('div');
            listenPlayDots.className = 'listen-play-dots';
            listenPlayDots.id = 'listenPlayCount';
            listenPlayDots.innerHTML = '<span class="play-dot active"></span><span class="play-dot active"></span><span class="play-dot active"></span>';
            listenCard.appendChild(listenPlayDots);

            const listenInputArea = document.createElement('div');
            listenInputArea.className = 'listen-input-area';
            listenInputArea.id = 'listenInputArea';

            const listenInput = document.createElement('input');
            listenInput.type = 'text';
            listenInput.className = 'listen-input';
            listenInput.id = 'listenPracticeInput';
            listenInput.placeholder = '输入你听到的单词...';
            listenInput.autocomplete = 'off';
            listenInput.spellcheck = false;
            listenInput.style.display = 'none';
            listenInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doListenCheck();
            });
            listenInputArea.appendChild(listenInput);

            const listenChoiceArea = document.createElement('div');
            listenChoiceArea.className = 'listen-choice-area';
            listenChoiceArea.id = 'listenChoiceArea';
            listenInputArea.appendChild(listenChoiceArea);

            listenCard.appendChild(listenInputArea);

            const listenResult = document.createElement('div');
            listenResult.className = 'fill-result';
            listenResult.id = 'listenPracticeResult';
            listenCard.appendChild(listenResult);

            container.appendChild(listenCard);

            const listenBottom = document.createElement('div');
            listenBottom.className = 'fill-bottom';
            listenBottom.innerHTML = `
                <button class="fill-reset-btn" id="listenReplayBtn">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"/></svg> 播放
                </button>
                <button class="fill-hint-btn" id="listenModeToggle" title="切换输入/选择模式">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
                    </svg>
                </button>
                <button class="fill-skip-btn" id="listenSkipBtn" title="跳过">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                </button>
                <button class="fill-check-btn" id="listenCheckBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 检查
                </button>
            `;
            listenBottom.querySelector('#listenReplayBtn').onclick = () => { listenSpeak(words[listenCurrentIndex]); };
            listenBottom.querySelector('#listenModeToggle').onclick = () => {
                listenChoiceMode = !listenChoiceMode;
                const btn = document.getElementById('listenModeToggle');
                if (btn) btn.classList.toggle('active', !listenChoiceMode);
                renderListenWord(listenCurrentIndex);
            };
            listenBottom.querySelector('#listenSkipBtn').onclick = doListenSkip;
            listenBottom.querySelector('#listenCheckBtn').onclick = doListenCheck;
            container.appendChild(listenBottom);

            let listenCurrentIndex = 0;
            let listenAnswered = new Set();
            let _listenRated = false;
            let _listenPlaysRemaining = 3;
            let _listenWaveInterval = null;
            let listenChoiceMode = true;
            let listenScore = 0;
            let listenTotalPlays = 0;
            let listenWrongCount = 0;
            let listenTotalWords = words.length;

            function updateListenScore() {
                const scoreEl = document.getElementById('listenScoreNum');
                if (scoreEl) scoreEl.textContent = listenScore;
                const badge = document.getElementById('listenScoreBadge');
                if (badge) {
                    badge.classList.remove('score-pop');
                    void badge.offsetWidth;
                    badge.classList.add('score-pop');
                }
            }

            function updateListenProgress() {
                const fillEl = document.getElementById('listenProgressFill');
                const idxEl = document.getElementById('listenPracticeIndex');
                if (fillEl) fillEl.style.width = (listenAnswered.size / listenTotalWords * 100) + '%';
                if (idxEl) idxEl.textContent = '已听懂 ' + listenAnswered.size + ' / ' + listenTotalWords;
            }

            function buildChoices(correctWord) {
                const dists = words
                    .filter(w => w.word.toLowerCase() !== correctWord.toLowerCase())
                    .map(w => w.word);
                const shuffled = shuffleArray(dists).slice(0, 3);
                shuffled.push(correctWord);
                return shuffleArray(shuffled);
            }

            function shuffleArray(arr) {
                const a = [...arr];
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }

            function startWaveAnimation() {
                stopWaveAnimation();
                const bars = document.querySelectorAll('#listenWaveBars .wave-bar');
                bars.forEach(b => b.classList.add('animating'));
                _listenWaveInterval = setInterval(() => {
                    bars.forEach(b => {
                        b.style.height = (8 + Math.random() * 24) + 'px';
                    });
                }, 150);
            }

            function stopWaveAnimation() {
                if (_listenWaveInterval) clearInterval(_listenWaveInterval);
                _listenWaveInterval = null;
                const bars = document.querySelectorAll('#listenWaveBars .wave-bar');
                bars.forEach(b => {
                    b.classList.remove('animating');
                    b.style.height = '8px';
                });
            }

            function updatePlayDots() {
                const dots = document.querySelectorAll('#listenPlayCount .play-dot');
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i < _listenPlaysRemaining);
                    dot.classList.toggle('used', i >= _listenPlaysRemaining);
                });
            }

            function listenSpeak(wordObj) {
                if (_listenRated) return;
                _listenPlaysRemaining--;
                listenTotalPlays++;
                if (_listenPlaysRemaining < 0) {
                    listenScore = Math.max(0, listenScore - 2);
                    updateListenScore();
                }
                updatePlayDots();
                startWaveAnimation();

                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(wordObj.word);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    utterance.onend = () => { stopWaveAnimation(); };
                    utterance.onerror = () => { stopWaveAnimation(); };
                    window.speechSynthesis.speak(utterance);
                } else {
                    setTimeout(() => stopWaveAnimation(), 1500);
                }
            }

            function showLearningCard(word, isCorrect) {
                const card = document.getElementById('listenPracticeCard');
                if (!card) return;

                const existing = card.querySelector('.listen-learning-card');
                if (existing) existing.remove();

                const learningCard = document.createElement('div');
                learningCard.className = 'listen-learning-card' + (isCorrect ? ' correct' : ' wrong');
                learningCard.innerHTML = `
                    <div class="learning-word">${isCorrect ? '✓' : '✗'} <strong>${word.word}</strong></div>
                    <div class="learning-meaning">${word.meaning || ''}</div>
                    ${word.sentence ? `<div class="learning-sentence">${word.sentence}</div>` : ''}
                `;
                card.appendChild(learningCard);

                setTimeout(() => {
                    if (learningCard.parentNode) {
                        learningCard.style.opacity = '0';
                        learningCard.style.transform = 'translateY(-8px)';
                        setTimeout(() => {
                            if (learningCard.parentNode) learningCard.parentNode.removeChild(learningCard);
                        }, 250);
                    }
                }, 1200);
            }

            function renderListenWord(idx) {
                listenCurrentIndex = idx;
                _listenRated = false;
                _listenPlaysRemaining = 3;
                updatePlayDots();
                stopWaveAnimation();

                const word = words[idx];
                const listenInputEl = document.getElementById('listenPracticeInput');
                const listenChoiceAreaEl = document.getElementById('listenChoiceArea');
                const listenResultEl = document.getElementById('listenPracticeResult');
                const listenIndexEl = document.getElementById('listenPracticeIndex');
                const listenCheckBtnEl = document.getElementById('listenCheckBtn');

                if (listenResultEl) listenResultEl.innerHTML = '';

                const card = document.getElementById('listenPracticeCard');
                const existingLC = card ? card.querySelector('.listen-learning-card') : null;
                if (existingLC) existingLC.remove();

                if (listenChoiceMode && listenChoiceAreaEl) {
                    if (listenInputEl) listenInputEl.style.display = 'none';
                    listenChoiceAreaEl.style.display = 'block';
                    if (listenCheckBtnEl) listenCheckBtnEl.style.display = 'none';

                    const choices = buildChoices(word.word);
                    listenChoiceAreaEl.innerHTML = '';
                    choices.forEach(choice => {
                        const btn = document.createElement('button');
                        btn.className = 'listen-choice-btn';
                        btn.textContent = choice;
                        btn.onclick = () => { doChoiceSelect(choice, word); };
                        listenChoiceAreaEl.appendChild(btn);
                    });
                } else {
                    if (listenInputEl) {
                        listenInputEl.style.display = 'block';
                        listenInputEl.value = '';
                        listenInputEl.disabled = false;
                        listenInputEl.focus();
                    }
                    if (listenChoiceAreaEl) listenChoiceAreaEl.style.display = 'none';
                    if (listenCheckBtnEl) listenCheckBtnEl.style.display = '';
                }

                setTimeout(() => listenSpeak(word), 350);
            }

            function doChoiceSelect(choice, word) {
                if (_listenRated) return;
                _listenRated = true;
                const listenResultEl = document.getElementById('listenPracticeResult');
                const choiceBtns = document.querySelectorAll('#listenChoiceArea .listen-choice-btn');

                choiceBtns.forEach(btn => {
                    btn.disabled = true;
                    if (btn.textContent.toLowerCase() === word.word.toLowerCase()) {
                        btn.classList.add('correct');
                    }
                    if (btn.textContent === choice && choice.toLowerCase() !== word.word.toLowerCase()) {
                        btn.classList.add('wrong');
                    }
                });

                const isCorrect = choice.toLowerCase() === word.word.toLowerCase();
                if (isCorrect) {
                    if (listenResultEl) {
                        listenResultEl.innerHTML = '<span class="fill-correct">✓ 正确！+10分</span>';
                        listenResultEl.className = 'fill-result fill-result-correct';
                    }
                    listenScore += 10;
                    listenAnswered.add(listenCurrentIndex);
                    updateListenScore();
                    updateListenProgress();
                } else {
                    listenWrongCount++;
                    if (listenResultEl) {
                        listenResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.word}</strong></span>`;
                        listenResultEl.className = 'fill-result fill-result-wrong';
                    }
                }

                showLearningCard(word, isCorrect);

                setTimeout(() => {
                    if (listenAnswered.size >= listenTotalWords) {
                        showListenSummary();
                    } else {
                        renderListenWord(listenCurrentIndex + 1);
                    }
                }, 1500);
            }

            function doListenCheck() {
                if (_listenRated) return;
                if (listenChoiceMode) return;
                const listenInputEl = document.getElementById('listenPracticeInput');
                const listenResultEl = document.getElementById('listenPracticeResult');
                if (!listenInputEl || !listenResultEl) return;

                const word = words[listenCurrentIndex];
                const userAnswer = listenInputEl.value.trim().toLowerCase();
                const correctWord = word.word.toLowerCase();

                _listenRated = true;
                listenInputEl.disabled = true;

                const isCorrect = userAnswer === correctWord;
                if (isCorrect) {
                    listenResultEl.innerHTML = '<span class="fill-correct">✓ 正确！+10分</span>';
                    listenResultEl.className = 'fill-result fill-result-correct';
                    listenInputEl.style.borderColor = '#22c55e';
                    listenScore += 10;
                    listenAnswered.add(listenCurrentIndex);
                    updateListenScore();
                    updateListenProgress();
                } else {
                    listenWrongCount++;
                    listenResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.word}</strong> <small>(${word.meaning})</small></span>`;
                    listenResultEl.className = 'fill-result fill-result-wrong';
                    listenInputEl.style.borderColor = '#ef4444';
                }

                showLearningCard(word, isCorrect);

                setTimeout(() => {
                    if (listenAnswered.size >= listenTotalWords) {
                        showListenSummary();
                    } else {
                        renderListenWord(listenCurrentIndex + 1);
                    }
                }, 1500);
            }

            function doListenSkip() {
                const listenResultEl = document.getElementById('listenPracticeResult');
                if (listenResultEl) {
                    listenResultEl.innerHTML = '<span class="fill-skip">⏭ 已跳过</span>';
                    listenResultEl.className = 'fill-result fill-result-skip';
                }

                setTimeout(() => {
                    if (listenAnswered.size >= listenTotalWords) {
                        showListenSummary();
                    } else {
                        renderListenWord(listenCurrentIndex + 1);
                    }
                }, 400);
            }

            function showListenSummary() {
                const listenCardEl = document.getElementById('listenPracticeCard');
                const listenCheckBtnEl = document.getElementById('listenCheckBtn');
                if (listenCheckBtnEl) listenCheckBtnEl.style.display = 'none';
                const listenBottomEl = document.querySelector('.fill-bottom');
                if (listenBottomEl) listenBottomEl.style.display = 'none';

                const total = listenTotalWords;
                const correct = listenAnswered.size;
                const wrong = listenWrongCount;
                const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

                let earLevel, earEmoji;
                if (wrong === 0) { earLevel = '金耳朵'; earEmoji = '🥇'; }
                else if (wrong <= 2) { earLevel = '银耳朵'; earEmoji = '🥈'; }
                else { earLevel = '铜耳朵'; earEmoji = '🥉'; }

                let title = `👂 ${earLevel}！`;
                let titleClass = 'perfect';

                if (listenCardEl) {
                    listenCardEl.innerHTML = `
                        <div class="fill-summary">
                            <div class="fill-summary-icon">
                                <div class="trophy-star">
                                    <div class="star-eight"></div>
                                </div>
                                <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="${wrong === 0 ? '#f59e0b' : wrong <= 2 ? '#94a3b8' : '#d97706'}">
                                    <path d="M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z"/>
                                </svg>
                            </div>
                            <div class="fill-summary-title ${titleClass}">${title}</div>
                            <div class="fill-summary-stats">
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val correct">${correct}</span>
                                    <span class="fill-summary-lbl">正确</span>
                                </div>
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val wrong">${wrong}</span>
                                    <span class="fill-summary-lbl">错误</span>
                                </div>
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val rate">${rate}%</span>
                                    <span class="fill-summary-lbl">正确率</span>
                                </div>
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val" style="color:var(--accent)">${listenTotalPlays}</span>
                                    <span class="fill-summary-lbl">播放次数</span>
                                </div>
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val score">${listenScore}</span>
                                    <span class="fill-summary-lbl">得分</span>
                                </div>
                            </div>
                            <div class="fill-perfect-badge">${earEmoji} 听力等级：${earLevel}</div>
                            <button class="summary-retry-btn">再来一轮</button>
                        </div>
                    `;

                    const retryBtn = listenCardEl.querySelector('.summary-retry-btn');
                    if (retryBtn) {
                        retryBtn.onclick = () => {
                            listenCardEl.innerHTML = '';

                            const listenWaveContainer = document.createElement('div');
                            listenWaveContainer.className = 'listen-wave-container';
                            listenWaveContainer.id = 'listenWaveContainer';
                            listenWaveContainer.innerHTML = `
                                <div class="listen-wave-icon">
                                    <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" class="wave-mic"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                        <line x1="12" y1="19" x2="12" y2="23"/>
                                        <line x1="8" y1="23" x2="16" y2="23"/>
                                    </svg>
                                </div>
                                <div class="listen-wave-bars" id="listenWaveBars">
                                    <span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span>
                                    <span class="wave-bar"></span><span class="wave-bar"></span>
                                </div>
                            `;
                            listenCardEl.appendChild(listenWaveContainer);

                            const listenPlayBtn = document.createElement('button');
                            listenPlayBtn.className = 'listen-play-btn';
                            listenPlayBtn.id = 'listenPlayBtn';
                            listenPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> 播放单词';
                            listenPlayBtn.onclick = () => { listenSpeak(words[0]); };
                            listenCardEl.appendChild(listenPlayBtn);

                            const listenPlayDots = document.createElement('div');
                            listenPlayDots.className = 'listen-play-dots';
                            listenPlayDots.id = 'listenPlayCount';
                            listenPlayDots.innerHTML = '<span class="play-dot active"></span><span class="play-dot active"></span><span class="play-dot active"></span>';
                            listenCardEl.appendChild(listenPlayDots);

                            const listenInputArea = document.createElement('div');
                            listenInputArea.className = 'listen-input-area';
                            listenInputArea.id = 'listenInputArea';

                            const listenInput = document.createElement('input');
                            listenInput.type = 'text';
                            listenInput.className = 'listen-input';
                            listenInput.id = 'listenPracticeInput';
                            listenInput.placeholder = '输入你听到的单词...';
                            listenInput.autocomplete = 'off';
                            listenInput.spellcheck = false;
                            listenInput.style.display = 'none';
                            listenInput.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') doListenCheck();
                            });
                            listenInputArea.appendChild(listenInput);

                            const listenChoiceArea = document.createElement('div');
                            listenChoiceArea.className = 'listen-choice-area';
                            listenChoiceArea.id = 'listenChoiceArea';
                            listenInputArea.appendChild(listenChoiceArea);

                            listenCardEl.appendChild(listenInputArea);

                            const listenResult = document.createElement('div');
                            listenResult.className = 'fill-result';
                            listenResult.id = 'listenPracticeResult';
                            listenCardEl.appendChild(listenResult);

                            listenCurrentIndex = 0;
                            listenAnswered = new Set();
                            _listenRated = false;
                            _listenPlaysRemaining = 3;
                            listenChoiceMode = true;
                            listenScore = 0;
                            listenTotalPlays = 0;
                            listenWrongCount = 0;

                            const checkBtn = document.getElementById('listenCheckBtn');
                            if (checkBtn) checkBtn.style.display = '';
                            const bottomEl = document.querySelector('.fill-bottom');
                            if (bottomEl) bottomEl.style.display = '';

                            const modeToggle = document.getElementById('listenModeToggle');
                            if (modeToggle) modeToggle.classList.add('active');

                            updatePlayDots();
                            updateListenScore();
                            updateListenProgress();
                            renderListenWord(0);
                        };
                    }
                }
            }

            updateListenScore();
            updateListenProgress();
            renderListenWord(0);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showListeningPracticeInterface,
            init: init
        };
    });
})();