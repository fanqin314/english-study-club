// vocab_ui.js - 生词本界面的HTML渲染和交互

(function() {
    ModuleRegistry.register('VocabUI', ['GlobalManager'], function(GlobalManager) {
        // 当前界面容器
        let currentContainer = null;
        // 句子容器
        let sentencesContainer = null;
        // 当前搜索关键词
        let currentSearchKeyword = '';
        // 当前排序方式
        let currentSortBy = 'timestamp';
        // 当前排序顺序
        let currentSortOrder = 'desc';
        // 记忆模式界面显示函数引用
        let _showMemoryModeInterfaceFn = null;
        // 选中的单词集合
        let selectedWords = new Set();
        // 是否批量模式
        let isBatchMode = false;
        // 排序下拉菜单关闭监听器引用（用于防止重复绑定）
        let sortCloseClickListener = null;
        // 文章tab生词本多选持久化
        let _articleSelectedNotebookIds = null;
        
        // 获取VocabData实例
        function getVocabData() {
            return GlobalManager.getGlobalObject('VocabData');
        }
    
    // 显示生词本界面
    function showVocabInterface(container, sentencesCont) {
        currentContainer = container;
        sentencesContainer = sentencesCont;
        
        if (!currentContainer) return;
        
        // 显示 card-header 和 card-body
        const cardHeader = document.querySelector('.card-header');
        const cardBody = document.querySelector('.card-body');
        
        if (cardHeader) {
            cardHeader.style.display = 'flex';
        }
        
        if (cardBody) {
            cardBody.style.display = 'block';
        }
        
        // 隐藏句子容器
        if (sentencesContainer) {
            sentencesContainer.style.display = 'none';
        }
        
        // 移除已存在的生词本界面
        const existing = document.getElementById('vocabInterface');
        if (existing) existing.remove();
        
        // 移除已存在的记忆模式界面
        const memoryModeDiv = document.getElementById('memoryModeInterface');
        if (memoryModeDiv) memoryModeDiv.style.setProperty('display', 'none', 'important');
        
        // 创建生词本界面容器
        const vocabDiv = document.createElement('div');
        vocabDiv.id = 'vocabInterface';
        vocabDiv.className = 'vocab-card';
        
        currentContainer.insertBefore(vocabDiv, sentencesContainer);
        
        // 渲染界面
        renderVocabUI(vocabDiv);
    }
    
    // 渲染生词本界面
    function renderVocabUI(container) {
        container.innerHTML = '';
        
        // 头部
        const header = document.createElement('div');
        header.className = 'vocab-header';
        
        // 左侧区域：标题
        const headerLeft = document.createElement('div');
        headerLeft.className = 'vocab-header-left';
        
        const title = document.createElement('h3');
        title.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: -4px; margin-bottom: -4px;">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            <line x1="8" y1="7" x2="16" y2="7"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg> 我的生词本`;
        headerLeft.appendChild(title);
        
        header.appendChild(headerLeft);
        
        // 统计信息
        const statsDiv = document.createElement('div');
        statsDiv.className = 'vocab-stats';
        const vocabData = getVocabData();
        const totalCount = vocabData.getWordCount();
        const notebookCount = Object.keys(vocabData.getAllNotebooks()).length;
        
        // 当前选中的生词本卡片容器
        let selectedNotebookBadge = null;
        
        // 创建选中生词本的徽章显示
        function createSelectedNotebookBadge(notebookId, notebook) {
            const badge = document.createElement('div');
            badge.className = 'selected-notebook-badge';
            badge.dataset.notebookId = notebookId;
            
            // 获取颜色（从现有卡片获取或生成）
            let color = '#f59e0b'; // 默认琥珀色
            const existingCard = document.querySelector(`[data-notebook-id="${notebookId}"] .card__image`);
            if (existingCard) {
                color = existingCard.style.background || '#f59e0b';
            }
            
            badge.innerHTML = `
                <div class="badge-color" style="background: ${color}"></div>
                <span class="badge-name">${notebook.name || '生词本'}</span>
            `;
            
            return badge;
        }
        
        function showStatsDetailInterface(container) {
            const StatsDetailUI = ModuleRegistry.get('StatsDetailUI');
            if (StatsDetailUI) { StatsDetailUI.show(container); }
        }
        
        function showPlanDetailInterface(container) {
            const PlanDetailUI = ModuleRegistry.get('PlanDetailUI');
            if (PlanDetailUI) { PlanDetailUI.show(container); }
        }
        
        function showMemoryModeInterface(container) {
            const MemoryModeUI = ModuleRegistry.get('MemoryModeUI');
            if (MemoryModeUI) { MemoryModeUI.show(container); }
        }
        _showMemoryModeInterfaceFn = showMemoryModeInterface;
        
        // 折叠按钮
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'collapse-btn';
        collapseBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
        collapseBtn.title = '折叠生词本列表';
        collapseBtn.onclick = () => {
            const createSection = container.querySelector('.create-notebook-section');
            const tabsSection = container.querySelector('.notebook-tabs');
            const vocabData = getVocabData();
            
            if (createSection && tabsSection) {
                // 检查是否已经折叠
                const isCollapsed = createSection.classList.contains('collapsed');
                
                if (isCollapsed) {
                    // 展开
                    createSection.style.display = 'flex';
                    tabsSection.style.display = 'flex';
                    
                    // 强制浏览器重排，然后再移除类
                    void createSection.offsetHeight;
                    void tabsSection.offsetHeight;
                    
                    createSection.classList.remove('collapsed');
                    tabsSection.classList.remove('collapsed');
                    
                    collapseBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    `;
                    collapseBtn.title = '折叠生词本列表';
                    
                    // 移除选中生词本徽章
                    if (selectedNotebookBadge) {
                        selectedNotebookBadge.classList.add('fade-out');
                        setTimeout(() => {
                            if (selectedNotebookBadge && selectedNotebookBadge.parentElement) {
                                selectedNotebookBadge.parentElement.removeChild(selectedNotebookBadge);
                                selectedNotebookBadge = null;
                            }
                        }, 300);
                    }
                } else {
                    // 折叠
                    createSection.classList.add('collapsed');
                    tabsSection.classList.add('collapsed');
                    
                    // 动画结束后再完全隐藏 display，避免视觉中断
                    setTimeout(() => {
                        if (createSection.classList.contains('collapsed')) {
                            createSection.style.display = 'none';
                        }
                        if (tabsSection.classList.contains('collapsed')) {
                            tabsSection.style.display = 'none';
                        }
                    }, 300);
                    
                    collapseBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                            <polyline points="6 15 12 9 18 15"></polyline>
                        </svg>
                    `;
                    collapseBtn.title = '展开生词本列表';
                    
                    // 显示当前选中的生词本徽章
                    const currentNotebookId = vocabData.getCurrentNotebookId();
                    const notebooks = vocabData.getAllNotebooks();
                    if (currentNotebookId && notebooks[currentNotebookId]) {
                        // 先移除旧徽章
                        if (selectedNotebookBadge && selectedNotebookBadge.parentElement) {
                            selectedNotebookBadge.parentElement.removeChild(selectedNotebookBadge);
                        }
                        
                        // 创建新徽章并插入到 statsText 前面
                        selectedNotebookBadge = createSelectedNotebookBadge(currentNotebookId, notebooks[currentNotebookId]);
                        statsDiv.insertBefore(selectedNotebookBadge, statsText);
                        
                        // 触发进入动画
                        setTimeout(() => {
                            if (selectedNotebookBadge) {
                                selectedNotebookBadge.classList.add('fade-in');
                            }
                        }, 50);
                    }
                }
            }
        };
        
        const statsText = document.createElement('span');
        statsText.className = 'stats-text';
        statsText.innerHTML = `${notebookCount} 个生词本 | ${totalCount} 个单词`;
        
        statsDiv.appendChild(statsText);
        statsDiv.appendChild(collapseBtn);
        header.appendChild(statsDiv);
        
        container.appendChild(header);
        
        // 创建生词本区域
        const createDiv = document.createElement('div');
        createDiv.className = 'create-notebook-section';
        
        // 创建搜索框样式的容器
        const notebookInputWrapper = document.createElement('div');
        notebookInputWrapper.className = 'form notebook-form';
        
        const newNameInput = document.createElement('input');
        newNameInput.type = 'text';
        newNameInput.placeholder = '新生词本名称';
        newNameInput.className = 'input notebook-name-input';
        
        const createBtn = document.createElement('button');
        createBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> 创建生词本';
        createBtn.className = 'secondary';
        
        notebookInputWrapper.appendChild(newNameInput);
        createDiv.appendChild(notebookInputWrapper);
        createDiv.appendChild(createBtn);
        container.appendChild(createDiv);
        
        // 生词本标签页区域
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'notebook-tabs';
        container.appendChild(tabsDiv);
        
        // 搜索和排序工具栏
        const toolbarDiv = document.createElement('div');
        toolbarDiv.className = 'words-toolbar';
        
        // 搜索框
        const searchDiv = document.createElement('div');
        searchDiv.className = 'search-box';
        const formDiv = document.createElement('div');
        formDiv.className = 'form';
        
        // 搜索图标
        const searchIcon = document.createElement('span');
        searchIcon.className = 'search-icon';
        searchIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>`;
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '搜索单词、释义...';
        searchInput.className = 'input';
        searchInput.value = currentSearchKeyword;
        
        // 清除按钮
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset';
        resetBtn.type = 'button';
        resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
        resetBtn.onclick = () => {
            searchInput.value = '';
            searchInput.focus();
            currentSearchKeyword = '';
            renderWordsList(wordsListDiv);
        };
        
        formDiv.appendChild(searchIcon);
        formDiv.appendChild(searchInput);
        formDiv.appendChild(resetBtn);
        searchDiv.appendChild(formDiv);
        toolbarDiv.appendChild(searchDiv);
        
        // 排序控件
        const sortDiv = document.createElement('div');
        sortDiv.className = 'sort-controls';
        
        const sortOptions = [
            { value: 'timestamp-desc', text: '最新添加' },
            { value: 'timestamp-asc', text: '最早添加' },
            { value: 'word-asc', text: '单词 A-Z' },
            { value: 'word-desc', text: '单词 Z-A' }
        ];
        
        const sortSelect = document.createElement('div');
        sortSelect.className = 'custom-sort-select';
        const sortSelectTrigger = document.createElement('button');
        sortSelectTrigger.className = 'sort-select-trigger';
        const currentOption = sortOptions.find(opt => opt.value === `${currentSortBy}-${currentSortOrder}`) || sortOptions[0];
        sortSelectTrigger.innerHTML = `<span class="sort-select-text">${currentOption.text}</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        sortSelect.appendChild(sortSelectTrigger);
        
        const sortDropdown = document.createElement('div');
        sortDropdown.className = 'sort-dropdown';
        sortOptions.forEach(opt => {
            const optDiv = document.createElement('div');
            optDiv.className = 'sort-option';
            optDiv.dataset.value = opt.value;
            optDiv.textContent = opt.text;
            if (opt.value === `${currentSortBy}-${currentSortOrder}`) {
                optDiv.classList.add('selected');
            }
            sortDropdown.appendChild(optDiv);
        });
        sortSelect.appendChild(sortDropdown);
        sortDiv.appendChild(sortSelect);
        toolbarDiv.appendChild(sortDiv);
        
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
                renderWordsList(wordsListDiv);
            };
        });
        
        // 移除旧的监听器，防止重复绑定
        if (sortCloseClickListener) {
            document.removeEventListener('click', sortCloseClickListener);
        }
        
        // 创建新的关闭监听器并保存引用
        sortCloseClickListener = function(e) {
            // 检查是否点击了排序控件外部
            if (isSortDropdownOpen && !sortSelect.contains(e.target)) {
                isSortDropdownOpen = false;
                sortDropdown.classList.remove('show');
                sortSelectTrigger.classList.remove('active');
            }
        };
        document.addEventListener('click', sortCloseClickListener);
        
        // 批量操作按钮
        const batchBtn = document.createElement('button');
        batchBtn.innerText = '批量操作';
        batchBtn.className = 'batch-mode-btn secondary';

        if (isBatchMode) {
            batchBtn.classList.add('active');
            batchBtn.innerText = '退出批量';
        }
        toolbarDiv.appendChild(batchBtn);
        
        // 导入导出按钮
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
        
        container.appendChild(toolbarDiv);
        
        // 批量操作栏（始终创建，默认隐藏）
        const batchBar = document.createElement('div');
        batchBar.className = 'batch-actions-bar';
        batchBar.style.display = 'none';
        batchBar.innerHTML = `
            <label class="select-all-label">
                <input type="checkbox" class="select-all-checkbox">
            </label>
            <span class="selected-count">已选择 0 个</span>
            <button class="batch-delete-btn" disabled>批量删除</button>
        `;
        container.appendChild(batchBar);
        
        // 单词列表区域
        const wordsListDiv = document.createElement('div');
        wordsListDiv.id = 'vocabWordsList';
        wordsListDiv.className = 'words-list';
        container.appendChild(wordsListDiv);
        
        // 刷新界面的函数
        function refreshUI() {
            if (window.NotebookTabUI) {
                window.NotebookTabUI.renderNotebookTabs(tabsDiv, refreshUI);
            } else {
                console.error('NotebookTabUI 未加载');
            }
            renderWordsList(wordsListDiv);
            updateStats();
        }
        
        // 轻量刷新：只更新单词列表和统计，不重渲染卡片（避免 hover 动画重启）
        if (window.NotebookTabUI) {
            window.NotebookTabUI.refreshWordsAndStats = function() {
                renderWordsList(wordsListDiv);
                updateStats();
            };
        }
        
        // 更新统计信息
        function updateStats() {
            const vocabData = getVocabData();
            const totalCount = vocabData.getWordCount();
            const notebookCount = Object.keys(vocabData.getAllNotebooks()).length;
            const statsText = statsDiv.querySelector('.stats-text');
            if (statsText) {
                statsText.innerHTML = `${notebookCount} 个生词本 | ${totalCount} 个单词`;
            }
        }
        
        // 创建生词本按钮事件
        createBtn.onclick = () => {
            const name = newNameInput.value.trim();
            if (!name) {
                showToast('请输入生词本名称');
                return;
            }
            const vocabData = getVocabData();
            const result = vocabData.createNotebook(name);
            if (result.success) {
                newNameInput.value = '';
                refreshUI();
                showToast(`生词本"${name}"已创建`);
            } else {
                showToast(result.error);
            }
        };
        
        // 搜索功能
        searchInput.oninput = () => {
            currentSearchKeyword = searchInput.value;
            renderWordsList(wordsListDiv);
        };
        
        // 排序功能已移至自定义下拉菜单
        
        // 批量模式切换
        batchBtn.onclick = () => {
            isBatchMode = !isBatchMode;
            selectedWords.clear();
            
            const allCheckboxes = document.querySelectorAll('.word-checkbox');
            
            if (isBatchMode) {
                batchBtn.classList.add('active');
                batchBtn.innerText = '退出批量';
                batchBar.style.display = 'flex';
                requestAnimationFrame(() => {
                    batchBar.classList.add('show');
                });
                allCheckboxes.forEach(cb => cb.classList.remove('word-checkbox--hidden'));
            } else {
                batchBtn.classList.remove('active');
                batchBtn.innerText = '批量操作';
                batchBar.classList.remove('show');
                batchBar.addEventListener('transitionend', function handler() {
                    batchBar.style.display = 'none';
                    batchBar.removeEventListener('transitionend', handler);
                });
                allCheckboxes.forEach(cb => cb.classList.add('word-checkbox--hidden'));
                document.querySelectorAll('.word-item.selected').forEach(item => {
                    item.classList.remove('selected');
                });
            }
        };
        
        // 导出功能
        exportBtn.onclick = () => {
            const vocabData = getVocabData();
            const currentId = vocabData.getCurrentNotebookId();
            if (!currentId) {
                showToast('请先选择一个生词本');
                return;
            }
            
            // 显示导出格式选择弹窗
            showExportDialog(currentId);
        };
        
        // 显示导出格式选择弹窗
        function showExportDialog(notebookId) {
            const overlay = document.createElement('div');
            overlay.className = 'export-overlay';
            
            const dialog = document.createElement('div');
            dialog.className = 'export-dialog';
            
            dialog.innerHTML = `
                <h3>📤 导出生词本</h3>
                <div class="export-content">
                    <p>请选择导出格式：</p>
                    
                    <div class="export-formats">
                        <button class="format-option" data-format="json">
                            <span class="format-icon">📋</span>
                            <div>
                                <strong>JSON 格式</strong>
                                <p>完整数据结构，便于数据迁移</p>
                            </div>
                        </button>
                        
                        <button class="format-option" data-format="md">
                            <span class="format-icon">📝</span>
                            <div>
                                <strong>Markdown 格式</strong>
                                <p>适合阅读和分享</p>
                            </div>
                        </button>
                        
                        <button class="format-option" data-format="txt">
                            <span class="format-icon">📄</span>
                            <div>
                                <strong>纯文本格式</strong>
                                <p>简洁的单词列表</p>
                            </div>
                        </button>
                    </div>
                </div>
                
                <div class="export-actions">
                    <button class="secondary cancel-btn">取消</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // 绑定事件
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const formatOptions = dialog.querySelectorAll('.format-option');
            
            const closeDialog = () => {
                document.body.removeChild(overlay);
            };
            
            cancelBtn.addEventListener('click', closeDialog);
            
            formatOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const format = option.dataset.format;
                    closeDialog();
                    
                    // 执行导出
                    const vocabData = getVocabData();
                    const result = vocabData.exportNotebook(notebookId, format);
                    if (result.success) {
                        const blob = new Blob([result.data], { type: result.mimeType });
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
                });
            });
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog();
                }
            });
        }
        
        // 导入功能
        importBtn.onclick = () => {
            // 显示导入提示弹窗
            showImportHelp();
        };
        
        // 显示导入帮助弹窗
        function showImportHelp() {
            const overlay = document.createElement('div');
            overlay.className = 'import-help-overlay';
            
            const dialog = document.createElement('div');
            dialog.className = 'import-help-dialog';
            
            dialog.innerHTML = `
                <h3>📥 导入生词本</h3>
                <div class="import-help-content">
                    <p>支持以下文件格式：</p>
                    
                    <div class="file-formats">
                        <div class="format-item">
                            <span class="format-badge json">.json</span>
                            <div>
                                <strong>JSON 格式（全量覆盖）</strong>
                                <p>完整的生词本数据格式，会覆盖现有所有数据</p>
                                <pre>{
  "notebooks": {
    "id": {
      "name": "生词本名称",
      "words": [{"word": "apple", "meaning": "苹果"}]
    }
  }
}</pre>
                            </div>
                        </div>
                        
                        <div class="format-item">
                            <span class="format-badge md">.md</span>
                            <span class="format-badge txt">.txt</span>
                            <div>
                                <strong>Markdown/文本格式（新建生词本）</strong>
                                <p>每行一个单词，支持多种分隔方式：</p>
                                <pre>apple 苹果          # 多个空格
banana: 香蕉        # 冒号
orange - 橙子       # 短横线
grape|葡萄          # 竖线
hello               # 仅单词</pre>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="import-help-actions">
                    <button class="secondary cancel-btn">取消</button>
                    <button class="primary import-btn">选择文件</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // 绑定事件
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const importBtn = dialog.querySelector('.import-btn');
            
            const closeDialog = () => {
                document.body.removeChild(overlay);
            };
            
            cancelBtn.addEventListener('click', closeDialog);
            
            importBtn.addEventListener('click', () => {
                closeDialog();
                // 打开文件选择器
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.md,.txt';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                        const text = await file.text();
                        const vocabData = getVocabData();
                        
                        let result;
                        if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                            result = vocabData.importFromMarkdown(text);
                        } else {
                            result = vocabData.importData(text);
                        }
                        
                        if (result.success) {
                            const count = result.importedCount ? `，共导入 ${result.importedCount} 个单词` : '';
                            showToast('生词本导入成功' + count);
                            refreshUI();
                        } else {
                            showToast('导入失败: ' + result.error);
                        }
                    } catch (err) {
                        showToast('文件读取失败');
                    }
                };
                input.click();
            });
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog();
                }
            });
        }
        
        // 批量操作栏事件
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
            updateBatchUI();
            renderWordsList(wordsListDiv);
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
        
        function updateBatchUI() {
            selectedCountSpan.textContent = `已选择 ${selectedWords.size} 个`;
            batchDeleteBtn.disabled = selectedWords.size === 0;
        }
        
        // 初始渲染
        refreshUI();
        
        // 添加全局点击事件，点击页面其他地方时关闭所有卡片的active状态
        document.addEventListener('click', (e) => {
            // 如果点击的不是单词卡片，也不是卡片内的元素，关闭所有active状态
            if (!e.target.closest('.word-item')) {
                document.querySelectorAll('.word-item').forEach(item => {
                    item.classList.remove('active');
                });
            }
        });
    }
    

    
    // 渲染单词列表
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
        
        // 获取并排序单词
        let words = vocabData.getWords(
            vocabData.getCurrentNotebookId(),
            currentSortBy,
            currentSortOrder
        );
        
        // 搜索过滤
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
        
        // 使用文档片段批量更新DOM，减少重排和重绘
        const fragment = document.createDocumentFragment();
        
        words.forEach((w, index) => {
            const div = document.createElement('div');
            div.className = 'word-item';
            if (isBatchMode && selectedWords.has(w.word)) {
                div.classList.add('selected');
            }
            
            // 添加点击事件，切换active类以显示/隐藏操作按钮
            div.onclick = (e) => {
                // 如果点击的是按钮，不触发卡片的点击事件
                if (e.target.closest('.edit-word-btn') || e.target.closest('.delete-word-btn')) {
                    return;
                }
                
                // 移除其他卡片的active类
                document.querySelectorAll('.word-item').forEach(item => {
                    if (item !== div) {
                        item.classList.remove('active');
                    }
                });
                
                // 切换当前卡片的active类
                div.classList.toggle('active');
            };
            
            // 单词基本信息区域
            const wordDetail = document.createElement('div');
            wordDetail.className = 'word-detail';
            
            // 包裹input和strong的div
            const inputStrongContainer = document.createElement('div');
            inputStrongContainer.style.display = 'flex';
            inputStrongContainer.style.alignItems = 'center';
            inputStrongContainer.style.gap = '8px';
            
            // 复选框（批量模式）
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'word-checkbox';
            checkbox.checked = selectedWords.has(w.word);
            if (!isBatchMode) {
                checkbox.classList.add('word-checkbox--hidden');
            }
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    selectedWords.add(w.word);
                } else {
                    selectedWords.delete(w.word);
                }
                renderWordsList(container);
                // 更新批量操作栏
                const selectedCountSpan = document.querySelector('.selected-count');
                const batchDeleteBtn = document.querySelector('.batch-delete-btn');
                if (selectedCountSpan) selectedCountSpan.textContent = `已选择 ${selectedWords.size} 个`;
                if (batchDeleteBtn) batchDeleteBtn.disabled = selectedWords.size === 0;
            };
            inputStrongContainer.appendChild(checkbox);
            
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
            
            // 操作按钮区域
            const buttonDiv = document.createElement('div');
            buttonDiv.className = 'word-actions';
            
            const editBtn = document.createElement('button');
            editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
            editBtn.className = 'edit-word-btn';
            editBtn.title = '编辑';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                
                // 关闭当前可能存在的气泡
                closeCurrentBubble();
                
                // 创建编辑气泡
                createEditBubble(w, editBtn);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
            deleteBtn.className = 'delete-word-btn';
            deleteBtn.title = '删除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                
                // 关闭当前可能存在的气泡
                closeCurrentBubble();
                
                // 创建删除确认气泡
                createDeleteBubble(w, deleteBtn, container);
            };
            
            buttonDiv.appendChild(editBtn);
            buttonDiv.appendChild(deleteBtn);
            
            div.appendChild(wordDetail);
            div.appendChild(buttonDiv);
            fragment.appendChild(div);
        });
        
        // 一次性更新容器
        container.innerHTML = '';
        container.appendChild(fragment);
    }
    
    // 渲染空状态
    function renderEmptyState(title, subtitle = '') {
        return `
            <div class="empty-state">
                <div class="empty-icon">📖</div>
                <div class="empty-title">${title}</div>
                ${subtitle ? `<div class="empty-subtitle">${subtitle}</div>` : ''}
            </div>
        `;
    }
    
    // 刷新界面
    function refresh() {
        const vocabDiv = document.getElementById('vocabInterface');
        if (vocabDiv) {
            renderVocabUI(vocabDiv);
        }
    }
    
    // 显示提示消息
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    }
    
    // 全局变量，用于跟踪当前气泡
    let currentBubble = null;
    
    // 创建编辑气泡
    function createEditBubble(wordData, targetElement) {
        // 创建气泡元素
        const bubble = document.createElement('div');
        bubble.className = 'word-bubble';
        bubble.id = 'editWordBubble';
        
        // 构建气泡内容
        bubble.innerHTML = `
            <div class="bubble-arrow"></div>
            <div class="bubble-inner">
                <div class="bubble-title">编辑单词</div>
                <div class="form-group">
                    <label>词性:</label>
                    <input type="text" class="pos-input" value="${wordData.pos || ''}" placeholder="如: n., v., adj.等">
                </div>
                <div class="form-group">
                    <label>释义:</label>
                    <textarea class="meaning-input" placeholder="请输入中文释义">${wordData.meaning || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>上下文/例句:</label>
                    <textarea class="context-input" placeholder="请输入单词的上下文或例句">${wordData.context || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button class="save-btn">保存</button>
                    <button class="cancel-btn">取消</button>
                </div>
            </div>
        `;
        
        // 添加到body
        document.body.appendChild(bubble);
        currentBubble = bubble;
        
        // 计算位置
        positionBubble(bubble, targetElement);
        
        // 绑定关闭事件
        bindCloseEvents(bubble);
        
        // 绑定保存按钮事件
        const saveBtn = bubble.querySelector('.save-btn');
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const pos = bubble.querySelector('.pos-input').value.trim();
            const meaning = bubble.querySelector('.meaning-input').value.trim();
            const context = bubble.querySelector('.context-input').value.trim();
            
            if (!meaning) {
                showToast('释义不能为空');
                return;
            }
            
            // 更新单词数据
            const vocabData = getVocabData();
            if (vocabData) {
                const result = vocabData.updateWord(vocabData.getCurrentNotebookId(), wordData.word, {
                    pos: pos,
                    meaning: meaning,
                    context: context
                });
                
                if (result.success) {
                    // 关闭气泡并刷新列表
                    closeCurrentBubble();
                    renderWordsList(document.getElementById('vocabWordsList'));
                    showToast('单词信息已更新');
                } else {
                    showToast(result.error);
                }
            } else {
                showToast('生词本数据服务未初始化');
            }
        });
        
        // 绑定取消按钮事件
        const cancelBtn = bubble.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCurrentBubble();
        });
    }
    
    // 定位气泡
    function positionBubble(bubble, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        
        // 默认显示在按钮右下方
        let left = rect.left;
        let top = rect.bottom + 8;
        
        // 检查是否超出视口右边界
        const viewportWidth = window.innerWidth;
        if (left + 260 > viewportWidth) {
            left = viewportWidth - 270;
        }
        
        // 检查是否超出视口底部
        const viewportHeight = window.innerHeight;
        const bubbleHeight = bubbleRect.height || 300;
        if (top + bubbleHeight > viewportHeight) {
            // 如果下方空间不足，显示在上方
            top = rect.top - bubbleHeight - 8;
            bubble.classList.add('bubble-top');
        }
        
        bubble.style.left = `${left + window.scrollX}px`;
        bubble.style.top = `${top + window.scrollY}px`;
    }
    
    // 绑定关闭事件
    function bindCloseEvents(bubble) {
        // 点击外部关闭
        const closeHandler = (e) => {
            if (!bubble.contains(e.target)) {
                closeCurrentBubble();
            }
        };
        
        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeCurrentBubble();
            }
        };
        
        // 延迟绑定，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('keydown', escHandler);
        }, 10);
        
        // 保存处理器引用以便移除
        bubble._closeHandler = closeHandler;
        bubble._escHandler = escHandler;
    }
    
    // 关闭当前气泡
    function closeCurrentBubble() {
        if (currentBubble) {
            // 移除事件监听
            if (currentBubble._closeHandler) {
                document.removeEventListener('click', currentBubble._closeHandler);
            }
            if (currentBubble._escHandler) {
                document.removeEventListener('keydown', currentBubble._escHandler);
            }
            // 移除元素
            currentBubble.remove();
            currentBubble = null;
        }
    }
    
    // 创建删除确认气泡
    function createDeleteBubble(wordData, targetElement, container) {
        // 创建气泡元素
        const bubble = document.createElement('div');
        bubble.className = 'word-bubble';
        bubble.id = 'deleteWordBubble';
        
        // 构建气泡内容
        bubble.innerHTML = `
            <div class="bubble-arrow"></div>
            <div class="bubble-inner">
                <div class="bubble-title">删除单词</div>
                <div class="bubble-message">确定删除单词"${wordData.word}"吗？</div>
                <div class="form-actions">
                    <button class="delete-btn">删除</button>
                    <button class="cancel-btn">取消</button>
                </div>
            </div>
        `;
        
        // 添加到body
        document.body.appendChild(bubble);
        currentBubble = bubble;
        
        // 计算位置
        positionBubble(bubble, targetElement);
        
        // 绑定关闭事件
        bindCloseEvents(bubble);
        
        // 绑定删除按钮事件
        const deleteBtn = bubble.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 删除单词
            const vocabData = getVocabData();
            if (vocabData) {
                const result = vocabData.deleteWord(vocabData.getCurrentNotebookId(), wordData.word);
                if (result.success) {
                    // 关闭气泡并刷新列表
                    closeCurrentBubble();
                    renderWordsList(container);
                    showToast(`已删除"${wordData.word}"`);
                } else {
                    showToast(result.error);
                }
            } else {
                showToast('生词本数据服务未初始化');
            }
        });
        
        // 绑定取消按钮事件
        const cancelBtn = bubble.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCurrentBubble();
        });
    }
    
    // 导出接口
    window.VocabInterface = {
        show: showVocabInterface,
        refresh,
        showMemoryModeInterface: (container) => {
            if (_showMemoryModeInterfaceFn) {
                _showMemoryModeInterfaceFn(container);
            }
        },
        hide: () => {
            const vocabDiv = document.getElementById('vocabInterface');
            if (vocabDiv) vocabDiv.remove();
            if (sentencesContainer) sentencesContainer.style.display = 'block';
        }
    };

        function initSubModules() {
            const utils = { showToast, getVocabData };
            const modules = ['PracticeFillUI', 'PracticeSpellUI', 'PracticeChoiceUI', 
                           'ClozeModeUI', 'VocabQuizUI', 'ArticleReviewUI', 'StatsDetailUI', 'PlanDetailUI', 'MemoryModeUI'];
            modules.forEach(name => {
                const mod = ModuleRegistry.get(name);
                if (mod && mod.init) {
                    mod.init(utils);
                }
            });
        }
        
        setTimeout(initSubModules, 0);

    return {
        show: showVocabInterface,
        refresh,
        showMemoryModeInterface: (container) => {
            if (_showMemoryModeInterfaceFn) {
                _showMemoryModeInterfaceFn(container);
            }
        }
    };
    });
})();
