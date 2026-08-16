(function() {
    ModuleRegistry.register('VocabList', ['GlobalManager'], function(GlobalManager) {
        let currentSearchKeyword = '';
        let currentSortBy = 'timestamp';
        let currentSortOrder = 'desc';
        let selectedWords = new Set();
        let isBatchMode = false;
        let sortOptions = [
            { value: 'timestamp-desc', text: '最新添加' },
            { value: 'timestamp-asc', text: '最早添加' },
            { value: 'word-asc', text: '单词 A-Z' },
            { value: 'word-desc', text: '单词 Z-A' }
        ];

        function getVocabData() {
            return GlobalManager.getGlobalObject('VocabData');
        }

        function init(searchInput, resetBtn, sortSelectTrigger, sortDropdown, toolbarDiv, container) {
            initSearch(searchInput, resetBtn);
            initSort(sortSelectTrigger, sortDropdown);
            initToolbar(toolbarDiv, container);
            refreshUI();
        }

        function initSearch(searchInput, resetBtn) {
            searchInput.oninput = () => {
                currentSearchKeyword = searchInput.value;
                renderWordsList(document.getElementById('vocabWordsList'));
            };

            resetBtn.onclick = () => {
                searchInput.value = '';
                searchInput.focus();
                currentSearchKeyword = '';
                renderWordsList(document.getElementById('vocabWordsList'));
            };
        }

        function initSort(sortSelectTrigger, sortDropdown) {
            let isSortDropdownOpen = false;

            sortSelectTrigger.onclick = (e) => {
                e.stopPropagation();
                isSortDropdownOpen = !isSortDropdownOpen;
                sortDropdown.classList.toggle('show', isSortDropdownOpen);
                sortSelectTrigger.classList.toggle('active', isSortDropdownOpen);
            };

            sortDropdown.querySelectorAll('.sort-option').forEach(optEl => {
                optEl.onclick = (e) => {
                    e.stopPropagation();
                    const value = optEl.dataset.value;
                    sortDropdown.querySelectorAll('.sort-option').forEach(el => el.classList.remove('selected'));
                    optEl.classList.add('selected');
                    const [sortBy, order] = value.split('-');
                    currentSortBy = sortBy;
                    currentSortOrder = order;
                    sortSelectTrigger.querySelector('.sort-select-text').textContent = optEl.textContent;
                    isSortDropdownOpen = false;
                    sortDropdown.classList.remove('show');
                    sortSelectTrigger.classList.remove('active');
                    renderWordsList(document.getElementById('vocabWordsList'));
                };
            });

            document.addEventListener('click', () => {
                if (isSortDropdownOpen) {
                    isSortDropdownOpen = false;
                    sortDropdown.classList.remove('show');
                    sortSelectTrigger.classList.remove('active');
                }
            });
        }

        function initToolbar(toolbarDiv, container) {
            const batchBtn = document.createElement('button');
            batchBtn.innerText = isBatchMode ? '退出批量' : '批量操作';
            batchBtn.className = `batch-mode-btn secondary ${isBatchMode ? 'active' : ''}`;
            toolbarDiv.appendChild(batchBtn);

            const importExportDiv = document.createElement('div');
            importExportDiv.className = 'import-export-btns';

            const exportBtn = document.createElement('button');
            exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> 导出';
            exportBtn.className = 'secondary';

            const importBtn = document.createElement('button');
            importBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> 导入';
            importBtn.className = 'secondary';

            importExportDiv.appendChild(exportBtn);
            importExportDiv.appendChild(importBtn);
            toolbarDiv.appendChild(importExportDiv);

            if (isBatchMode) {
                const batchBar = document.createElement('div');
                batchBar.className = 'batch-actions-bar';
                batchBar.innerHTML = `
                    <label class="select-all-label">
                        <input type="checkbox" class="select-all-checkbox">
                    </label>
                    <span class="selected-count">已选择 0 个</span>
                    <button class="batch-delete-btn" disabled>批量删除</button>
                `;
                container.appendChild(batchBar);
            }

            batchBtn.onclick = () => {
                isBatchMode = !isBatchMode;
                selectedWords.clear();
                refreshUI();
            };

            exportBtn.onclick = () => {
                const vocabData = getVocabData();
                const currentId = vocabData.getCurrentNotebookId();
                if (!currentId) {
                    showToast('请先选择一个生词本');
                    return;
                }

                const result = vocabData.exportNotebook(currentId);
                if (result.success) {
                    const blob = new Blob([result.data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = result.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('生词本已导出');
                } else {
                    showToast(result.error);
                }
            };

            importBtn.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        const text = await file.text();
                        const vocabData = getVocabData();
                        const result = vocabData.importData(text);
                        if (result.success) {
                            refreshUI();
                            showToast('生词本导入成功');
                        } else {
                            showToast('导入失败: ' + result.error);
                        }
                    } catch (err) {
                        showToast('文件读取失败');
                    }
                };
                input.click();
            };

            if (isBatchMode) {
                initBatchEvents(container);
            }
        }

        function initBatchEvents(container) {
            const selectAllCheckbox = container.querySelector('.select-all-checkbox');
            const batchDeleteBtn = container.querySelector('.batch-delete-btn');
            const selectedCountSpan = container.querySelector('.selected-count');

            selectAllCheckbox.onchange = () => {
                const vocabData = getVocabData();
                const currentNotebook = vocabData.getCurrentNotebook();
                if (selectAllCheckbox.checked) {
                    currentNotebook.words.forEach(w => selectedWords.add(w.word));
                } else {
                    selectedWords.clear();
                }
                updateBatchUI(selectedCountSpan, batchDeleteBtn);
                renderWordsList(document.getElementById('vocabWordsList'));
            };

            batchDeleteBtn.onclick = () => {
                if (selectedWords.size === 0) return;

                if (confirm(`确定删除选中的 ${selectedWords.size} 个单词吗？`)) {
                    const vocabData = getVocabData();
                    const currentId = vocabData.getCurrentNotebookId();
                    let deletedCount = 0;

                    selectedWords.forEach(word => {
                        const result = vocabData.deleteWord(currentId, word);
                        if (result.success) deletedCount++;
                    });

                    selectedWords.clear();
                    refreshUI();
                    showToast(`已删除 ${deletedCount} 个单词`);
                }
            };
        }

        function updateBatchUI(selectedCountSpan, batchDeleteBtn) {
            if (selectedCountSpan) {
                selectedCountSpan.textContent = `已选择 ${selectedWords.size} 个`;
            }
            if (batchDeleteBtn) {
                batchDeleteBtn.disabled = selectedWords.size === 0;
            }
        }

        function refreshUI() {
            const tabsDiv = document.querySelector('.notebook-tabs');
            if (window.NotebookTabUI) {
                window.NotebookTabUI.renderNotebookTabs(tabsDiv, refreshUI);
            } else {
                console.error('NotebookTabUI 未加载');
            }
            renderWordsList(document.getElementById('vocabWordsList'));
            updateStats();
        }

        function updateStats() {
            const statsDiv = document.querySelector('.vocab-stats');
            if (statsDiv) {
                const vocabData = getVocabData();
                const totalCount = vocabData.getWordCount();
                const notebookCount = Object.keys(vocabData.getAllNotebooks()).length;
                statsDiv.innerHTML = `<span>${notebookCount} 个生词本</span> | <span>${totalCount} 个单词</span>`;
            }
        }

        function renderWordsList(container) {
            const vocabData = getVocabData();
            if (!vocabData) {
                container.innerHTML = renderEmptyState('生词本数据服务未初始化');
                return;
            }

            const currentNotebook = vocabData.getCurrentNotebook();

            if (!currentNotebook) {
                container.innerHTML = renderEmptyState('请选择一个生词本');
                return;
            }

            let words = vocabData.getWords(
                vocabData.getCurrentNotebookId(),
                currentSortBy,
                currentSortOrder
            );

            if (currentSearchKeyword) {
                words = words.filter(w => {
                    const keyword = currentSearchKeyword.toLowerCase();
                    return (
                        w.word.toLowerCase().includes(keyword) ||
                        w.meaning.toLowerCase().includes(keyword) ||
                        w.context.toLowerCase().includes(keyword)
                    );
                });
            }

            if (words.length === 0) {
                if (currentSearchKeyword) {
                    container.innerHTML = renderEmptyState('没有找到匹配的单词');
                } else {
                    container.innerHTML = renderEmptyState(
                        '暂无单词',
                        '右键或双击文章中的单词可快速添加，或使用上方输入框手动添加'
                    );
                }
                return;
            }

            const fragment = document.createDocumentFragment();

            words.forEach((w, index) => {
                const div = document.createElement('div');
                div.className = 'word-item';
                if (isBatchMode && selectedWords.has(w.word)) {
                    div.classList.add('selected');
                }

                div.onclick = (e) => {
                    if (e.target.closest('.edit-word-btn') || e.target.closest('.delete-word-btn')) {
                        return;
                    }

                    document.querySelectorAll('.word-item').forEach(item => {
                        if (item !== div) {
                            item.classList.remove('active');
                        }
                    });

                    div.classList.toggle('active');
                };

                const wordDetail = document.createElement('div');
                wordDetail.className = 'word-detail';

                const inputStrongContainer = document.createElement('div');
                inputStrongContainer.style.display = 'flex';
                inputStrongContainer.style.alignItems = 'center';
                inputStrongContainer.style.gap = '8px';

                if (isBatchMode) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'word-checkbox';
                    checkbox.checked = selectedWords.has(w.word);
                    checkbox.onchange = () => {
                        if (checkbox.checked) {
                            selectedWords.add(w.word);
                        } else {
                            selectedWords.delete(w.word);
                        }
                        renderWordsList(container);
                        const selectedCountSpan = document.querySelector('.selected-count');
                        const batchDeleteBtn = document.querySelector('.batch-delete-btn');
                        updateBatchUI(selectedCountSpan, batchDeleteBtn);
                    };
                    inputStrongContainer.appendChild(checkbox);
                }

                const wordStrong = document.createElement('strong');
                wordStrong.innerText = w.word;
                if (w.pos) {
                    wordStrong.innerText += ` [${w.pos}]`;
                }
                inputStrongContainer.appendChild(wordStrong);
                wordDetail.appendChild(inputStrongContainer);

                const meaningSmall = document.createElement('small');
                meaningSmall.innerText = w.meaning || '暂无释义';
                wordDetail.appendChild(document.createElement('br'));
                wordDetail.appendChild(meaningSmall);

                if (w.context) {
                    const contextSmall = document.createElement('small');
                    contextSmall.className = 'word-context';
                    contextSmall.innerText = `上下文: ${w.context}`;
                    wordDetail.appendChild(document.createElement('br'));
                    wordDetail.appendChild(contextSmall);
                }

                if (w.example && (w.example.en || w.example.zh)) {
                    const exampleSmall = document.createElement('small');
                    exampleSmall.className = 'word-example';
                    if (w.example.en) {
                        exampleSmall.innerText = `例句: ${w.example.en}`;
                        if (w.example.zh) {
                            exampleSmall.innerText += ` (${w.example.zh})`;
                        }
                    } else if (w.example.zh) {
                        exampleSmall.innerText = `例句: ${w.example.zh}`;
                    }
                    wordDetail.appendChild(document.createElement('br'));
                    wordDetail.appendChild(exampleSmall);
                }

                const buttonDiv = document.createElement('div');
                buttonDiv.className = 'word-actions';

                const editBtn = document.createElement('button');
                editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
                editBtn.className = 'edit-word-btn';
                editBtn.title = '编辑';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.VocabBubble) {
                        window.VocabBubble.createEditBubble(w, editBtn);
                    }
                };

                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
                deleteBtn.className = 'delete-word-btn';
                deleteBtn.title = '删除';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.VocabBubble) {
                        window.VocabBubble.createDeleteBubble(w, deleteBtn);
                    }
                };

                buttonDiv.appendChild(editBtn);
                buttonDiv.appendChild(deleteBtn);

                div.appendChild(wordDetail);
                div.appendChild(buttonDiv);
                fragment.appendChild(div);
            });

            container.innerHTML = '';
            container.appendChild(fragment);
        }

        function renderEmptyState(title, subtitle = '') {
            return `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            <line x1="9" y1="7" x2="16" y2="7"/>
                            <line x1="9" y1="11" x2="16" y2="11"/>
                        </svg>
                    </div>
                    <div class="empty-title">${title}</div>
                    ${subtitle ? `<div class="empty-subtitle">${subtitle}</div>` : ''}
                </div>
            `;
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.innerText = msg;
                toast.style.opacity = '1';
                setTimeout(() => toast.style.opacity = '0', 2000);
            }
        }

        return {
            init,
            refreshUI,
            renderWordsList
        };
    });
})();