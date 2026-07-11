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

            container.innerHTML = '';

            const clozeHeader = document.createElement('div');
            clozeHeader.className = 'cloze-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            backBtn.onclick = () => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
            clozeHeader.appendChild(backBtn);

            const clozeTitle = document.createElement('h3');
            clozeTitle.textContent = `语境填空 · ${clozeItems.length} 个生词`;
            clozeHeader.appendChild(clozeTitle);

            const clozeProgress = document.createElement('span');
            clozeProgress.className = 'cloze-progress';
            clozeProgress.textContent = `0 / ${clozeItems.length}`;
            clozeHeader.appendChild(clozeProgress);

            container.appendChild(clozeHeader);

            const sentences = historyItem.sentences || [];
            function findSentenceForWord(wordIndex) {
                let charCount = 0;
                for (const sent of sentences) {
                    if (wordIndex >= charCount && wordIndex < charCount + sent.length) {
                        return sent;
                    }
                    charCount += sent.length + 1;
                }
                return null;
            }

            const clozeContent = document.createElement('div');
            clozeContent.className = 'cloze-content';

            const clozeProgressBar = document.createElement('div');
            clozeProgressBar.className = 'cloze-progress-bar';
            const clozeProgressFill = document.createElement('div');
            clozeProgressFill.className = 'cloze-progress-fill';
            clozeProgressFill.style.width = '0%';
            clozeProgressBar.appendChild(clozeProgressFill);
            container.appendChild(clozeProgressBar);

            let lastIndex = 0;
            const clozeInputs = [];

            function speakText(text) {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    window.speechSynthesis.speak(utterance);
                }
            }

            function updateClozeProgress() {
                let completed = 0;
                clozeInputs.forEach(input => {
                    if (input.disabled || input.parentElement.classList.contains('correct')) completed++;
                });
                clozeProgress.textContent = `${completed} / ${clozeItems.length}`;
                const pct = clozeItems.length > 0 ? (completed / clozeItems.length * 100) : 0;
                clozeProgressFill.style.width = pct + '%';

                if (completed === clozeItems.length && clozeItems.length > 0) {
                    showClozeComplete();
                }
            }

            function showClozeComplete() {
                if (container.querySelector('.cloze-complete-overlay')) return;
                if (window.StatsTracker) {
                    window.StatsTracker.recordArticleRead(articleId);
                    window.StatsTracker.recordWordsLearned(clozeItems.length);
                    window.StatsTracker.recordModuleActivity('cloze', clozeItems.length);
                }
                const overlay = document.createElement('div');
                overlay.className = 'cloze-complete-overlay';
                overlay.innerHTML = `
                    <div class="cloze-complete-icon">🎉</div>
                    <div class="cloze-complete-title">全部完成！</div>
                    <div class="cloze-complete-desc">你已正确填写了全部 ${clozeItems.length} 个生词填空</div>
                    <button class="section-btn cloze-complete-btn">返回</button>
                `;
                overlay.querySelector('.cloze-complete-btn').onclick = () => {
                    backBtn.onclick();
                };
                container.appendChild(overlay);
            }

            clozeItems.forEach((item, i) => {
                if (item.index > lastIndex) {
                    const beforeText = articleText.substring(lastIndex, item.index);
                    const span = document.createElement('span');
                    span.className = 'cloze-text';
                    span.textContent = beforeText;
                    clozeContent.appendChild(span);
                }

                const inputWrapper = document.createElement('span');
                inputWrapper.className = 'cloze-input-wrapper';
                inputWrapper.dataset.answer = item.word;
                inputWrapper.dataset.lemma = item.lemma;
                inputWrapper.dataset.meaning = item.meaning;

                const inputGroup = document.createElement('span');
                inputGroup.className = 'cloze-input-group';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'cloze-input';
                input.dataset.index = i;
                input.placeholder = '______';
                input.autocomplete = 'off';
                input.spellcheck = false;

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab' || e.key === 'Enter') {
                        e.preventDefault();
                        const nextInput = clozeContent.querySelector(`.cloze-input[data-index="${i + 1}"]`);
                        if (nextInput) nextInput.focus();
                    }
                });

                input.addEventListener('input', () => {
                    const wrapper = input.parentElement.parentElement;
                    if (wrapper.classList.contains('correct') || wrapper.classList.contains('incorrect')) {
                        wrapper.classList.remove('correct', 'incorrect');
                        const ca = wrapper.querySelector('.cloze-correct-answer');
                        if (ca) ca.remove();
                    }
                });

                inputGroup.appendChild(input);

                const speakBtn = document.createElement('button');
                speakBtn.className = 'cloze-speak-btn';
                speakBtn.type = 'button';
                speakBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
                speakBtn.title = '朗读包含此单词的句子';
                speakBtn.onclick = (e) => {
                    e.stopPropagation();
                    const sent = findSentenceForWord(item.index);
                    if (sent) speakText(sent);
                };
                inputGroup.appendChild(speakBtn);

                inputWrapper.appendChild(inputGroup);
                clozeContent.appendChild(inputWrapper);
                clozeInputs.push(input);

                lastIndex = item.index + item.word.length;
            });

            if (lastIndex < articleText.length) {
                const afterText = articleText.substring(lastIndex);
                const span = document.createElement('span');
                span.className = 'cloze-text';
                span.textContent = afterText;
                clozeContent.appendChild(span);
            }

            container.appendChild(clozeContent);

            setTimeout(() => {
                if (clozeInputs.length > 0) clozeInputs[0].focus();
            }, 100);

            const clozeFooter = document.createElement('div');
            clozeFooter.className = 'cloze-footer';

            const checkBtn = document.createElement('button');
            checkBtn.className = 'section-btn cloze-check-btn';
            checkBtn.textContent = '检查答案';

            function doCheck() {
                let correct = 0;
                const total = clozeInputs.length;

                clozeInputs.forEach((input) => {
                    const wrapper = input.parentElement.parentElement;
                    const answer = wrapper.dataset.answer;
                    const lemma = wrapper.dataset.lemma;
                    const userAnswer = input.value.trim().toLowerCase();

                    wrapper.classList.remove('correct', 'incorrect');

                    if (userAnswer === answer.toLowerCase() || userAnswer === lemma.toLowerCase() || lemmatize(userAnswer) === lemma) {
                        wrapper.classList.add('correct');
                        input.disabled = true;
                        correct++;
                    } else {
                        wrapper.classList.add('incorrect');
                        const correctSpan = document.createElement('span');
                        correctSpan.className = 'cloze-correct-answer';
                        correctSpan.textContent = answer;
                        if (!wrapper.querySelector('.cloze-correct-answer')) {
                            wrapper.appendChild(correctSpan);
                        }
                    }
                });

                const resultSpan = clozeFooter.querySelector('.cloze-result') || document.createElement('span');
                resultSpan.className = 'cloze-result';
                resultSpan.textContent = `正确 ${correct}/${total}`;
                if (!clozeFooter.querySelector('.cloze-result')) {
                    clozeFooter.appendChild(resultSpan);
                }

                updateClozeProgress();
                checkBtn.textContent = '重新尝试';
                checkBtn.onclick = doReset;
            }

            function doReset() {
                clozeInputs.forEach(input => {
                    input.value = '';
                    input.disabled = false;
                    const wrapper = input.parentElement.parentElement;
                    wrapper.classList.remove('correct', 'incorrect', 'revealed');
                    const ca = wrapper.querySelector('.cloze-correct-answer');
                    if (ca) ca.remove();
                });
                const resultSpan = clozeFooter.querySelector('.cloze-result');
                if (resultSpan) resultSpan.textContent = '';
                checkBtn.textContent = '检查答案';
                checkBtn.onclick = doCheck;
                const completeOverlay = container.querySelector('.cloze-complete-overlay');
                if (completeOverlay) completeOverlay.remove();
                updateClozeProgress();
            }

            checkBtn.onclick = doCheck;
            clozeFooter.appendChild(checkBtn);

            const revealBtn = document.createElement('button');
            revealBtn.className = 'section-btn cloze-reveal-btn';
            revealBtn.textContent = '显示答案';
            let isRevealed = false;
            revealBtn.onclick = () => {
                isRevealed = !isRevealed;
                if (isRevealed) {
                    clozeInputs.forEach(input => {
                        const wrapper = input.parentElement.parentElement;
                        const answer = wrapper.dataset.answer;
                        input.value = answer;
                        input.disabled = true;
                        wrapper.classList.add('revealed');
                    });
                    revealBtn.textContent = '隐藏答案';
                } else {
                    clozeInputs.forEach(input => {
                        const wrapper = input.parentElement.parentElement;
                        input.value = '';
                        input.disabled = false;
                        wrapper.classList.remove('revealed');
                    });
                    revealBtn.textContent = '显示答案';
                }
                updateClozeProgress();
            };
            clozeFooter.appendChild(revealBtn);

            const transBtn = document.createElement('button');
            transBtn.className = 'section-btn cloze-trans-btn';
            transBtn.textContent = '显示翻译';
            clozeFooter.appendChild(transBtn);

            const transArea = document.createElement('div');
            transArea.className = 'cloze-translation';
            transArea.style.display = 'none';

            let translationText = historyItem.fullTranslation || '';

            if (!translationText && historyItem.sentenceData) {
                const sentTranslations = [];
                const sd = historyItem.sentenceData;
                const keys = Object.keys(sd).sort((a, b) => parseInt(a) - parseInt(b));
                for (const key of keys) {
                    if (sd[key] && sd[key].translation) {
                        sentTranslations.push(sd[key].translation);
                    }
                }
                if (sentTranslations.length > 0) {
                    translationText = sentTranslations.join('');
                }
            }

            if (translationText) {
                const transText = document.createElement('div');
                transText.className = 'cloze-translation-text';
                transText.textContent = translationText;
                transArea.appendChild(transText);
            } else {
                const noTrans = document.createElement('div');
                noTrans.className = 'cloze-translation-empty';
                noTrans.textContent = '暂无翻译数据';
                transArea.appendChild(noTrans);
            }

            container.appendChild(transArea);

            transBtn.addEventListener('click', () => {
                const isHidden = transArea.style.display === 'none';
                transArea.style.display = isHidden ? 'block' : 'none';
                transBtn.textContent = isHidden ? '隐藏翻译' : '显示翻译';
            });

            container.appendChild(clozeFooter);
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