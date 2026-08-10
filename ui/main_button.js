// main_button.js - 主按钮生成与模式切换（模块化重构版）
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

        const MAIN_BUTTONS_CONFIG = [
            { id: 'deepParseMainBtn', text: '深度解析', mode: MODES.ANALYSIS, icon: 'search' },
            { id: 'vocabMainBtn', text: '生词本', mode: MODES.VOCAB, icon: 'book' },
            { id: 'historyMainBtn', text: '历史记录', mode: MODES.HISTORY, icon: 'history' }
        ];

        const ICONS = {
            search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>`,
            book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>`,
            history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8v4l3 3"></path>
                <circle cx="12" cy="12" r="10"></circle>
            </svg>`
        };

        const DEEP_PARSE_SECTION_HTML = `
            <div class="two-column-container">
                <button id="panelToggleBtn" class="panel-toggle-btn" aria-label="折叠输入面板" data-tooltip="折叠输入面板">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
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
                this.buttons = [...MAIN_BUTTONS_CONFIG];
            }

            getIconSVG(iconType) {
                return ICONS[iconType] || ICONS.search;
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

            generateMainButtons() {
                const container = this.getElement('mainButtonContainer');
                if (!container) return;

                container.innerHTML = '';

                this.buttons.forEach((btn) => {
                    const linkBtn = document.createElement('button');
                    linkBtn.className = 'link';
                    linkBtn.id = btn.id;

                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'link-icon';
                    iconSpan.innerHTML = this.getIconSVG(btn.icon);

                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'link-title';
                    titleSpan.textContent = btn.text;

                    linkBtn.appendChild(iconSpan);
                    linkBtn.appendChild(titleSpan);

                    if (this.currentMode === btn.mode) {
                        linkBtn.classList.add('active');
                    }

                    linkBtn.addEventListener('click', () => {
                        if (btn.mode !== this.currentMode) {
                            this.switchMode(btn.mode);
                        }
                    });

                    container.appendChild(linkBtn);
                });

                const memoryModeBtn = document.createElement('button');
                memoryModeBtn.className = 'memory-mode-button';
                memoryModeBtn.innerHTML = `
                    <span class="memory-mode-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="12" r="6"/>
                            <circle cx="12" cy="12" r="2"/>
                            <line x1="12" y1="2" x2="12" y2="6"/>
                            <line x1="12" y1="18" x2="12" y2="22"/>
                            <line x1="2" y1="12" x2="6" y2="12"/>
                            <line x1="18" y1="12" x2="22" y2="12"/>
                        </svg>
                    </span>
                    <span class="memory-mode-title">记忆模式</span>
                    <div class="memory-mode-hover-effect">
                        <div></div>
                    </div>
                `;
                memoryModeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.currentMode !== MODES.MEMORY) {
                        this.switchMode(MODES.MEMORY);
                    }
                });

                if (this.currentMode === MODES.MEMORY) {
                    memoryModeBtn.classList.add('active');
                }

                container.appendChild(memoryModeBtn);
            }

            updateButtonHighlight() {
                this.buttons.forEach(btn => {
                    const link = this.getElement(btn.id);
                    if (link) {
                        link.classList.toggle('active', this.currentMode === btn.mode);
                    }
                });
            }

            updateMemoryModeButtonState() {
                const memoryBtn = document.querySelector('.memory-mode-button');
                if (memoryBtn) {
                    memoryBtn.classList.toggle('active', this.currentMode === MODES.MEMORY);
                }
            }

            switchMode(mode) {
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

            showCardHeaderAndBody() {
                const cardHeader = document.querySelector('.card-header');
                const cardBody = document.querySelector('.card-body');
                this.safeSetStyle(cardHeader, 'display', 'flex');
                this.safeSetStyle(cardBody, 'display', 'block');
            }

            hideCardHeaderAndBody() {
                const cardHeader = document.querySelector('.card-header');
                const cardBody = document.querySelector('.card-body');
                this.safeSetStyle(cardHeader, 'display', 'none');
                this.safeSetStyle(cardBody, 'display', 'none');
            }

            hideHeader() {
                const header = document.getElementById('app-header');
                this.safeSetStyle(header, 'display', 'none');
            }

            showHeader() {
                const header = document.getElementById('app-header');
                this.safeSetStyle(header, 'display', 'flex');
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
                    const secondaryContainer = this.getElement('secondaryAnalysisContainer');
                    if (mainContent && secondaryContainer) {
                        mainContent.insertBefore(section, secondaryContainer);
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

                // 恢复缓存的内容
                this.restoreCachedContent();

                // 完全移除 content-section
                this.removeContentSection();

                this.showCardHeaderAndBody();
                this.showHeader();
                this.showSecondaryButtons();
                this.hideAllInterfaces();

                // 触发事件通知其他模块深度解析模式已激活
                if (eventBus && eventBus.emit) {
                    eventBus.emit('showAnalysisMode');
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

                this.showCardHeaderAndBody();
                this.showHeader();
                this.hideAllInterfaces();

                this.renderVocabInterface();
            }

            showMemoryMode() {
                this.removeDeepParseSection();
                this.ensureContentSection();

                this.showCardHeaderAndBody();
                this.showHeader();
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

                this.showCardHeaderAndBody();
                this.showHeader();
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

                this.hideCardHeaderAndBody();
                this.hideHeader();

                this.safeSetStyle(this.getElement('secondaryAnalysisContainer'), 'display', 'block');

                if (eventBus && eventBus.emit) {
                    eventBus.emit('analyzeText', { text, historyItem });
                }
            }

            addButton(button) {
                this.buttons.push(button);
                this.generateMainButtons();
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

                eventBus.on('addMainButton', (button) => this.addButton(button));
                eventBus.on('navigateToSecondaryAnalysis', (data) => {
                    this.showSecondaryAnalysisMode(data.text, data.historyItem);
                });
            }

            init() {
                this.generateMainButtons();
                this.setupEventListeners();
                this.showAnalysisMode();
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
