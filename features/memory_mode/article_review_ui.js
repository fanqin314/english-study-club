(function() {
    let _showToast = null;
    let _getVocabData = null;

    ModuleRegistry.register('ArticleReviewUI', ['GlobalManager'], function(GlobalManager) {

        // ===== SVG ICON CONSTANTS =====
        const SPEAKER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
        const PAUSE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        const CHECK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        const ARROW_LEFT_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
        const ARROW_RIGHT_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        const BACK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

        const TROPHY_SVG_PATH = 'M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z';

        // ===== SHARED UTILITIES =====

        function buildSummaryHtml(opts) {
            const { titleText, titleClass, modeLabel, stats, isPerfect, perfectText } = opts;
            const statsHtml = stats.map((s, i) => `
                <div class="fill-summary-stat" style="animation-delay:${(0.05 + i * 0.07).toFixed(2)}s">
                    <span class="fill-summary-val ${s.cls || ''}" style="${s.color ? 'color:' + s.color : ''}">${s.val}</span>
                    <span class="fill-summary-lbl">${s.lbl}</span>
                </div>
            `).join('');
            return `
                <div class="fill-summary">
                    <div class="fill-summary-icon">
                        <div class="trophy-star">
                            <div class="star-eight"></div>
                        </div>
                        <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="${isPerfect ? '#f59e0b' : '#e94822'}">
                            <path d="${TROPHY_SVG_PATH}"/>
                        </svg>
                    </div>
                    <div class="fill-summary-title ${titleClass || ''}">${titleText}</div>
                    ${modeLabel ? '<div class="fill-summary-mode">' + modeLabel + '</div>' : ''}
                    <div class="fill-summary-stats">${statsHtml}</div>
                    ${isPerfect && perfectText ? '<div class="fill-perfect-badge">' + perfectText + '</div>' : ''}
                    <button class="summary-retry-btn">再来一轮</button>
                </div>
            `;
        }

        /**
         * Build highlighted text with vocab words marked.
         * @param {string} text - Original text
         * @param {Object} reviewVocabMap - { word: meaning }
         * @param {Object} masteryMap - { word: { reviewCount, lastReviewed } }
         * @param {Set} reviewedVocabSet - Set of reviewed words
         * @param {Function} onVocabClick - Callback(word, spanElement)
         * @returns {DocumentFragment}
         */
        function buildHighlightedText(text, reviewVocabMap, masteryMap, reviewedVocabSet, onVocabClick) {
            const paragraphs = text.split(/\n\s*\n/);
            const frag = document.createDocumentFragment();
            paragraphs.forEach(para => {
                const pDiv = document.createElement('div');
                pDiv.className = 'review-paragraph';
                const regex = /([a-zA-Z'-]+)|([^a-zA-Z'-]+)/g;
                let match;
                let hasVocab = false;
                while ((match = regex.exec(para)) !== null) {
                    if (match[1]) {
                        const word = match[1];
                        const lower = word.toLowerCase();
                        if (reviewVocabMap[lower]) {
                            hasVocab = true;
                            const span = document.createElement('span');
                            span.className = 'review-vocab-word';
                            span.textContent = word;
                            span.dataset.meaning = reviewVocabMap[lower];
                            span.dataset.word = lower;
                            const rc = (masteryMap[lower] && masteryMap[lower].reviewCount) || 0;
                            let masteryLevel = 0;
                            if (rc === 0) masteryLevel = 0;
                            else if (rc < 3) masteryLevel = 1;
                            else if (rc < 7) masteryLevel = 2;
                            else masteryLevel = 3;
                            span.classList.add('mastery-' + masteryLevel);
                            if (reviewedVocabSet && reviewedVocabSet.has(lower)) {
                                span.classList.add('reviewed');
                            }
                            span.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (onVocabClick) onVocabClick(lower, span);
                            });
                            pDiv.appendChild(span);
                        } else {
                            pDiv.appendChild(document.createTextNode(word));
                        }
                    } else if (match[2]) {
                        pDiv.appendChild(document.createTextNode(match[2]));
                    }
                }
                if (!hasVocab) pDiv.classList.add('no-vocab');
                frag.appendChild(pDiv);
            });
            return frag;
        }

        /**
         * Show review vocab bubble near the clicked element.
         */
        function showReviewBubble(meaning, element, word, masteryMap) {
            closeReviewBubble();
            const bubble = document.createElement('div');
            bubble.className = 'review-word-bubble';

            // Structure with bubble-word and bubble-meaning for CSS targeting
            const wordSpan = document.createElement('span');
            wordSpan.className = 'bubble-word';
            wordSpan.textContent = word || element.textContent;
            bubble.appendChild(wordSpan);

            const meaningSpan = document.createElement('span');
            meaningSpan.className = 'bubble-meaning';
            meaningSpan.textContent = meaning;
            bubble.appendChild(meaningSpan);

            // Find the nearest [data-review-style] container for CSS scoping
            const styleContainer = element.closest('[data-review-style]');
            const appendTarget = styleContainer || document.body;
            appendTarget.appendChild(bubble);

            // Use position:fixed for correct viewport-relative positioning
            bubble.style.position = 'fixed';

            if (word && masteryMap) {
                const mastery = masteryMap[word];
                if (mastery && mastery.reviewCount > 0) {
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'bubble-practice-info';
                    let infoText = '已练习 ' + mastery.reviewCount + ' 次';
                    if (mastery.lastReviewed) {
                        const date = new Date(mastery.lastReviewed);
                        const dateStr = date.getFullYear() + '-' +
                            String(date.getMonth() + 1).padStart(2, '0') + '-' +
                            String(date.getDate()).padStart(2, '0');
                        infoText += ' · 上次：' + dateStr;
                    }
                    infoDiv.textContent = infoText;
                    bubble.appendChild(infoDiv);
                }
            }

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

        /**
         * Close any open review bubble.
         */
        function closeReviewBubble() {
            const existing = document.querySelector('.review-word-bubble');
            if (existing) existing.remove();
        }

        /**
         * Update the progress bar display.
         */
        function updateReviewProgress(reviewedVocabSet, vocabCount, progressWrap) {
            if (!progressWrap) return;
            const fillEl = progressWrap.querySelector('.fill-progress-fill');
            const txtEl = progressWrap.querySelector('.fill-progress-text');
            if (fillEl) fillEl.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
            if (txtEl) txtEl.textContent = '已回顾 ' + reviewedVocabSet.size + ' / ' + vocabCount;
        }

        function getPlainWordCount(text) {
            return text.split(/\s+/).filter(w => w.length > 0).length;
        }

        /**
         * Replace vocab class names with theme-specific class after building content.
         * @param {HTMLElement} contentEl - The content element containing .review-vocab-word spans
         * @param {string} vocabClass - The theme-specific vocab class (e.g. 'rv-book-vocab')
         */
        function replaceVocabClasses(contentEl, vocabClass) {
            if (!contentEl) return;
            contentEl.querySelectorAll('.review-vocab-word').forEach(span => {
                span.className = span.className.replace('review-vocab-word', vocabClass);
            });
        }

        // ===== REVIEW STYLES DEFINITION =====
        const REVIEW_STYLES = [
            { id: 'book', label: '书本', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
            { id: 'magazine', label: '杂志', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
            { id: 'newspaper', label: '报纸', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/></svg>' },
            { id: 'cute', label: '可爱', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
            { id: 'pixel', label: '像素', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/></svg>' },
            { id: 'minimal', label: '极简', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="12" y2="18"/></svg>' },
            { id: 'library', label: '典籍', icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M4 9h5M4 14h5M4 19h5"/></svg>' }
        ];

        // ===== 7 INDEPENDENT RENDER FUNCTIONS =====

        /**
         * renderBookStyle - 摊开的书
         */
        function renderBookStyle(data) {
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            // Background wrapper
            const bgWrap = document.createElement('div');
            bgWrap.className = 'rv-book-wrapper';
            container.appendChild(bgWrap);

            // Book container
            const book = document.createElement('div');
            book.className = 'rv-book-container';
            bgWrap.appendChild(book);

            // Spine with progress
            const spine = document.createElement('div');
            spine.className = 'rv-book-spine';
            const spineProgress = document.createElement('div');
            spineProgress.className = 'rv-book-progress review-progress-wrap';
            const spineFill = document.createElement('div');
            spineFill.className = 'progress-fill fill-progress-fill';
            spineFill.style.height = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
            spineProgress.appendChild(spineFill);
            const spineText = document.createElement('span');
            spineText.className = 'progress-text fill-progress-text';
            spineText.textContent = reviewedVocabSet.size + '/' + vocabCount;
            spineProgress.appendChild(spineText);
            spine.appendChild(spineProgress);

            // Spine decorative ribs (竹节)
            for (let i = 0; i < 4; i++) {
                const rib = document.createElement('div');
                rib.className = 'rv-book-rib';
                spine.appendChild(rib);
            }

            // Bookmark ribbon (书签丝带)
            const ribbon = document.createElement('div');
            ribbon.className = 'rv-book-ribbon';
            spine.appendChild(ribbon);

            book.appendChild(spine);

            // Left page (English)
            const leftPage = document.createElement('div');
            leftPage.className = 'rv-book-left-page';
            const leftHeader = document.createElement('div');
            leftHeader.className = 'rv-book-header';
            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = BACK_SVG;
            backBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            styleCleanups.push(() => backBtn.removeEventListener('click', () => {}));
            leftHeader.appendChild(backBtn);
            const leftTitle = document.createElement('h3');
            leftTitle.textContent = 'English Original';
            leftHeader.appendChild(leftTitle);
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'tts-btn';
            ttsBtn.innerHTML = SPEAKER_SVG;
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.classList.add('speaking'); ttsBtn.innerHTML = PAUSE_SVG;
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            leftHeader.appendChild(ttsBtn);
            leftPage.appendChild(leftHeader);

            // Info bar in left page
            const infoBar = document.createElement('div');
            infoBar.className = 'rv-book-info review-info-bar';
            infoBar.innerHTML = '<span class="info-item">📄 ' + wordCount + ' 词</span><span class="info-sep"></span><span class="info-item">⭐ ' + vocabCount + ' 生词</span><span class="info-sep"></span><span class="info-item review-timer" id="reviewTimer">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            infoBar.appendChild(filterBtn);
            leftPage.appendChild(infoBar);

            // English text
            const textArea = document.createElement('div');
            textArea.className = 'review-content-fill';
            textArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(textArea, 'rv-book-vocab');
            if (filterMode) textArea.classList.add('filter-vocab-only');
            leftPage.appendChild(textArea);

            // Page number
            const pageNum = document.createElement('div');
            pageNum.className = 'rv-book-page-num';
            pageNum.textContent = '— 1 —';
            leftPage.appendChild(pageNum);

            book.appendChild(leftPage);

            // Right page (Chinese translation)
            const rightPage = document.createElement('div');
            rightPage.className = 'rv-book-right-page';
            const rightHeader = document.createElement('div');
            rightHeader.className = 'rv-book-header';
            const rightTitle = document.createElement('h3');
            rightTitle.textContent = '中文翻译';
            rightHeader.appendChild(rightTitle);
            rightPage.appendChild(rightHeader);

            if (item.fullTranslation) {
                const transDiv = document.createElement('div');
                transDiv.textContent = item.fullTranslation;
                rightPage.appendChild(transDiv);
            } else {
                const noTrans = document.createElement('div');
                noTrans.className = 'rv-book-no-trans';
                noTrans.textContent = '（暂无翻译）';
                rightPage.appendChild(noTrans);
            }

            const rightPageNum = document.createElement('div');
            rightPageNum.className = 'rv-book-page-num';
            rightPageNum.textContent = '— 2 —';
            rightPage.appendChild(rightPageNum);

            // Page curl corner
            const curl = document.createElement('div');
            curl.className = 'rv-book-page-curl';
            rightPage.appendChild(curl);

            book.appendChild(rightPage);

            // Complete button embedded as bookmark ribbon on right page
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-book-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            styleCleanups.push(() => completeBtn.removeEventListener('click', () => {}));
            rightPage.appendChild(completeBtn);

            // Touch swipe support for page turning on mobile
            let touchStartX = 0;
            let touchStartY = 0;
            const handleTouchStart = (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            };
            const handleTouchEnd = (e) => {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const diffX = touchEndX - touchStartX;
                const diffY = touchEndY - touchStartY;
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                    if (diffX > 0) {
                        book.classList.add('page-turning-left');
                        setTimeout(() => book.classList.remove('page-turning-left'), 400);
                    } else {
                        book.classList.add('page-turning-right');
                        setTimeout(() => book.classList.remove('page-turning-right'), 400);
                    }
                }
            };
            book.addEventListener('touchstart', handleTouchStart, { passive: true });
            book.addEventListener('touchend', handleTouchEnd, { passive: true });
            styleCleanups.push(() => {
                book.removeEventListener('touchstart', handleTouchStart);
                book.removeEventListener('touchend', handleTouchEnd);
            });

            // Keyboard arrow key support for page turning
            const handleBookKeydown = (e) => {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    book.classList.add('page-turning-left');
                    setTimeout(() => book.classList.remove('page-turning-left'), 400);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    book.classList.add('page-turning-right');
                    setTimeout(() => book.classList.remove('page-turning-right'), 400);
                }
            };
            document.addEventListener('keydown', handleBookKeydown);
            styleCleanups.push(() => {
                document.removeEventListener('keydown', handleBookKeydown);
            });

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    textArea.innerHTML = '';
                    textArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(textArea, 'rv-book-vocab');
                    if (filterMode) textArea.classList.add('filter-vocab-only'); else textArea.classList.remove('filter-vocab-only');
                    spineFill.style.height = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
                    spineText.textContent = reviewedVocabSet.size + '/' + vocabCount;
                },
                getContentEl: () => textArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        /**
         * renderMagazineStyle - 全幅杂志内页
         */
        function renderMagazineStyle(data) {
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            const magWrap = document.createElement('div');
            magWrap.className = 'rv-mag-wrapper';
            container.appendChild(magWrap);

            // ===== 顶部工具栏（返回按钮 + 朗读按钮）=====
            const topBar = document.createElement('div');
            topBar.className = 'rv-mag-topbar';
            // 返回按钮 - 使用 BACK_SVG
            const backBtn = document.createElement('button');
            backBtn.className = 'rv-mag-back-btn';
            backBtn.innerHTML = BACK_SVG;
            backBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            topBar.appendChild(backBtn);
            // 朗读按钮 - 使用 SPEAKER_SVG
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'rv-mag-tts-btn';
            ttsBtn.innerHTML = SPEAKER_SVG;
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.classList.add('speaking'); ttsBtn.innerHTML = PAUSE_SVG;
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            topBar.appendChild(ttsBtn);
            magWrap.appendChild(topBar);

            // ===== 刊头 Masthead =====
            const masthead = document.createElement('div');
            masthead.className = 'rv-mag-masthead';
            const mastheadTitle = document.createElement('div');
            mastheadTitle.className = 'rv-mag-masthead-title';
            mastheadTitle.textContent = 'THE ENGLISH READER';
            masthead.appendChild(mastheadTitle);
            const mastheadIssue = document.createElement('div');
            mastheadIssue.className = 'rv-mag-masthead-issue';
            mastheadIssue.textContent = 'VOL. I · ISSUE ' + (item.id || '1');
            masthead.appendChild(mastheadIssue);
            magWrap.appendChild(masthead);

            // 装饰性粗细分隔线
            const rule = document.createElement('div');
            rule.className = 'rv-mag-thick-thin-rule';
            magWrap.appendChild(rule);

            // ===== 标题层级：Kicker + Headline + Deck =====
            const kicker = document.createElement('div');
            kicker.className = 'rv-mag-kicker';
            kicker.textContent = 'FEATURE · FULL REVIEW';
            magWrap.appendChild(kicker);

            const headline = document.createElement('h1');
            headline.className = 'rv-mag-headline';
            headline.textContent = item.title || 'Full Review';
            magWrap.appendChild(headline);

            const deck = document.createElement('div');
            deck.className = 'rv-mag-deck';
            deck.textContent = 'A comprehensive review of vocabulary and expressions in context.';
            magWrap.appendChild(deck);

            // ===== Byline + Dateline =====
            const byline = document.createElement('div');
            byline.className = 'rv-mag-byline';
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            byline.innerHTML = 'By English Reading Lab <span class="rv-mag-byline-sep">·</span> ' + dateStr;
            magWrap.appendChild(byline);

            // ===== Info bar（信息栏）=====
            const infoBar = document.createElement('div');
            infoBar.className = 'rv-mag-info review-info-bar';
            infoBar.innerHTML = '<span class="info-item">WORDS ' + wordCount + '</span><span class="info-sep"></span><span class="info-item">VOCAB ' + vocabCount + '</span><span class="info-sep"></span><span class="info-item review-timer" id="reviewTimer">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            infoBar.appendChild(filterBtn);
            magWrap.appendChild(infoBar);

            // ===== 内容区域（双栏）=====
            const contentArea = document.createElement('div');
            contentArea.className = 'rv-mag-content review-content-fill';
            contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(contentArea, 'rv-mag-vocab');
            if (filterMode) contentArea.classList.add('filter-vocab-only');
            magWrap.appendChild(contentArea);

            // ===== 编者注（翻译）=====
            if (item.fullTranslation) {
                const editorNote = document.createElement('div');
                editorNote.className = 'rv-mag-editor-note';
                editorNote.innerHTML = '<span class="note-label">Editor\'s Note · 中文翻译</span><br>' + item.fullTranslation;
                magWrap.appendChild(editorNote);
            }

            // ===== 进度条 =====
            const progressWrap = document.createElement('div');
            progressWrap.className = 'rv-mag-progress review-progress-wrap';
            progressWrap.innerHTML = '<div class="fill-progress-track" style="height:4px;background:#eee;border-radius:2px;"><div class="fill-progress-fill" style="width:' + (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%;height:100%;background:#111;border-radius:2px;transition:width 0.3s;"></div></div><span class="fill-progress-text" style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;">Reviewed ' + reviewedVocabSet.size + '/' + vocabCount + '</span>';
            magWrap.appendChild(progressWrap);

            // ===== 完成按钮 =====
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-mag-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            magWrap.appendChild(completeBtn);

            // ===== 页脚 Folio =====
            const folio = document.createElement('div');
            folio.className = 'rv-mag-folio';
            folio.innerHTML = '<div class="rv-mag-folio-rule"></div>THE ENGLISH READER · PAGE 1 · ' + dateStr;
            magWrap.appendChild(folio);

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    contentArea.innerHTML = '';
                    contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(contentArea, 'rv-mag-vocab');
                    if (filterMode) contentArea.classList.add('filter-vocab-only'); else contentArea.classList.remove('filter-vocab-only');
                    const fillEl = progressWrap.querySelector('.fill-progress-fill');
                    const txtEl = progressWrap.querySelector('.fill-progress-text');
                    if (fillEl) fillEl.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
                    if (txtEl) txtEl.textContent = 'Reviewed ' + reviewedVocabSet.size + '/' + vocabCount;
                },
                getContentEl: () => contentArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        /**
         * renderNewspaperStyle - 报纸版面
         */
        function renderNewspaperStyle(data) {
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            const paper = document.createElement('div');
            paper.className = 'rv-news-wrapper';
            const newsInner = document.createElement('div');
            newsInner.className = 'news-inner';
            paper.appendChild(newsInner);
            container.appendChild(paper);

            // Newspaper masthead
            const newsHeader = document.createElement('div');
            newsHeader.className = 'rv-news-masthead';
            const headerTop = document.createElement('div');
            headerTop.className = 'rv-news-header-top';
            const backBtn = document.createElement('button');
            backBtn.className = 'rv-news-back-btn';
            backBtn.innerHTML = BACK_SVG;
            backBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            styleCleanups.push(() => backBtn.removeEventListener('click', () => {}));
            headerTop.appendChild(backBtn);
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'rv-news-tts-btn';
            ttsBtn.innerHTML = SPEAKER_SVG;
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.classList.add('speaking'); ttsBtn.innerHTML = PAUSE_SVG;
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            headerTop.appendChild(ttsBtn);
            newsHeader.appendChild(headerTop);

            const paperName = document.createElement('div');
            paperName.className = 'rv-news-masthead-name';
            paperName.textContent = 'The Daily Review';
            newsHeader.appendChild(paperName);

            // Decorative double rule
            const doubleRule = document.createElement('div');
            doubleRule.className = 'rv-news-double-rule';
            newsHeader.appendChild(doubleRule);

            // Section label
            const sectionLabel = document.createElement('div');
            sectionLabel.className = 'rv-news-section-label';
            sectionLabel.textContent = 'FEATURE · FULL REVIEW';
            newsHeader.appendChild(sectionLabel);

            // Headline
            const headline = document.createElement('h1');
            headline.className = 'rv-news-headline';
            headline.textContent = item.title || 'Full Review';
            newsHeader.appendChild(headline);

            // Subheadline
            const subheadline = document.createElement('div');
            subheadline.className = 'rv-news-subheadline';
            subheadline.textContent = 'A comprehensive review of vocabulary and expressions in context.';
            newsHeader.appendChild(subheadline);

            // Dateline
            const now = new Date();
            const dateLine = document.createElement('div');
            dateLine.className = 'rv-news-dateline';
            dateLine.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            newsHeader.appendChild(dateLine);

            // Byline
            const byline = document.createElement('div');
            byline.className = 'rv-news-byline';
            byline.textContent = 'By English Reading Lab';
            newsHeader.appendChild(byline);

            // Masthead info bar (word count, timer, edition)
            const mastInfo = document.createElement('div');
            mastInfo.className = 'rv-news-masthead-info review-info-bar';
            mastInfo.innerHTML = '<span>Words: ' + wordCount + ' | Vocab: ' + vocabCount + ' | <span class="review-timer" id="reviewTimer">00:00</span> | Edition: Bilingual</span>';
            newsHeader.appendChild(mastInfo);
            newsInner.appendChild(newsHeader);

            // Info bar
            const infoBar = document.createElement('div');
            infoBar.className = 'rv-news-info';
            infoBar.innerHTML = '<span class="info-item">WORDS ' + wordCount + '</span><span class="info-sep"></span><span class="info-item">VOCAB ' + vocabCount + '</span><span class="info-sep"></span><span class="info-item review-timer" id="reviewTimer2">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            infoBar.appendChild(filterBtn);
            newsInner.appendChild(infoBar);

            // Content - 3 column layout
            const contentArea = document.createElement('div');
            contentArea.className = 'rv-news-content review-content-fill';
            contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(contentArea, 'rv-news-vocab');
            if (filterMode) contentArea.classList.add('filter-vocab-only');
            newsInner.appendChild(contentArea);

            // Translation as bilingual section
            if (item.fullTranslation) {
                const transBox = document.createElement('div');
                transBox.className = 'rv-news-bilingual';
                transBox.innerHTML = '<span class="bilingual-label">Bilingual · 中文翻译</span>' + item.fullTranslation;
                newsInner.appendChild(transBox);
            }

            // Progress bar
            const progressWrap = document.createElement('div');
            progressWrap.className = 'rv-news-progress review-progress-wrap';
            progressWrap.innerHTML = '<div class="fill-progress-track" style="height:3px;background:#ddd;"><div class="fill-progress-fill" style="width:' + (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%;height:100%;background:#333;transition:width 0.3s;"></div></div><span class="fill-progress-text" style="font-size:10px;color:#999;">' + reviewedVocabSet.size + '/' + vocabCount + ' reviewed</span>';
            newsInner.appendChild(progressWrap);

            // Complete button embedded as "reading complete" stamp in newspaper
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-news-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            styleCleanups.push(() => completeBtn.removeEventListener('click', () => {}));
            newsInner.appendChild(completeBtn);

            // Folio line
            const folioLine = document.createElement('div');
            folioLine.className = 'rv-news-folio-line';
            const folioDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            folioLine.textContent = 'THE DAILY REVIEW · ' + folioDate + ' · PAGE 1';
            newsInner.appendChild(folioLine);

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    contentArea.innerHTML = '';
                    contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(contentArea, 'rv-news-vocab');
                    if (filterMode) contentArea.classList.add('filter-vocab-only'); else contentArea.classList.remove('filter-vocab-only');
                    const fillEl = progressWrap.querySelector('.fill-progress-fill');
                    const txtEl = progressWrap.querySelector('.fill-progress-text');
                    if (fillEl) fillEl.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
                    if (txtEl) txtEl.textContent = reviewedVocabSet.size + '/' + vocabCount + ' reviewed';
                },
                getContentEl: () => contentArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        /**
         * renderCuteStyle - 手账本
         */
        function renderCuteStyle(data) {
            const sectionDividers = ['✿', '♡', '✦'];
            function insertSectionDividers(contentArea) {
                const paragraphs = contentArea.querySelectorAll('.review-paragraph');
                for (let i = paragraphs.length - 1; i > 0; i--) {
                    const divider = document.createElement('span');
                    divider.className = 'rv-cute-section-divider';
                    divider.textContent = sectionDividers[i % sectionDividers.length];
                    paragraphs[i].parentNode.insertBefore(divider, paragraphs[i]);
                }
            }
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            const cuteBg = document.createElement('div');
            cuteBg.className = 'rv-cute-wrapper';
            const cuteInner = document.createElement('div');
            cuteInner.className = 'cute-inner';
            cuteBg.appendChild(cuteInner);
            container.appendChild(cuteBg);

            // Notebook card
            const card = document.createElement('div');
            card.className = 'rv-cute-notebook';

            // Washi tape decoration
            const washiTape = document.createElement('div');
            washiTape.className = 'rv-cute-washi-tape';
            card.appendChild(washiTape);

            // Sticker decoration
            const sticker = document.createElement('div');
            sticker.className = 'rv-cute-sticker';
            const now = new Date();
            sticker.textContent = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
            card.appendChild(sticker);

            // Header
            const header = document.createElement('div');
            header.className = 'rv-cute-header';
            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = BACK_SVG;
            backBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            styleCleanups.push(() => backBtn.removeEventListener('click', () => {}));
            header.appendChild(backBtn);
            const titleEl = document.createElement('h3');
            titleEl.textContent = '今日阅读';
            header.appendChild(titleEl);
            const titleUnderline = document.createElement('div');
            titleUnderline.className = 'rv-cute-title-underline';
            header.appendChild(titleUnderline);
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'tts-btn';
            ttsBtn.innerHTML = SPEAKER_SVG;
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.classList.add('speaking'); ttsBtn.innerHTML = PAUSE_SVG;
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            header.appendChild(ttsBtn);
            card.appendChild(header);

            // Info bar
            const infoBar = document.createElement('div');
            infoBar.className = 'rv-cute-info review-info-bar';
            infoBar.innerHTML = '<span class="info-item">' + wordCount + ' words</span><span class="info-sep"></span><span class="info-item">' + vocabCount + ' vocab</span><span class="info-sep"></span><span class="info-item review-timer" id="reviewTimer">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            infoBar.appendChild(filterBtn);
            card.appendChild(infoBar);

            // Content area
            const contentArea = document.createElement('div');
            contentArea.className = 'rv-cute-content review-content-fill';
            contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(contentArea, 'rv-cute-vocab');
            if (filterMode) contentArea.classList.add('filter-vocab-only');
            insertSectionDividers(contentArea);
            card.appendChild(contentArea);

            // Translation as sticky note
            if (item.fullTranslation) {
                const sticky = document.createElement('div');
                sticky.className = 'rv-cute-sticky-note';
                sticky.innerHTML = '<span class="sticky-label">翻译便签</span>' + item.fullTranslation;
                const tape = document.createElement('div');
                tape.className = 'rv-cute-tape';
                sticky.insertBefore(tape, sticky.firstChild);
                card.appendChild(sticky);
            }

            // Decorative elements
            const decor = document.createElement('div');
            decor.className = 'rv-cute-decoration';
            decor.textContent = '✦ ✦ ✦';
            card.appendChild(decor);

            // Doodle decorations
            const doodles = document.createElement('div');
            doodles.className = 'rv-cute-doodles';
            doodles.innerHTML = '<span class="doodle-tl">★</span><span class="doodle-tr">♥</span><span class="doodle-bl">✿</span><span class="doodle-br">★</span>';
            card.appendChild(doodles);

            // Complete button embedded as decorative sticker at bottom of notebook
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-cute-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            styleCleanups.push(() => completeBtn.removeEventListener('click', () => {}));
            card.appendChild(completeBtn);

            cuteInner.appendChild(card);

            // Progress bar
            const progressWrap = document.createElement('div');
            progressWrap.className = 'rv-cute-progress review-progress-wrap';
            progressWrap.innerHTML = '<div class="fill-progress-track" style="height:8px;background:#fce4ec;border-radius:4px;"><div class="fill-progress-fill" style="width:' + (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%;height:100%;background:linear-gradient(90deg,#f48fb1,#f06292);border-radius:4px;transition:width 0.4s;"></div></div><span class="fill-progress-text" style="font-size:11px;color:#e91e63;">已回顾 ' + reviewedVocabSet.size + '/' + vocabCount + '</span>';
            cuteInner.appendChild(progressWrap);

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    contentArea.innerHTML = '';
                    contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(contentArea, 'rv-cute-vocab');
                    if (filterMode) contentArea.classList.add('filter-vocab-only'); else contentArea.classList.remove('filter-vocab-only');
                    insertSectionDividers(contentArea);
                    const fillEl = progressWrap.querySelector('.fill-progress-fill');
                    const txtEl = progressWrap.querySelector('.fill-progress-text');
                    if (fillEl) fillEl.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
                    if (txtEl) txtEl.textContent = '已回顾 ' + reviewedVocabSet.size + '/' + vocabCount;
                },
                getContentEl: () => contentArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        /**
         * renderPixelStyle - 复古终端
         */
        function renderPixelStyle(data) {
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            function insertPixelDividers(contentArea) {
                const paragraphs = contentArea.querySelectorAll('.review-paragraph');
                for (let i = paragraphs.length - 1; i > 0; i--) {
                    const divider = document.createElement('div');
                    divider.className = 'rv-pixel-divider';
                    divider.textContent = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
                    paragraphs[i].parentNode.insertBefore(divider, paragraphs[i]);
                }
            }

            const crtWrapper = document.createElement('div');
            crtWrapper.className = 'rv-pixel-wrapper';
            container.appendChild(crtWrapper);

            // Vent holes (before CRT screen)
            const vents = document.createElement('div');
            vents.className = 'rv-pixel-vents';
            for (let i = 0; i < 8; i++) {
                const vent = document.createElement('div');
                vent.className = 'rv-pixel-vent';
                vents.appendChild(vent);
            }
            crtWrapper.appendChild(vents);

            // Power LED (before CRT screen)
            const led = document.createElement('div');
            led.className = 'rv-pixel-led';
            crtWrapper.appendChild(led);

            // CRT monitor
            const crtScreen = document.createElement('div');
            crtScreen.className = 'rv-pixel-crt';
            crtWrapper.appendChild(crtScreen);

            // RGB subpixel layer
            const subpixels = document.createElement('div');
            subpixels.className = 'rv-pixel-subpixels';
            crtScreen.appendChild(subpixels);

            // Terminal title bar
            const titleBar = document.createElement('div');
            titleBar.className = 'rv-pixel-titlebar';
            const titleText = document.createElement('span');
            titleText.className = 'title-text';
            titleText.textContent = 'REVIEW_TERMINAL v1.0';
            titleBar.appendChild(titleText);
            const titleBtns = document.createElement('div');
            titleBtns.className = 'title-btns';

            // Minimize button
            const minimizeBtn = document.createElement('button');
            minimizeBtn.className = 'title-btn title-btn-minimize';
            minimizeBtn.textContent = '─';
            minimizeBtn.title = '最小化';
            titleBtns.appendChild(minimizeBtn);

            // Maximize button
            const maximizeBtn = document.createElement('button');
            maximizeBtn.className = 'title-btn title-btn-maximize';
            maximizeBtn.textContent = '□';
            maximizeBtn.title = '最大化';
            titleBtns.appendChild(maximizeBtn);

            // Close button (exit)
            const closeBtn = document.createElement('button');
            closeBtn.className = 'title-btn title-btn-close';
            closeBtn.textContent = '×';
            closeBtn.title = '退出';
            closeBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            styleCleanups.push(() => closeBtn.removeEventListener('click', () => {}));
            titleBtns.appendChild(closeBtn);
            titleBar.appendChild(titleBtns);
            crtScreen.appendChild(titleBar);

            // Pixel header
            const pixelHeader = document.createElement('div');
            pixelHeader.className = 'rv-pixel-header';
            const headerTitle = document.createElement('h3');
            headerTitle.className = 'rv-pixel-header-title';
            headerTitle.textContent = item.title || 'FULL REVIEW';
            pixelHeader.appendChild(headerTitle);
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'tts-btn';
            ttsBtn.textContent = '[TTS]';
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.textContent = '[TTS]'; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.textContent = '[TTS]'; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.textContent = '[STOP]';
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            pixelHeader.appendChild(ttsBtn);
            crtScreen.appendChild(pixelHeader);

            // Content area
            const contentArea = document.createElement('div');
            contentArea.className = 'rv-pixel-content review-content-fill';
            contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(contentArea, 'rv-pixel-vocab');
            if (filterMode) contentArea.classList.add('filter-vocab-only');
            insertPixelDividers(contentArea);
            crtScreen.appendChild(contentArea);

            // Split translation
            if (item.fullTranslation) {
                const splitDiv = document.createElement('div');
                splitDiv.className = 'rv-pixel-split';
                splitDiv.innerHTML = '<div class="rv-pixel-split-rule">════════════════════════════════</div><div class="split-label">// TRANSLATION</div><div class="split-text">' + item.fullTranslation + '</div>';
                crtScreen.appendChild(splitDiv);
            }

            // Status bar
            const statusBar = document.createElement('div');
            statusBar.className = 'rv-pixel-statusbar review-info-bar';
            statusBar.innerHTML = '<span>WORDS:' + wordCount + '</span><span class="rv-pixel-sep">│</span><span>VOCAB:' + vocabCount + '</span><span class="rv-pixel-sep">│</span><span>REVIEWED:' + reviewedVocabSet.size + '/' + vocabCount + '</span><span class="rv-pixel-sep">│</span><span class="review-timer" id="reviewTimer">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'rv-pixel-info filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            statusBar.appendChild(filterBtn);
            // Complete button embedded in terminal status bar
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-pixel-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            styleCleanups.push(() => completeBtn.removeEventListener('click', () => {}));
            statusBar.appendChild(completeBtn);
            crtScreen.appendChild(statusBar);

            // Progress bar
            const progressWrap = document.createElement('div');
            progressWrap.className = 'rv-pixel-progress review-progress-wrap';
            const totalBlocks = 20;
            const filledBlocks = vocabCount > 0 ? Math.round(reviewedVocabSet.size / vocabCount * totalBlocks) : 0;
            const emptyBlocks = totalBlocks - filledBlocks;
            const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
            progressWrap.innerHTML = '<span class="rv-pixel-ascii-progress">' + progressBar + '</span><span class="fill-progress-text">' + reviewedVocabSet.size + '/' + vocabCount + '</span>';
            crtScreen.appendChild(progressWrap);

            // Brand label (after CRT screen, inside wrapper)
            const brand = document.createElement('div');
            brand.className = 'rv-pixel-brand';
            brand.textContent = 'PIXEL-VIEW';
            crtWrapper.appendChild(brand);

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    contentArea.querySelectorAll('.rv-pixel-divider').forEach(d => d.remove());
                    contentArea.innerHTML = '';
                    contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(contentArea, 'rv-pixel-vocab');
                    if (filterMode) contentArea.classList.add('filter-vocab-only'); else contentArea.classList.remove('filter-vocab-only');
                    insertPixelDividers(contentArea);
                    const fb = vocabCount > 0 ? Math.round(reviewedVocabSet.size / vocabCount * 20) : 0;
                    const eb = 20 - fb;
                    const asciiBar = progressWrap.querySelector('.rv-pixel-ascii-progress');
                    if (asciiBar) asciiBar.textContent = '█'.repeat(fb) + '░'.repeat(eb);
                    const progressText = progressWrap.querySelector('.fill-progress-text');
                    if (progressText) progressText.textContent = reviewedVocabSet.size + '/' + vocabCount;
                    const reviewedSpan = statusBar.querySelector('span:nth-child(5)');
                    if (reviewedSpan) reviewedSpan.textContent = 'REVIEWED:' + reviewedVocabSet.size + '/' + vocabCount;
                },
                getContentEl: () => contentArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        /**
         * renderMinimalStyle - 极简
         */
        function renderMinimalStyle(data) {
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            const minimalWrap = document.createElement('div');
            minimalWrap.className = 'rv-min-wrapper';
            const minInner = document.createElement('div');
            minInner.className = 'min-inner';
            minimalWrap.appendChild(minInner);
            container.appendChild(minimalWrap);

            // Thin progress line at top
            const progressLine = document.createElement('div');
            progressLine.className = 'rv-min-progress-line review-progress-wrap';
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill fill-progress-fill';
            progressFill.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
            progressLine.appendChild(progressFill);
            const progressText = document.createElement('span');
            progressText.className = 'progress-text fill-progress-text';
            progressText.textContent = reviewedVocabSet.size + '/' + vocabCount;
            progressLine.appendChild(progressText);
            minInner.appendChild(progressLine);

            // Controls group (hidden until hover)
            const controls = document.createElement('div');
            controls.className = 'rv-min-controls';
            const header = document.createElement('div');
            header.className = 'rv-min-header';
            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = BACK_SVG;
            backBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            styleCleanups.push(() => backBtn.removeEventListener('click', () => {}));
            header.appendChild(backBtn);
            const infoSpan = document.createElement('span');
            infoSpan.className = 'rv-min-info review-info-bar';
            infoSpan.innerHTML = '<span class="info-item">' + wordCount + ' words</span><span class="info-sep"></span><span class="info-item">' + vocabCount + ' vocab</span><span class="info-sep"></span><span class="info-item review-timer" id="reviewTimer">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            infoSpan.appendChild(filterBtn);
            header.appendChild(infoSpan);
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'tts-btn';
            ttsBtn.innerHTML = SPEAKER_SVG;
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.classList.add('speaking'); ttsBtn.innerHTML = PAUSE_SVG;
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            header.appendChild(ttsBtn);
            // Complete button embedded in minimal controls bar
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-min-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            styleCleanups.push(() => completeBtn.removeEventListener('click', () => {}));
            header.appendChild(completeBtn);
            controls.appendChild(header);
            minInner.appendChild(controls);

            // Content area
            const contentArea = document.createElement('div');
            contentArea.className = 'rv-min-content review-content-fill';
            contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(contentArea, 'rv-min-vocab');
            if (filterMode) contentArea.classList.add('filter-vocab-only');
            minInner.appendChild(contentArea);

            // Translation as collapsible block
            if (item.fullTranslation) {
                const transBlock = document.createElement('div');
                transBlock.className = 'rv-min-collapse';
                const transLabel = document.createElement('div');
                transLabel.className = 'collapse-label';
                transLabel.textContent = '翻译 ▸';
                let transVisible = false;
                const transContent = document.createElement('div');
                transContent.className = 'collapse-content';
                transContent.textContent = item.fullTranslation;
                transLabel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    transVisible = !transVisible;
                    if (transVisible) {
                        transContent.classList.add('open');
                    } else {
                        transContent.classList.remove('open');
                    }
                    transLabel.textContent = (transVisible ? '翻译 ▾' : '翻译 ▸');
                });
                styleCleanups.push(() => transLabel.removeEventListener('click', () => {}));
                transBlock.appendChild(transLabel);
                transBlock.appendChild(transContent);
                minInner.appendChild(transBlock);
            }

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    contentArea.innerHTML = '';
                    contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(contentArea, 'rv-min-vocab');
                    if (filterMode) contentArea.classList.add('filter-vocab-only'); else contentArea.classList.remove('filter-vocab-only');
                    progressFill.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
                    progressText.textContent = reviewedVocabSet.size + '/' + vocabCount;
                },
                getContentEl: () => contentArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        /**
         * renderLibraryStyle - 古籍线装书
         */
        function renderLibraryStyle(data) {
            const { item, reviewVocabMap, masteryMap, wordCount, vocabCount, reviewedVocabSet, container, _cleanupFns, onExit, onComplete, filterMode } = data;
            const styleCleanups = [];
            container.innerHTML = '';

            const woodBg = document.createElement('div');
            woodBg.className = 'rv-lib-wrapper';
            const libInner = document.createElement('div');
            libInner.className = 'lib-inner';
            woodBg.appendChild(libInner);
            container.appendChild(woodBg);

            // Book page
            const page = document.createElement('div');
            page.className = 'rv-lib-book';

            // Gold border
            const border = document.createElement('div');
            border.className = 'rv-lib-border';
            page.appendChild(border);

            // Book title label
            const titleLabel = document.createElement('div');
            titleLabel.className = 'rv-lib-title-label';
            titleLabel.textContent = item.title || '全文回顾';
            page.appendChild(titleLabel);

            // Header with controls
            const header = document.createElement('div');
            header.className = 'rv-lib-header';
            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = BACK_SVG;
            backBtn.addEventListener('click', (e) => { e.stopPropagation(); onExit(); });
            styleCleanups.push(() => backBtn.removeEventListener('click', () => {}));
            header.appendChild(backBtn);
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'tts-btn';
            ttsBtn.innerHTML = SPEAKER_SVG;
            ttsBtn.title = '朗读全文';
            let isSpeaking = false;
            ttsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; }
                else {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(item.originalText);
                    utterance.lang = 'en-US'; utterance.rate = 0.85;
                    utterance.onend = () => { isSpeaking = false; ttsBtn.classList.remove('speaking'); ttsBtn.innerHTML = SPEAKER_SVG; };
                    window.speechSynthesis.speak(utterance);
                    isSpeaking = true; ttsBtn.classList.add('speaking'); ttsBtn.innerHTML = PAUSE_SVG;
                }
            });
            styleCleanups.push(() => { window.speechSynthesis.cancel(); });
            header.appendChild(ttsBtn);
            page.appendChild(header);

            // Info bar
            const infoBar = document.createElement('div');
            infoBar.className = 'rv-lib-info review-info-bar';
            infoBar.innerHTML = '<span class="info-item">词数 ' + wordCount + '</span><span class="info-sep"></span><span class="info-item">生词 ' + vocabCount + '</span><span class="info-sep"></span><span class="info-item review-timer" id="reviewTimer">00:00</span>';
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.title = '仅看含生词的段落';
            filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (data._toggleFilter) data._toggleFilter();
            });
            infoBar.appendChild(filterBtn);
            page.appendChild(infoBar);

            // Content area
            const contentArea = document.createElement('div');
            contentArea.className = 'rv-lib-content review-content-fill';
            contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
            replaceVocabClasses(contentArea, 'rv-lib-vocab');
            if (filterMode) contentArea.classList.add('filter-vocab-only');
            page.appendChild(contentArea);

            // Translation as annotation (collapsible)
            if (item.fullTranslation) {
                const annotDiv = document.createElement('div');
                annotDiv.className = 'rv-lib-jianzhu';
                const labelEl = document.createElement('div');
                labelEl.className = 'jianzhu-label';
                labelEl.textContent = '【译注】 ▾';
                labelEl.style.cursor = 'pointer';
                const textEl = document.createElement('div');
                textEl.className = 'jianzhu-text open';
                textEl.textContent = item.fullTranslation;
                let annotVisible = true;
                labelEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    annotVisible = !annotVisible;
                    if (annotVisible) {
                        textEl.classList.add('open');
                        labelEl.textContent = '【译注】 ▾';
                    } else {
                        textEl.classList.remove('open');
                        labelEl.textContent = '【译注】 ▸';
                    }
                });
                styleCleanups.push(() => labelEl.removeEventListener('click', () => {}));
                annotDiv.appendChild(labelEl);
                annotDiv.appendChild(textEl);
                page.appendChild(annotDiv);
            }

            libInner.appendChild(page);

            // Progress bar
            const progressWrap = document.createElement('div');
            progressWrap.className = 'rv-lib-progress review-progress-wrap';
            progressWrap.innerHTML = '<div class="fill-progress-track"><div class="fill-progress-fill" style="width:' + (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%;height:100%;"></div></div><span class="fill-progress-text">已回顾 ' + reviewedVocabSet.size + ' / ' + vocabCount + '</span>';
            libInner.appendChild(progressWrap);

            // Complete button embedded as collector's seal at bottom of book page
            const completeBtn = document.createElement('button');
            completeBtn.className = 'rv-lib-complete review-fill-bottom';
            completeBtn.innerHTML = CHECK_SVG;
            completeBtn.title = '完成阅读';
            completeBtn.addEventListener('click', (e) => { e.stopPropagation(); onComplete(); });
            styleCleanups.push(() => completeBtn.removeEventListener('click', () => {}));
            libInner.appendChild(completeBtn);

            return {
                cleanup: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; },
                refresh: () => {
                    contentArea.innerHTML = '';
                    contentArea.appendChild(buildHighlightedText(item.originalText, reviewVocabMap, masteryMap, reviewedVocabSet, data.onVocabClick));
                    replaceVocabClasses(contentArea, 'rv-lib-vocab');
                    if (filterMode) contentArea.classList.add('filter-vocab-only'); else contentArea.classList.remove('filter-vocab-only');
                    const fillEl = progressWrap.querySelector('.fill-progress-fill');
                    const txtEl = progressWrap.querySelector('.fill-progress-text');
                    if (fillEl) fillEl.style.width = (vocabCount > 0 ? reviewedVocabSet.size / vocabCount * 100 : 0) + '%';
                    if (txtEl) txtEl.textContent = '已回顾 ' + reviewedVocabSet.size + ' / ' + vocabCount;
                },
                getContentEl: () => contentArea,
                onStyleExit: () => { styleCleanups.forEach(fn => fn()); styleCleanups.length = 0; }
            };
        }

        // ===== MAIN ENTRY: showArticleReviewInterface =====

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
            const _cleanupFns = [];

            // ---- Data preparation ----
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

            const masteryMap = {};
            for (const nb of Object.values(allNotebooks)) {
                if (nb.words) {
                    nb.words.forEach(w => {
                        const key = w.word.toLowerCase().trim();
                        if (key) {
                            masteryMap[key] = {
                                reviewCount: w.reviewCount || 0,
                                lastReviewed: w.lastReviewed || null
                            };
                        }
                    });
                }
            }

            const wordCount = getPlainWordCount(item.originalText);
            const vocabCount = Object.keys(reviewVocabMap).length;
            const reviewedVocabSet = new Set();

            // ---- Exit function ----
            function exitReview() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                _cleanupFns.forEach(fn => fn());
                _cleanupFns.length = 0;
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
            }

            // ---- Vocab click handler ----
            function onVocabClick(word, span) {
                reviewedVocabSet.add(word);
                span.classList.add('reviewed');
                updateReviewProgress(reviewedVocabSet, vocabCount, container.querySelector('.review-progress-wrap'));
                showReviewBubble(span.dataset.meaning, span, word, masteryMap);
            }

            // ---- Complete handler ----
            function onComplete() {
                showReviewSummary();
            }

            // ---- Filter mode ----
            let filterMode = false;
            let currentContentEl = null;

            function setFilterMode(enabled) {
                filterMode = enabled;
                if (currentContentEl) {
                    if (filterMode) currentContentEl.classList.add('filter-vocab-only');
                    else currentContentEl.classList.remove('filter-vocab-only');
                }
                const filterBtn = container.querySelector('#reviewFilterBtn');
                if (filterBtn) filterBtn.classList.toggle('active', filterMode);
            }

            function _toggleFilter() {
                setFilterMode(!filterMode);
            }

            // ---- Timer ----
            let reviewStartTime = Date.now();
            let reviewTimerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - reviewStartTime) / 1000);
                const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const secs = (elapsed % 60).toString().padStart(2, '0');
                const timerEl = document.getElementById('reviewTimer');
                if (timerEl) timerEl.textContent = mins + ':' + secs;
                const timerEl2 = document.getElementById('reviewTimer2');
                if (timerEl2) timerEl2.textContent = mins + ':' + secs;
            }, 1000);
            _cleanupFns.push(() => clearInterval(reviewTimerInterval));

            // ---- Keyboard ESC handler ----
            const escHandler = function(e) {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    exitReview();
                }
            };
            document.addEventListener('keydown', escHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', escHandler));

            // ---- External click closes bubble ----
            const onDocClick = function(e) {
                if (!e.target.classList.contains('review-vocab-word') &&
                    !e.target.classList.contains('rv-book-vocab') &&
                    !e.target.classList.contains('rv-mag-vocab') &&
                    !e.target.classList.contains('rv-news-vocab') &&
                    !e.target.classList.contains('rv-cute-vocab') &&
                    !e.target.classList.contains('rv-pixel-vocab') &&
                    !e.target.classList.contains('rv-min-vocab') &&
                    !e.target.classList.contains('rv-lib-vocab')) {
                    closeReviewBubble();
                }
            };
            document.addEventListener('click', onDocClick);
            _cleanupFns.push(() => document.removeEventListener('click', onDocClick));

            // ---- Current style state ----
            let currentStyleInstance = null;
            let currentReviewStyle = localStorage.getItem('reviewStyle') || 'book';

            // ---- Style map ----
            const styleMap = {
                'book': renderBookStyle,
                'magazine': renderMagazineStyle,
                'newspaper': renderNewspaperStyle,
                'cute': renderCuteStyle,
                'pixel': renderPixelStyle,
                'minimal': renderMinimalStyle,
                'library': renderLibraryStyle
            };

            // ---- Apply style ----
            function applyStyle(styleId) {
                if (currentStyleInstance && currentStyleInstance.onStyleExit) {
                    currentStyleInstance.onStyleExit();
                }
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();

                const renderFn = styleMap[styleId];
                if (!renderFn) return;

                // Set data-review-style attribute for CSS selectors
                container.setAttribute('data-review-style', styleId);

                // Add transition animation
                container.classList.add('style-transitioning');

                currentStyleInstance = renderFn({
                    item, reviewVocabMap, masteryMap, wordCount, vocabCount,
                    reviewedVocabSet, reviewStartTime, container, _cleanupFns,
                    onExit: exitReview, onComplete, filterMode, onVocabClick,
                    _toggleFilter
                });

                // Trigger entrance animation for the current style
                const animateTargets = {
                    'book': container.querySelector('.rv-book-container'),
                    'magazine': [container.querySelector('.rv-mag-wrapper'), container.querySelector('.rv-mag-content')],
                    'newspaper': container.querySelector('.rv-news-wrapper'),
                    'cute': container.querySelector('.rv-cute-wrapper'),
                    'pixel': container.querySelector('.rv-pixel-crt'),
                    'minimal': container.querySelector('.rv-min-wrapper'),
                    'library': container.querySelector('.rv-lib-wrapper')
                };
                // Remove transition before starting animate-in so animations are visible
                container.classList.remove('style-transitioning');

                const targets = animateTargets[styleId];
                if (targets) {
                    const targetList = Array.isArray(targets) ? targets : [targets];
                    // Use requestAnimationFrame to ensure DOM is painted before adding class
                    requestAnimationFrame(() => {
                        targetList.forEach(el => {
                            if (el) el.classList.add('animate-in');
                        });
                        // Remove after longest animation completes (pixel CRT: 1000ms)
                        const maxDuration = styleId === 'pixel' ? 1000 : 800;
                        setTimeout(() => {
                            targetList.forEach(el => {
                                if (el) el.classList.remove('animate-in');
                            });
                        }, maxDuration);
                    });
                }

                currentContentEl = currentStyleInstance.getContentEl();
                currentReviewStyle = styleId;
                localStorage.setItem('reviewStyle', styleId);

                // Update capsule active state
                const capsule = document.getElementById('reviewStyleCapsule');
                if (capsule) {
                    capsule.querySelectorAll('.capsule-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.style === styleId);
                    });
                }

                // Update filter button state
                const filterBtn = container.querySelector('#reviewFilterBtn');
                if (filterBtn) filterBtn.classList.toggle('active', filterMode);
            }

            // ---- Style capsule (floating bottom bar) ----
            const styleCapsule = document.createElement('div');
            styleCapsule.className = 'review-style-capsule';
            styleCapsule.id = 'reviewStyleCapsule';
            styleCapsule.title = '切换阅读风格';
            styleCapsule.innerHTML = REVIEW_STYLES.map(s => '<button class="capsule-btn' + (s.id === currentReviewStyle ? ' active' : '') + '" data-style="' + s.id + '" title="' + s.label + '风格">' + s.icon + '</button>').join('');

            // ---- Filter button in capsule ----
            const filterCapsuleBtn = document.createElement('button');
            filterCapsuleBtn.className = 'capsule-btn';
            filterCapsuleBtn.id = 'reviewFilterBtn';
            filterCapsuleBtn.title = '仅看含生词的段落';
            filterCapsuleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
            filterCapsuleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setFilterMode(!filterMode);
            });
            styleCapsule.appendChild(filterCapsuleBtn);
            document.body.appendChild(styleCapsule);
            _cleanupFns.push(() => styleCapsule.remove());

            // ---- Capsule style buttons ----
            styleCapsule.querySelectorAll('.capsule-btn:not(#reviewFilterBtn)').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    applyStyle(btn.dataset.style);
                });
            });

            // ---- Show review summary ----
            function showReviewSummary() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                clearInterval(reviewTimerInterval);

                const reviewed = reviewedVocabSet.size;
                const totalVocab = vocabCount;
                const readWords = wordCount;
                const rate = totalVocab > 0 ? Math.round((reviewed / totalVocab) * 100) : 100;
                const isPerfect = reviewed >= totalVocab && totalVocab > 0;

                let masteredCount = 0, practicingCount = 0, newCount = 0;
                Object.keys(reviewVocabMap).forEach(word => {
                    const rc = (masteryMap[word] && masteryMap[word].reviewCount) || 0;
                    if (rc === 0) newCount++;
                    else if (rc < 7) practicingCount++;
                    else masteredCount++;
                });

                if (window.StatsTracker) {
                    if (reviewed > 0) {
                        window.StatsTracker.recordWordsLearned(reviewed);
                    }
                    window.StatsTracker.recordModuleActivity('fullReview', Math.max(1, reviewed));
                }

                let titleText = '阅读完成！';
                let titleClass = '';
                if (isPerfect) {
                    titleText = '全部回顾！';
                    titleClass = 'perfect';
                } else if (rate >= 80) {
                    titleText = '回顾得不错！';
                } else if (rate >= 50) {
                    titleText = '继续加油！';
                }

                // Hide UI elements
                const fillBottomEl = container.querySelector('.review-fill-bottom');
                if (fillBottomEl) fillBottomEl.style.display = 'none';
                const progressEl = container.querySelector('.review-progress-wrap');
                if (progressEl) progressEl.style.display = 'none';
                const infoBarEl = container.querySelector('.review-info-bar');
                if (infoBarEl) infoBarEl.style.display = 'none';
                const capsuleEl = document.getElementById('reviewStyleCapsule');
                if (capsuleEl) capsuleEl.style.display = 'none';

                // Replace content area with summary
                if (currentContentEl) {
                    currentContentEl.innerHTML = buildSummaryHtml({
                        titleText,
                        titleClass,
                        modeLabel: '全文回顾模式',
                        isPerfect,
                        perfectText: '已回顾全部生词，太棒了！',
                        stats: [
                            { val: reviewed, lbl: '已回顾生词', cls: 'correct' },
                            { val: totalVocab, lbl: '总生词数', color: '#3b82f6' },
                            { val: readWords, lbl: '阅读词数', color: '#8b5cf6' },
                            { val: rate + '%', lbl: '回顾率', cls: 'rate' },
                            { val: masteredCount + '/' + practicingCount + '/' + newCount, lbl: '掌握/练习/未练', color: '#10b981' }
                        ]
                    });

                    const retryBtn = currentContentEl.querySelector('.summary-retry-btn');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            reviewedVocabSet.clear();
                            if (fillBottomEl) fillBottomEl.style.display = '';
                            if (progressEl) progressEl.style.display = '';
                            if (infoBarEl) infoBarEl.style.display = '';
                            const capsuleEl2 = document.getElementById('reviewStyleCapsule');
                            if (capsuleEl2) capsuleEl2.style.display = '';
                            applyStyle(currentReviewStyle);
                        });
                    }
                }
            }

            // ---- Initial render ----
            applyStyle(currentReviewStyle);
        }

        // ===== showSentenceReviewInterface (UNCHANGED) =====

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

            const _cleanupFns = [];

            const sentenceHeader = document.createElement('div');
            sentenceHeader.className = 'fill-header sentence-fill-header';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = BACK_SVG;

            function exitSentenceReview() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                _cleanupFns.forEach(fn => fn());
                _cleanupFns.length = 0;
                closeSentBubble();
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

            const onBackClick = (e) => {
                e.stopPropagation();
                exitSentenceReview();
            };
            backBtn.addEventListener('click', onBackClick);
            _cleanupFns.push(() => backBtn.removeEventListener('click', onBackClick));
            sentenceHeader.appendChild(backBtn);

            const sentenceTitle = document.createElement('h3');
            sentenceTitle.textContent = `逐句精读 · ${sentences.length} 句`;
            sentenceHeader.appendChild(sentenceTitle);

            const FAV_KEY = 'sentFavorites_' + articleId;
            function getSentFavorites() {
                try {
                    const raw = localStorage.getItem(FAV_KEY);
                    return new Set(raw ? JSON.parse(raw) : []);
                } catch (err) { return new Set(); }
            }
            function saveSentFavorites(set) {
                try {
                    localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
                } catch (err) { /* ignore */ }
            }
            const BOOKMARK_OUTLINE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
            const BOOKMARK_FILLED_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

            let currentTtsToken = 0;
            const sentenceTtsBtn = document.createElement('button');
            sentenceTtsBtn.className = 'review-tts-btn fill-header-tts';
            sentenceTtsBtn.title = '朗读当前句子';
            sentenceTtsBtn.innerHTML = SPEAKER_SVG;
            const onHeaderTtsClick = (e) => {
                e.stopPropagation();
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const token = ++currentTtsToken;
                    const sentenceTextEl = document.getElementById('sentenceReviewText');
                    if (sentenceTextEl) {
                        sentenceTextEl.querySelectorAll('.sent-word-active').forEach(w => w.classList.remove('sent-word-active'));
                    }
                    const utterance = new SpeechSynthesisUtterance(sentences[currentIndex]);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.85;
                    utterance.onboundary = (ev) => {
                        if (token !== currentTtsToken || !sentenceTextEl) return;
                        const charIndex = ev.charIndex || 0;
                        const wordEls = sentenceTextEl.querySelectorAll('.sent-word');
                        if (!wordEls.length) return;
                        let target = null;
                        wordEls.forEach(w => {
                            const offset = parseInt(w.dataset.offset, 10);
                            const len = (w.textContent || '').length;
                            if (offset <= charIndex && charIndex < offset + len) {
                                target = w;
                            }
                        });
                        if (!target) {
                            for (const w of wordEls) {
                                if (parseInt(w.dataset.offset, 10) >= charIndex) { target = w; break; }
                            }
                        }
                        if (target) {
                            wordEls.forEach(w => w.classList.remove('sent-word-active'));
                            target.classList.add('sent-word-active');
                        }
                    };
                    const clearHighlights = () => {
                        if (token !== currentTtsToken) return;
                        if (sentenceTextEl) {
                            sentenceTextEl.querySelectorAll('.sent-word-active').forEach(w => w.classList.remove('sent-word-active'));
                        }
                    };
                    utterance.onend = clearHighlights;
                    utterance.onerror = clearHighlights;
                    window.speechSynthesis.speak(utterance);
                }
            };
            sentenceTtsBtn.addEventListener('click', onHeaderTtsClick);
            _cleanupFns.push(() => sentenceTtsBtn.removeEventListener('click', onHeaderTtsClick));
            sentenceHeader.appendChild(sentenceTtsBtn);

            const sentenceFavBtn = document.createElement('button');
            sentenceFavBtn.className = 'review-fav-btn fill-header-fav';
            sentenceFavBtn.title = '收藏当前句子';
            sentenceFavBtn.innerHTML = BOOKMARK_OUTLINE_SVG;
            function updateFavoriteUI(idx) {
                const favs = getSentFavorites();
                const isFav = favs.has(idx);
                if (sentenceFavBtn) {
                    sentenceFavBtn.innerHTML = isFav ? BOOKMARK_FILLED_SVG : BOOKMARK_OUTLINE_SVG;
                    sentenceFavBtn.classList.toggle('favorited', isFav);
                }
                const textEl = document.getElementById('sentenceReviewText');
                if (textEl) {
                    let mark = textEl.querySelector('.sent-fav-mark');
                    if (isFav) {
                        if (!mark) {
                            mark = document.createElement('span');
                            mark.className = 'sent-fav-mark';
                            mark.innerHTML = BOOKMARK_FILLED_SVG;
                            textEl.appendChild(mark);
                        }
                    } else if (mark) {
                        mark.remove();
                    }
                }
            }
            const onFavClick = (e) => {
                e.stopPropagation();
                const favs = getSentFavorites();
                if (favs.has(currentIndex)) {
                    favs.delete(currentIndex);
                } else {
                    favs.add(currentIndex);
                }
                saveSentFavorites(favs);
                updateFavoriteUI(currentIndex);
            };
            sentenceFavBtn.addEventListener('click', onFavClick);
            _cleanupFns.push(() => sentenceFavBtn.removeEventListener('click', onFavClick));
            sentenceHeader.appendChild(sentenceFavBtn);

            container.appendChild(sentenceHeader);

            const progressWrap = document.createElement('div');
            progressWrap.className = 'fill-progress-wrap sentence-progress-wrap';
            progressWrap.innerHTML = `
                <div class="fill-progress-track">
                    <div class="fill-progress-fill" style="width:${(1 / sentences.length * 100)}%"></div>
                </div>
                <span class="fill-progress-text">1 / ${sentences.length}</span>
            `;
            container.appendChild(progressWrap);

            const sentenceNav = document.createElement('div');
            sentenceNav.className = 'sentence-nav sentence-nav-fill';
            const sentenceIndexEl = document.createElement('span');
            sentenceIndexEl.className = 'sentence-index';
            sentenceIndexEl.textContent = '1 / ' + sentences.length;
            sentenceNav.appendChild(sentenceIndexEl);

            const navHint = document.createElement('span');
            navHint.className = 'sent-nav-hint';
            navHint.textContent = '← → 键切换 · ESC 退出';
            sentenceNav.appendChild(navHint);
            container.appendChild(sentenceNav);

            const sentenceContent = document.createElement('div');
            sentenceContent.className = 'sentence-review-content sentence-content-fill';

            const sentenceText = document.createElement('div');
            sentenceText.className = 'sentence-review-text';
            sentenceText.id = 'sentenceReviewText';
            sentenceContent.appendChild(sentenceText);

            const sentenceAnalysis = document.createElement('div');
            sentenceAnalysis.className = 'sentence-review-analysis';
            sentenceAnalysis.id = 'sentenceReviewAnalysis';
            sentenceContent.appendChild(sentenceAnalysis);

            container.appendChild(sentenceContent);

            // 底部导航按钮
            const fillBottom = document.createElement('div');
            fillBottom.className = 'fill-bottom sentence-fill-bottom';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'fill-hint-btn sent-nav-btn-fill';
            prevBtn.id = 'sentenceReviewPrevBtn';
            prevBtn.title = '上一句';
            prevBtn.innerHTML = ARROW_LEFT_SVG;
            const onPrevClick = (e) => {
                e.stopPropagation();
                if (currentIndex > 0) renderSentence(currentIndex - 1);
            };
            prevBtn.addEventListener('click', onPrevClick);
            _cleanupFns.push(() => prevBtn.removeEventListener('click', onPrevClick));
            fillBottom.appendChild(prevBtn);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'fill-hint-btn sent-nav-btn-fill';
            nextBtn.id = 'sentenceReviewNextBtn';
            nextBtn.title = '下一句';
            nextBtn.innerHTML = ARROW_RIGHT_SVG;
            const onNextClick = (e) => {
                e.stopPropagation();
                if (currentIndex < sentences.length - 1) renderSentence(currentIndex + 1);
            };
            nextBtn.addEventListener('click', onNextClick);
            _cleanupFns.push(() => nextBtn.removeEventListener('click', onNextClick));
            fillBottom.appendChild(nextBtn);

            container.appendChild(fillBottom);
            _cleanupFns.push(() => fillBottom.remove());

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

            const vocabSentences = [];
            for (let i = 0; i < sentences.length; i++) {
                const sText = sentences[i] || '';
                const sWords = sText.match(/[a-zA-Z'-]+/g) || [];
                const sVocabCount = sWords.filter(w => sentVocabMap[w.toLowerCase()]).length;
                if (sVocabCount > 0) {
                    vocabSentences.push({
                        idx: i,
                        count: sVocabCount,
                        preview: sText.replace(/\s+/g, ' ').trim().slice(0, 20)
                    });
                }
            }

            const sentVocabBtn = document.createElement('button');
            sentVocabBtn.className = 'sent-vocab-nav-btn';
            sentVocabBtn.title = '生词句列表';
            sentVocabBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
            const sentVocabPanel = document.createElement('div');
            sentVocabPanel.className = 'sent-vocab-panel';
            sentVocabPanel.style.display = 'none';
            let sentVocabPanelOpen = false;
            function toggleSentVocabPanel(open) {
                sentVocabPanelOpen = (typeof open === 'boolean') ? open : !sentVocabPanelOpen;
                sentVocabPanel.style.display = sentVocabPanelOpen ? '' : 'none';
                sentVocabBtn.classList.toggle('active', sentVocabPanelOpen);
            }
            const onSentVocabBtnClick = (e) => {
                e.stopPropagation();
                toggleSentVocabPanel();
            };
            sentVocabBtn.addEventListener('click', onSentVocabBtnClick);
            _cleanupFns.push(() => sentVocabBtn.removeEventListener('click', onSentVocabBtnClick));

            if (vocabSentences.length > 0) {
                const panelHeader = document.createElement('div');
                panelHeader.className = 'sent-vocab-panel-header';
                panelHeader.textContent = '生词句列表（' + vocabSentences.length + '）';
                sentVocabPanel.appendChild(panelHeader);
                const panelList = document.createElement('div');
                panelList.className = 'sent-vocab-panel-list';
                vocabSentences.forEach(vs => {
                    const item = document.createElement('button');
                    item.className = 'sent-vocab-panel-item';
                    item.dataset.idx = vs.idx;
                    item.innerHTML = '<span class="sent-vocab-panel-num">' + (vs.idx + 1) + '</span>' +
                        '<span class="sent-vocab-panel-preview"></span>' +
                        '<span class="sent-vocab-panel-count">' + vs.count + '词</span>';
                    item.querySelector('.sent-vocab-panel-preview').textContent = vs.preview;
                    const onItemClick = (e) => {
                        e.stopPropagation();
                        toggleSentVocabPanel(false);
                        renderSentence(vs.idx);
                    };
                    item.addEventListener('click', onItemClick);
                    _cleanupFns.push(() => item.removeEventListener('click', onItemClick));
                    panelList.appendChild(item);
                });
                sentVocabPanel.appendChild(panelList);
            } else {
                const empty = document.createElement('div');
                empty.className = 'sent-vocab-panel-empty';
                empty.textContent = '暂无含生词的句子';
                sentVocabPanel.appendChild(empty);
            }

            sentenceNav.insertBefore(sentVocabBtn, navHint);
            sentenceNav.appendChild(sentVocabPanel);

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
                let wordIdx = 0;
                let charOffset = 0;
                while ((match = regex.exec(text)) !== null) {
                    if (match[1]) {
                        const word = match[1];
                        const lower = word.toLowerCase();
                        const span = document.createElement('span');
                        span.className = 'sent-word';
                        span.dataset.idx = wordIdx;
                        span.dataset.offset = charOffset;
                        span.textContent = word;
                        if (sentVocabMap[lower]) {
                            span.classList.add('review-vocab-word');
                            span.dataset.meaning = sentVocabMap[lower];
                            span.addEventListener('click', (e) => {
                                e.stopPropagation();
                                showSentBubble(span.dataset.meaning, span);
                            });
                        }
                        frag.appendChild(span);
                        wordIdx++;
                        charOffset += word.length;
                    } else if (match[2]) {
                        frag.appendChild(document.createTextNode(match[2]));
                        charOffset += match[2].length;
                    }
                }
                return frag;
            }

            let currentIndex = 0;
            const sentenceData = item.sentenceData || {};
            const readSentencesSet = new Set();
            const touchedVocabSet = new Set();

            function collectSentenceVocab(idx) {
                const text = sentences[idx] || '';
                const regex = /([a-zA-Z'-]+)/g;
                let m;
                while ((m = regex.exec(text)) !== null) {
                    const lower = m[1].toLowerCase();
                    if (sentVocabMap[lower]) {
                        touchedVocabSet.add(lower);
                    }
                }
            }

            const ANALYSIS_TABS = [
                { key: 'translation', label: '翻译', cls: 'tab-translation' },
                { key: 'knowledge', label: '知识点', cls: 'tab-knowledge' },
                { key: 'syntax', label: '语法', cls: 'tab-syntax' }
            ];

            function ensureAnalysisTabs(analysisEl) {
                if (analysisEl.querySelector('.sentence-analysis-tabs')) return;
                analysisEl.innerHTML = '';
                const tabsBar = document.createElement('div');
                tabsBar.className = 'sentence-analysis-tabs';
                ANALYSIS_TABS.forEach((t, i) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'sentence-tab-btn ' + t.cls + (i === 0 ? ' active' : '');
                    btn.dataset.tab = t.key;
                    btn.textContent = t.label;
                    const onTabClick = (e) => {
                        e.stopPropagation();
                        analysisEl.querySelectorAll('.sentence-tab-btn').forEach(b => b.classList.remove('active'));
                        analysisEl.querySelectorAll('.sentence-tab-content').forEach(c => c.classList.remove('active'));
                        btn.classList.add('active');
                        const content = analysisEl.querySelector('.sentence-tab-content[data-tab="' + t.key + '"]');
                        if (content) content.classList.add('active');
                    };
                    btn.addEventListener('click', onTabClick);
                    _cleanupFns.push(() => btn.removeEventListener('click', onTabClick));
                    tabsBar.appendChild(btn);
                });
                // 刷新按钮
                const refreshBtn = document.createElement('button');
                refreshBtn.type = 'button';
                refreshBtn.className = 'sentence-tab-btn tab-refresh';
                refreshBtn.title = '重新分析当前句子';
                refreshBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>';
                const onRefreshClick = (e) => {
                    e.stopPropagation();
                    fetchSentenceAnalysis(currentIndex);
                };
                refreshBtn.addEventListener('click', onRefreshClick);
                _cleanupFns.push(() => refreshBtn.removeEventListener('click', onRefreshClick));
                tabsBar.appendChild(refreshBtn);
                const contentsWrap = document.createElement('div');
                contentsWrap.className = 'sentence-tab-contents';
                ANALYSIS_TABS.forEach((t, i) => {
                    const content = document.createElement('div');
                    content.className = 'sentence-tab-content' + (i === 0 ? ' active' : '');
                    content.dataset.tab = t.key;
                    contentsWrap.appendChild(content);
                });
                analysisEl.appendChild(tabsBar);
                analysisEl.appendChild(contentsWrap);
            }

            function setTabContent(analysisEl, key, html, isPos, isEmptyMsg) {
                const content = analysisEl.querySelector('.sentence-tab-content[data-tab="' + key + '"]');
                if (!content) return;
                content.innerHTML = '';
                if (isEmptyMsg) {
                    const empty = document.createElement('div');
                    empty.className = 'sentence-analysis-empty';
                    empty.textContent = html;
                    content.appendChild(empty);
                    return;
                }
                if (!html) {
                    const empty = document.createElement('div');
                    empty.className = 'sentence-analysis-empty';
                    empty.textContent = '暂无';
                    content.appendChild(empty);
                    return;
                }
                if (isPos) {
                    const wrap = document.createElement('div');
                    wrap.className = 'pos-list';
                    wrap.innerHTML = html;
                    content.appendChild(wrap);
                } else {
                    const value = document.createElement('div');
                    value.className = 'analysis-value';
                    value.innerHTML = html;
                    content.appendChild(value);
                }
            }

            function fetchSentenceAnalysis(idx) {
                const analysisEl = document.getElementById('sentenceReviewAnalysis');
                if (!analysisEl) return;
                const loadingText = '<span class="analysis-loading">AI 分析中...</span>';
                setTabContent(analysisEl, 'translation', loadingText);
                setTabContent(analysisEl, 'knowledge', loadingText);
                setTabContent(analysisEl, 'syntax', loadingText);
                const sentence = sentences[idx];
                (async () => {
                    try {
                        const [syntaxRes, knowledgeRes, translationRes] = await Promise.all([
                            window.APIRequest.requestSyntax(sentence),
                            window.APIRequest.requestKnowledge(sentence),
                            window.APIRequest.requestTranslation(sentence)
                        ]);
                        const newData = {
                            syntax: syntaxRes,
                            knowledge: knowledgeRes,
                            translation: translationRes
                        };
                        sentenceData[idx] = newData;
                        window.HistoryManager.updateSentenceData(articleId, idx, newData);
                        if (currentIndex === idx && analysisEl) {
                            setTabContent(analysisEl, 'translation', newData.translation || '');
                            setTabContent(analysisEl, 'knowledge', newData.knowledge || '');
                            setTabContent(analysisEl, 'syntax', newData.syntax || '');
                        }
                    } catch (e) {
                        console.warn('[逐句精读] 分析失败:', e);
                        if (currentIndex === idx && analysisEl) {
                            setTabContent(analysisEl, 'translation', '分析失败，请重试', false, true);
                            setTabContent(analysisEl, 'knowledge', '');
                            setTabContent(analysisEl, 'syntax', '');
                        }
                    }
                })();
            }

            function renderSentence(idx) {
                currentIndex = idx;
                currentTtsToken++;
                readSentencesSet.add(idx);
                collectSentenceVocab(idx);
                const sentenceTextEl = document.getElementById('sentenceReviewText');
                const analysisEl = document.getElementById('sentenceReviewAnalysis');

                if (sentenceTextEl) {
                    sentenceTextEl.innerHTML = '';
                    sentenceTextEl.appendChild(buildSentHighlightedText(sentences[idx]));
                }
                updateFavoriteUI(idx);
                if (sentVocabPanel) {
                    sentVocabPanel.querySelectorAll('.sent-vocab-panel-item').forEach(it => {
                        it.classList.toggle('active', parseInt(it.dataset.idx, 10) === idx);
                    });
                }
                sentenceIndexEl.textContent = (idx + 1) + ' / ' + sentences.length;
                prevBtn.disabled = idx === 0;
                nextBtn.disabled = idx === sentences.length - 1;

                const fillEl = progressWrap.querySelector('.fill-progress-fill');
                const txtEl = progressWrap.querySelector('.fill-progress-text');
                if (fillEl) fillEl.style.width = ((idx + 1) / sentences.length * 100) + '%';
                if (txtEl) txtEl.textContent = (idx + 1) + ' / ' + sentences.length;

                if (analysisEl) {
                    ensureAnalysisTabs(analysisEl);
                    const data = sentenceData[idx];
                    if (data) {
                        setTabContent(analysisEl, 'translation', data.translation || '');
                        setTabContent(analysisEl, 'knowledge', data.knowledge || '');
                        setTabContent(analysisEl, 'syntax', data.syntax || '');
                    } else {
                        fetchSentenceAnalysis(idx);
                    }
                }
            }

            renderSentence(0);

            function sentenceKeyHandler(e) {
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    renderSentence(currentIndex - 1);
                } else if (e.key === 'ArrowRight' && currentIndex < sentences.length - 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    renderSentence(currentIndex + 1);
                }
            }
            document.addEventListener('keydown', sentenceKeyHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', sentenceKeyHandler));

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    backBtn.click();
                }
            };
            document.addEventListener('keydown', escHandler);
            _cleanupFns.push(() => document.removeEventListener('keydown', escHandler));

            const onDocClick = (e) => {
                if (!e.target.classList.contains('review-vocab-word')) {
                    closeSentBubble();
                }
            };
            document.addEventListener('click', onDocClick);
            _cleanupFns.push(() => document.removeEventListener('click', onDocClick));

            function showSentenceSummary() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();

                const readCount = readSentencesSet.size;
                const totalCount = sentences.length;
                const vocabCount = touchedVocabSet.size;
                const rate = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;
                const isPerfect = readCount >= totalCount;

                if (window.StatsTracker) {
                    window.StatsTracker.recordModuleActivity('sentenceReview', Math.max(1, readCount));
                    if (vocabCount > 0) {
                        window.StatsTracker.recordWordsLearned(vocabCount);
                    }
                }

                let titleText = '阅读完成！';
                let titleClass = '';
                if (isPerfect) {
                    titleText = '全部读完！';
                    titleClass = 'perfect';
                } else if (rate >= 80) {
                    titleText = '读得不错！';
                } else if (rate >= 50) {
                    titleText = '继续加油！';
                }

                const progressEl = container.querySelector('.sentence-progress-wrap');
                if (progressEl) progressEl.style.display = 'none';
                const navEl = container.querySelector('.sentence-nav-fill');
                if (navEl) navEl.style.display = 'none';

                function restoreSentenceView(idx) {
                    sentenceContent.innerHTML = '';
                    const newText = document.createElement('div');
                    newText.className = 'sentence-review-text';
                    newText.id = 'sentenceReviewText';
                    sentenceContent.appendChild(newText);
                    const newAnalysis = document.createElement('div');
                    newAnalysis.className = 'sentence-review-analysis';
                    newAnalysis.id = 'sentenceReviewAnalysis';
                    sentenceContent.appendChild(newAnalysis);

                    if (progressEl) progressEl.style.display = '';
                    if (navEl) navEl.style.display = '';
                    currentIndex = idx;
                    renderSentence(idx);
                }

                sentenceContent.innerHTML = buildSummaryHtml({
                    titleText,
                    titleClass,
                    modeLabel: '逐句精读模式',
                    isPerfect,
                    perfectText: '已完成全部句子的精读！',
                    stats: [
                        { val: readCount, lbl: '已读句数', cls: 'correct' },
                        { val: totalCount, lbl: '总句数', color: '#3b82f6' },
                        { val: vocabCount, lbl: '涉及生词', color: '#f97316' },
                        { val: rate + '%', lbl: '完成率', cls: 'rate' }
                    ]
                });

                const favSet = getSentFavorites();
                const favList = Array.from(favSet).sort((a, b) => a - b);
                if (favList.length > 0) {
                    const favSection = document.createElement('div');
                    favSection.className = 'sent-fav-summary';
                    const favTitle = document.createElement('div');
                    favTitle.className = 'sent-fav-summary-title';
                    favTitle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> 已收藏句子（' + favList.length + '）';
                    favSection.appendChild(favTitle);
                    const favListEl = document.createElement('div');
                    favListEl.className = 'sent-fav-summary-list';
                    favList.forEach(fIdx => {
                        const sText = (sentences[fIdx] || '').replace(/\s+/g, ' ').trim();
                        const preview = sText.slice(0, 30);
                        const item = document.createElement('button');
                        item.type = 'button';
                        item.className = 'sent-fav-summary-item';
                        item.innerHTML = '<span class="sent-fav-summary-num">' + (fIdx + 1) + '</span><span class="sent-fav-summary-preview"></span>';
                        item.querySelector('.sent-fav-summary-preview').textContent = preview + (sText.length > 30 ? '...' : '');
                        const onFavJump = (e) => {
                            e.stopPropagation();
                            restoreSentenceView(fIdx);
                        };
                        item.addEventListener('click', onFavJump);
                        _cleanupFns.push(() => item.removeEventListener('click', onFavJump));
                        favListEl.appendChild(item);
                    });
                    favSection.appendChild(favListEl);
                    sentenceContent.appendChild(favSection);
                }

                const retryBtn = sentenceContent.querySelector('.summary-retry-btn');
                if (retryBtn) {
                    const onRetryClick = (e) => {
                        e.stopPropagation();
                        readSentencesSet.clear();
                        touchedVocabSet.clear();
                        restoreSentenceView(0);
                    };
                    retryBtn.addEventListener('click', onRetryClick);
                    _cleanupFns.push(() => retryBtn.removeEventListener('click', onRetryClick));
                }
            }
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