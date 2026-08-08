(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('PracticeFillUI', ['GlobalManager'], function(GlobalManager) {

        function showFillPracticeInterface(container) {
            const vocabData = _getVocabData();
            const notebook = vocabData ? vocabData.getCurrentNotebook() : null;
            const words = (notebook && notebook.words && notebook.words.length > 0) ? [...notebook.words] : [];

            if (words.length === 0) {
                _showToast('当前生词本没有单词');
                return;
            }

            for (let i = words.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [words[i], words[j]] = [words[j], words[i]];
            }

            const appHeader = document.getElementById('app-header');
            const cardHeader = document.querySelector('.card-header');
            const cardBody = document.querySelector('.card-body');
            if (appHeader) appHeader.style.display = 'none';
            if (cardHeader) cardHeader.style.display = 'none';
            if (cardBody) cardBody.style.display = 'none';

            container.innerHTML = '';

            const _cleanupFns = [];

            const fillHeader = document.createElement('div');
            fillHeader.className = 'fill-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            const onBackClick = (e) => {
                e.stopPropagation();
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
            };
            backBtn.addEventListener('click', onBackClick);
            _cleanupFns.push(() => backBtn.removeEventListener('click', onBackClick));
            fillHeader.appendChild(backBtn);

            const fillTitle = document.createElement('h3');
            fillTitle.textContent = `填空练习`;
            fillHeader.appendChild(fillTitle);

            const fillScoreBadge = document.createElement('span');
            fillScoreBadge.className = 'fill-score-badge';
            fillScoreBadge.id = 'fillScoreBadge';
            fillScoreBadge.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> <span id="fillScoreNum">0</span>`;
            fillHeader.appendChild(fillScoreBadge);

            container.appendChild(fillHeader);

            const fillBottom = document.createElement('div');
            fillBottom.className = 'fill-bottom';

            const hintBtn = document.createElement('button');
            hintBtn.className = 'fill-hint-btn';
            hintBtn.id = 'fillHintBtn';
            hintBtn.title = '逐字母提示（-3分/个）';
            hintBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1010 10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="8" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="16"/><line x1="8" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="16" y2="12"/></svg>';
            const onHintClick = (e) => {
                e.stopPropagation();
                revealNextLetter();
            };
            hintBtn.addEventListener('click', onHintClick);
            _cleanupFns.push(() => hintBtn.removeEventListener('click', onHintClick));
            fillBottom.appendChild(hintBtn);

            const skipBtn = document.createElement('button');
            skipBtn.className = 'fill-skip-btn';
            skipBtn.title = '跳过';
            skipBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`;
            const onSkipClick = (e) => {
                e.stopPropagation();
                doFillSkip();
            };
            skipBtn.addEventListener('click', onSkipClick);
            _cleanupFns.push(() => skipBtn.removeEventListener('click', onSkipClick));
            fillBottom.appendChild(skipBtn);

            const fillCard = document.createElement('div');
            fillCard.className = 'fill-card';
            fillCard.id = 'fillPracticeCard';

            const fillMeaning = document.createElement('div');
            fillMeaning.className = 'fill-meaning';
            fillMeaning.id = 'fillPracticeMeaning';
            fillCard.appendChild(fillMeaning);

            const fillSentence = document.createElement('div');
            fillSentence.className = 'fill-sentence';
            fillSentence.id = 'fillPracticeSentence';
            fillCard.appendChild(fillSentence);

            const fillLetterHint = document.createElement('div');
            fillLetterHint.className = 'fill-letter-hint';
            fillLetterHint.id = 'fillLetterHint';
            fillCard.appendChild(fillLetterHint);

            const fillLetterGrid = document.createElement('div');
            fillLetterGrid.className = 'fill-letter-grid';
            fillLetterGrid.id = 'fillLetterGrid';
            fillCard.appendChild(fillLetterGrid);

            const fillCheckBtn = document.createElement('button');
            fillCheckBtn.className = 'fill-check-btn fill-check-btn-inline btn-check';
            fillCheckBtn.id = 'fillCheckBtn';
            fillCheckBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 检查`;
            fillCheckBtn.onclick = doFillCheck;
            fillCard.appendChild(fillCheckBtn);

            const fillHiddenInput = document.createElement('input');
            fillHiddenInput.type = 'text';
            fillHiddenInput.className = 'fill-hidden-input';
            fillHiddenInput.id = 'fillHiddenInput';
            fillHiddenInput.autocomplete = 'off';
            fillHiddenInput.spellcheck = false;
            fillHiddenInput.maxLength = 50;
            fillHiddenInput.addEventListener('keydown', onFillKeydown);
            fillHiddenInput.addEventListener('compositionend', () => {
                const raw = normalizeInput(fillHiddenInput.value);
                fillHiddenInput.value = '';
                for (let i = 0; i < raw.length && fillActiveSlot + i < fillSlotChars.length; i++) {
                    fillSlotChars[fillActiveSlot + i] = raw[i];
                }
                fillActiveSlot = Math.min(fillActiveSlot + raw.length, fillSlotChars.length - 1);
                updateFillLetterBoxes();
                updateAllBoxHighlights();
            });

            const onFillCardClick = (e) => {
                if (e.target.closest('.fill-hint-btn')) return;
                e.stopPropagation();
                fillHiddenInput.focus();
            };
            fillCard.addEventListener('click', onFillCardClick);
            _cleanupFns.push(() => fillCard.removeEventListener('click', onFillCardClick));
            fillCard.appendChild(fillHiddenInput);

            const fillResult = document.createElement('div');
            fillResult.className = 'fill-result';
            fillResult.id = 'fillPracticeResult';
            fillCard.appendChild(fillResult);

            const fillStreak = document.createElement('div');
            fillStreak.className = 'fill-streak';
            fillStreak.id = 'fillStreak';
            fillCard.appendChild(fillStreak);

            container.appendChild(fillCard);
            fillCard.appendChild(fillBottom);

            const fillProgressWrap = document.createElement('div');
            fillProgressWrap.className = 'fill-progress-wrap';
            fillProgressWrap.innerHTML = `
                <div class="fill-progress-track" id="fillProgressTrack">
                    <div class="fill-progress-fill" id="fillProgressFill" style="width:0%"></div>
                </div>
                <span class="fill-progress-text" id="fillPracticeIndex">已攻克 0 / ${words.length}</span>
            `;
            container.appendChild(fillProgressWrap);

            let fillCurrentIndex = 0;
            let fillAnswered = new Set();
            let fillStreakCount = 0;
            let fillScore = 0;
            let fillRevealedLetters = new Map();
            let fillCheckDisabled = false;
            let fillSlotChars = [];
            let fillActiveSlot = 0;
            let fillTotalWords = words.length;
            let fillRetryQueue = [];
            let fillSkipped = new Set();
            let fillMaxStreak = 0;
            let fillTotalWrongAttempts = 0;

            const fillEscHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    backBtn.click();
                }
            };
            document.addEventListener('keydown', fillEscHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', fillEscHandler));

            function updateFillScore() {
                const scoreEl = document.getElementById('fillScoreNum');
                if (scoreEl) scoreEl.textContent = fillScore;
                const badge = document.getElementById('fillScoreBadge');
                if (badge) {
                    badge.classList.remove('score-pop');
                    void badge.offsetWidth;
                    badge.classList.add('score-pop');
                }
            }

            function updateFillStreak() {
                const streakEl = document.getElementById('fillStreak');
                if (!streakEl) return;
                if (fillStreakCount >= 10) {
                    streakEl.innerHTML = `<span class="streak-fire-super">🌟🔥🌟 超级连击 ${fillStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                    triggerStreakMilestone(fillStreakCount);
                } else if (fillStreakCount >= 5) {
                    streakEl.innerHTML = `<span class="streak-fire-big">🔥🔥 连对 ${fillStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                    triggerStreakMilestone(fillStreakCount);
                } else if (fillStreakCount >= 3) {
                    streakEl.innerHTML = `<span class="streak-fire">🔥 连对 ${fillStreakCount} 次！</span>`;
                    streakEl.classList.add('active');
                } else {
                    streakEl.innerHTML = '';
                    streakEl.classList.remove('active');
                }
            }

            function triggerStreakMilestone(count) {
                const card = document.getElementById('fillPracticeCard');
                if (!card) return;
                if (count === 5) {
                    card.classList.add('streak-milestone');
                    setTimeout(() => card.classList.remove('streak-milestone'), 1500);
                } else if (count >= 10) {
                    card.classList.add('streak-super');
                    setTimeout(() => card.classList.remove('streak-super'), 2000);
                }
            }

            function updateFillProgress() {
                const fillEl = document.getElementById('fillProgressFill');
                const idxEl = document.getElementById('fillPracticeIndex');
                if (fillEl) fillEl.style.width = (fillAnswered.size / fillTotalWords * 100) + '%';
                if (idxEl) idxEl.textContent = '已攻克 ' + fillAnswered.size + ' / ' + fillTotalWords;
            }

            function renderFillLetterHint(word, revealedSet) {
                const hintEl = document.getElementById('fillLetterHint');
                if (!hintEl) return;
                const len = word.word.length;
                let html = '';
                for (let i = 0; i < len; i++) {
                    if (revealedSet && revealedSet.has(i)) {
                        html += '<span class="fill-letter-box revealed">' + word.word.charAt(i) + '</span>';
                    } else {
                        html += '<span class="fill-letter-box">_</span>';
                    }
                }
                hintEl.innerHTML = html;
                hintEl.classList.add('show');
            }

            function buildFillLetterGrid(wordStr) {
                const grid = document.getElementById('fillLetterGrid');
                if (!grid) return;
                grid.innerHTML = '';
                fillSlotChars = new Array(wordStr.length).fill('');
                fillActiveSlot = 0;
                for (let i = 0; i < wordStr.length; i++) {
                    const box = document.createElement('span');
                    box.className = 'letter-box';
                    box.dataset.index = i;
                    box.textContent = '';
                    box.addEventListener('click', () => {
                        fillActiveSlot = i;
                        updateAllBoxHighlights();
                        const hi = document.getElementById('fillHiddenInput');
                        if (hi) hi.focus();
                    });
                    grid.appendChild(box);
                }
            }

            function updateFillLetterBoxes() {
                const boxes = document.querySelectorAll('#fillLetterGrid .letter-box');
                boxes.forEach((box, i) => {
                    const hadContent = !!box.textContent;
                    box.textContent = fillSlotChars[i] || '';
                    box.classList.toggle('filled', !!fillSlotChars[i]);
                    box.classList.remove('correct', 'wrong');
                    if (fillSlotChars[i] && !hadContent) {
                        box.style.animation = 'none';
                        void box.offsetWidth;
                        box.style.animation = 'fillBoxPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    }
                });
            }

            function updateAllBoxHighlights() {
                const boxes = document.querySelectorAll('#fillLetterGrid .letter-box');
                boxes.forEach((box, i) => {
                    box.classList.toggle('active-slot', i === fillActiveSlot);
                });
            }

            function normalizeInput(val) {
                return val
                    .replace(/[\uFF41-\uFF5A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
                    .replace(/[\uFF21-\uFF3A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
                    .replace(/[^a-zA-Z]/g, '');
            }

            function onFillKeydown(e) {
                if (e.key === 'Enter') {
                    doFillCheck();
                    e.preventDefault();
                    return;
                }
                if (e.key === 'Backspace') {
                    if (fillActiveSlot > 0 && fillSlotChars[fillActiveSlot]) {
                        fillSlotChars[fillActiveSlot] = '';
                        updateFillLetterBoxes();
                        fillActiveSlot--;
                        updateAllBoxHighlights();
                    } else if (fillActiveSlot > 0) {
                        fillActiveSlot--;
                        updateAllBoxHighlights();
                    } else if (fillSlotChars[0]) {
                        fillSlotChars[0] = '';
                        updateFillLetterBoxes();
                    }
                    e.preventDefault();
                    return;
                }
                if (e.key === 'Delete') {
                    if (fillSlotChars[fillActiveSlot]) {
                        fillSlotChars[fillActiveSlot] = '';
                        updateFillLetterBoxes();
                    }
                    e.preventDefault();
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    fillActiveSlot = Math.max(0, fillActiveSlot - 1);
                    updateAllBoxHighlights();
                    e.preventDefault();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    fillActiveSlot = Math.min(fillSlotChars.length - 1, fillActiveSlot + 1);
                    updateAllBoxHighlights();
                    e.preventDefault();
                    return;
                }
                if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                    fillSlotChars[fillActiveSlot] = e.key.toLowerCase();
                    updateFillLetterBoxes();
                    if (fillActiveSlot < fillSlotChars.length - 1) {
                        fillActiveSlot++;
                        updateAllBoxHighlights();
                    }
                    e.preventDefault();
                    return;
                }
            }

            function revealNextLetter() {
                const word = words[fillCurrentIndex];
                const len = word.word.length;
                const hintBtnEl = document.getElementById('fillHintBtn');

                if (!fillRevealedLetters.has(fillCurrentIndex)) {
                    fillRevealedLetters.set(fillCurrentIndex, new Set());
                }
                const revealed = fillRevealedLetters.get(fillCurrentIndex);

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

                fillSlotChars[pos] = word.word.charAt(pos);
                updateFillLetterBoxes();

                renderFillLetterHint(word, revealed);

                const box = document.querySelector(`#fillLetterGrid .letter-box[data-index="${pos}"]`);
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

                fillScore = Math.max(0, fillScore - 3);
                updateFillScore();

                if (hintBtnEl && revealed.size >= len) {
                    hintBtnEl.disabled = true;
                }
            }

            function getNextWord() {
                if (fillRetryQueue.length > 0) {
                    return fillRetryQueue[0];
                }
                for (let i = 0; i < words.length; i++) {
                    const idx = (fillCurrentIndex + i) % words.length;
                    if (idx !== fillCurrentIndex && !fillAnswered.has(idx) && !fillSkipped.has(idx) && !fillRetryQueue.includes(idx)) {
                        return idx;
                    }
                }
                if (fillCurrentIndex !== undefined && !fillAnswered.has(fillCurrentIndex) && !fillRetryQueue.includes(fillCurrentIndex)) {
                    return fillCurrentIndex;
                }
                return 0;
            }

            function renderFillWord(idx) {
                fillCurrentIndex = idx;
                fillCheckDisabled = false;
                const word = words[idx];
                const fillMeaningEl = document.getElementById('fillPracticeMeaning');
                const fillSentenceEl = document.getElementById('fillPracticeSentence');
                const fillResultEl = document.getElementById('fillPracticeResult');
                const fillLetterHintEl = document.getElementById('fillLetterHint');
                const hintBtnEl = document.getElementById('fillHintBtn');
                const hiddenInput = document.getElementById('fillHiddenInput');

                fillRevealedLetters.delete(idx);

                const card = document.getElementById('fillPracticeCard');
                if (card) {
                    card.classList.remove('fill-card-correct', 'fill-card-wrong');
                    card.classList.add('fill-card-enter');
                    requestAnimationFrame(() => card.classList.remove('fill-card-enter'));
                }

                if (fillMeaningEl) {
                    fillMeaningEl.textContent = word.meaning || '(无释义)';
                    fillMeaningEl.classList.remove('enter');
                    void fillMeaningEl.offsetWidth;
                    fillMeaningEl.classList.add('enter');
                }
                if (fillSentenceEl) {
                    if (word.example && word.example.en) {
                        const exampleText = word.example.en;
                        const regex = new RegExp(word.word, 'gi');
                        const highlighted = exampleText.replace(regex, '<span class="fill-blank">______</span>');
                        fillSentenceEl.innerHTML = highlighted;
                    } else {
                        fillSentenceEl.innerHTML = '<span class="fill-no-sentence">（无例句）</span>';
                    }
                }

                buildFillLetterGrid(word.word);
                if (hiddenInput) {
                    hiddenInput.value = '';
                    hiddenInput.focus();
                }
                updateAllBoxHighlights();

                if (fillResultEl) {
                    fillResultEl.innerHTML = '';
                    fillResultEl.className = 'fill-result';
                }
                if (fillLetterHintEl) {
                    fillLetterHintEl.innerHTML = '';
                    fillLetterHintEl.classList.remove('show');
                }
                if (hintBtnEl) hintBtnEl.disabled = false;

                // 恢复检查按钮
                const checkBtnEl = document.getElementById('fillCheckBtn');
                if (checkBtnEl) {
                    checkBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 检查`;
                    checkBtnEl.onclick = doFillCheck;
                }

                updateFillProgress();
            }

            function doFillCheck() {
                const hiddenInput = document.getElementById('fillHiddenInput');
                const fillResultEl = document.getElementById('fillPracticeResult');
                const card = document.getElementById('fillPracticeCard');
                if (!hiddenInput || !fillResultEl) return;
                if (fillCheckDisabled) return;
                fillCheckDisabled = true;

                const word = words[fillCurrentIndex];
                const userAnswer = fillSlotChars.join('').toLowerCase();
                const correctWord = word.word.toLowerCase();

                if (userAnswer === correctWord) {
                    fillStreakCount++;
                    if (fillStreakCount > fillMaxStreak) fillMaxStreak = fillStreakCount;

                    let comboBonus = 0;
                    if (fillStreakCount >= 20) comboBonus = 10;
                    else if (fillStreakCount >= 10) comboBonus = 5;
                    else if (fillStreakCount >= 5) comboBonus = 3;
                    else if (fillStreakCount >= 3) comboBonus = 2;

                    const totalEarned = 10 + comboBonus;
                    fillScore += totalEarned;

                    let resultHtml = '<span class="fill-correct">✓ 正确！+10';
                    if (comboBonus > 0) resultHtml += ' +连击加成' + comboBonus;
                    resultHtml += ' = ' + totalEarned + '分</span>';

                    fillResultEl.innerHTML = resultHtml;
                    fillResultEl.className = 'fill-result fill-result-correct';
                    if (card) card.classList.add('fill-card-correct');

                    if (fillRetryQueue.includes(fillCurrentIndex)) {
                        fillRetryQueue = fillRetryQueue.filter(idx => idx !== fillCurrentIndex);
                    }
                    fillAnswered.add(fillCurrentIndex);

                    updateFillScore();
                    updateFillStreak();
                    updateFillProgress();

                    const boxes = document.querySelectorAll('#fillLetterGrid .letter-box');
                    boxes.forEach((b, i) => {
                        setTimeout(() => b.classList.add('correct'), i * 30);
                    });

                    const confettiIntensity = fillStreakCount >= 10 ? 'super' : 'normal';
                    triggerConfetti(document.getElementById('fillLetterGrid'), confettiIntensity);

                    if (fillAnswered.size >= fillTotalWords && fillRetryQueue.length === 0) {
                        setTimeout(() => showFillSummary(), 600);
                    } else {
                        setTimeout(() => {
                            const next = getNextWord();
                            renderFillWord(next);
                        }, 700);
                    }
                } else {
                    fillTotalWrongAttempts++;
                    fillStreakCount = 0;
                    updateFillStreak();

                    fillResultEl.innerHTML = `<span class="fill-wrong">✗ 正确答案：<strong>${word.word}</strong></span>`;
                    fillResultEl.className = 'fill-result fill-result-wrong';
                    if (card) card.classList.add('fill-card-wrong');
                    const progressWrap = document.querySelector('.fill-progress-wrap');
                    if (progressWrap) {
                        progressWrap.classList.add('shake');
                        setTimeout(() => progressWrap.classList.remove('shake'), 450);
                    }

                    const boxes = document.querySelectorAll('#fillLetterGrid .letter-box');
                    boxes.forEach((box, i) => {
                        const ch = (fillSlotChars[i] || '').toLowerCase();
                        const correct = correctWord[i];
                        setTimeout(() => {
                            if (ch && correct && ch === correct) {
                                box.classList.add('correct');
                            } else {
                                box.classList.add('wrong');
                                box.textContent = correctWord[i];
                            }
                        }, i * 40);
                    });

                    if (!fillRetryQueue.includes(fillCurrentIndex)) {
                        fillRetryQueue.push(fillCurrentIndex);
                    }

                    // 将检查按钮改为重来按钮
                    const checkBtn = document.getElementById('fillCheckBtn');
                    if (checkBtn) {
                        checkBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 重来`;
                        checkBtn.onclick = (e) => {
                            e.stopPropagation();
                            renderFillWord(fillCurrentIndex);
                        };
                    }
                }
            }

            function doFillSkip() {
                const fillResultEl = document.getElementById('fillPracticeResult');
                fillSkipped.add(fillCurrentIndex);
                fillScore = Math.max(0, fillScore - 5);
                fillStreakCount = 0;
                updateFillScore();
                updateFillStreak();

                if (fillResultEl) {
                    fillResultEl.innerHTML = '<span class="fill-skip">⏭ 已跳过 -5分</span>';
                    fillResultEl.className = 'fill-result fill-result-skip';
                }

                if (fillAnswered.size >= fillTotalWords && fillRetryQueue.length === 0) {
                    setTimeout(() => showFillSummary(), 500);
                } else {
                    setTimeout(() => {
                        const next = getNextWord();
                        if (next === fillCurrentIndex && fillSkipped.has(next)) {
                            showFillSummary();
                            return;
                        }
                        renderFillWord(next);
                    }, 400);
                }
            }

            function showFillSummary() {
                const fillCardEl = document.getElementById('fillPracticeCard');
                const fillCheckBtnEl = document.getElementById('fillCheckBtn');

                if (fillCheckBtnEl) fillCheckBtnEl.style.display = 'none';

                const fillBottomEl = document.querySelector('.fill-bottom');
                if (fillBottomEl) fillBottomEl.style.display = 'none';

                const isPerfect = (fillTotalWrongAttempts === 0 && fillSkipped.size === 0);

                if (isPerfect) {
                    fillScore += 20;
                }

                const correct = fillAnswered.size;
                const skipped = fillSkipped.size;
                const wrongAttempts = fillTotalWrongAttempts;
                const rate = fillTotalWords > 0 ? Math.round((correct / fillTotalWords) * 100) : 0;

                if (window.StatsTracker) {
                    window.StatsTracker.recordWordsLearned(correct);
                    window.StatsTracker.recordModuleActivity('fillPractice', correct, window.VocabData ? window.VocabData.getCurrentNotebookId() : null);
                }

                let titleText = '太棒了，完成啦！';
                let titleClass = '';
                if (isPerfect) {
                    titleText = '完美通关！🌟';
                    titleClass = 'perfect';
                } else if (rate >= 90) {
                    titleText = '非常出色！🏆';
                } else if (rate >= 70) {
                    titleText = '做得不错！🌟';
                } else if (rate >= 50) {
                    titleText = '继续加油！👍';
                }

                if (fillCardEl) {
                    fillCardEl.innerHTML = `
                        <div class="fill-summary">
                            <div class="fill-summary-icon">
                                <div class="trophy-star">
                                    <div class="star-eight"></div>
                                </div>
                                <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="${isPerfect ? '#f59e0b' : '#e94822'}">
                                    <path d="M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z"/>
                                </svg>
                            </div>
                            <div class="fill-summary-title ${titleClass}">${titleText}</div>
                            <div class="fill-summary-stats">
                                <div class="fill-summary-stat" style="animation-delay:0.05s">
                                    <span class="fill-summary-val correct">${correct}</span>
                                    <span class="fill-summary-lbl">正确</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.12s">
                                    <span class="fill-summary-val wrong">${wrongAttempts}</span>
                                    <span class="fill-summary-lbl">错误尝试</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.19s">
                                    <span class="fill-summary-val rate">${rate}%</span>
                                    <span class="fill-summary-lbl">正确率</span>
                                </div>
                                <div class="fill-summary-stat" style="animation-delay:0.26s">
                                    <span class="fill-summary-val streak">${fillMaxStreak}</span>
                                    <span class="fill-summary-lbl">最高连击</span>
                                </div>
                                ${skipped > 0 ? `<div class="fill-summary-stat" style="animation-delay:0.33s">
                                    <span class="fill-summary-val skip">${skipped}</span>
                                    <span class="fill-summary-lbl">跳过</span>
                                </div>` : ''}
                                <div class="fill-summary-stat" style="animation-delay:0.40s">
                                    <span class="fill-summary-val score">${fillScore}</span>
                                    <span class="fill-summary-lbl">得分</span>
                                </div>
                            </div>
                            ${isPerfect ? '<div class="fill-perfect-badge">🎉 完美通关！零错误零跳过，奖励 +20分</div>' : ''}
                            <button class="summary-retry-btn">再来一轮</button>
                        </div>
                    `;

                    const retryBtn = fillCardEl.querySelector('.summary-retry-btn');
                    if (retryBtn) {
                        const onRetryClick = (e) => {
                            e.stopPropagation();

                            _cleanupFns.forEach(fn => fn());
                            _cleanupFns.length = 0;

                            // 重新注册返回按钮
                            backBtn.addEventListener('click', onBackClick);
                            _cleanupFns.push(() => backBtn.removeEventListener('click', onBackClick));

                            fillCardEl.innerHTML = '';

                            const fillMeaning = document.createElement('div');
                            fillMeaning.className = 'fill-meaning';
                            fillMeaning.id = 'fillPracticeMeaning';
                            fillCardEl.appendChild(fillMeaning);

                            const fillSentence = document.createElement('div');
                            fillSentence.className = 'fill-sentence';
                            fillSentence.id = 'fillPracticeSentence';
                            fillCardEl.appendChild(fillSentence);

                            const fillLetterHint = document.createElement('div');
                            fillLetterHint.className = 'fill-letter-hint';
                            fillLetterHint.id = 'fillLetterHint';
                            fillCardEl.appendChild(fillLetterHint);

                            const fillLetterGrid = document.createElement('div');
                            fillLetterGrid.className = 'fill-letter-grid';
                            fillLetterGrid.id = 'fillLetterGrid';
                            fillCardEl.appendChild(fillLetterGrid);

                            const retryCheckBtn = document.createElement('button');
                            retryCheckBtn.className = 'fill-check-btn fill-check-btn-inline btn-check';
                            retryCheckBtn.id = 'fillCheckBtn';
                            retryCheckBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 检查`;
                            retryCheckBtn.onclick = doFillCheck;
                            fillCardEl.appendChild(retryCheckBtn);

                            const fillHiddenInput = document.createElement('input');
                            fillHiddenInput.type = 'text';
                            fillHiddenInput.className = 'fill-hidden-input';
                            fillHiddenInput.id = 'fillHiddenInput';
                            fillHiddenInput.autocomplete = 'off';
                            fillHiddenInput.spellcheck = false;
                            fillHiddenInput.maxLength = 50;
                            fillHiddenInput.addEventListener('keydown', onFillKeydown);
                            fillHiddenInput.addEventListener('compositionend', () => {
                                const raw = normalizeInput(fillHiddenInput.value);
                                fillHiddenInput.value = '';
                                for (let i = 0; i < raw.length && fillActiveSlot + i < fillSlotChars.length; i++) {
                                    fillSlotChars[fillActiveSlot + i] = raw[i];
                                }
                                fillActiveSlot = Math.min(fillActiveSlot + raw.length, fillSlotChars.length - 1);
                                updateFillLetterBoxes();
                                updateAllBoxHighlights();
                            });
                            fillCardEl.appendChild(fillHiddenInput);

                            const fillResult = document.createElement('div');
                            fillResult.className = 'fill-result';
                            fillResult.id = 'fillPracticeResult';
                            fillCardEl.appendChild(fillResult);

                            const fillStreak = document.createElement('div');
                            fillStreak.className = 'fill-streak';
                            fillStreak.id = 'fillStreak';
                            fillCardEl.appendChild(fillStreak);

                            // 重建底部按钮栏
                            const retryFillBottom = document.createElement('div');
                            retryFillBottom.className = 'fill-bottom';
                            const retryHintBtn = document.createElement('button');
                            retryHintBtn.className = 'fill-hint-btn';
                            retryHintBtn.id = 'fillHintBtn';
                            retryHintBtn.title = '逐字母提示（-3分/个）';
                            retryHintBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1010 10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="8" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="16"/><line x1="8" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="16" y2="12"/></svg>';
                            const retryOnHintClick = (e) => {
                                e.stopPropagation();
                                revealNextLetter();
                            };
                            retryHintBtn.addEventListener('click', retryOnHintClick);
                            _cleanupFns.push(() => retryHintBtn.removeEventListener('click', retryOnHintClick));
                            retryFillBottom.appendChild(retryHintBtn);

                            const retrySkipBtn = document.createElement('button');
                            retrySkipBtn.className = 'fill-skip-btn';
                            retrySkipBtn.title = '跳过';
                            retrySkipBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`;
                            const retryOnSkipClick = (e) => {
                                e.stopPropagation();
                                doFillSkip();
                            };
                            retrySkipBtn.addEventListener('click', retryOnSkipClick);
                            _cleanupFns.push(() => retrySkipBtn.removeEventListener('click', retryOnSkipClick));
                            retryFillBottom.appendChild(retrySkipBtn);
                            fillCardEl.appendChild(retryFillBottom);

                            const onRetryCardClick = (e) => {
                                if (e.target.closest('.fill-hint-btn')) return;
                                if (e.target.closest('.fill-skip-btn')) return;
                                e.stopPropagation();
                                const hi = document.getElementById('fillHiddenInput');
                                if (hi) hi.focus();
                            };
                            fillCardEl.addEventListener('click', onRetryCardClick);
                            _cleanupFns.push(() => fillCardEl.removeEventListener('click', onRetryCardClick));

                            fillAnswered = new Set();
                            fillRetryQueue = [];
                            fillSkipped = new Set();
                            fillStreakCount = 0;
                            fillMaxStreak = 0;
                            fillTotalWrongAttempts = 0;
                            fillScore = 0;
                            fillRevealedLetters = new Map();
                            fillCheckDisabled = false;

                            const checkBtnEl = document.getElementById('fillCheckBtn');
                            if (checkBtnEl) checkBtnEl.style.display = '';

                            const fillBottomEl = document.querySelector('.fill-bottom');
                            if (fillBottomEl) fillBottomEl.style.display = '';

                            updateFillScore();
                            updateFillStreak();
                            updateFillProgress();
                            renderFillWord(0);
                        };
                        retryBtn.addEventListener('click', onRetryClick);
                        _cleanupFns.push(() => retryBtn.removeEventListener('click', onRetryClick));
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

            renderFillWord(0);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showFillPracticeInterface,
            init: init
        };
    });
})();