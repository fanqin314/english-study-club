(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('PracticeChoiceUI', ['GlobalManager'], function(GlobalManager) {

        function showChoicePracticeInterface(container) {
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
            if (window.applyMemoryRainbow) window.applyMemoryRainbow();

            let choiceMode = 'meaning';
            let choiceCurrentIndex = 0;
            let choiceAnswered = new Set();
            let choiceSkipped = new Set();
            let _choiceRated = false;
            let _choicePlaysRemaining = 3;
            let choiceScore = 0;
            let choiceTotalPlays = 0;
            let choiceWrongCount = 0;
            let choiceStreakCount = 0;
            let choiceMaxStreak = 0;
            let choiceTotalWords = words.length;
            let _choiceHintUsed = false;

            const choiceHeader = document.createElement('div');
            choiceHeader.className = 'fill-header';
            choiceHeader.innerHTML = `
                <button class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                <h3>选词练习</h3>
                <span class="fill-score-badge" id="choiceScoreBadge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span id="choiceScoreNum">0</span>
                </span>
            `;
            choiceHeader.querySelector('.back-btn').onclick = () => {
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
            };
            container.appendChild(choiceHeader);

            const choiceBottom = document.createElement('div');
            choiceBottom.className = 'fill-bottom choice-bottom-bar';
            choiceBottom.innerHTML = `
                <button class="fill-hint-btn" id="choiceHintBtn" title="显示首字母提示">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </button>
                <button class="choice-speak-btn" id="choiceSpeakBtn" title="重新播放发音" style="display:none">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
                <button class="choice-gen-example-btn" id="choiceGenExampleBtn" title="生成例句">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <button class="fill-skip-btn choice-skip-btn" id="choiceSkipBtn" title="跳过">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                    <span>跳过</span>
                </button>
            `;
            choiceBottom.querySelector('#choiceHintBtn').onclick = () => { doChoiceHint(); };
            choiceBottom.querySelector('#choiceSkipBtn').onclick = doChoiceSkip;
            choiceBottom.querySelector('#choiceSpeakBtn').onclick = () => { if (words[choiceCurrentIndex]) choiceSpeak(words[choiceCurrentIndex]); };
            choiceBottom.querySelector('#choiceGenExampleBtn').onclick = () => {
                handleGenerateExample(words[choiceCurrentIndex], choiceCurrentIndex);
            };
            container.appendChild(choiceBottom);

            const choiceModeBar = document.createElement('div');
            choiceModeBar.className = 'spell-mode-bar choice-mode-bar';
            choiceModeBar.innerHTML = `
                <button class="spell-mode-btn active" data-mode="meaning" title="看释义选英文单词">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    <span>释义选词</span>
                </button>
                <button class="spell-mode-btn" data-mode="listen" title="听发音选英文单词">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                    <span>听音选词</span>
                </button>
                <button class="spell-mode-btn" data-mode="fillblank" title="选词填空完成句子">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                    <span>选词填空</span>
                </button>
                <button class="spell-mode-btn" data-mode="wordzh" title="看英文单词选中文释义">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>看词选义</span>
                </button>
                <button class="spell-mode-btn" data-mode="listenzh" title="听发音选中文释义">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                    <span>听音选义</span>
                </button>
            `;
            choiceModeBar.querySelectorAll('.spell-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (_choiceRated) return;
                    choiceModeBar.querySelectorAll('.spell-mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    choiceMode = btn.dataset.mode;
                    renderChoiceWord(choiceCurrentIndex);
                });
            });
            container.appendChild(choiceModeBar);

            const choiceCard = document.createElement('div');
            choiceCard.className = 'fill-card choice-card';
            choiceCard.id = 'choicePracticeCard';

            const choicePrompt = document.createElement('div');
            choicePrompt.className = 'choice-prompt';
            choicePrompt.id = 'choicePrompt';
            choiceCard.appendChild(choicePrompt);

            const choicePlayBtn = document.createElement('button');
            choicePlayBtn.className = 'choice-play-btn';
            choicePlayBtn.id = 'choicePlayBtn';
            choicePlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            choicePlayBtn.onclick = () => { choiceSpeak(words[choiceCurrentIndex]); };
            choiceCard.appendChild(choicePlayBtn);

            const choicePlayDots = document.createElement('div');
            choicePlayDots.className = 'listen-play-dots choice-play-dots';
            choicePlayDots.id = 'choicePlayCount';
            choicePlayDots.innerHTML = '<span class="play-dot active"></span><span class="play-dot active"></span><span class="play-dot active"></span>';
            choiceCard.appendChild(choicePlayDots);

            const choiceArea = document.createElement('div');
            choiceArea.className = 'choice-option-grid';
            choiceArea.id = 'choiceOptionArea';
            choiceCard.appendChild(choiceArea);

            const choiceStreak = document.createElement('div');
            choiceStreak.className = 'fill-streak';
            choiceStreak.id = 'choiceStreak';
            choiceCard.appendChild(choiceStreak);

            const choiceResult = document.createElement('div');
            choiceResult.className = 'fill-result';
            choiceResult.id = 'choicePracticeResult';
            choiceCard.appendChild(choiceResult);

            container.appendChild(choiceCard);

            const choiceProgressWrap = document.createElement('div');
            choiceProgressWrap.className = 'fill-progress-wrap';
            choiceProgressWrap.innerHTML = `
                <div class="fill-progress-track" id="choiceProgressTrack">
                    <div class="fill-progress-fill" id="choiceProgressFill" style="width:0%"></div>
                </div>
                <span class="fill-progress-text" id="choicePracticeIndex">已选对 0 / ${words.length}</span>
            `;
            container.appendChild(choiceProgressWrap);

            function updateChoiceScore() {
                const scoreEl = document.getElementById('choiceScoreNum');
                if (scoreEl) scoreEl.textContent = choiceScore;
                const badge = document.getElementById('choiceScoreBadge');
                if (badge) {
                    badge.classList.remove('score-pop');
                    void badge.offsetWidth;
                    badge.classList.add('score-pop');
                }
            }

            function updateChoiceProgress() {
                const fillEl = document.getElementById('choiceProgressFill');
                const idxEl = document.getElementById('choicePracticeIndex');
                const totalDone = choiceAnswered.size + choiceSkipped.size;
                if (fillEl) fillEl.style.width = (totalDone / choiceTotalWords * 100) + '%';
                if (idxEl) idxEl.textContent = '已选对 ' + choiceAnswered.size + ' / ' + choiceTotalWords;
            }

            function updateChoiceStreak() {
                const streakEl = document.getElementById('choiceStreak');
                if (!streakEl) return;
                if (choiceStreakCount >= 10) {
                    streakEl.innerHTML = `<span class="streak-fire-super">🌟🔥🌟 超级连击 ${choiceStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                } else if (choiceStreakCount >= 5) {
                    streakEl.innerHTML = `<span class="streak-fire">🔥 连击 ${choiceStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                } else if (choiceStreakCount >= 3) {
                    streakEl.innerHTML = `<span class="streak-fire">⚡ ${choiceStreakCount} 连对</span>`;
                    streakEl.classList.add('active');
                } else {
                    streakEl.classList.remove('active');
                }
            }

            function updatePlayDots() {
                const dots = document.querySelectorAll('#choicePlayCount .play-dot');
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active', i < _choicePlaysRemaining);
                    dot.classList.toggle('used', i >= _choicePlaysRemaining);
                });
            }

            function buildChoices(correctWord) {
                const dists = words
                    .filter(w => w.word.toLowerCase() !== correctWord.toLowerCase())
                    .map(w => w.word);
                const shuffled = shuffleArray(dists).slice(0, 3);
                shuffled.push(correctWord);
                return shuffleArray(shuffled);
            }

            function buildZhChoices(correctWordObj) {
                const dists = words
                    .filter(w => w.word.toLowerCase() !== correctWordObj.word.toLowerCase() && w.meaning)
                    .map(w => w.meaning);
                const shuffled = shuffleArray(dists).slice(0, 3);
                shuffled.push(correctWordObj.meaning);
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

            function choiceSpeak(wordObj) {
                if (_choiceRated) return;
                _choicePlaysRemaining--;
                choiceTotalPlays++;
                if (_choicePlaysRemaining < 0) {
                    choiceScore = Math.max(0, choiceScore - 2);
                    updateChoiceScore();
                }
                updatePlayDots();

                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(wordObj.word);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    window.speechSynthesis.speak(utterance);
                }
            }

            function triggerConfetti(containerEl, intensity) {
                if (!containerEl) return;
                const rect = containerEl.getBoundingClientRect();
                const container = document.createElement('div');
                container.className = 'confetti-container';
                container.style.left = rect.width / 2 + 'px';
                container.style.top = rect.height / 2 + 'px';
                containerEl.style.position = 'relative';
                containerEl.appendChild(container);

                const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6b9d', '#c084fc', '#fb923c', '#22c55e', '#a855f7', '#ec4899', '#f97316', '#06b6d4'];
                const shapes = ['confetti-piece--square', 'confetti-piece--circle', 'confetti-piece--ribbon', 'confetti-piece--star'];
                const count = intensity === 'super' ? 140 : 80;

                for (let i = 0; i < count; i++) {
                    const piece = document.createElement('div');
                    piece.className = 'confetti-piece ' + shapes[i % shapes.length];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const size = 5 + Math.random() * 9;
                    const angle = Math.random() * 360;
                    const distance = 50 + Math.random() * (intensity === 'super' ? 180 : 140);
                    const rad = (angle * Math.PI) / 180;
                    const tx = Math.cos(rad) * distance;
                    const ty = Math.sin(rad) * distance - 50;
                    const tr = Math.random() * 720 - 360;
                    const fx = tx * 0.4;
                    const fy = ty * 0.5 + 70 + Math.random() * 50;
                    const fr = tr + Math.random() * 360;
                    const duration = 500 + Math.random() * (intensity === 'super' ? 700 : 500);
                    const delay = Math.random() * 120;

                    piece.style.width = size + 'px';
                    piece.style.height = size * (0.4 + Math.random() * 0.9) + 'px';
                    piece.style.background = color;
                    piece.style.setProperty('--tx', tx + 'px');
                    piece.style.setProperty('--ty', ty + 'px');
                    piece.style.setProperty('--tr', tr + 'deg');
                    piece.style.setProperty('--fx', fx + 'px');
                    piece.style.setProperty('--fy', fy + 'px');
                    piece.style.setProperty('--fr', fr + 'deg');

                    const useBurst = Math.random() > 0.25;
                    piece.style.animation = (useBurst ? 'confettiBurst' : 'confettiFall') + ' ' + duration + 'ms ease-out ' + delay + 'ms forwards';
                    if (intensity === 'super' && Math.random() > 0.7) {
                        piece.style.boxShadow = '0 0 4px ' + color;
                    }
                    container.appendChild(piece);
                }

                const cleanupTimeout = intensity === 'super' ? 2000 : 1500;
                setTimeout(() => {
                    if (container.parentNode) container.parentNode.removeChild(container);
                }, cleanupTimeout);
            }

            function showLearningCard(word, isCorrect) {
                const card = document.getElementById('choicePracticeCard');
                if (!card) return;

                const existing = card.querySelector('.choice-learning-card');
                if (existing) existing.remove();

                const learningCard = document.createElement('div');
                learningCard.className = 'choice-learning-card' + (isCorrect ? ' correct' : ' wrong');
                learningCard.innerHTML = `
                    <div class="choice-learning-word">${isCorrect ? '✓' : '✗'} <strong>${word.word}</strong></div>
                    <div class="choice-learning-meaning">${word.meaning || ''}</div>
                    ${word.sentence ? `<div class="choice-learning-sentence">${word.sentence}</div>` : ''}
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

            function doChoiceHint() {
                if (_choiceRated || _choiceHintUsed) return;
                if (choiceMode === 'listenzh' || choiceMode === 'wordzh') return;
                _choiceHintUsed = true;
                choiceScore = Math.max(0, choiceScore - 3);
                updateChoiceScore();

                const word = words[choiceCurrentIndex];
                const btns = document.querySelectorAll('#choiceOptionArea .choice-option-btn');
                btns.forEach(btn => {
                    if (btn.textContent[0].toLowerCase() === word.word[0].toLowerCase()) {
                        btn.classList.add('hint-glow');
                        btn.style.animation = 'choiceHintPulse 0.6s ease 3';
                    }
                });
            }

            let _choiceTranslationBubble = null;

            function closeChoiceTranslationBubble() {
                if (_choiceTranslationBubble) {
                    _choiceTranslationBubble.remove();
                    _choiceTranslationBubble = null;
                }
            }

            function showChoiceTranslationBubble(btn, translation) {
                closeChoiceTranslationBubble();

                const bubble = document.createElement('div');
                bubble.className = 'choice-translation-bubble';
                bubble.innerHTML = `
                    <div class="choice-translation-bubble-arrow"></div>
                    <div class="choice-translation-bubble-inner">${translation}</div>
                `;
                document.body.appendChild(bubble);
                _choiceTranslationBubble = bubble;

                const rect = btn.getBoundingClientRect();
                bubble.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - 100, window.innerWidth - 208)) + 'px';
                bubble.style.top = (rect.bottom + 8) + 'px';

                const bubbleRect = bubble.getBoundingClientRect();
                if (rect.bottom + 8 + bubbleRect.height > window.innerHeight) {
                    bubble.style.top = (rect.top - bubbleRect.height - 8) + 'px';
                    bubble.classList.add('bubble-above');
                }
            }

            function getBlankedSentence(word) {
                if (word.example && word.example.en) {
                    const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp('(' + escaped + ')', 'gi');
                    return word.example.en.replace(regex, '<span class="fill-blank-inline">______</span>');
                }
                return null;
            }

            async function handleGenerateExample(word, idx) {
                if (_choiceRated) return;
                const genBtn = document.getElementById('choiceGenExampleBtn');
                if (genBtn) genBtn.disabled = true;
                _showToast('正在生成例句...');

                try {
                    const APIRequest = window.APIRequest || GlobalManager.getGlobalObject('APIRequest');
                    if (APIRequest && APIRequest.requestExample) {
                        const example = await APIRequest.requestExample(word.word, word.meaning);
                        if (example && example.en) {
                            word.example = example;
                            const vocabData = _getVocabData();
                            if (vocabData) {
                                const notebookId = vocabData.getCurrentNotebookId();
                                vocabData.updateWord(notebookId, word.word, { example: example });
                            }
                            _showToast('例句已生成');
                            renderChoiceWord(idx);
                            return;
                        }
                    }

                    _showToast('生成失败，请重试');
                    if (genBtn) genBtn.disabled = false;
                } catch (err) {
                    _showToast('生成失败，请重试');
                    if (genBtn) genBtn.disabled = false;
                }
            }

            function renderChoiceWord(idx) {
                choiceCurrentIndex = idx;
                _choiceRated = false;
                _choicePlaysRemaining = 3;
                _choiceHintUsed = false;
                updatePlayDots();

                const genBtn = document.getElementById('choiceGenExampleBtn');
                if (genBtn) { genBtn.disabled = false; genBtn.style.display = 'none'; }

                const word = words[idx];
                const choiceAreaEl = document.getElementById('choiceOptionArea');
                const choiceResultEl = document.getElementById('choicePracticeResult');
                const choicePromptEl = document.getElementById('choicePrompt');
                const choicePlayBtnEl = document.getElementById('choicePlayBtn');
                const choicePlayDotsEl = document.getElementById('choicePlayCount');

                if (choiceResultEl) choiceResultEl.innerHTML = '';

                const card = document.getElementById('choicePracticeCard');
                card.classList.remove('choice-mode-fillblank');
                const existingLC = card ? card.querySelector('.choice-learning-card') : null;
                if (existingLC) existingLC.remove();

                const playBtnVisible = choiceMode === 'listen' || choiceMode === 'listenzh';
                if (choicePlayBtnEl) choicePlayBtnEl.style.display = playBtnVisible ? '' : 'none';
                if (choicePlayDotsEl) choicePlayDotsEl.style.display = playBtnVisible ? '' : 'none';

                const hintBtn = document.getElementById('choiceHintBtn');
                if (hintBtn) hintBtn.style.display = (choiceMode === 'listenzh' || choiceMode === 'wordzh') ? 'none' : '';

                const speakBtn = document.getElementById('choiceSpeakBtn');
                if (speakBtn) speakBtn.style.display = (choiceMode === 'listen' || choiceMode === 'listenzh') ? '' : 'none';

                if (choiceMode === 'meaning') {
                    const genBtn = document.getElementById('choiceGenExampleBtn');
                    if (genBtn) genBtn.style.display = 'none';
                    if (choicePromptEl) {
                        choicePromptEl.innerHTML = `
                            <div class="choice-prompt-label">选择正确单词</div>
                            <div class="choice-prompt-meaning">${word.meaning || '—'}</div>
                        `;
                    }
                } else if (choiceMode === 'listenzh') {
                    const genBtn = document.getElementById('choiceGenExampleBtn');
                    if (genBtn) genBtn.style.display = 'none';
                    if (choicePromptEl) {
                        choicePromptEl.innerHTML = `
                            <div class="choice-prompt-label">听发音，选择中文释义</div>
                            <div class="choice-prompt-phonetic">${word.phonetic || ''}</div>
                        `;
                    }
                    setTimeout(() => choiceSpeak(word), 300);
                } else if (choiceMode === 'wordzh') {
                    const genBtn = document.getElementById('choiceGenExampleBtn');
                    if (genBtn) genBtn.style.display = 'none';
                    if (choicePromptEl) {
                        choicePromptEl.innerHTML = `
                            <div class="choice-prompt-label">选择正确中文释义</div>
                            <div class="choice-prompt-word-large">${word.word}</div>
                        `;
                    }
                } else if (choiceMode === 'listen') {
                    const genBtn = document.getElementById('choiceGenExampleBtn');
                    if (genBtn) genBtn.style.display = 'none';
                    if (choicePromptEl) {
                        choicePromptEl.innerHTML = `
                            <div class="choice-prompt-label">听发音，选择正确单词</div>
                            <div class="choice-prompt-phonetic">${word.phonetic || ''}</div>
                        `;
                    }
                    setTimeout(() => choiceSpeak(word), 300);
                } else if (choiceMode === 'fillblank') {
                    card.classList.add('choice-mode-fillblank');
                    const blanked = getBlankedSentence(word);
                    closeChoiceTranslationBubble();
                    const genBtn = document.getElementById('choiceGenExampleBtn');
                    if (choicePromptEl) {
                        if (blanked) {
                            if (genBtn) genBtn.style.display = 'none';
                            const translation = (word.example && word.example.zh) ? word.example.zh : '';
                            choicePromptEl.innerHTML = `
                                <div class="choice-prompt-label">选择正确单词完成句子</div>
                                <div class="choice-prompt-sentence">${blanked}</div>
                                ${translation ? `
                                    <button class="choice-toggle-zh-btn" id="choiceToggleZhBtn">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                ` : ''}
                            `;
                            const toggleBtn = document.getElementById('choiceToggleZhBtn');
                            if (toggleBtn) {
                                toggleBtn.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    if (_choiceTranslationBubble) {
                                        closeChoiceTranslationBubble();
                                    } else {
                                        showChoiceTranslationBubble(this, translation);
                                    }
                                });
                                toggleBtn.addEventListener('mouseleave', function() {
                                    if (_choiceTranslationBubble) {
                                        closeChoiceTranslationBubble();
                                    }
                                });
                            }
                        } else {
                            if (genBtn) genBtn.style.display = '';
                            choicePromptEl.innerHTML = `
                                <div class="choice-prompt-label">选择正确单词</div>
                                <div class="choice-prompt-meaning">${word.meaning || '—'}</div>
                            `;
                        }
                    }
                }

                if (choiceAreaEl) {
                    const choices = (choiceMode === 'listenzh' || choiceMode === 'wordzh') ? buildZhChoices(word) : buildChoices(word.word);
                    choiceAreaEl.innerHTML = '';
                    choices.forEach(choice => {
                        const btn = document.createElement('button');
                        btn.className = 'choice-option-btn';
                        btn.textContent = choice;
                        btn.onclick = () => { doChoiceSelect(choice, word); };
                        choiceAreaEl.appendChild(btn);
                    });
                }
            }

            function doChoiceSelect(choice, word) {
                if (_choiceRated) return;
                _choiceRated = true;
                const choiceResultEl = document.getElementById('choicePracticeResult');
                const choiceBtns = document.querySelectorAll('#choiceOptionArea .choice-option-btn');
                const choiceCardEl = document.getElementById('choicePracticeCard');

                const isZhMode = choiceMode === 'listenzh' || choiceMode === 'wordzh';

                choiceBtns.forEach(btn => {
                    btn.disabled = true;
                    if (isZhMode) {
                        if (btn.textContent === word.meaning) {
                            btn.classList.add('correct');
                        }
                    } else {
                        if (btn.textContent.toLowerCase() === word.word.toLowerCase()) {
                            btn.classList.add('correct');
                        }
                    }
                    if (btn.textContent === choice && choice.toLowerCase() !== word.word.toLowerCase() && choice !== word.meaning) {
                        btn.classList.add('wrong');
                    }
                });

                const isCorrect = isZhMode ? (choice === word.meaning) : (choice.toLowerCase() === word.word.toLowerCase());
                if (isCorrect) {
                    choiceStreakCount++;
                    if (choiceStreakCount > choiceMaxStreak) choiceMaxStreak = choiceStreakCount;
                    updateChoiceStreak();

                    if (choiceResultEl) {
                        choiceResultEl.innerHTML = '<span class="fill-correct">✓ 正确！+10分</span>';
                        choiceResultEl.className = 'fill-result fill-result-correct';
                    }
                    choiceScore += 10;
                    choiceAnswered.add(choiceCurrentIndex);
                    updateChoiceScore();
                    updateChoiceProgress();

                    if (choiceStreakCount >= 10) {
                        triggerConfetti(choiceCardEl, 'super');
                    } else if (choiceStreakCount >= 5) {
                        triggerConfetti(choiceCardEl, 'normal');
                    }
                } else {
                    choiceStreakCount = 0;
                    updateChoiceStreak();
                    choiceWrongCount++;
                    if (choiceResultEl) {
                        if (isZhMode) {
                            choiceResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.meaning}</strong> · ${word.word}</span>`;
                        } else {
                            choiceResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.word}</strong> · ${word.meaning}</span>`;
                        }
                        choiceResultEl.className = 'fill-result fill-result-wrong';
                    }
                    if (choiceCardEl) choiceCardEl.classList.add('fill-card-wrong');
                    setTimeout(() => { if (choiceCardEl) choiceCardEl.classList.remove('fill-card-wrong'); }, 600);
                }

                showLearningCard(word, isCorrect);

                setTimeout(() => {
                    if (choiceAnswered.size + choiceSkipped.size >= choiceTotalWords) {
                        showChoiceSummary();
                    } else {
                        renderChoiceWord(choiceCurrentIndex + 1);
                    }
                }, 1500);
            }

            function doChoiceSkip() {
                if (_choiceRated) return;
                _choiceRated = true;
                const word = words[choiceCurrentIndex];
                const choiceResultEl = document.getElementById('choicePracticeResult');
                const choiceBtns = document.querySelectorAll('#choiceOptionArea .choice-option-btn');

                const isZhMode = choiceMode === 'listenzh' || choiceMode === 'wordzh';

                choiceBtns.forEach(btn => {
                    btn.disabled = true;
                    if (isZhMode) {
                        if (btn.textContent === word.meaning) {
                            btn.classList.add('correct');
                        }
                    } else {
                        if (btn.textContent.toLowerCase() === word.word.toLowerCase()) {
                            btn.classList.add('correct');
                        }
                    }
                });

                if (choiceResultEl) {
                    if (isZhMode) {
                        choiceResultEl.innerHTML = `<span class="fill-wrong">⏭ 已跳过 · 正确答案：<strong>${word.meaning}</strong> · ${word.word}</span>`;
                    } else {
                        choiceResultEl.innerHTML = `<span class="fill-wrong">⏭ 已跳过 · 正确答案：<strong>${word.word}</strong> · ${word.meaning}</span>`;
                    }
                    choiceResultEl.className = 'fill-result fill-result-skip';
                }

                choiceSkipped.add(choiceCurrentIndex);
                updateChoiceProgress();

                showLearningCard(word, false);

                const totalDone = choiceAnswered.size + choiceSkipped.size;
                setTimeout(() => {
                    if (totalDone >= choiceTotalWords) {
                        showChoiceSummary();
                    } else {
                        renderChoiceWord(choiceCurrentIndex + 1);
                    }
                }, 800);
            }

            function showChoiceSummary() {
                const choiceCardEl = document.getElementById('choicePracticeCard');
                const choiceBottomEl = document.querySelector('.fill-bottom');
                if (choiceBottomEl) choiceBottomEl.style.display = 'none';

                const total = choiceTotalWords;
                const correct = choiceAnswered.size;
                const wrong = choiceWrongCount;
                const skipped = choiceSkipped.size;
                const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
                const maxStreak = choiceMaxStreak;
                const isPerfect = wrong === 0;

                if (window.StatsTracker) {
                    window.StatsTracker.recordWordsLearned(correct);
                    window.StatsTracker.recordModuleActivity('choicePractice', correct, window.VocabData ? window.VocabData.getCurrentNotebookId() : null);
                }

                const modeLabel = choiceMode === 'meaning' ? '看释义模式' : choiceMode === 'listenzh' ? '听英文选中文模式' : choiceMode === 'wordzh' ? '看单词选中文模式' : choiceMode === 'listen' ? '听音模式' : '填空模式';

                let titleText, titleClass;
                if (isPerfect) {
                    titleText = '完美全对！🏆';
                    titleClass = 'perfect';
                } else if (rate >= 90) {
                    titleText = '非常出色！🌟';
                    titleClass = '';
                } else if (rate >= 70) {
                    titleText = '做得不错！👍';
                    titleClass = '';
                } else {
                    titleText = '继续加油！💪';
                    titleClass = '';
                }

                if (choiceCardEl) {
                    choiceCardEl.innerHTML = `
                        <div class="fill-summary">
                            <div class="fill-summary-icon">
                                <div class="trophy-star">
                                    <div class="star-eight"></div>
                                </div>
                                <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="#e94822">
                                    <path d="M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z"/>
                                </svg>
                            </div>
                            <div class="fill-summary-title ${titleClass}">${titleText}</div>
                            <div class="fill-summary-mode">${modeLabel}</div>
                            <div class="fill-summary-stats">
                                <div class="fill-summary-stat" style="animation-delay:0.05s">
                                    <span class="fill-summary-val" style="color:#22c55e">${correct}</span>
                                    <span class="fill-summary-lbl">正确</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.12s">
                                    <span class="fill-summary-val" style="color:#ef4444">${wrong}</span>
                                    <span class="fill-summary-lbl">错误</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.19s">
                                    <span class="fill-summary-val rate">${rate}%</span>
                                    <span class="fill-summary-lbl">正确率</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.26s">
                                    <span class="fill-summary-val" style="color:#f59e0b">${maxStreak}</span>
                                    <span class="fill-summary-lbl">最大连击</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.33s">
                                    <span class="fill-summary-val score">${choiceScore}</span>
                                    <span class="fill-summary-lbl">得分</span>
                                </div>
                            </div>
                            ${isPerfect ? '<div class="fill-perfect-badge">🏆 完美通关！全对零失误</div>' : ''}
                            <button class="summary-retry-btn">再来一轮</button>
                        </div>
                    `;

                    const retryBtn = choiceCardEl.querySelector('.summary-retry-btn');
                    if (retryBtn) {
                        retryBtn.onclick = () => {
                            choiceCardEl.innerHTML = '';

                            const choicePrompt = document.createElement('div');
                            choicePrompt.className = 'choice-prompt';
                            choicePrompt.id = 'choicePrompt';
                            choiceCardEl.appendChild(choicePrompt);

                            const choicePlayBtn = document.createElement('button');
                            choicePlayBtn.className = 'choice-play-btn';
                            choicePlayBtn.id = 'choicePlayBtn';
                            choicePlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> 播放发音';
                            choicePlayBtn.onclick = () => { choiceSpeak(words[0]); };
                            choiceCardEl.appendChild(choicePlayBtn);

                            const choicePlayDots = document.createElement('div');
                            choicePlayDots.className = 'listen-play-dots choice-play-dots';
                            choicePlayDots.id = 'choicePlayCount';
                            choicePlayDots.innerHTML = '<span class="play-dot active"></span><span class="play-dot active"></span><span class="play-dot active"></span>';
                            choiceCardEl.appendChild(choicePlayDots);

                            const choiceArea = document.createElement('div');
                            choiceArea.className = 'choice-option-grid';
                            choiceArea.id = 'choiceOptionArea';
                            choiceCardEl.appendChild(choiceArea);

                            const choiceStreak = document.createElement('div');
                            choiceStreak.className = 'fill-streak';
                            choiceStreak.id = 'choiceStreak';
                            choiceCardEl.appendChild(choiceStreak);

                            const choiceResult = document.createElement('div');
                            choiceResult.className = 'fill-result';
                            choiceResult.id = 'choicePracticeResult';
                            choiceCardEl.appendChild(choiceResult);

                            choiceCurrentIndex = 0;
                            choiceAnswered = new Set();
                            choiceSkipped = new Set();
                            _choiceRated = false;
                            _choicePlaysRemaining = 3;
                            choiceScore = 0;
                            choiceTotalPlays = 0;
                            choiceWrongCount = 0;
                            choiceStreakCount = 0;
                            choiceMaxStreak = 0;
                            _choiceHintUsed = false;

                            const bottomEl = document.querySelector('.fill-bottom');
                            if (bottomEl) bottomEl.style.display = '';

                            updatePlayDots();
                            updateChoiceScore();
                            updateChoiceStreak();
                            updateChoiceProgress();
                            renderChoiceWord(0);
                        };
                    }
                }
            }

            updateChoiceScore();
            updateChoiceProgress();
            renderChoiceWord(0);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showChoicePracticeInterface,
            init: init
        };
    });
})();