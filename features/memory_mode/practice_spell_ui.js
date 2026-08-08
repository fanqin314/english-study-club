(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('PracticeSpellUI', ['GlobalManager'], function(GlobalManager) {

        function showSpellingPracticeInterface(container) {
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
            const _cleanupFns = [];

            const spellHeader = document.createElement('div');
            spellHeader.className = 'fill-header';
            spellHeader.innerHTML = `
                <button class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                <h3>听写练习</h3>
                <span class="fill-score-badge" id="spellScoreBadge">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span id="spellScoreNum">0</span>
                </span>
            `;
            const spellBackBtn = spellHeader.querySelector('.back-btn');
            const spellBackHandler = () => {
                _cleanupFns.forEach(fn => fn());
                _cleanupFns.length = 0;
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
            };
            spellBackBtn.addEventListener('click', spellBackHandler);
            _cleanupFns.push(() => spellBackBtn.removeEventListener('click', spellBackHandler));

            const spellEscHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    spellBackBtn.click();
                }
            };
            document.addEventListener('keydown', spellEscHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', spellEscHandler));

            container.appendChild(spellHeader);

            const spellModeBar = document.createElement('div');
            spellModeBar.className = 'spell-mode-bar';
            spellModeBar.innerHTML = `
                <button class="spell-mode-btn active" data-mode="en">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    听英文写英文
                </button>
                <button class="spell-mode-btn" data-mode="cn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    听中文写英文
                </button>
            `;
            let spellMode = 'en';
            spellModeBar.querySelectorAll('.spell-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (_spellRated) return;
                    spellModeBar.querySelectorAll('.spell-mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    spellMode = btn.dataset.mode;
                    const word = words[spellCurrentIndex];
                    renderSpellWord(spellCurrentIndex);
                });
            });

            const spellBottom = document.createElement('div');
            spellBottom.className = 'fill-bottom';
            spellBottom.innerHTML = `
                <button class="fill-hint-btn" id="spellHintBtn" title="逐字母提示（-3分/个）">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1010 10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="8" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="16"/><line x1="8" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="16" y2="12"/></svg>
                </button>
                <button class="fill-hint-btn" id="spellSpeedToggle" title="语速切换">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                </button>
                <button class="fill-skip-btn" id="spellSkipBtn">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                </button>
            `;
            spellBottom.querySelector('#spellHintBtn').onclick = doSpellHint;
            spellBottom.querySelector('#spellSpeedToggle').onclick = () => {
                spellIsSlow = !spellIsSlow;
                const btn = document.getElementById('spellSpeedToggle');
                if (btn) btn.classList.toggle('slow', spellIsSlow);
            };
            spellBottom.querySelector('#spellSkipBtn').onclick = doSpellSkip;

            container.appendChild(spellModeBar);

            const spellCard = document.createElement('div');
            spellCard.className = 'fill-card';
            spellCard.id = 'spellPracticeCard';

            const spellSyllable = document.createElement('div');
            spellSyllable.className = 'spell-syllable';
            spellSyllable.id = 'spellSyllable';
            spellCard.appendChild(spellSyllable);

            const spellPlayBtn = document.createElement('button');
            spellPlayBtn.className = 'spell-play-btn';
            spellPlayBtn.id = 'spellPlayBtn';
            spellPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
            spellPlayBtn.onclick = () => { spellSpeakCurrentWord(); };
            spellCard.appendChild(spellPlayBtn);

            const spellWaveBars = document.createElement('div');
            spellWaveBars.className = 'spell-wave-bars';
            spellWaveBars.id = 'spellWaveBars';
            spellWaveBars.innerHTML = '<span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span>';
            spellCard.appendChild(spellWaveBars);

            const spellLetterGrid = document.createElement('div');
            spellLetterGrid.className = 'spell-letter-grid';
            spellLetterGrid.id = 'spellLetterGrid';
            spellCard.appendChild(spellLetterGrid);

            const spellHiddenInput = document.createElement('input');
            spellHiddenInput.type = 'text';
            spellHiddenInput.className = 'spell-hidden-input';
            spellHiddenInput.id = 'spellHiddenInput';
            spellHiddenInput.autocomplete = 'off';
            spellHiddenInput.spellcheck = false;
            spellHiddenInput.maxLength = 30;
            spellHiddenInput.addEventListener('input', onSpellInput);
            spellHiddenInput.addEventListener('compositionend', () => {
                const val = normalizeInput(spellHiddenInput.value);
                spellHiddenInput.value = val;
                updateLetterBoxes(val);
            });
            spellHiddenInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    doSpellCheck();
                } else if (e.key === 'Backspace') {
                    const val = e.target.value;
                    if (val.length > 0) {
                        e.target.value = val.slice(0, -1);
                        updateLetterBoxes(e.target.value);
                    }
                    e.preventDefault();
                }
            });
            const spellCardClickHandler = (e) => {
                if (e.target.closest('.spell-play-btn')) return;
                spellHiddenInput.focus();
            };
            spellCard.addEventListener('click', spellCardClickHandler);
            _cleanupFns.push(() => spellCard.removeEventListener('click', spellCardClickHandler));
            spellCard.appendChild(spellHiddenInput);

            const spellResult = document.createElement('div');
            spellResult.className = 'fill-result';
            spellResult.id = 'spellPracticeResult';
            spellCard.appendChild(spellResult);

            const spellStreak = document.createElement('div');
            spellStreak.className = 'fill-streak';
            spellStreak.id = 'spellStreak';
            spellCard.appendChild(spellStreak);

            const spellCheckBtn = document.createElement('button');
            spellCheckBtn.className = 'fill-check-btn fill-check-btn-inline btn-check';
            spellCheckBtn.id = 'spellCheckBtn';
            spellCheckBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 检查`;
            spellCheckBtn.addEventListener('click', doSpellCheck);
            spellCard.appendChild(spellCheckBtn);

            container.appendChild(spellCard);
            spellCard.appendChild(spellBottom);

            const spellProgressWrap = document.createElement('div');
            spellProgressWrap.className = 'fill-progress-wrap';
            spellProgressWrap.innerHTML = `
                <div class="fill-progress-track" id="spellProgressTrack">
                    <div class="fill-progress-fill" id="spellProgressFill" style="width:0%"></div>
                </div>
                <span class="fill-progress-text" id="spellPracticeIndex">已掌握 0 / ${words.length}</span>`;
            container.appendChild(spellProgressWrap);

            let spellCurrentIndex = 0;
            let spellAnswered = new Set();
            let spellSkipped = new Set();
            let spellRevealedLetters = new Map();
            let spellStreakCount = 0;
            let spellMaxStreak = 0;
            let spellIsSlow = false;
            let _spellRated = false;
            let spellScore = 0;
            let spellWordStartTime = 0;
            let spellMinTime = Infinity;
            let spellTotalWords = words.length;

            function splitSyllables(word) {
                const low = word.toLowerCase();
                const parts = low.split(/([aeiou]+[^aeiou]*)/g).filter(Boolean);
                if (parts.length <= 1) return [low];
                const result = [];
                let chunk = '';
                for (const p of parts) {
                    chunk += p;
                    if (/[aeiou]/.test(p)) {
                        result.push(chunk);
                        chunk = '';
                    }
                }
                if (chunk) {
                    if (result.length > 0) result[result.length - 1] += chunk;
                    else result.push(chunk);
                }
                return result.length > 0 ? result : [low];
            }

            function updateSpellScore() {
                const scoreEl = document.getElementById('spellScoreNum');
                if (scoreEl) scoreEl.textContent = spellScore;
                const badge = document.getElementById('spellScoreBadge');
                if (badge) {
                    badge.classList.remove('score-pop');
                    void badge.offsetWidth;
                    badge.classList.add('score-pop');
                }
            }

            function updateSpellProgress() {
                const fillEl = document.getElementById('spellProgressFill');
                const idxEl = document.getElementById('spellPracticeIndex');
                const totalDone = spellAnswered.size + spellSkipped.size;
                if (fillEl) fillEl.style.width = (totalDone / spellTotalWords * 100) + '%';
                if (idxEl) idxEl.textContent = '已掌握 ' + spellAnswered.size + ' / ' + spellTotalWords;
            }

            function triggerStreakMilestone(count) {
                const card = document.getElementById('spellPracticeCard');
                if (!card) return;
                if (count === 5) {
                    card.classList.add('streak-milestone');
                    setTimeout(() => card.classList.remove('streak-milestone'), 1500);
                } else if (count >= 10) {
                    card.classList.add('streak-super');
                    setTimeout(() => card.classList.remove('streak-super'), 2000);
                }
            }

            function updateSpellStreak() {
                const streakEl = document.getElementById('spellStreak');
                if (!streakEl) return;
                if (spellStreakCount >= 10) {
                    streakEl.innerHTML = `<span class="streak-fire-super">🌟🔥🌟 超级连击 ${spellStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                    triggerStreakMilestone(spellStreakCount);
                } else if (spellStreakCount >= 5) {
                    streakEl.innerHTML = `<span class="streak-fire-big">🔥🔥 连对 ${spellStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                    triggerStreakMilestone(spellStreakCount);
                } else if (spellStreakCount >= 3) {
                    streakEl.innerHTML = `<span class="streak-fire">🔥 连对 ${spellStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                } else {
                    streakEl.innerHTML = '';
                    streakEl.classList.remove('active');
                }
            }

            function spellSpeakCurrentWord() {
                const word = words[spellCurrentIndex];
                speakWordFn(word);
            }

            function speakWordFn(word) {
                if (spellMode === 'cn' && word.meaning) {
                    if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(word.meaning);
                        utterance.lang = 'zh-CN';
                        utterance.rate = spellIsSlow ? 0.7 : 1.0;
                        startSpellWaveAnimation();
                        utterance.onend = () => { stopSpellWaveAnimation(); };
                        window.speechSynthesis.speak(utterance);
                    }
                    return;
                }
                const syllables = splitSyllables(word.word);
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(word.word);
                    utterance.lang = 'en-US';
                    utterance.rate = spellIsSlow ? 0.55 : 0.85;

                    let sylIdx = 0;
                    const totalTime = (word.word.length * (spellIsSlow ? 200 : 120));
                    const sylInterval = setInterval(() => {
                        if (sylIdx < syllables.length) {
                            highlightSyllable(sylIdx);
                            sylIdx++;
                        } else {
                            clearInterval(sylInterval);
                            setTimeout(() => clearSyllableHighlight(), 200);
                        }
                    }, syllables.length > 0 ? totalTime / syllables.length : totalTime);
                    startSpellWaveAnimation();
                    utterance.onend = () => {
                        clearInterval(sylInterval);
                        clearSyllableHighlight();
                        stopSpellWaveAnimation();
                    };
                    window.speechSynthesis.speak(utterance);
                }
            }

            let _spellWaveInterval = null;

            function startSpellWaveAnimation() {
                stopSpellWaveAnimation();
                const bars = document.querySelectorAll('#spellWaveBars .wave-bar');
                bars.forEach(b => b.classList.add('animating'));
                _spellWaveInterval = setInterval(() => {
                    bars.forEach(b => {
                        b.style.height = (8 + Math.random() * 24) + 'px';
                    });
                }, 150);
            }

            function stopSpellWaveAnimation() {
                if (_spellWaveInterval) clearInterval(_spellWaveInterval);
                _spellWaveInterval = null;
                const bars = document.querySelectorAll('#spellWaveBars .wave-bar');
                bars.forEach(b => {
                    b.classList.remove('animating');
                    b.style.height = '8px';
                });
            }

            function highlightSyllable(idx) {
                const el = document.getElementById('spellSyllable');
                if (!el) return;
                const spans = el.querySelectorAll('span');
                spans.forEach((s, i) => {
                    s.classList.toggle('active', i === idx);
                });
            }

            function clearSyllableHighlight() {
                const el = document.getElementById('spellSyllable');
                if (!el) return;
                el.querySelectorAll('span').forEach(s => s.classList.remove('active'));
            }

            function buildLetterGrid(wordStr) {
                const grid = document.getElementById('spellLetterGrid');
                if (!grid) return;
                grid.innerHTML = '';
                for (let i = 0; i < wordStr.length; i++) {
                    const box = document.createElement('span');
                    box.className = 'letter-box';
                    box.dataset.index = i;
                    box.textContent = '';
                    box.addEventListener('click', () => {
                        document.getElementById('spellHiddenInput').focus();
                    });
                    grid.appendChild(box);
                }
            }

            function buildSyllableDisplay(wordStr) {
                const el = document.getElementById('spellSyllable');
                if (!el) return;
                const syllables = splitSyllables(wordStr);
                el.innerHTML = syllables.map((s, i) =>
                    `<span class="syllable-part${i === 0 ? ' first' : ''}">${s}<span class="syllable-dot">·</span></span>`
                ).join('');
                const lastDot = el.querySelector('.syllable-part:last-child .syllable-dot');
                if (lastDot) lastDot.style.display = 'none';
            }

            function updateLetterBoxes(text) {
                const boxes = document.querySelectorAll('#spellLetterGrid .letter-box');
                boxes.forEach((box, i) => {
                    box.textContent = text[i] || '';
                    box.classList.toggle('filled', !!text[i]);
                });
            }

            function normalizeInput(val) {
                return val
                    .replace(/[\uFF41-\uFF5A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
                    .replace(/[\uFF21-\uFF3A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
                    .replace(/[^a-zA-Z]/g, '');
            }

            function onSpellInput(e) {
                if (e.isComposing) return;
                const val = normalizeInput(e.target.value);
                e.target.value = val;
                updateLetterBoxes(val);
            }

            function renderSpellWord(idx) {
                spellCurrentIndex = idx;
                _spellRated = false;
                spellWordStartTime = performance.now();
                const word = words[idx];
                const spellInputEl = document.getElementById('spellHiddenInput');
                const spellResultEl = document.getElementById('spellPracticeResult');
                const spellSyllableEl = document.getElementById('spellSyllable');
                const spellCardEl = document.getElementById('spellPracticeCard');

                if (spellInputEl) {
                    spellInputEl.value = '';
                    spellInputEl.disabled = false;
                    spellInputEl.focus();
                }
                if (spellResultEl) spellResultEl.innerHTML = '';
                if (spellCardEl) {
                    spellCardEl.querySelectorAll('.spell-reveal-btn').forEach(b => b.remove());
                }

                if (spellRevealedLetters.has(idx)) spellRevealedLetters.delete(idx);
                const hintBtnEl = document.getElementById('spellHintBtn');
                if (hintBtnEl) hintBtnEl.disabled = false;

                if (spellMode === 'cn' && spellSyllableEl) {
                    const meaning = word.meaning || '—';
                    spellSyllableEl.innerHTML = `
                        <div class="spell-cue-cn spell-cue-hidden">
                            <span class="spell-cue-label">中文提示</span>
                            <span class="spell-cue-text">${meaning}</span>
                        </div>
                    `;
                    const revealBtn = document.createElement('button');
                    revealBtn.className = 'spell-reveal-btn';
                    revealBtn.dataset.target = 'cn';
                    revealBtn.dataset.tooltip = word.meaning || '';
                    revealBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    `;
                    revealBtn.addEventListener('click', function() {
                        const cue = spellSyllableEl.querySelector('.spell-cue-cn');
                        if (cue) cue.classList.toggle('spell-cue-hidden');
                        const isVisible = cue && !cue.classList.contains('spell-cue-hidden');
                        this.innerHTML = isVisible ? `
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ` : `
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        `;
                    });
                    if (spellSyllableEl.parentNode) {
                        spellSyllableEl.parentNode.insertBefore(revealBtn, spellSyllableEl.nextSibling);
                    }
                } else {
                    buildSyllableDisplay(word.word);
                    if (spellSyllableEl) {
                        spellSyllableEl.classList.add('spell-syllable-hidden');
                        const revealBtn = document.createElement('button');
                        revealBtn.className = 'spell-reveal-btn';
                        revealBtn.dataset.target = 'en';
                        revealBtn.dataset.tooltip = word.word;
                        revealBtn.innerHTML = `
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        `;
                        revealBtn.addEventListener('click', function() {
                            spellSyllableEl.classList.toggle('spell-syllable-hidden');
                            const isVisible = !spellSyllableEl.classList.contains('spell-syllable-hidden');
                            this.innerHTML = isVisible ? `
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ` : `
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            `;
                        });
                        if (spellSyllableEl.parentNode) {
                            spellSyllableEl.parentNode.insertBefore(revealBtn, spellSyllableEl.nextSibling);
                        }
                    }
                }

                buildLetterGrid(word.word);
                setTimeout(() => spellSpeakCurrentWord(), 300);
            }

            function highlightLetterDiff(userAnswer, correctWord) {
                const boxes = document.querySelectorAll('#spellLetterGrid .letter-box');
                const ua = userAnswer.toLowerCase();
                const cw = correctWord.toLowerCase();
                const maxLen = Math.max(ua.length, cw.length);
                boxes.forEach((box, i) => {
                    if (i < ua.length && i < cw.length) {
                        if (ua[i] === cw[i]) {
                            box.classList.add('correct');
                        } else {
                            box.classList.add('wrong');
                        }
                    } else if (i < cw.length) {
                        box.textContent = cw[i];
                        box.classList.add('missing');
                    }
                });
            }

            function doSpellHint() {
                if (_spellRated) return;
                const word = words[spellCurrentIndex];
                const len = word.word.length;
                const hintBtnEl = document.getElementById('spellHintBtn');

                if (!spellRevealedLetters.has(spellCurrentIndex)) {
                    spellRevealedLetters.set(spellCurrentIndex, new Set());
                }
                const revealed = spellRevealedLetters.get(spellCurrentIndex);

                if (revealed.size >= len) {
                    if (hintBtnEl) hintBtnEl.disabled = true;
                    return;
                }

                const round = revealed.size;
                let pos;
                if (round % 2 === 0) {
                    pos = Math.floor(round / 2);
                } else {
                    pos = len - 1 - Math.floor(round / 2);
                }

                if (revealed.has(pos)) {
                    for (let i = 0; i < len; i++) {
                        if (!revealed.has(i)) { pos = i; break; }
                    }
                }

                revealed.add(pos);

                const spellInputEl = document.getElementById('spellHiddenInput');
                if (spellInputEl) {
                    let curVal = spellInputEl.value;
                    if (pos < curVal.length) {
                        curVal = curVal.slice(0, pos) + word.word.charAt(pos) + curVal.slice(pos + 1);
                    } else {
                        while (curVal.length < pos) curVal += ' ';
                        curVal += word.word.charAt(pos);
                    }
                    spellInputEl.value = curVal;
                    updateLetterBoxes(curVal);
                }

                const box = document.querySelector(`#spellLetterGrid .letter-box[data-index="${pos}"]`);
                if (box) {
                    box.style.transition = 'none';
                    box.style.transform = 'scale(0.3) rotateX(90deg)';
                    box.style.opacity = '0';
                    requestAnimationFrame(() => {
                        box.style.transition = 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        box.style.transform = 'scale(1) rotateX(0deg)';
                        box.style.opacity = '1';
                    });
                }

                spellScore = Math.max(0, spellScore - 3);
                updateSpellScore();

                if (revealed.size >= len) {
                    if (hintBtnEl) hintBtnEl.disabled = true;
                }
            }

            function doSpellSkip() {
                if (_spellRated) return;
                const spellInputEl = document.getElementById('spellHiddenInput');
                const spellResultEl = document.getElementById('spellPracticeResult');
                if (!spellInputEl || !spellResultEl) return;

                const word = words[spellCurrentIndex];
                _spellRated = true;
                spellInputEl.disabled = true;

                spellStreakCount = 0;
                updateSpellStreak();

                const modeHint = spellMode === 'cn' ? ` [中文：${word.meaning}]` : '';
                spellResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.word}</strong> · ${word.meaning}${modeHint}</span>`;
                spellResultEl.className = 'fill-result fill-result-wrong';

                updateLetterBoxes(word.word);
                const boxes = document.querySelectorAll('#spellLetterGrid .letter-box');
                boxes.forEach(b => b.classList.add('missing'));

                spellSkipped.add(spellCurrentIndex);
                updateSpellScore();
                updateSpellProgress();

                const totalDone = spellAnswered.size + spellSkipped.size;
                if (totalDone >= spellTotalWords) {
                    setTimeout(() => showSpellSummary(), 600);
                } else {
                    setTimeout(() => renderSpellWord(spellCurrentIndex + 1), 800);
                }
            }

            function doSpellCheck() {
                if (_spellRated) return;
                const spellInputEl = document.getElementById('spellHiddenInput');
                const spellResultEl = document.getElementById('spellPracticeResult');
                if (!spellInputEl || !spellResultEl) return;

                const word = words[spellCurrentIndex];
                const userAnswer = spellInputEl.value.trim().toLowerCase();
                const correctWord = word.word.toLowerCase();
                _spellRated = true;
                spellInputEl.disabled = true;

                if (userAnswer === correctWord) {
                    spellStreakCount++;
                    if (spellStreakCount > spellMaxStreak) spellMaxStreak = spellStreakCount;

                    const elapsed = (performance.now() - spellWordStartTime) / 1000;
                    if (elapsed < spellMinTime) spellMinTime = elapsed;

                    const baseTime = word.word.length * 0.8;
                    let speedBonus = 1;
                    if (elapsed < baseTime) speedBonus = 5;
                    else if (elapsed < baseTime * 1.5) speedBonus = 3;

                    let comboBonus = 0;
                    if (spellStreakCount >= 20) comboBonus = 10;
                    else if (spellStreakCount >= 10) comboBonus = 5;
                    else if (spellStreakCount >= 5) comboBonus = 3;
                    else if (spellStreakCount >= 3) comboBonus = 2;

                    const totalEarned = 10 + speedBonus + comboBonus;
                    spellScore += totalEarned;

                    let resultHtml = '<span class="fill-correct">✓ 正确！+10';
                    if (speedBonus > 1) resultHtml += ' 速度+' + speedBonus;
                    if (comboBonus > 0) resultHtml += ' 连击+' + comboBonus;
                    resultHtml += ` = ${totalEarned}分 <small>(${word.meaning})</small></span>`;

                    spellResultEl.innerHTML = resultHtml;
                    spellResultEl.className = 'fill-result fill-result-correct';

                    spellAnswered.add(spellCurrentIndex);
                    updateSpellScore();
                    updateSpellStreak();
                    updateSpellProgress();

                    updateLetterBoxes(word.word);
                    const boxes = document.querySelectorAll('#spellLetterGrid .letter-box');
                    boxes.forEach(b => b.classList.add('correct'));

                    const confettiIntensity = spellStreakCount >= 10 ? 'super' : 'normal';
                    triggerConfetti(document.getElementById('spellLetterGrid'), confettiIntensity);

                    if (spellAnswered.size + spellSkipped.size >= spellTotalWords) {
                        setTimeout(() => showSpellSummary(), 600);
                    } else {
                        setTimeout(() => renderSpellWord(spellCurrentIndex + 1), 800);
                    }
                } else {
                    spellStreakCount = 0;
                    updateSpellStreak();
                    const modeHint = spellMode === 'cn' ? ` [中文：${word.meaning}]` : '';
                    spellResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.word}</strong> · ${word.meaning}${modeHint}</span>`;
                    spellResultEl.className = 'fill-result fill-result-wrong';
                    highlightLetterDiff(userAnswer, correctWord);

                    // 将检查按钮改为重来按钮
                    const checkBtn = document.getElementById('spellCheckBtn');
                    if (checkBtn) {
                        checkBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 重来`;
                        checkBtn.onclick = (e) => {
                            e.stopPropagation();
                            _spellRated = false;
                            if (spellInputEl) spellInputEl.disabled = false;
                            renderSpellWord(spellCurrentIndex);
                        };
                    }
                }
            }

            function showSpellSummary() {
                const spellCardEl = document.getElementById('spellPracticeCard');
                const spellCheckBtnEl = document.getElementById('spellCheckBtn');
                if (spellCheckBtnEl) spellCheckBtnEl.style.display = 'none';
                const spellBottomEl = document.querySelector('.fill-bottom');
                if (spellBottomEl) spellBottomEl.style.display = 'none';

                const total = spellTotalWords;
                const correct = spellAnswered.size;
                const wrong = total - correct - spellSkipped.size;
                const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
                const maxStreak = spellMaxStreak;
                const minTime = spellMinTime < Infinity ? spellMinTime.toFixed(1) + 's' : '—';

                if (window.StatsTracker) {
                    window.StatsTracker.recordWordsLearned(correct);
                    window.StatsTracker.recordModuleActivity('spelling', correct, window.VocabData ? window.VocabData.getCurrentNotebookId() : null);
                }

                const modeLabel = spellMode === 'cn' ? '听中文模式' : '听英文模式';

                let title = '听写练习完成！';
                if (rate >= 90) title = '拼写大师！🏆';
                else if (rate >= 70) title = '做得很棒！🌟';
                else if (rate >= 50) title = '继续加油！👍';

                if (spellCardEl) {
                    spellCardEl.innerHTML = `
                        <div class="fill-summary">
                            <div class="fill-summary-icon">
                                <div class="trophy-star">
                                    <div class="star-eight"></div>
                                </div>
                                <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="#e94822">
                                    <path d="M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z"/>
                                </svg>
                            </div>
                            <div class="fill-summary-title">${title}</div>
                            <div class="fill-summary-mode">${modeLabel}</div>
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
                                    <span class="fill-summary-val streak">${maxStreak}</span>
                                    <span class="fill-summary-lbl">最高连击</span>
                                </div>
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val" style="color:#22c55e">${minTime}</span>
                                    <span class="fill-summary-lbl">最快用时</span>
                                </div>
                                <div class="fill-summary-stat">
                                    <span class="fill-summary-val score">${spellScore}</span>
                                    <span class="fill-summary-lbl">得分</span>
                                </div>
                            </div>
                            <button class="summary-retry-btn">再来一轮</button>
                        </div>
                    `;

                    const retryBtn = spellCardEl.querySelector('.summary-retry-btn');
                    if (retryBtn) {
                        const spellRetryHandler = () => {
                            _cleanupFns.forEach(fn => fn());
                            _cleanupFns.length = 0;

                            // 重新注册返回按钮和ESC键
                            spellBackBtn.addEventListener('click', spellBackHandler);
                            _cleanupFns.push(() => spellBackBtn.removeEventListener('click', spellBackHandler));
                            document.addEventListener('keydown', spellEscHandler);
                            _cleanupFns.push(() => document.removeEventListener('keydown', spellEscHandler));

                            spellCardEl.innerHTML = '';

                            const spellSyllable = document.createElement('div');
                            spellSyllable.className = 'spell-syllable';
                            spellSyllable.id = 'spellSyllable';
                            spellCardEl.appendChild(spellSyllable);

                            const spellPlayBtn = document.createElement('button');
                            spellPlayBtn.className = 'spell-play-btn';
                            spellPlayBtn.id = 'spellPlayBtn';
                            spellPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
                            spellPlayBtn.onclick = () => { spellSpeakCurrentWord(); };
                            spellCardEl.appendChild(spellPlayBtn);

                            const spellWaveBars = document.createElement('div');
                            spellWaveBars.className = 'spell-wave-bars';
                            spellWaveBars.id = 'spellWaveBars';
                            spellWaveBars.innerHTML = '<span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span>';
                            spellCardEl.appendChild(spellWaveBars);

                            const spellLetterGrid = document.createElement('div');
                            spellLetterGrid.className = 'spell-letter-grid';
                            spellLetterGrid.id = 'spellLetterGrid';
                            spellCardEl.appendChild(spellLetterGrid);

                            const spellHiddenInput = document.createElement('input');
                            spellHiddenInput.type = 'text';
                            spellHiddenInput.className = 'spell-hidden-input';
                            spellHiddenInput.id = 'spellHiddenInput';
                            spellHiddenInput.autocomplete = 'off';
                            spellHiddenInput.spellcheck = false;
                            spellHiddenInput.maxLength = 30;
                            spellHiddenInput.addEventListener('input', onSpellInput);
                            spellHiddenInput.addEventListener('compositionend', () => {
                                const val = normalizeInput(spellHiddenInput.value);
                                spellHiddenInput.value = val;
                                updateLetterBoxes(val);
                            });
                            spellHiddenInput.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') doSpellCheck();
                                else if (e.key === 'Backspace') {
                                    const val = e.target.value;
                                    if (val.length > 0) {
                                        e.target.value = val.slice(0, -1);
                                        updateLetterBoxes(e.target.value);
                                    }
                                    e.preventDefault();
                                }
                            });
                            spellCardEl.addEventListener('click', (e) => {
                                if (e.target.closest('.spell-play-btn')) return;
                                spellHiddenInput.focus();
                            });
                            spellCardEl.appendChild(spellHiddenInput);

                            const spellResult = document.createElement('div');
                            spellResult.className = 'fill-result';
                            spellResult.id = 'spellPracticeResult';
                            spellCardEl.appendChild(spellResult);

                            const spellStreak = document.createElement('div');
                            spellStreak.className = 'fill-streak';
                            spellStreak.id = 'spellStreak';
                            spellCardEl.appendChild(spellStreak);

                            // 重建检查按钮
                            const retryCheckBtn = document.createElement('button');
                            retryCheckBtn.className = 'fill-check-btn fill-check-btn-inline btn-check';
                            retryCheckBtn.id = 'spellCheckBtn';
                            retryCheckBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 检查`;
                            retryCheckBtn.addEventListener('click', doSpellCheck);
                            spellCardEl.appendChild(retryCheckBtn);

                            // 重建底部按钮栏
                            const retrySpellBottom = document.createElement('div');
                            retrySpellBottom.className = 'fill-bottom';
                            retrySpellBottom.innerHTML = `
                                <button class="fill-hint-btn" id="spellHintBtn" title="逐字母提示（-3分/个）">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1010 10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="8" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="16"/><line x1="8" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="16" y2="12"/></svg>
                                </button>
                                <button class="fill-hint-btn" id="spellSpeedToggle" title="语速切换">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </button>
                                <button class="fill-skip-btn" id="spellSkipBtn">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                                </button>
                            `;
                            retrySpellBottom.querySelector('#spellHintBtn').onclick = doSpellHint;
                            retrySpellBottom.querySelector('#spellSpeedToggle').onclick = () => {
                                spellIsSlow = !spellIsSlow;
                                const btn = document.getElementById('spellSpeedToggle');
                                if (btn) btn.classList.toggle('slow', spellIsSlow);
                            };
                            retrySpellBottom.querySelector('#spellSkipBtn').onclick = doSpellSkip;
                            spellCardEl.appendChild(retrySpellBottom);

                            spellCurrentIndex = 0;
                            spellAnswered = new Set();
                            spellSkipped = new Set();
                            spellStreakCount = 0;
                            spellMaxStreak = 0;
                            _spellRated = false;
                            spellScore = 0;
                            spellMinTime = Infinity;

                            const checkBtn = document.getElementById('spellCheckBtn');
                            if (checkBtn) checkBtn.style.display = '';

                            updateSpellScore();
                            updateSpellStreak();
                            updateSpellProgress();
                            renderSpellWord(0);
                        };
                        retryBtn.addEventListener('click', spellRetryHandler);
                        _cleanupFns.push(() => retryBtn.removeEventListener('click', spellRetryHandler));
                    }
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

            updateSpellScore();
            updateSpellProgress();
            renderSpellWord(0);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showSpellingPracticeInterface,
            init: init
        };
    });
})();