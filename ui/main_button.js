// main_button.js - 侧边栏导航与模式切换（杂志风设计稿适配版）
(function() {
    'use strict';

    ModuleRegistry.register('MainButtonManager', ['EventBus'], function(EventBus) {
        const eventBus = EventBus || window.EventBus;

        const MODES = {
            ANALYSIS: 'analysis',
            VOCAB: 'vocab',
            HISTORY: 'history',
            MEMORY: 'memory'
        };

        // 侧边栏导航标签：data-mode 与界面模式一一对应
        const NAV_TABS = [
            { id: 'deepParseMainBtn', mode: MODES.ANALYSIS },
            { id: 'vocabMainBtn', mode: MODES.VOCAB },
            { id: 'historyMainBtn', mode: MODES.HISTORY },
            { id: 'memoryModeBtn', mode: MODES.MEMORY }
        ];

        const DEEP_PARSE_SECTION_HTML = `
            <div class="two-column-container">
                <section class="input-panel-section">
                    <div id="inputPanel" class="input-panel">
                        <div id="inputPanelContent" class="input-panel-content">
                            <div id="textareaContainer">
                                <div id="textareaWrapper"></div>
                                <div id="secondRowContainer" class="button-group action-buttons"></div>
                            </div>
                            <figure id="fullTranslationArea" class="full-translation">
                                <strong class="translation-label">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="2" y1="12" x2="22" y2="12"/>
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                    </svg>
                                    全文翻译
                                </strong>
                                <span id="fullTranslationText" class="translation-content"></span>
                            </figure>
                        </div>
                    </div>
                </section>
                <section class="sentences-panel-section">
                    <div class="reading-toolbar">
                        <span class="reading-toolbar-label">阅读精解</span>
                        <button id="panelToggleBtn" class="panel-toggle-btn" aria-label="折叠输入面板" data-tooltip="折叠输入面板">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                        </button>
                    </div>
                    <section id="deepParseSentencesContainer" class="sentences-container"></section>
                </section>
            </div>
        `;

        class MainButtonManager {
            constructor() {
                this.currentMode = MODES.ANALYSIS;
                this.deepParseModule = null;
                this.vocabModule = null;
                this.memoryModule = null;
            }

            getElement(id) {
                return document.getElementById(id);
            }

            safeSetStyle(element, style, value) {
                if (element && element.style) {
                    element.style[style] = value;
                }
            }

            safeRemove(element) {
                if (element && element.parentNode) {
                    element.remove();
                }
            }

            // 绑定侧边栏导航标签的点击事件
            bindNavTabs() {
                NAV_TABS.forEach(tab => {
                    const el = this.getElement(tab.id);
                    if (!el) return;
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.closeMobileSidebar) {
                            this.closeMobileSidebar();
                        }
                        if (tab.mode !== this.currentMode) {
                            this.switchMode(tab.mode);
                        }
                    });
                });
            }

            // 更新侧边栏标签高亮
            updateButtonHighlight() {
                NAV_TABS.forEach(tab => {
                    const el = this.getElement(tab.id);
                    if (el) {
                        const isActive = this.currentMode === tab.mode;
                        el.classList.toggle('active', isActive);
                        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    }
                });
            }

            updateMemoryModeButtonState() {
                const memoryBtn = this.getElement('memoryModeBtn');
                if (memoryBtn) {
                    memoryBtn.classList.toggle('active', this.currentMode === MODES.MEMORY);
                }
            }

            // 初始绑定侧边栏折叠按钮
            bindSidebarCollapse() {
                const btn = this.getElement('sidebarCollapseBtn');
                if (!btn) return;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const collapsed = document.body.classList.toggle('sidebar-collapsed');
                    btn.setAttribute('aria-label', collapsed ? '展开侧边栏' : '折叠侧边栏');
                    btn.title = collapsed ? '展开侧边栏' : '折叠侧边栏';
                });
            }

            switchMode(mode) {
                if (mode === this.currentMode) return;
                this.currentMode = mode;
                this.updateButtonHighlight();
                this.updateMemoryModeButtonState();

                const modeHandlers = {
                    [MODES.ANALYSIS]: () => this.showAnalysisMode(),
                    [MODES.VOCAB]: () => this.showVocabMode(),
                    [MODES.HISTORY]: () => this.showHistoryMode(),
                    [MODES.MEMORY]: () => this.showMemoryMode()
                };

                const handler = modeHandlers[mode];
                if (handler) {
                    handler();
                }
            }

            hideAllInterfaces() {
                this.safeSetStyle(this.getElement('secondaryAnalysisContainer'), 'display', 'none');
                this.safeRemove(this.getElement('vocabInterface'));
                this.safeRemove(this.getElement('historyInterface'));
                const mmi = this.getElement('memoryModeInterface');
                if (mmi) {
                    mmi.style.setProperty('display', 'none', 'important');
                }
            }

            showSecondaryButtons() {
                const loadExampleBtn = document.getElementById('loadExampleBtn');
                if (loadExampleBtn) loadExampleBtn.style.display = '';
                const saveAnalysisBtn = document.getElementById('saveAnalysisBtn');
                if (saveAnalysisBtn) saveAnalysisBtn.style.display = '';
                // 恢复按钮布局为纵向（覆盖历史记录视图设置的行向布局）
                const secondRow = document.getElementById('secondRowContainer');
                if (secondRow) {
                    secondRow.style.flexDirection = '';
                    secondRow.style.order = '';
                }
            }

            ensureDeepParseSection() {
                let section = this.getElement('deep-parse-section');
                const isNewlyCreated = !section;

                if (!section) {
                    section = document.createElement('section');
                    section.id = 'deep-parse-section';
                    section.className = 'deep-parse-section';
                    section.innerHTML = DEEP_PARSE_SECTION_HTML;

                    const mainContent = this.getElement('main-content');
                    const contentSection = this.getElement('content-section');
                    if (mainContent && contentSection) {
                        mainContent.insertBefore(section, contentSection);
                    }
                }

                // 如果是新创建的，重新初始化相关模块
                if (isNewlyCreated && window.FullTranslation && typeof window.FullTranslation.init === 'function') {
                    window.FullTranslation.init();
                }

                return section;
            }

            removeDeepParseSection() {
                const section = this.getElement('deep-parse-section');
                this.safeRemove(section);
            }

            ensureContentSection() {
                let section = this.getElement('content-section');
                if (!section) {
                    section = document.createElement('section');
                    section.id = 'content-section';
                    section.className = 'content-section';
                    section.innerHTML = `
                        <div id="contentArea" class="content-area">
                            <div id="sentencesContainer" class="sentences-list"></div>
                        </div>
                    `;

                    const mainContent = this.getElement('main-content');
                    const secondaryContainer = this.getElement('secondaryAnalysisContainer');
                    if (mainContent && secondaryContainer) {
                        mainContent.insertBefore(section, secondaryContainer);
                    }
                }

                // 保证内容区包含 sentencesContainer
                let contentArea = this.getElement('contentArea');
                if (contentArea && !this.getElement('sentencesContainer')) {
                    const sc = document.createElement('div');
                    sc.id = 'sentencesContainer';
                    sc.className = 'sentences-list';
                    contentArea.appendChild(sc);
                }
                return section;
            }

            removeContentSection() {
                const section = this.getElement('content-section');
                this.safeRemove(section);
            }

            ensureTextarea() {
                let textarea = this.getElement('articleInput');
                if (!textarea) {
                    textarea = document.createElement('textarea');
                    textarea.id = 'articleInput';
                    textarea.rows = 5;
                    textarea.placeholder = '粘贴英文文章...';
                    Object.assign(textarea.style, {
                        width: '100%',
                        padding: '14px',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        fontSize: '16px',
                        background: 'var(--bg-page)',
                        color: 'var(--text)'
                    });

                    const wrapper = this.getElement('textareaWrapper');
                    if (wrapper) {
                        wrapper.appendChild(textarea);
                    }
                }
                return textarea;
            }

            showAnalysisMode() {
                const section = this.ensureDeepParseSection();
                const twoColumn = section.querySelector('.two-column-container');
                const inputPanel = section.querySelector('#inputPanel');

                this.safeSetStyle(twoColumn, 'display', 'flex');
                this.safeSetStyle(inputPanel, 'display', 'block');
                this.ensureTextarea();
                this.renderSecondRowButtons();

                // 恢复缓存的内容
                this.restoreCachedContent();

                // 完全移除 content-section（由深度解析区替代）
                this.removeContentSection();

                this.showSecondaryButtons();
                this.hideAllInterfaces();

                // 触发事件通知其他模块深度解析模式已激活
                if (eventBus && eventBus.emit) {
                    eventBus.emit('showAnalysisMode');
                }
            }

            // 生成第二行按钮（解析 / 词性高亮 / 保存当前分析 / 加载示例）
            // 容器 secondRowContainer 由 ensureDeepParseSection 同步创建，此处直接同步渲染即可，无需延时轮询
            renderSecondRowButtons() {
                const container = document.getElementById('secondRowContainer');
                if (!container) return;

                const buttons = [
                    { id: 'parseBtn', text: '解析', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' },
                    { id: 'highlightToggleBtn', text: '词性高亮', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3 3-3 3" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8" /><path d="M12 6h8" /><path d="M12 12h8" /><path d="M12 18h8" /></svg>' },
                    { id: 'saveAnalysisBtn', text: '保存当前分析', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>' },
                    { id: 'loadExampleBtn', text: '加载示例', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' }
                ];

                container.innerHTML = '';
                buttons.forEach(btn => {
                    const button = document.createElement('button');
                    button.id = btn.id;
                    button.classList.add('secondary');

                    const buttonContent = document.createElement('span');
                    buttonContent.style.display = 'flex';
                    buttonContent.style.alignItems = 'center';
                    buttonContent.style.gap = '8px';

                    if (btn.icon) {
                        const iconSpan = document.createElement('span');
                        iconSpan.innerHTML = btn.icon;
                        buttonContent.appendChild(iconSpan);
                    }

                    const textSpan = document.createElement('span');
                    textSpan.textContent = btn.text;
                    buttonContent.appendChild(textSpan);

                    button.appendChild(buttonContent);
                    container.appendChild(button);
                });

                // 通知词性高亮控制器按钮已重新生成，便于其重新绑定事件
                if (eventBus && eventBus.emit) {
                    eventBus.emit('secondRowButtonsGenerated');
                }
            }

            restoreCachedContent() {
                if (!window.CacheManager) return;

                // 恢复原始文本
                const originalText = window.CacheManager.getOriginalText();
                const textarea = document.getElementById('articleInput');
                if (textarea && originalText) {
                    textarea.value = originalText;
                }

                // 恢复句子解析结果
                const sentences = window.CacheManager.getSentences();
                const sentenceData = window.CacheManager.getAllSentenceData();
                const container = document.getElementById('deepParseSentencesContainer');
                if (container && sentences && sentences.length > 0 && window.SentenceRenderer) {
                    window.SentenceRenderer.setContainer(container);
                    window.SentenceRenderer.setSentencesData(sentences, sentenceData || {});
                    window.SentenceRenderer.renderAll();

                    // 显示右栏
                    const twoColumnContainer = document.querySelector('.two-column-container');
                    if (twoColumnContainer) {
                        twoColumnContainer.classList.add('show-right', 'has-sentences');
                    }

                    // 触发句子卡片重新渲染完成事件，通知其他模块重新绑定
                    if (eventBus && eventBus.emit) {
                        eventBus.emit('sentencesRendered');
                    }
                }
            }

            showVocabMode() {
                this.removeDeepParseSection();
                this.ensureContentSection();

                this.hideAllInterfaces();

                this.renderVocabInterface();
            }

            showMemoryMode() {
                this.removeDeepParseSection();
                this.ensureContentSection();

                this.hideAllInterfaces();

                this.renderVocabInterface();

                const contentArea = this.getElement('contentArea');
                const sentencesContainer = this.getElement('sentencesContainer');

                if (this.memoryModule && this.memoryModule.showMemoryInterface) {
                    this.memoryModule.showMemoryInterface(contentArea, sentencesContainer);
                } else if (window.VocabInterface && window.VocabInterface.showMemoryModeInterface) {
                    const vocabContainer = document.getElementById('vocabInterface');
                    if (vocabContainer) {
                        window.VocabInterface.showMemoryModeInterface(vocabContainer);
                    }
                }
            }

            showHistoryMode() {
                this.removeDeepParseSection();
                this.ensureContentSection();

                this.hideAllInterfaces();

                this.safeSetStyle(this.getElement('contentArea'), 'display', '');
                this.renderHistoryInterface();

                if (eventBus && eventBus.emit) {
                    eventBus.emit('showHistoryMode');
                }
            }

            renderVocabInterface() {
                const contentArea = this.getElement('contentArea');
                const sentencesContainer = this.getElement('sentencesContainer');

                if (!contentArea) return;

                try {
                    if (this.vocabModule && this.vocabModule.showVocabInterface) {
                        this.vocabModule.showVocabInterface(contentArea, sentencesContainer);
                    } else if (window.VocabInterface && window.VocabInterface.show) {
                        window.VocabInterface.show(contentArea, sentencesContainer);
                    } else {
                        this.showErrorInterface(contentArea, 'vocabInterface', '生词本界面');
                    }
                } catch (error) {
                    console.error('生词本界面加载失败:', error);
                    this.showErrorInterface(contentArea, 'vocabInterface', '生词本界面');
                }
            }

            renderHistoryInterface() {
                const contentArea = this.getElement('contentArea');
                const sentencesContainer = this.getElement('sentencesContainer');

                if (!contentArea) return;

                try {
                    if (window.HistoryInterface && window.HistoryInterface.show) {
                        window.HistoryInterface.show(contentArea, sentencesContainer);
                    } else {
                        this.showErrorInterface(contentArea, 'historyInterface', '历史记录界面');
                    }
                } catch (error) {
                    console.error('历史记录界面加载失败:', error);
                    this.showErrorInterface(contentArea, 'historyInterface', '历史记录界面');
                }
            }

            showErrorInterface(container, id, name) {
                const errorDiv = document.createElement('div');
                errorDiv.id = id;
                errorDiv.className = `${id.replace('Interface', '')}-card`;
                errorDiv.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: var(--text-light);">
                        <p>⚠️ ${name}加载失败</p>
                        <p style="font-size: 0.9rem; margin-top: 10px;">请刷新页面重试</p>
                    </div>
                `;
                const sentencesContainer = this.getElement('sentencesContainer');
                container.insertBefore(errorDiv, sentencesContainer);
            }

            showSecondaryAnalysisMode(text, historyItem) {
                this.removeDeepParseSection();

                this.safeSetStyle(this.getElement('contentArea'), 'display', 'none');
                this.safeSetStyle(this.getElement('sentencesContainer'), 'display', 'none');

                this.safeSetStyle(this.getElement('secondaryAnalysisContainer'), 'display', 'block');

                if (eventBus && eventBus.emit) {
                    eventBus.emit('analyzeText', { text, historyItem });
                }
            }

            getCurrentMode() {
                return this.currentMode;
            }

            setDeepParseModule(module) {
                this.deepParseModule = module;
            }

            setVocabModule(module) {
                this.vocabModule = module;
            }

            setMemoryModule(module) {
                this.memoryModule = module;
            }

            setupEventListeners() {
                if (!eventBus || !eventBus.on) {
                    console.warn('EventBus 不可用，无法监听事件');
                    return;
                }

                eventBus.on('navigateToSecondaryAnalysis', (data) => {
                    this.showSecondaryAnalysisMode(data.text, data.historyItem);
                });
            }

            init() {
                this.bindNavTabs();
                this.bindSidebarCollapse();
                this.bindMobileNavigation();
                this.setupEventListeners();
                this.updateButtonHighlight();
                this.updateMemoryModeButtonState();
                this.showAnalysisMode();
                // 默认折叠侧边栏
                this.setSidebarCollapsed(true);
            }

            // 移动端：侧边栏抽屉开关（汉堡按钮 / 遮罩 / Esc / 模式切换后自动关闭）
            bindMobileNavigation() {
                const menuBtn = this.getElement('mobileMenuBtn');
                const overlay = this.getElement('mobileSidebarOverlay');
                const sidebar = this.getElement('app-sidebar');
                if (!menuBtn || !overlay || !sidebar) return;

                const setMobileSidebar = (open) => {
                    sidebar.classList.toggle('mobile-open', open);
                    overlay.classList.toggle('show', open);
                    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                    menuBtn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
                    document.body.classList.toggle('mobile-nav-open', open);
                };
                this.closeMobileSidebar = () => setMobileSidebar(false);

                menuBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileSidebar(!sidebar.classList.contains('mobile-open'));
                });

                overlay.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setMobileSidebar(false);
                });

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
                        setMobileSidebar(false);
                    }
                });
            }

            // 设置侧边栏折叠状态并同步按钮文案
            setSidebarCollapsed(collapsed) {
                document.body.classList.toggle('sidebar-collapsed', collapsed);
                const btn = this.getElement('sidebarCollapseBtn');
                if (btn) {
                    btn.setAttribute('aria-label', collapsed ? '展开侧边栏' : '折叠侧边栏');
                    btn.title = collapsed ? '展开侧边栏' : '折叠侧边栏';
                }
            }
        }

        const manager = new MainButtonManager();

        window.MainButtonManager = {
            init: () => manager.init(),
            switchMode: (mode) => manager.switchMode(mode),
            getCurrentMode: () => manager.getCurrentMode(),
            setDeepParseModule: (module) => manager.setDeepParseModule(module),
            setVocabModule: (module) => manager.setVocabModule(module),
            setMemoryModule: (module) => manager.setMemoryModule(module),
            showAnalysisMode: () => manager.showAnalysisMode(),
            showVocabMode: () => manager.showVocabMode()
        };

        return window.MainButtonManager;
    });
})();