(function() {
    let _showToast = null;
    let _getVocabData = null;
    let _articleSelectedNotebookIds = null;

    ModuleRegistry.register('MemoryModeUI', ['GlobalManager'], function(GlobalManager) {

        function showMemoryModeInterface(container) {
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
                            flashcardMode.showFlashcardModeInterface(memoryModeDiv);
                        } else {
                            _showToast('闪卡模式模块未加载');
                        }
                    } else if (mode.id === 'fill') {
                        showFillPracticeInterface(memoryModeDiv);
                    } else if (mode.id === 'spelling') {
                        showSpellingPracticeInterface(memoryModeDiv);
                    } else if (mode.id === 'choice') {
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