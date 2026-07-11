(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('ArticleReviewUI', ['GlobalManager'], function(GlobalManager) {

        function showArticleReviewInterface(container, articleId) {
            const appHeader = document.getElementById('app-header');
            const cardHeader = document.querySelector('.card-header');
            const cardBody = document.querySelector('.card-body');
            if (appHeader) appHeader.style.display = 'none';
            if (cardHeader) cardHeader.style.display = 'none';
            if (cardBody) cardBody.style.display = 'none';

            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            const item = historyList.find(h => h.id === articleId);
            if (!item) {
                _showToast('文章数据未找到');
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
                return;
            }

            if (window.StatsTracker) {
                window.StatsTracker.recordArticleRead(articleId);
                window.StatsTracker.recordModuleActivity('fullReview', 1);
            }

            container.innerHTML = '';

            const reviewHeader = document.createElement('div');
            reviewHeader.className = 'review-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            backBtn.onclick = () => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                closeReviewBubble();
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
            reviewHeader.appendChild(backBtn);

            const reviewTitle = document.createElement('h3');
            reviewTitle.textContent = '全文回顾';
            reviewHeader.appendChild(reviewTitle);

            const reviewTtsBtn = document.createElement('button');
            reviewTtsBtn.className = 'review-tts-btn';
            reviewTtsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            reviewTtsBtn.title = '朗读全文';
            let isSpeaking = false;
            reviewTtsBtn.onclick = () => {
                if (isSpeaking) {
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    isSpeaking = false;
                    reviewTtsBtn.classList.remove('speaking');
                    reviewTtsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
                } else {
                    if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(item.originalText);
                        utterance.lang = 'en-US';
                        utterance.rate = 0.85;
                        utterance.onend = () => {
                            isSpeaking = false;
                            reviewTtsBtn.classList.remove('speaking');
                            reviewTtsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
                        };
                        window.speechSynthesis.speak(utterance);
                        isSpeaking = true;
                        reviewTtsBtn.classList.add('speaking');
                        reviewTtsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
                    }
                }
            };
            reviewHeader.appendChild(reviewTtsBtn);

            container.appendChild(reviewHeader);

            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const reviewVocabMap = {};
            for (const nb of Object.values(allNotebooks)) {
                if (nb.words) {
                    nb.words.forEach(w => {
                        const key = w.word.toLowerCase().trim();
                        if (key) reviewVocabMap[key] = w.meaning || '';
                    });
                }
            }

            function getPlainWordCount(text) {
                return text.split(/\s+/).filter(w => w.length > 0).length;
            }

            const wordCount = getPlainWordCount(item.originalText);
            const vocabCount = Object.keys(reviewVocabMap).length;

            const reviewInfoBar = document.createElement('div');
            reviewInfoBar.className = 'review-info-bar';
            reviewInfoBar.innerHTML = `
                <span class="review-info-item">${wordCount} 词</span>
                <span class="review-info-sep">·</span>
                <span class="review-info-item" style="color: var(--accent);">${vocabCount} 个生词可回顾</span>
            `;
            container.appendChild(reviewInfoBar);

            function closeReviewBubble() {
                const existing = container.querySelector('.review-word-bubble');
                if (existing) existing.remove();
            }

            function showReviewBubble(meaning, element) {
                closeReviewBubble();
                const bubble = document.createElement('div');
                bubble.className = 'review-word-bubble';
                bubble.textContent = meaning;
                document.body.appendChild(bubble);

                const rect = element.getBoundingClientRect();
                const bubbleRect = bubble.getBoundingClientRect();
                let top = rect.bottom + 8;
                let left = rect.left + (rect.width / 2) - (bubbleRect.width / 2);
                if (left < 8) left = 8;
                if (left + bubbleRect.width > window.innerWidth - 8) {
                    left = window.innerWidth - bubbleRect.width - 8;
                }

                bubble.style.top = top + 'px';
                bubble.style.left = left + 'px';

                const closeHandler = (e) => {
                    if (!bubble.contains(e.target) && e.target !== element) {
                        bubble.remove();
                        document.removeEventListener('click', closeHandler);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeHandler), 10);
            }

            function buildHighlightedText(text) {
                const frag = document.createDocumentFragment();
                const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (match[1]) {
                        const word = match[1];
                        const lower = word.toLowerCase();
                        if (reviewVocabMap[lower]) {
                            const span = document.createElement('span');
                            span.className = 'review-vocab-word';
                            span.textContent = word;
                            span.dataset.meaning = reviewVocabMap[lower];
                            span.addEventListener('click', (e) => {
                                e.stopPropagation();
                                showReviewBubble(span.dataset.meaning, span);
                            });
                            frag.appendChild(span);
                        } else {
                            frag.appendChild(document.createTextNode(word));
                        }
                    } else if (match[2]) {
                        frag.appendChild(document.createTextNode(match[2]));
                    }
                }
                return frag;
            }

            const reviewContent = document.createElement('div');
            reviewContent.className = 'review-content';

            const textDiv = document.createElement('div');
            textDiv.className = 'review-text';
            textDiv.appendChild(buildHighlightedText(item.originalText));
            reviewContent.appendChild(textDiv);

            if (item.fullTranslation) {
                const divider = document.createElement('hr');
                divider.className = 'review-divider';
                reviewContent.appendChild(divider);

                const transLabel = document.createElement('div');
                transLabel.className = 'review-trans-label';
                transLabel.textContent = '全文翻译';
                reviewContent.appendChild(transLabel);

                const transDiv = document.createElement('div');
                transDiv.className = 'review-translation';
                transDiv.textContent = item.fullTranslation;
                reviewContent.appendChild(transDiv);
            }

            container.appendChild(reviewContent);

            document.addEventListener('click', (e) => {
                if (!e.target.classList.contains('review-vocab-word')) {
                    closeReviewBubble();
                }
            }, { once: false });
        }

        function showSentenceReviewInterface(container, articleId) {
            const appHeader = document.getElementById('app-header');
            const cardHeader = document.querySelector('.card-header');
            const cardBody = document.querySelector('.card-body');
            if (appHeader) appHeader.style.display = 'none';
            if (cardHeader) cardHeader.style.display = 'none';
            if (cardBody) cardBody.style.display = 'none';

            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            const item = historyList.find(h => h.id === articleId);
            if (!item) {
                _showToast('文章数据未找到');
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
                return;
            }

            const sentences = item.sentences || [];
            if (sentences.length === 0) {
                _showToast('该文章没有解析句子数据');
                const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
                if (MemoryModeUI) { MemoryModeUI.show(container); }
                return;
            }

            if (window.StatsTracker) {
                window.StatsTracker.recordArticleRead(articleId);
                window.StatsTracker.recordModuleActivity('sentenceReview', 1);
            }

            container.innerHTML = '';

            const sentenceHeader = document.createElement('div');
            sentenceHeader.className = 'sentence-review-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            backBtn.onclick = () => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                document.removeEventListener('keydown', sentenceKeyHandler);
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
            sentenceHeader.appendChild(backBtn);

            const sentenceTitle = document.createElement('h3');
            sentenceTitle.textContent = `逐句精读 · ${sentences.length} 句`;
            sentenceHeader.appendChild(sentenceTitle);

            const sentenceTtsBtn = document.createElement('button');
            sentenceTtsBtn.className = 'sent-tts-btn';
            sentenceTtsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            sentenceTtsBtn.title = '朗读当前句子';
            sentenceTtsBtn.onclick = () => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(sentences[currentIndex]);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    window.speechSynthesis.speak(utterance);
                }
            };
            sentenceHeader.appendChild(sentenceTtsBtn);

            container.appendChild(sentenceHeader);

            const progressBar = document.createElement('div');
            progressBar.className = 'sent-progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = 'sent-progress-fill';
            progressFill.style.width = (1 / sentences.length * 100) + '%';
            progressBar.appendChild(progressFill);
            container.appendChild(progressBar);

            const sentenceNav = document.createElement('div');
            sentenceNav.className = 'sentence-nav';

            const sentenceIndexEl = document.createElement('span');
            sentenceIndexEl.className = 'sentence-index';
            sentenceIndexEl.textContent = '1 / ' + sentences.length;
            sentenceNav.appendChild(sentenceIndexEl);

            const prevBtn = document.createElement('button');
            prevBtn.className = 'section-btn sentence-nav-btn';
            prevBtn.textContent = '← 上一句';
            prevBtn.id = 'sentenceReviewPrevBtn';
            sentenceNav.appendChild(prevBtn);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'section-btn primary sentence-nav-btn';
            nextBtn.textContent = '下一句 →';
            nextBtn.id = 'sentenceReviewNextBtn';
            sentenceNav.appendChild(nextBtn);

            const navHint = document.createElement('span');
            navHint.className = 'sent-nav-hint';
            navHint.textContent = '← → 键切换';
            sentenceNav.appendChild(navHint);

            container.appendChild(sentenceNav);

            const sentenceContent = document.createElement('div');
            sentenceContent.className = 'sentence-review-content';
            sentenceContent.id = 'sentenceReviewContent';

            const sentenceText = document.createElement('div');
            sentenceText.className = 'sentence-review-text';
            sentenceText.id = 'sentenceReviewText';
            sentenceContent.appendChild(sentenceText);

            const sentenceAnalysis = document.createElement('div');
            sentenceAnalysis.className = 'sentence-review-analysis';
            sentenceAnalysis.id = 'sentenceReviewAnalysis';
            sentenceContent.appendChild(sentenceAnalysis);

            container.appendChild(sentenceContent);

            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const sentVocabMap = {};
            for (const nb of Object.values(allNotebooks)) {
                if (nb.words) {
                    nb.words.forEach(w => {
                        const key = w.word.toLowerCase().trim();
                        if (key) sentVocabMap[key] = w.meaning || '';
                    });
                }
            }

            function closeSentBubble() {
                const existing = container.querySelector('.review-word-bubble');
                if (existing) existing.remove();
            }

            function showSentBubble(meaning, element) {
                closeSentBubble();
                const bubble = document.createElement('div');
                bubble.className = 'review-word-bubble';
                bubble.textContent = meaning;
                document.body.appendChild(bubble);

                const rect = element.getBoundingClientRect();
                const bubbleRect = bubble.getBoundingClientRect();
                let top = rect.bottom + 8;
                let left = rect.left + (rect.width / 2) - (bubbleRect.width / 2);
                if (left < 8) left = 8;
                if (left + bubbleRect.width > window.innerWidth - 8) {
                    left = window.innerWidth - bubbleRect.width - 8;
                }
                bubble.style.top = top + 'px';
                bubble.style.left = left + 'px';

                setTimeout(() => {
                    const handler = (e) => {
                        if (!bubble.contains(e.target) && e.target !== element) {
                            bubble.remove();
                            document.removeEventListener('click', handler);
                        }
                    };
                    document.addEventListener('click', handler);
                }, 10);
            }

            function buildSentHighlightedText(text) {
                const frag = document.createDocumentFragment();
                const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (match[1]) {
                        const word = match[1];
                        const lower = word.toLowerCase();
                        if (sentVocabMap[lower]) {
                            const span = document.createElement('span');
                            span.className = 'review-vocab-word';
                            span.textContent = word;
                            span.dataset.meaning = sentVocabMap[lower];
                            span.addEventListener('click', (e) => {
                                e.stopPropagation();
                                showSentBubble(span.dataset.meaning, span);
                            });
                            frag.appendChild(span);
                        } else {
                            frag.appendChild(document.createTextNode(word));
                        }
                    } else if (match[2]) {
                        frag.appendChild(document.createTextNode(match[2]));
                    }
                }
                return frag;
            }

            let currentIndex = 0;
            const sentenceData = item.sentenceData || {};

            function renderSentence(idx) {
                currentIndex = idx;
                const sentenceTextEl = document.getElementById('sentenceReviewText');
                const analysisEl = document.getElementById('sentenceReviewAnalysis');
                const indexEl = document.getElementById('sentenceReviewIndex');
                const prevBtnEl = document.getElementById('sentenceReviewPrevBtn');
                const nextBtnEl = document.getElementById('sentenceReviewNextBtn');

                if (sentenceTextEl) {
                    sentenceTextEl.innerHTML = '';
                    sentenceTextEl.appendChild(buildSentHighlightedText(sentences[idx]));
                }
                if (indexEl) indexEl.textContent = (idx + 1) + ' / ' + sentences.length;
                if (prevBtnEl) prevBtnEl.disabled = idx === 0;
                if (nextBtnEl) nextBtnEl.disabled = idx === sentences.length - 1;
                progressFill.style.width = ((idx + 1) / sentences.length * 100) + '%';

                if (analysisEl) {
                    analysisEl.innerHTML = '';
                    const data = sentenceData[idx];
                    if (data) {
                        if (data.translation) {
                            const transDiv = document.createElement('div');
                            transDiv.className = 'sentence-analysis-item';
                            transDiv.innerHTML = `<span class="analysis-label">翻译</span><span class="analysis-value">${data.translation}</span>`;
                            analysisEl.appendChild(transDiv);
                        }
                        if (data.pos) {
                            const posDiv = document.createElement('div');
                            posDiv.className = 'sentence-analysis-item';
                            let posHtml = '';
                            try {
                                const posData = typeof data.pos === 'string' ? JSON.parse(data.pos) : data.pos;
                                if (Array.isArray(posData)) {
                                    posHtml = posData.map(p => {
                                        const lower = p.word.toLowerCase();
                                        const hasVocab = sentVocabMap[lower];
                                        return `<span class="pos-tag ${hasVocab ? 'pos-vocab' : ''}" title="${hasVocab ? sentVocabMap[lower] : ''}">${p.word}<em>${p.pos}</em></span>`;
                                    }).join(' ');
                                }
                            } catch (e) { posHtml = String(data.pos); }
                            posDiv.innerHTML = `<span class="analysis-label">词性</span><span class="analysis-value pos-list">${posHtml}</span>`;
                            analysisEl.appendChild(posDiv);
                        }
                        if (data.knowledge) {
                            const knowDiv = document.createElement('div');
                            knowDiv.className = 'sentence-analysis-item';
                            knowDiv.innerHTML = `<span class="analysis-label">知识点</span><span class="analysis-value">${data.knowledge}</span>`;
                            analysisEl.appendChild(knowDiv);
                        }
                    } else {
                        analysisEl.innerHTML = '<div class="sentence-analysis-empty">暂无该句子的分析数据</div>';
                    }
                }
            }

            renderSentence(0);

            const prevEl = document.getElementById('sentenceReviewPrevBtn');
            const nextEl = document.getElementById('sentenceReviewNextBtn');
            if (prevEl) {
                prevEl.onclick = () => {
                    if (currentIndex > 0) renderSentence(currentIndex - 1);
                };
            }
            if (nextEl) {
                nextEl.onclick = () => {
                    if (currentIndex < sentences.length - 1) renderSentence(currentIndex + 1);
                };
            }

            function sentenceKeyHandler(e) {
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    renderSentence(currentIndex - 1);
                } else if (e.key === 'ArrowRight' && currentIndex < sentences.length - 1) {
                    e.preventDefault();
                    renderSentence(currentIndex + 1);
                }
            }

            document.addEventListener('keydown', sentenceKeyHandler);
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            showReview: showArticleReviewInterface,
            showSentence: showSentenceReviewInterface,
            init: init
        };
    });
})();