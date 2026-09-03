(function() {
    let _showToast = null;
    let _getVocabData = null;
    let _articleSelectedNotebookIds = null;

    ModuleRegistry.register('MemoryModeUI', ['GlobalManager'], function(GlobalManager) {

        function showMemoryModeInterface(container) {
            // 回到记忆模式菜单，恢复侧边栏显示
            document.body.classList.remove('mode-sub-interface');

            // 隐藏生词本界面
            container.style.display = 'none';
            
            // 检查是否已存在记忆模式界面
            let memoryModeDiv = document.getElementById('memoryModeInterface');
            if (!memoryModeDiv) {
                // 创建记忆模式界面容器
                memoryModeDiv = document.createElement('div');
                memoryModeDiv.id = 'memoryModeInterface';
                memoryModeDiv.className = 'vocab-card memory-mode-card memory-rainbow-off';
            }
            
            // 确保显示（CSS 默认隐藏）
            memoryModeDiv.style.setProperty('display', 'block', 'important');

            // 清理旧的事件监听器（防止内存泄漏）
            if (memoryModeDiv._cleanup) {
                memoryModeDiv._cleanup();
            }
            const _cleanupFns = [];

            // 清空容器，重新渲染内容
            memoryModeDiv.innerHTML = '';
            
            // 头部区域（包含功能按钮）
            const header = document.createElement('div');
            header.className = 'memory-mode-header';
            
            // 标题
            const title = document.createElement('div');
            title.className = 'memory-mode-title';
            title.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;flex-shrink:0"><path d="M9 12h6"/><path d="M12 9v6"/><path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.2 4.5 3 5.5V21l4-2 4 2v-6.5c1.8-1 3-3 3-5.5a7 7 0 0 0-7-7z"/></svg> 记忆模式';
            header.appendChild(title);

            // 标签切换栏（放在header内，作为第2个子元素）
            const tabBar = document.createElement('div');
            tabBar.className = 'memory-mode-tabs';

            const wordTab = document.createElement('button');
            wordTab.className = 'memory-mode-tab active';
            wordTab.dataset.tab = 'word';
            wordTab.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> 单词';

            const articleTab = document.createElement('button');
            articleTab.className = 'memory-mode-tab';
            articleTab.dataset.tab = 'article';
            articleTab.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> 文章';

            tabBar.appendChild(wordTab);
            tabBar.appendChild(articleTab);
            header.appendChild(tabBar);
            
            // 功能按钮容器（统一放在 header 中，两个 tab 共用）
            const headerButtons = document.createElement('div');
            headerButtons.className = 'memory-mode-header-buttons';
            
            // 学习统计按钮
            const statsButton = document.createElement('button');
            statsButton.innerText = '学习统计';
            statsButton.className = 'section-btn header-section-btn';
            statsButton.onclick = () => {
                // 显示学习统计详细界面
                showStatsDetailInterface(memoryModeDiv);
            };
            headerButtons.appendChild(statsButton);
            
            // 学习计划按钮
                const planButton = document.createElement('button');
                planButton.innerText = '学习计划';
                planButton.className = 'section-btn header-section-btn';
                planButton.onclick = () => {
                    // 显示学习计划详细界面
                    showPlanDetailInterface(memoryModeDiv);
                };
            headerButtons.appendChild(planButton);
            
            // 模式选择区域
            const modeSelectDiv = document.createElement('div');
            modeSelectDiv.className = 'mode-select-section';

            // 单词标签内容
            const wordContent = document.createElement('div');
            wordContent.className = 'memory-mode-tab-content word-tab-content';

            // 生词本选择器
            const notebookSelector = document.createElement('div');
            notebookSelector.className = 'memory-notebook-selector';
            notebookSelector.appendChild(headerButtons);

            const currentNotebookId = window.VocabData ? window.VocabData.getCurrentNotebookId() : null;
            const allNotebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const currentNotebook = currentNotebookId ? allNotebooks[currentNotebookId] : null;

            const selectorCurrent = document.createElement('div');
            selectorCurrent.className = 'memory-notebook-current';

            const currentColorDot = document.createElement('span');
            currentColorDot.className = 'memory-nb-color-dot';
            if (currentNotebook) {
                currentColorDot.style.background = currentNotebook.color || '#6366f1';
            }
            selectorCurrent.appendChild(currentColorDot);

            const currentNameSpan = document.createElement('span');
            currentNameSpan.className = 'memory-nb-name';
            currentNameSpan.textContent = currentNotebook ? currentNotebook.name : '默认生词本';
            selectorCurrent.appendChild(currentNameSpan);

            const currentCountSpan = document.createElement('span');
            currentCountSpan.className = 'memory-nb-count';
            currentCountSpan.textContent = currentNotebook ? (currentNotebook.words ? currentNotebook.words.length : 0) + ' 词' : '0 词';
            selectorCurrent.appendChild(currentCountSpan);

            const arrowSpan = document.createElement('span');
            arrowSpan.className = 'memory-nb-arrow';
            arrowSpan.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
            selectorCurrent.appendChild(arrowSpan);

            notebookSelector.appendChild(selectorCurrent);

            // 下拉列表
            const dropdown = document.createElement('div');
            dropdown.className = 'memory-notebook-dropdown';

            for (const [id, nb] of Object.entries(allNotebooks)) {
                const option = document.createElement('div');
                option.className = 'memory-nb-option';
                if (id === currentNotebookId) {
                    option.classList.add('active');
                }

                const dot = document.createElement('span');
                dot.className = 'memory-nb-color-dot';
                dot.style.background = nb.color || '#6366f1';
                option.appendChild(dot);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'memory-nb-name';
                nameSpan.textContent = nb.name;
                option.appendChild(nameSpan);

                const countSpan = document.createElement('span');
                countSpan.className = 'memory-nb-count';
                countSpan.textContent = (nb.words ? nb.words.length : 0) + ' 词';
                option.appendChild(countSpan);

                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.VocabData) {
                        window.VocabData.setCurrentNotebookId(id);
                    }
                    currentColorDot.style.background = nb.color || '#6366f1';
                    currentNameSpan.textContent = nb.name;
                    currentCountSpan.textContent = (nb.words ? nb.words.length : 0) + ' 词';
                    dropdown.querySelectorAll('.memory-nb-option').forEach(o => o.classList.remove('active'));
                    option.classList.add('active');
                    dropdown.classList.remove('open');
                    notebookSelector.classList.remove('open');
                });

                dropdown.appendChild(option);
            }

            selectorCurrent.appendChild(dropdown);

            // 点击展开/收起
            selectorCurrent.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
                notebookSelector.classList.toggle('open');
            });

            // 点击外部关闭下拉
            function closeDropdownOnOutsideClick(e) {
                if (dropdown.contains(e.target) || selectorCurrent.contains(e.target)) return;
                dropdown.classList.remove('open');
                notebookSelector.classList.remove('open');
            }
            document.addEventListener('click', closeDropdownOnOutsideClick);
            _cleanupFns.push(() => document.removeEventListener('click', closeDropdownOnOutsideClick));

            wordContent.appendChild(notebookSelector);

            // 今日待复习轻量提示（复用现有 class，不破坏布局）
            const dueCount = window.VocabData && typeof window.VocabData.getDueCount === 'function'
                ? window.VocabData.getDueCount() : 0;
            const dueHint = document.createElement('div');
            dueHint.className = 'mode-card-stat';
            dueHint.style.margin = '0 0 8px 2px';
            dueHint.textContent = '今日待复习 ' + dueCount + ' 词';
            wordContent.appendChild(dueHint);

            // 功能入口：内置词库 + 词汇量自测
            const libRow = document.createElement('div');
            libRow.style.cssText = 'display:flex;gap:8px;margin:0 0 10px 2px;';
            const makeEntryBtn = (label, iconSvg, onClick) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'section-btn vocab-library-btn';
                b.style.cssText = 'flex:1;cursor:pointer;';
                b.innerHTML = iconSvg + label;
                b.onclick = onClick;
                return b;
            };
            const libIcon = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
            const quizIcon = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            libRow.appendChild(makeEntryBtn('内置词库', libIcon, () => { showVocabLibraryModal(memoryModeDiv); }));
            libRow.appendChild(makeEntryBtn('词汇量自测', quizIcon, () => { showVocabularyQuizModal(); }));
            wordContent.appendChild(libRow);

            const modeTitle = document.createElement('h4');
            modeTitle.innerText = '选择记忆模式';
            wordContent.appendChild(modeTitle);

            const modeButtons = [
                { 
                    id: 'flashcard', 
                    text: '闪卡模式',
                    desc: '翻转卡片，快速记忆单词',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
                    available: true,
                    color: '#3b82f6'
                },
                { 
                    id: 'fill', 
                    text: '填空练习',
                    desc: '语境填空，加深词汇理解',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
                    available: true,
                    color: '#10b981'
                },
                { 
                    id: 'spelling', 
                    text: '听写练习',
                    desc: '听音拼写，强化听写能力',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
                    available: true,
                    color: '#8b5cf6'
                },
                { 
                    id: 'choice', 
                    text: '选词练习',
                    desc: '释义·听音·选中文·填空',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
                    available: true,
                    color: '#f59e0b'
                }
            ];

            const modeGrid = document.createElement('div');
            modeGrid.className = 'mode-grid';

            // 获取模块统计数据，用于卡片显示学习进度
            const allModuleStats = window.StatsTracker ? window.StatsTracker.getModuleAllTimeStats() : [];
            const statsMap = {};
            allModuleStats.forEach(s => { statsMap[s.key] = s.count; });

            modeButtons.forEach(mode => {
                const card = document.createElement('div');
                card.className = 'mode-card';
                card.setAttribute('tabindex', '0');
                card.setAttribute('role', 'button');
                if (mode.color) {
                    card.style.setProperty('--mode-accent', mode.color);
                }
                if (!mode.available) {
                    card.classList.add('coming-soon');
                }

                const iconDiv = document.createElement('div');
                iconDiv.className = 'mode-card-icon';
                iconDiv.innerHTML = mode.icon;

                const label = document.createElement('div');
                label.className = 'mode-card-label';
                label.textContent = mode.text;

                const desc = document.createElement('div');
                desc.className = 'mode-card-desc';
                desc.textContent = mode.desc;

                card.appendChild(iconDiv);
                card.appendChild(label);
                card.appendChild(desc);

                // 学习进度提示
                if (mode.available) {
                    const statCount = statsMap[mode.id] || 0;
                    if (statCount > 0) {
                        const stat = document.createElement('div');
                        stat.className = 'mode-card-stat';
                        stat.textContent = `已学 ${statCount} 次`;
                        card.appendChild(stat);
                    }
                }

                if (!mode.available) {
                    const badge = document.createElement('span');
                    badge.className = 'mode-card-badge';
                    badge.textContent = '即将上线';
                    card.appendChild(badge);
                }

                card.onclick = () => {
                    if (!mode.available) {
                        _showToast(`${mode.text}功能即将上线`);
                        return;
                    }
                    if (mode.id === 'flashcard') {
                        const flashcardMode = GlobalManager.getGlobalObject('FlashcardMode');
                        if (flashcardMode && flashcardMode.showFlashcardModeInterface) {
                            document.body.classList.add('mode-sub-interface');
                            flashcardMode.showFlashcardModeInterface(memoryModeDiv);
                        } else {
                            _showToast('闪卡模式模块未加载');
                        }
                    } else if (mode.id === 'fill') {
                        document.body.classList.add('mode-sub-interface');
                        showFillPracticeInterface(memoryModeDiv);
                    } else if (mode.id === 'spelling') {
                        document.body.classList.add('mode-sub-interface');
                        showSpellingPracticeInterface(memoryModeDiv);
                    } else if (mode.id === 'choice') {
                        document.body.classList.add('mode-sub-interface');
                        showChoicePracticeInterface(memoryModeDiv);
                    }
                };

                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        card.click();
                    }
                });

                modeGrid.appendChild(card);
            });

            wordContent.appendChild(modeGrid);

            modeSelectDiv.appendChild(wordContent);

            // 文章标签内容
            const articleContent = document.createElement('div');
            articleContent.className = 'memory-mode-tab-content article-tab-content';
            articleContent.style.display = 'none';

            // 文章tab也显示功能按钮
            const articleHeaderButtons = headerButtons.cloneNode(true);
            // 重新绑定点击事件（cloneNode不会复制事件）
            const statsBtn = articleHeaderButtons.querySelector('.section-btn:first-child');
            const planBtn = articleHeaderButtons.querySelector('.section-btn:last-child');
            statsBtn.onclick = () => { showStatsDetailInterface(memoryModeDiv); };
            planBtn.onclick = () => { showPlanDetailInterface(memoryModeDiv); };
            // 文章选择器
            const articleSelector = document.createElement('div');
            articleSelector.className = 'memory-article-selector';
            articleSelector.appendChild(articleHeaderButtons);

            const historyList = window.HistoryManager ? window.HistoryManager.getHistory() : [];
            let selectedArticleId = historyList.length > 0 ? historyList[0].id : null;
            articleSelector._selectedId = selectedArticleId;

            const articleCurrent = document.createElement('div');
            articleCurrent.className = 'memory-article-current';

            const articleIcon = document.createElement('span');
            articleIcon.className = 'memory-article-icon';
            articleIcon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
            articleCurrent.appendChild(articleIcon);

            const currentArticleTitle = document.createElement('span');
            currentArticleTitle.className = 'memory-article-title';

            const currentArticleDate = document.createElement('span');
            currentArticleDate.className = 'memory-article-date';

            const currentArticleVocab = document.createElement('span');
            currentArticleVocab.className = 'memory-article-vocab-count';

            function getVocabCountForArticle(text) {
                if (!text || !window.VocabData) return 0;
                const allNotebooks = window.VocabData.getAllNotebooks();
                const vocabWords = new Set();
                for (const nb of Object.values(allNotebooks)) {
                    if (nb.words) {
                        nb.words.forEach(w => vocabWords.add(w.word.toLowerCase()));
                    }
                }
                const words = text.split(/\s+/);
                let count = 0;
                for (const w of words) {
                    const clean = w.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                    if (clean && vocabWords.has(clean)) count++;
                }
                return count;
            }

            function updateArticleCurrentDisplay(item) {
                if (item) {
                    const firstLine = item.originalText.split('\n')[0].substring(0, 50);
                    currentArticleTitle.textContent = firstLine || '(无标题)';
                    const d = new Date(item.savedAt);
                    currentArticleDate.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
                    currentArticleVocab.textContent = getVocabCountForArticle(item.originalText) + ' 个生词';
                } else {
                    currentArticleTitle.textContent = '暂无历史文章';
                    currentArticleDate.textContent = '';
                    currentArticleVocab.textContent = '';
                }
            }

            if (historyList.length > 0) {
                updateArticleCurrentDisplay(historyList[0]);
            } else {
                updateArticleCurrentDisplay(null);
            }

            articleCurrent.appendChild(currentArticleTitle);
            articleCurrent.appendChild(currentArticleDate);
            articleCurrent.appendChild(currentArticleVocab);

            const articleArrow = document.createElement('span');
            articleArrow.className = 'memory-article-arrow';
            articleArrow.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

            articleCurrent.appendChild(articleArrow);

            articleSelector.appendChild(articleCurrent);

            // 文章下拉列表
            const articleDropdown = document.createElement('div');
            articleDropdown.className = 'memory-article-dropdown';

            if (historyList.length === 0) {
                const emptyOption = document.createElement('div');
                emptyOption.className = 'memory-article-option empty';
                emptyOption.textContent = '暂无历史文章，请先在深度解析中分析文章';
                articleDropdown.appendChild(emptyOption);
            } else {
                historyList.forEach((item) => {
                    const option = document.createElement('div');
                    option.className = 'memory-article-option';
                    if (item.id === selectedArticleId) {
                        option.classList.add('active');
                    }

                    const optIcon = document.createElement('span');
                    optIcon.className = 'memory-article-icon';
                    optIcon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
                    option.appendChild(optIcon);

                    const optTitle = document.createElement('span');
                    optTitle.className = 'memory-article-title';
                    optTitle.textContent = item.originalText.split('\n')[0].substring(0, 50) || '(无标题)';
                    option.appendChild(optTitle);

                    const optDate = document.createElement('span');
                    optDate.className = 'memory-article-date';
                    const d = new Date(item.savedAt);
                    optDate.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
                    option.appendChild(optDate);

                    const optVocab = document.createElement('span');
                    optVocab.className = 'memory-article-vocab-count';
                    optVocab.textContent = getVocabCountForArticle(item.originalText) + ' 个生词';
                    option.appendChild(optVocab);

                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectedArticleId = item.id;
                        articleSelector._selectedId = selectedArticleId;
                        updateArticleCurrentDisplay(item);
                        articleDropdown.querySelectorAll('.memory-article-option').forEach(o => o.classList.remove('active'));
                        option.classList.add('active');
                        articleDropdown.classList.remove('open');
                        articleSelector.classList.remove('open');
                    });

                    articleDropdown.appendChild(option);
                });
            }

            articleCurrent.appendChild(articleDropdown);

            articleCurrent.addEventListener('click', (e) => {
                e.stopPropagation();
                if (historyList.length === 0) return;
                articleDropdown.classList.toggle('open');
                articleSelector.classList.toggle('open');
            });

            function closeArticleDropdownOnOutsideClick(e) {
                if (articleDropdown.contains(e.target) || articleCurrent.contains(e.target)) return;
                articleDropdown.classList.remove('open');
                articleSelector.classList.remove('open');
            }
            document.addEventListener('click', closeArticleDropdownOnOutsideClick);
            _cleanupFns.push(() => document.removeEventListener('click', closeArticleDropdownOnOutsideClick));

            articleContent.appendChild(articleSelector);

            // 生词本多选器
            const notebookMultiSection = document.createElement('div');
            notebookMultiSection.className = 'memory-nb-multi-section';

            const nbMultiHeader = document.createElement('div');
            nbMultiHeader.className = 'memory-nb-multi-header';

            const nbMultiLabel = document.createElement('span');
            nbMultiLabel.className = 'memory-nb-multi-label';
            nbMultiLabel.textContent = '选择生词本';
            nbMultiHeader.appendChild(nbMultiLabel);

            const nbMultiList = document.createElement('div');
            nbMultiList.className = 'memory-nb-multi-list';

            const nbMultiToggle = document.createElement('button');
            nbMultiToggle.className = 'memory-nb-multi-toggle';
            nbMultiToggle.textContent = '全选';

            nbMultiHeader.appendChild(nbMultiList);
            nbMultiHeader.appendChild(nbMultiToggle);
            notebookMultiSection.appendChild(nbMultiHeader);
            articleContent.appendChild(notebookMultiSection);

            const allNotebooksForMulti = window.VocabData ? window.VocabData.getAllNotebooks() : {};
            const nbEntries = Object.entries(allNotebooksForMulti);
            if (_articleSelectedNotebookIds === null) {
                _articleSelectedNotebookIds = new Set(nbEntries.map(([id]) => id));
            }
            const selectedNotebookIds = _articleSelectedNotebookIds;

            function updateNbMultiToggleText() {
                const allSelected = nbEntries.every(([id]) => selectedNotebookIds.has(id));
                nbMultiToggle.textContent = allSelected ? '取消全选' : '全选';
            }

            function rebuildArticleVocabCount() {
                if (selectedArticleId) {
                    const item = historyList.find(h => h.id === selectedArticleId);
                    if (item) {
                        currentArticleVocab.textContent = getFilteredVocabCount(item.originalText, selectedNotebookIds) + ' 个生词';
                    }
                }
            }

            function getFilteredVocabCount(text, nbIds) {
                if (!text || !window.VocabData) return 0;
                const allNbs = window.VocabData.getAllNotebooks();
                const vocabWords = new Set();
                for (const [id, nb] of Object.entries(allNbs)) {
                    if (nbIds.has(id) && nb.words) {
                        nb.words.forEach(w => vocabWords.add(w.word.toLowerCase()));
                    }
                }
                const words = text.split(/\s+/);
                let count = 0;
                for (const w of words) {
                    const clean = w.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                    if (clean && vocabWords.has(clean)) count++;
                }
                return count;
            }

            if (nbEntries.length === 0) {
                const emptyNb = document.createElement('div');
                emptyNb.className = 'memory-nb-multi-empty';
                emptyNb.textContent = '暂无生词本';
                nbMultiList.appendChild(emptyNb);
            } else {
                nbEntries.forEach(([id, nb]) => {
                    const chipColor = nb.color || '#6366f1';
                    const isSelected = selectedNotebookIds.has(id);

                    const item = document.createElement('label');
                    item.className = 'memory-nb-multi-item' + (isSelected ? ' selected' : '');
                    item.style.setProperty('--chip-color', chipColor);

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'memory-nb-multi-checkbox';
                    checkbox.checked = isSelected;
                    checkbox.dataset.nbId = id;

                    checkbox.addEventListener('change', (e) => {
                        e.stopPropagation();
                        if (checkbox.checked) {
                            selectedNotebookIds.add(id);
                            item.classList.add('selected');
                        } else {
                            selectedNotebookIds.delete(id);
                            item.classList.remove('selected');
                        }
                        updateNbMultiToggleText();
                        rebuildArticleVocabCount();
                    });

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'memory-nb-multi-name';
                    nameSpan.textContent = nb.name;

                    const countSpan = document.createElement('span');
                    countSpan.className = 'memory-nb-multi-count';
                    countSpan.textContent = (nb.words ? nb.words.length : 0) + ' 词';

                    item.appendChild(checkbox);
                    item.appendChild(nameSpan);
                    item.appendChild(countSpan);
                    nbMultiList.appendChild(item);
                });

                nbMultiToggle.addEventListener('click', () => {
                    const allSelected = nbEntries.every(([id]) => selectedNotebookIds.has(id));
                    if (allSelected) {
                        selectedNotebookIds.clear();
                        nbMultiList.querySelectorAll('.memory-nb-multi-checkbox').forEach(cb => cb.checked = false);
                        nbMultiList.querySelectorAll('.memory-nb-multi-item').forEach(el => el.classList.remove('selected'));
                    } else {
                        nbEntries.forEach(([id]) => selectedNotebookIds.add(id));
                        nbMultiList.querySelectorAll('.memory-nb-multi-checkbox').forEach(cb => cb.checked = true);
                        nbMultiList.querySelectorAll('.memory-nb-multi-item').forEach(el => el.classList.add('selected'));
                    }
                    updateNbMultiToggleText();
                    rebuildArticleVocabCount();
                });
            }

            notebookMultiSection.appendChild(nbMultiHeader);

            const articleModeTitle = document.createElement('h4');
            articleModeTitle.innerText = '选择记忆模式';
            articleContent.appendChild(articleModeTitle);

            const articleModeButtons = [
                {
                    id: 'cloze',
                    text: '语境填空',
                    desc: '基于文章内容，填空记忆生词',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
                    available: true,
                    color: '#10b981'
                },
                {
                    id: 'review',
                    text: '全文回顾',
                    desc: '回顾全文，巩固阅读理解',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
                    available: true,
                    color: '#3b82f6'
                },
                {
                    id: 'sentence',
                    text: '逐句精读',
                    desc: '逐句精读，深入理解文章',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>`,
                    available: true,
                    color: '#8b5cf6'
                },
                {
                    id: 'vocabQuiz',
                    text: '生词测验',
                    desc: '拖拽填空，检验词汇掌握',
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>`,
                    available: true,
                    color: '#ef4444'
                }
            ];

            const articleModeGrid = document.createElement('div');
            articleModeGrid.className = 'mode-grid';

            // 获取模块统计数据
            const articleStatsMap = {};
            const articleModuleStats = window.StatsTracker ? window.StatsTracker.getModuleAllTimeStats() : [];
            articleModuleStats.forEach(s => { articleStatsMap[s.key] = s.count; });

            articleModeButtons.forEach(mode => {
                const card = document.createElement('div');
                card.className = 'mode-card';
                card.setAttribute('tabindex', '0');
                card.setAttribute('role', 'button');
                if (mode.color) {
                    card.style.setProperty('--mode-accent', mode.color);
                }
                if (!mode.available) {
                    card.classList.add('coming-soon');
                }

                const iconDiv = document.createElement('div');
                iconDiv.className = 'mode-card-icon';
                iconDiv.innerHTML = mode.icon;

                const label = document.createElement('div');
                label.className = 'mode-card-label';
                label.textContent = mode.text;

                const desc = document.createElement('div');
                desc.className = 'mode-card-desc';
                desc.textContent = mode.desc;

                card.appendChild(iconDiv);
                card.appendChild(label);
                card.appendChild(desc);

                // 学习进度提示
                if (mode.available) {
                    const statCount = articleStatsMap[mode.id] || 0;
                    if (statCount > 0) {
                        const stat = document.createElement('div');
                        stat.className = 'mode-card-stat';
                        stat.textContent = `已学 ${statCount} 次`;
                        card.appendChild(stat);
                    }
                }

                if (!mode.available) {
                    const badge = document.createElement('span');
                    badge.className = 'mode-card-badge';
                    badge.textContent = '即将上线';
                    card.appendChild(badge);
                }

                card.onclick = () => {
                    if (!mode.available) {
                        _showToast(`${mode.text}功能即将上线`);
                        return;
                    }
                    if (!selectedArticleId) {
                        _showToast('请先选择一篇文章');
                        return;
                    }
                    document.body.classList.add('mode-sub-interface');
                    if (mode.id === 'cloze') {
                        showClozeModeInterface(memoryModeDiv, selectedArticleId, selectedNotebookIds);
                    } else if (mode.id === 'review') {
                        showArticleReviewInterface(memoryModeDiv, selectedArticleId);
                    } else if (mode.id === 'sentence') {
                        showSentenceReviewInterface(memoryModeDiv, selectedArticleId);
                    } else if (mode.id === 'vocabQuiz') {
                        showVocabQuizInterface(memoryModeDiv, selectedArticleId, selectedNotebookIds);
                    }
                };

                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        card.click();
                    }
                });

                articleModeGrid.appendChild(card);
            });

            articleContent.appendChild(articleModeGrid);

            modeSelectDiv.appendChild(articleContent);

            // ========== 填空练习模式 ==========
            function showFillPracticeInterface(container) {
                const PracticeFillUI = ModuleRegistry.get('PracticeFillUI');
                if (PracticeFillUI) { PracticeFillUI.show(container); }
            }

            // ========== 听写练习模式 ==========
            function showSpellingPracticeInterface(container) {
                const PracticeSpellUI = ModuleRegistry.get('PracticeSpellUI');
                if (PracticeSpellUI) { PracticeSpellUI.show(container); }
            }

            // ========== 选词练习模式 ==========
            function showChoicePracticeInterface(container) {
                const PracticeChoiceUI = ModuleRegistry.get('PracticeChoiceUI');
                if (PracticeChoiceUI) { PracticeChoiceUI.show(container); }
            }

            // ========== 语境填空模式 ==========
            function showClozeModeInterface(container, articleId, selectedNotebookIds) {
                const ClozeModeUI = ModuleRegistry.get('ClozeModeUI');
                if (ClozeModeUI) { ClozeModeUI.show(container, articleId, selectedNotebookIds); }
            }

            // ========== 全文回顾模式 ==========
            function showArticleReviewInterface(container, articleId) {
                const ArticleReviewUI = ModuleRegistry.get('ArticleReviewUI');
                if (ArticleReviewUI) { ArticleReviewUI.showReview(container, articleId); }
            }

            // ========== 逐句精读模式 ==========
            function showSentenceReviewInterface(container, articleId) {
                const ArticleReviewUI = ModuleRegistry.get('ArticleReviewUI');
                if (ArticleReviewUI) { ArticleReviewUI.showSentence(container, articleId); }
            }

            // ========== 生词测验模式 ==========
            function showVocabQuizInterface(container, articleId, selectedNotebookIds) {
                const VocabQuizUI = ModuleRegistry.get('VocabQuizUI');
                if (VocabQuizUI) { VocabQuizUI.show(container, articleId, selectedNotebookIds); }
            }

            // tab 切换事件
            tabBar.addEventListener('click', (e) => {
                const tab = e.target.closest('.memory-mode-tab');
                if (!tab) return;

                tabBar.querySelectorAll('.memory-mode-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;
                modeSelectDiv.querySelectorAll('.memory-mode-tab-content').forEach(c => c.style.display = 'none');
                const target = modeSelectDiv.querySelector(`.${tabName}-tab-content`);
                if (target) target.style.display = 'block';
            });
            
            // 添加记忆模式内容
            memoryModeDiv.appendChild(header);
            memoryModeDiv.appendChild(modeSelectDiv);
            
            // 确保记忆模式界面可见
            memoryModeDiv.style.setProperty('display', 'block', 'important');

            // 应用彩虹背景开关状态
            if (window.applyMemoryRainbow) {
                window.applyMemoryRainbow();
            }
            
            // 恢复整个 header 区域显示
            const mmAppHeader = document.getElementById('app-header');
            const mmCardHeader = document.querySelector('.card-header');
            const mmCardBody = document.querySelector('.card-body');
            if (mmAppHeader) mmAppHeader.style.display = 'flex';
            if (mmCardHeader) mmCardHeader.style.display = 'flex';
            if (mmCardBody) mmCardBody.style.display = 'block';

            if (!document.getElementById('memoryModeInterface')) {
                const contentArea = document.getElementById('contentArea');
                if (contentArea) {
                    contentArea.appendChild(memoryModeDiv);
                }
            }

            // 存储清理函数
            memoryModeDiv._cleanup = () => {
                _cleanupFns.forEach(fn => fn());
            };
        }

        function showStatsDetailInterface(container) {
            const StatsDetailUI = ModuleRegistry.get('StatsDetailUI');
            if (StatsDetailUI) { StatsDetailUI.show(container); }
        }

        function showPlanDetailInterface(container) {
            const PlanDetailUI = ModuleRegistry.get('PlanDetailUI');
            if (PlanDetailUI) { PlanDetailUI.show(container); }
        }

        // ========== 内置分级词库弹层 ==========
        function showVocabLibraryModal(memoryModeDiv) {
            const library = window.VocabLibrary;
            if (!library) { _showToast('词库模块未加载'); return; }

            let currentLevelId = null;
            let loading = false;

            const overlay = document.createElement('div');
            overlay.className = 'vocab-library-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:16px;';

            const panel = document.createElement('div');
            panel.className = 'vocab-library-panel';
            panel.style.cssText = 'width:520px;max-width:94vw;max-height:88vh;overflow:auto;background:hsl(var(--study-card) / var(--study-card-alpha,1));background:var(--study-card,#fff);border-radius:14px;padding:20px 22px;font-family:var(--study-font-sans,sans-serif);color:var(--study-text,#1f2937);box-shadow:0 18px 50px rgba(0,0,0,.25);line-height:1.5;';

            // 头部
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';
            const title = document.createElement('h3');
            title.style.cssText = 'font-size:17px;font-weight:600;margin:0;color:var(--study-text,#1f2937);';
            title.textContent = '内置分级词库';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.style.cssText = 'cursor:pointer;border:none;background:transparent;color:var(--study-text,#1f2937);padding:4px;display:flex;';
            closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            head.appendChild(title);
            head.appendChild(closeBtn);
            panel.appendChild(head);

            const sub = document.createElement('div');
            sub.style.cssText = 'font-size:13px;color:var(--study-muted,#6b7280);margin-bottom:12px;';
            sub.textContent = '按 CEFR / 考试档位选择词表，一键导入到指定生词本，配合间隔重复与记忆模式系统学习';
            panel.appendChild(sub);

            // 状态容器
            const status = document.createElement('div');
            status.style.cssText = 'font-size:14px;padding:18px 4px;color:var(--study-muted,#6b7280);';
            panel.appendChild(status);

            // 档位列表
            const list = document.createElement('div');
            list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            panel.appendChild(list);

            // 导入区
            const importBar = document.createElement('div');
            importBar.style.cssText = 'display:none;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--study-border,#e5e7eb);flex-wrap:wrap;';
            const importLabel = document.createElement('span');
            importLabel.style.cssText = 'font-size:13px;color:var(--study-muted,#6b7280);';
            importLabel.textContent = '导入到：';
            const nbSelect = document.createElement('select');
            nbSelect.style.cssText = 'flex:1;min-width:120px;padding:6px 8px;border:1px solid var(--study-border,#d1d5db);border-radius:8px;font-size:13px;background:var(--study-bg,#fff);color:var(--study-text,#1f2937);';
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.style.cssText = 'cursor:pointer;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:500;color:#fff;background:var(--study-accent,#2563eb);';
            addBtn.textContent = '导入生词本';
            importBar.appendChild(importLabel);
            importBar.appendChild(nbSelect);
            importBar.appendChild(addBtn);
            panel.appendChild(importBar);

            function closeAndRemove() {
                document.removeEventListener('keydown', onKey);
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }
            function onKey(e) {
                if (e.key === 'Escape') closeAndRemove();
            }
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAndRemove(); });
            closeBtn.addEventListener('click', closeAndRemove);
            document.addEventListener('keydown', onKey);

            // 填充目标生词本下拉
            function fillNotebookSelect() {
                const notebooks = (window.VocabData && window.VocabData.getAllNotebooks) ? window.VocabData.getAllNotebooks() : {};
                const ids = Object.keys(notebooks);
                if (!ids.length) {
                    nbSelect.innerHTML = '<option value="">无生词本，请先创建</option>';
                    return;
                }
                const cur = window.VocabData.getCurrentNotebookId ? window.VocabData.getCurrentNotebookId() : null;
                const opts = ids.map(id => {
                    const o = document.createElement('option');
                    o.value = id;
                    o.textContent = notebooks[id].name || id;
                    if (id === cur) o.selected = true;
                    return o;
                });
                nbSelect.innerHTML = '';
                opts.forEach(o => nbSelect.appendChild(o));
            }

            function selectLevel(levelId) {
                currentLevelId = levelId;
                list.querySelectorAll('.vl-level').forEach(el => {
                    const on = el.dataset.levelId === levelId;
                    el.style.borderColor = on ? 'var(--study-accent,#2563eb)' : 'var(--study-border,#e5e7eb)';
                    el.style.background = on ? 'var(--study-accent,#2563eb)18' : '';
                });
                importBar.style.display = 'flex';
            }

            addBtn.addEventListener('click', async () => {
                if (!currentLevelId) { _showToast('请先选择一个词表档位'); return; }
                const notebookId = nbSelect.value;
                if (!notebookId) { _showToast('请先选择目标生词本'); return; }
                if (loading) return;
                loading = true;
                const prev = addBtn.textContent;
                addBtn.textContent = '导入中…';
                const r = await library.importToNotebook(currentLevelId, (words) => {
                    return window.VocabData.addWordsBulk(notebookId, words);
                });
                loading = false;
                addBtn.textContent = prev;
                _showToast(`导入完成：新增 ${r.added} 词，跳过 ${r.skipped} 词`);
                // 刷新今日待复习提示
                if (memoryModeDiv) {
                    const hint = memoryModeDiv.querySelector('.mode-card-stat');
                    if (hint && window.VocabData && window.VocabData.getDueCount) {
                        hint.textContent = '今日待复习 ' + window.VocabData.getDueCount() + ' 词';
                    }
                }
            });

            // 先挂载弹层到文档，保证点击后立即可见（后续异步加载/填充即便异常也不至于无反馈）
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            // 加载词库
            status.textContent = '正在加载词库…';
            library.load().then(res => {
                if (!res || !res.ok) {
                    status.textContent = '词库加载失败，请稍后重试';
                    return;
                }
                status.remove();
                const levels = library.listLevels();
                if (!levels.length) {
                    status.textContent = '词库为空';
                    return;
                }
                levels.forEach(lv => {
                    const item = document.createElement('div');
                    item.className = 'vl-level';
                    item.dataset.levelId = lv.id;
                    item.setAttribute('role', 'button');
                    item.setAttribute('tabindex', '0');
                    item.style.cssText = 'cursor:pointer;border:1px solid var(--study-border,#e5e7eb);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;transition:border-color .15s,background .15s;';
                    const left = document.createElement('div');
                    left.style.cssText = 'flex:1;min-width:0;';
                    const nameLine = document.createElement('div');
                    nameLine.style.cssText = 'font-size:14px;font-weight:600;color:var(--study-text,#1f2937);';
                    const badge = lv.cefr ? ' <span style="font-size:11px;font-weight:600;color:var(--study-accent,#2563eb);border:1px solid currentColor;border-radius:6px;padding:0 5px;margin-left:6px;vertical-align:1px;">' + lv.cefr + '</span>' : '';
                    nameLine.innerHTML = lv.name + badge;
                    const descP = document.createElement('div');
                    descP.style.cssText = 'font-size:12px;color:var(--study-muted,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+ 'margin-top:2px;';
                    descP.textContent = lv.description + (lv.count ? ' · ' + lv.count + ' 词' : '');
                    left.appendChild(nameLine);
                    left.appendChild(descP);
                    const chevron = document.createElement('span');
                    chevron.style.cssText = 'color:var(--study-muted,#9ca3af);flex-shrink:0;';
                    chevron.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg>';
                    item.appendChild(left);
                    item.appendChild(chevron);

                    // 预览面板
                    const preview = document.createElement('div');
                    preview.style.cssText = 'display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--study-border,#e5e7eb);grid-column:1/-1;';
                    const wl = library.getLevel(lv.id);
                    const words = (wl && wl.words) ? wl.words.slice(0, 24) : [];
                    const ws = document.createElement('div');
                    ws.style.cssText = 'max-height:180px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;';
                    words.forEach(wd => {
                        const it = document.createElement('div');
                        it.style.cssText = 'font-size:12px;color:var(--study-text,#374151);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                        const m = (wd.meaning || '').length > 16 ? (wd.meaning.slice(0, 16) + '…') : (wd.meaning || '');
                        it.textContent = wd.word + (wd.pos ? ' ' + wd.pos : '') + ' ' + m;
                        ws.appendChild(it);
                    });
                    const more = document.createElement('div');
                    more.style.cssText = 'font-size:12px;color:var(--study-muted,#6b7280);margin-top:6px;';
                    more.textContent = wl && wl.words && wl.words.length > 24 ? '仅展示前 24 词，导入将加入全部 ' + wl.words.length + ' 词' : (wl && wl.words ? '共 ' + wl.words.length + ' 词' : '');
                    preview.appendChild(ws);
                    preview.appendChild(more);
                    // 放入 item
                    item.appendChild(preview);

                    const togglePreview = () => {
                        const isOpen = preview.style.display === 'grid';
                        if (isOpen) { preview.style.display = 'none'; }
                        else { preview.style.display = 'grid'; }
                        selectLevel(lv.id);
                    };
                    item.addEventListener('click', (e) => {
                        if (preview.contains(e.target)) return;
                        togglePreview();
                    });
                    item.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePreview(); }
                    });

                    list.appendChild(item);
                });
            }).catch(() => {
                status.textContent = '词库加载失败，请稍后重试';
            });

            fillNotebookSelect();
        }

        // ========== 词汇量自测弹层（四选一，阶梯式跳档） ==========
        function trackModuleCount(key, delta) {
            try {
                const data = JSON.parse(localStorage.getItem('stats_module_data') || '{}');
                const today = new Date().toDateString();
                data[today] = data[today] || {};
                data[today][key] = (data[today][key] || 0) + (delta || 1);
                localStorage.setItem('stats_module_data', JSON.stringify(data));
            } catch (e) { /* 静默 */ }
        }

        function showVocabularyQuizModal() {
            const library = window.VocabLibrary;
            if (!library) { _showToast('词库模块未加载'); return; }

            // 弹层骨架
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:16px;';
            const panel = document.createElement('div');
            panel.style.cssText = 'width:500px;max-width:94vw;max-height:88vh;overflow:auto;background:var(--study-card,#fff);border-radius:14px;padding:20px 22px;font-family:var(--study-font-sans,sans-serif);color:var(--study-text,#1f2937);box-shadow:0 18px 50px rgba(0,0,0,.25);line-height:1.5;';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
            const title = document.createElement('h3');
            title.style.cssText = 'font-size:17px;font-weight:600;margin:0;color:var(--study-text,#1f2937);';
            title.textContent = '词汇量自测';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.style.cssText = 'cursor:pointer;border:none;background:transparent;color:var(--study-text,#1f2937);padding:4px;display:flex;';
            closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            head.appendChild(title);
            head.appendChild(closeBtn);
            const body = document.createElement('div');
            body.style.cssText = 'color:var(--study-text,#1f2937);';
            panel.appendChild(head);
            panel.appendChild(body);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            function close() { document.removeEventListener('keydown', onKey); if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
            function onKey(e) { if (e.key === 'Escape') close(); }
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            closeBtn.addEventListener('click', close);
            document.addEventListener('keydown', onKey);

            // 状态
            let quiz = [];
            let levelIdx = 0;
            let qIdx = 0;
            const results = [];
            const wrongWords = [];

            function esc(t) {
                return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            }

            function renderQuestion() {
                const level = quiz[levelIdx];
                const q = level.questions[qIdx];
                const levelLabel = (levelIdx + 1) + '/' + quiz.length + ' · ' + level.name + (level.cefr ? ' (' + level.cefr + ')' : '');
                body.innerHTML = '';
                const prog = document.createElement('div');
                prog.style.cssText = 'font-size:12px;color:var(--study-muted,#6b7280);margin-bottom:14px;';
                prog.textContent = '第 ' + levelLabel + ' · 本题 ' + (qIdx + 1) + '/' + level.questions.length;
                body.appendChild(prog);
                const wordEl = document.createElement('div');
                wordEl.style.cssText = 'font-size:24px;font-weight:600;color:var(--study-text,#111827);margin:4px 0 2px;';
                wordEl.textContent = q.word + (q.pos ? '  ' + q.pos : '');
                body.appendChild(wordEl);
                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:12px;color:var(--study-muted,#6b7280);margin-bottom:12px;';
                hint.textContent = '请选择正确的释义';
                body.appendChild(hint);
                q.options.forEach((opt, i) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;margin:6px 0;border:1px solid var(--study-border,#e5e7eb);border-radius:10px;background:var(--study-bg,#fff);cursor:pointer;font-size:14px;color:var(--study-text,#1f2937);font-family:inherit;';
                    b.textContent = opt;
                    body.appendChild(b);
                });
                // 绑定选项点击：即答即反馈
                const optBtns = body.querySelectorAll('button');
                optBtns.forEach((b, i) => {
                    b.addEventListener('click', () => {
                        optBtns.forEach(o => o.disabled = true);
                        const isCorrect = (i === q.answer);
                        if (isCorrect) b.style.borderColor = '#22c55e'; else { b.style.borderColor = '#ef4444'; }
                        optBtns[q.answer].style.borderColor = '#22c55e';
                        if (!isCorrect) wrongWords.push({ level: quiz[levelIdx].levelId, word: q.word, pos: q.pos, meaning: q.meaning });
                        setTimeout(() => advance(), 650);
                    });
                });
            }

            function advance() {
                qIdx++;
                const level = quiz[levelIdx];
                if (qIdx < level.questions.length) { renderQuestion(); return; }
                // 答完一档：本档正确数 = 总数 - 本档答错数
                const total = level.questions.length;
                const levelWrong = wrongWords.filter(w => w.level === level.levelId).length;
                const correct = total - levelWrong;
                results.push({ levelId: level.levelId, correct: correct, total: total });
                // 跳档：本档正确率 ≥80% 升入更高档，否则视为接临档位，结束测验
                const ratio = total > 0 ? correct / total : 0;
                if (ratio >= 0.8 && levelIdx < quiz.length - 1) {
                    levelIdx++;
                    qIdx = 0;
                    renderQuestion();
                } else {
                    renderResult();
                }
            }

            // 结束页：估算词汇量 + CEFR 建议 + 认错词导入生词本 + 记录学习活动
            function renderResult() {
                const estimate = library.estimateVocabulary(results);
                let activeNbId = null;
                const nbs = (window.VocabData && window.VocabData.getAllNotebooks) ? window.VocabData.getAllNotebooks() : {};
                if (window.VocabData && window.VocabData.getCurrentNotebookId) {
                    activeNbId = window.VocabData.getCurrentNotebookId();
                }
                if (!activeNbId) { const ids = Object.keys(nbs); if (ids.length) activeNbId = ids[0]; }

                body.innerHTML = '';
                const result = document.createElement('div');
                result.style.cssText = 'text-align:center;padding:6px 2px;';

                const voc = document.createElement('div');
                voc.style.cssText = 'font-size:34px;font-weight:700;color:var(--study-accent,#2563eb);line-height:1.1;';
                voc.textContent = '约 ' + estimate.vocab + ' 词';
                result.appendChild(voc);

                const cefr = document.createElement('div');
                cefr.style.cssText = 'display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:var(--study-accent,#2563eb);border:1px solid currentColor;border-radius:6px;padding:2px 8px;';
                cefr.textContent = 'CEFR ' + (estimate.cefr || '—');
                result.appendChild(cefr);

                const advice = document.createElement('div');
                advice.style.cssText = 'font-size:13px;color:var(--study-muted,#6b7280);margin-top:12px;';
                advice.textContent = estimate.advice || '';
                result.appendChild(advice);

                body.appendChild(result);

                // 认错词清单
                if (wrongWords.length) {
                    const wTitle = document.createElement('div');
                    wTitle.style.cssText = 'margin:18px 0 6px;font-size:14px;font-weight:600;color:var(--study-text,#1f2937);';
                    wTitle.textContent = '本次认错的词（' + wrongWords.length + '）';
                    body.appendChild(wTitle);
                    const chipWrap = document.createElement('div');
                    chipWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;';
                    wrongWords.forEach(w => {
                        const chip = document.createElement('span');
                        chip.textContent = w.word + (w.pos ? ' ' + w.pos : '');
                        chip.style.cssText = 'font-size:12px;padding:3px 9px;border:1px solid var(--study-border,#e5e7eb);border-radius:999px;background:var(--study-bg,#fff);color:var(--study-text,#374151);';
                        chipWrap.appendChild(chip);
                    });
                    body.appendChild(chipWrap);

                    // 一键导入生词本
                    if (window.VocabData && activeNbId) {
                        const nbName = (nbs[activeNbId] && nbs[activeNbId].name) || activeNbId;
                        const impBtn = document.createElement('button');
                        impBtn.type = 'button';
                        impBtn.style.cssText = 'width:100%;cursor:pointer;border:none;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:600;color:#fff;background:var(--study-accent,#2563eb);';
                        impBtn.textContent = '一键加入生词本（' + nbName + '）';
                        impBtn.addEventListener('click', () => {
                            if (impBtn.disabled) return;
                            impBtn.disabled = true;
                            let added = 0, skipped = 0;
                            wrongWords.forEach(w => {
                                const r = window.VocabData.addWord(activeNbId, { word: w.word, pos: w.pos, meaning: w.meaning });
                                if (r && r.success) added++; else skipped++;
                            });
                            _showToast('已加入生词本：新增 ' + added + ' 词，跳过 ' + skipped + ' 词');
                            impBtn.textContent = '已加入 ' + added + ' 词';
                        });
                        body.appendChild(impBtn);
                    }
                } else {
                    const okEl = document.createElement('div');
                    okEl.style.cssText = 'margin-top:18px;font-size:13px;color:#10b981;';
                    okEl.textContent = '全部答对，太棒了！';
                    body.appendChild(okEl);
                }

                // 记录一次自测学习活动，供热力图/统计展示
                try {
                    if (window.StatsTracker && window.StatsTracker.recordModuleActivity) {
                        window.StatsTracker.recordModuleActivity('vocabQuiz', 1);
                    } else {
                        trackModuleCount('vocabQuiz', 1);
                    }
                } catch (e) { /* 静默 */ }
            }

            // 载入词库并开始
            body.innerHTML = '<div style="padding:18px 4px;color:var(--study-muted,#6b7280);">正在加载词库…</div>';
            library.load().then((res) => {
                if (!res || !res.ok) { _showToast('词库加载失败'); close(); return; }
                quiz = library.prepareQuiz();
                if (!quiz.length) { _showToast('词库为空'); close(); return; }
                renderQuestion();
            }).catch(() => { _showToast('词库加载失败'); close(); });
        }

        function init(utils) {
            _showToast = utils.showToast;
            _getVocabData = utils.getVocabData;
        }

        return {
            show: showMemoryModeInterface,
            init: init
        };
    });
})();