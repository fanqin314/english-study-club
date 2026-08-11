// flashcard_ui.js - 闪卡模式的界面和交互逻辑
// 基于完整版 flashcard_ui.js 改造，集成到模块化系统

(function() {
    // 将模块挂载到 window 对象（提前挂载，确保 GlobalManager 初始化时能获取到）
    window.FlashcardUI = {
        showFlashcardModeInterface: function(container) {
            console.log('FlashcardUI 模块正在初始化...');
        }
    };

    ModuleRegistry.register('FlashcardUI', ['GlobalManager'], function(GlobalManager) {
        // 获取VocabData实例
        function getVocabData() {
            return GlobalManager.getGlobalObject('VocabData');
        }

        // 当前单词索引
        let currentIndex = 0;
        // 单词数据列表
        let wordsData = [];
        // 是否为翻转模式
        let isFlipMode = false;
        // 键盘事件处理函数引用（用于清理）
        let _keydownHandler = null;
        // 评级自动前进防重入标志
        let _rateTimeoutPending = false;

        // 默认单词库 (当生词本为空时使用)
        const DEFAULT_WORDS = [
            { word: "Antique", pos: "adj / n", meaning: "古老的，古董的", example: null },
            { word: "Exert", pos: "v", meaning: "施加（影响）；运用", example: null },
            { word: "Peculiar", pos: "adj", meaning: "奇怪的；特有的", example: null },
            { word: "Fascination", pos: "n", meaning: "魅力；着迷", example: null },
            { word: "Pretentious", pos: "adj", meaning: "自命不凡的，做作的", example: null },
            { word: "Ephemeral", pos: "adj", meaning: "短暂的，瞬息的", example: null },
            { word: "Serendipity", pos: "n", meaning: "意外发现珍宝的运气", example: null },
            { word: "Mellifluous", pos: "adj", meaning: "甜美流畅的（声音）", example: null }
        ];

        // 例句模拟库
        const FAKE_EXAMPLES = {
            "Antique": { en: "This antique vase is worth a fortune.", zh: "这个古董花瓶价值连城。" },
            "Exert": { en: "He had to exert all his strength.", zh: "他必须使出全力。" },
            "Peculiar": { en: "There's a peculiar smell.", zh: "有一股奇怪的气味。" },
            "Fascination": { en: "The castle held a strange fascination.", zh: "古堡有种奇怪的魅力。" },
            "Pretentious": { en: "His pretentious style annoys readers.", zh: "他做作的风格惹人反感。" },
            "Ephemeral": { en: "Fame can be ephemeral.", zh: "名声可能转瞬即逝。" },
            "Serendipity": { en: "Finding that book was serendipity.", zh: "找到那本书纯属机缘。" },
            "Mellifluous": { en: "Her mellifluous voice captivated all.", zh: "她甜美的嗓音迷住了所有人。" }
        };

        // 加载单词数据
        function loadWordsData() {
            const vocabData = getVocabData();
            if (!vocabData) {
                console.warn('生词本数据服务未初始化');
                wordsData = [];
                return;
            }

            const currentNotebook = vocabData.getCurrentNotebook();
            if (!currentNotebook || currentNotebook.words.length === 0) {
                console.warn('当前生词本为空');
                wordsData = [];
                return;
            }

            // 转换单词数据格式，包括例句
            wordsData = currentNotebook.words.map(word => ({
                word: word.word,
                pos: word.pos || 'n',
                meaning: word.meaning,
                example: word.example || null
            }));

            // 随机打乱单词顺序
            shuffleArray(wordsData);
            currentIndex = 0;
        }

        // 打乱数组
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        // 显示闪卡模式界面
        function showFlashcardModeInterface(container) {
            // 隐藏其他界面元素
            hideOtherElements();

            // 隐藏记忆模式界面的原有内容
            const memoryModeHeader = container.querySelector('.memory-mode-header');
            const memoryModeTitle = container.querySelector('h4');
            const modeSelectSection = container.querySelector('.mode-select-section');
            
            if (memoryModeHeader) memoryModeHeader.style.display = 'none';
            if (memoryModeTitle) memoryModeTitle.style.display = 'none';
            if (modeSelectSection) modeSelectSection.style.display = 'none';

            // 加载单词数据
            loadWordsData();

            // 创建闪卡容器
            let flashcardContainer = document.getElementById('flashcardModeContainer');
            if (!flashcardContainer) {
                flashcardContainer = document.createElement('div');
                flashcardContainer.id = 'flashcardModeContainer';
            }
            flashcardContainer.innerHTML = '';

            // 检查是否有单词
            if (wordsData.length === 0) {
                // 显示空状态
                const emptyHTML = `
                    <div class="fill-header">
                        <button class="back-btn" id="backBtn">
                            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <h3>闪卡模式</h3>
                        <span class="fill-score-badge" id="flashcardScoreBadge">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            <span id="flashcardScoreNum">0</span>
                        </span>
                    </div>
                    <div class="empty-state">
                        <div class="empty-icon">📖</div>
                        <div class="empty-title">暂无单词</div>
                        <div class="empty-subtitle">请先在生词本中添加单词</div>
                    </div>
                `;
                flashcardContainer.innerHTML = emptyHTML;
                container.appendChild(flashcardContainer);
                
                // 添加返回按钮事件
                const backBtn = document.getElementById('backBtn');
                if (backBtn) {
                    function handleBackClick() {
                        // 移除闪卡容器
                        if (flashcardContainer) {
                            flashcardContainer.remove();
                        }
                        
                        // 显示记忆模式界面的原有内容
                        if (container) {
                            const memoryModeHeader = container.querySelector('.memory-mode-header');
                            const memoryModeTitle = container.querySelector('h4');
                            const modeSelectSection = container.querySelector('.mode-select-section');
                            
                            if (memoryModeHeader) memoryModeHeader.style.display = '';
                            if (memoryModeTitle) memoryModeTitle.style.display = '';
                            if (modeSelectSection) modeSelectSection.style.display = '';
                        }
                        
                        // 恢复整个 header 区域显示
                        const fcAppHeader = document.getElementById('app-header');
                        const fcCardHeader = document.querySelector('.card-header');
                        const fcCardBody = document.querySelector('.card-body');
                        if (fcAppHeader) fcAppHeader.style.display = 'flex';
                        if (fcCardHeader) fcCardHeader.style.display = 'flex';
                        if (fcCardBody) fcCardBody.style.display = 'block';
                    }
                    backBtn.addEventListener('click', handleBackClick);
                }
                return;
            }

            // 创建闪卡界面（简化DOM结构）
            const flashcardHTML = `
                <div class="fill-header">
                    <button class="back-btn" id="backBtn">
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <h3>闪卡模式</h3>
                    <span class="fill-score-badge" id="flashcardScoreBadge">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span id="flashcardScoreNum">0</span>
                    </span>
                </div>
                <div class="card-3d" id="magicCard">
                    <div class="glare" id="glareLayer"></div>
                    <div class="card-face card-front">
                        <div class="word-section" id="wordSection">
                            <span class="word" id="currentWord">loading...</span>
                            <span class="pos" id="currentPos"></span>
                            <span class="meaning" id="currentMeaning"></span>
                            <div id="flipWrapper" style="display: none;"></div>
                        </div>
                        <div class="example-area" id="exampleArea">
                            <div class="example-en" id="exampleEn">点击右侧星星生成例句</div>
                            <div class="example-zh" id="exampleZh"></div>
                        </div>
                        <div class="fill-bottom">
                            <button class="fill-hint-btn" id="flashcardGenExampleBtn" title="生成例句">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>
                            <button class="fill-skip-btn" id="flashcardToggleTransBtn" title="隐藏/显示翻译">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/></svg>
                            </button>
                        </div>
                        <div class="nav-buttons">
                            <button class="nav-btn" id="prevBtn">
                                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                                上一个
                            </button>
                            <span class="counter" id="counter">1 / ${wordsData.length}</span>
                            <button class="nav-btn" id="nextBtn">
                                下一个
                                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                        <div class="fill-progress-wrap" id="flashcardProgressWrap">
                            <div class="fill-progress-track">
                                <div class="fill-progress-fill" id="progressBar" style="width:0%"></div>
                            </div>
                            <span class="fill-progress-text" id="counterText">${currentIndex+1} / ${wordsData.length}</span>
                        </div>
                        <div class="feedback-overlay" id="feedbackOverlay" style="display:none">
                            <div class="feedback-content">
                                <div class="feedback-icon" id="feedbackIcon"></div>
                                <div class="feedback-text" id="feedbackText"></div>
                                <div class="feedback-detail" id="feedbackDetail"></div>
                            </div>
                        </div>
                        <div class="mastery-ratings" id="masteryRatings">
                            <button class="mastery-btn unknown" data-rating="unknown" title="不认识 (按 1)">
                                <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                                <span>不认识</span>
                            </button>
                            <button class="mastery-btn vague" data-rating="vague" title="模糊 (按 2)">
                                <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                                <span>模糊</span>
                            </button>
                            <button class="mastery-btn known" data-rating="known" title="已掌握 (按 3)">
                                <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="8 12 11 15 16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span>已掌握</span>
                            </button>
                        </div>
                    </div>
                    <div class="card-face card-back" id="cardBack"></div>
                </div>`;

            flashcardContainer.innerHTML = flashcardHTML;
            container.appendChild(flashcardContainer);

            // 初始化界面
            initFlashcardUI(container, flashcardContainer);
        }

        // 隐藏其他界面元素
        function hideOtherElements() {
            // 隐藏整个 header 区域
            const appHeader = document.getElementById('app-header');
            const cardHeader = document.querySelector('.card-header');
            const cardBody = document.querySelector('.card-body');
            
            if (appHeader) {
                appHeader.style.display = 'none';
            }
            
            if (cardHeader) {
                cardHeader.style.display = 'none';
            }
            
            if (cardBody) {
                cardBody.style.display = 'none';
            }
        }



        // 初始化闪卡界面
        function initFlashcardUI(memoryModeContainer, flashcardContainer) {
            // DOM 元素
            const card = document.getElementById('magicCard');
            const glare = document.getElementById('glareLayer');
            const wordSection = document.getElementById('wordSection');
            const wordEl = document.getElementById('currentWord');
            const posEl = document.getElementById('currentPos');
            const meaningEl = document.getElementById('currentMeaning');
            const exampleEnEl = document.getElementById('exampleEn');
            const exampleZhEl = document.getElementById('exampleZh');
            const generateBtn = document.getElementById('flashcardGenExampleBtn');
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            const counterSpan = document.getElementById('counter');
            const counterText = document.getElementById('counterText');
            const progressBar = document.getElementById('progressBar');
            const toggleTransBtn = document.getElementById('flashcardToggleTransBtn');
            const hideIconSvg = document.getElementById('flashcardToggleTransBtn')?.querySelector('svg');
            const flipWrapper = document.getElementById('flipWrapper');
            const exampleArea = document.getElementById('exampleArea');
            const backBtn = document.getElementById('backBtn');
            const navButtons = [prevBtn, nextBtn];

            // 初始化主题
            const isDarkMode = localStorage.getItem('darkMode') === 'true';
            if (isDarkMode) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }

            // 清理函数数组，用于退出时统一移除事件监听
            const _cleanupFns = [];

            // 翻转卡片功能
            function buildFlipStructure(word, meaning) {
                flipWrapper.style.display = 'block';
                flipWrapper.innerHTML = `
                    <div class="flip-container">
                        <div class="flipper">
                            <div class="flip-front">${word}</div>
                            <div class="flip-back">${meaning}</div>
                        </div>
                    </div>
                `;
                wordEl.style.display = 'none';
                posEl.style.display = 'none';
                meaningEl.style.display = 'none';
                wordSection.classList.add('flip-mode');
            }

            function destroyFlipStructure() {
                flipWrapper.style.display = 'none';
                flipWrapper.innerHTML = '';
                wordEl.style.display = '';
                posEl.style.display = '';
                meaningEl.style.display = '';
                wordSection.classList.remove('flip-mode');
            }

            function updateFlipContent(word, meaning) {
                const front = document.querySelector('.flip-front');
                const back = document.querySelector('.flip-back');
                if (front) front.textContent = word;
                if (back) back.textContent = meaning;
            }

            function toggleTranslationMode() {
                isFlipMode = !isFlipMode;
                const item = wordsData[currentIndex];

                if (isFlipMode) {
                    exampleArea.classList.add('hide-zh');
                    buildFlipStructure(item.word, item.meaning);
                    hideIconSvg.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
                    toggleTransBtn.setAttribute('aria-label', '显示翻译');
                } else {
                    exampleArea.classList.remove('hide-zh');
                    destroyFlipStructure();
                    hideIconSvg.innerHTML = `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/>`;
                    toggleTransBtn.setAttribute('aria-label', '隐藏翻译');
                    updateCardContent();
                }
            }

            // 更新卡片内容
            function updateCardContent() {
                if (wordsData.length === 0) {
                    wordEl.textContent = '无单词';
                    posEl.textContent = '';
                    meaningEl.textContent = '请先在生词本中添加单词';
                    counterSpan.textContent = '0 / 0';
                    if (counterText) counterText.textContent = '0 / 0';
                    progressBar.style.width = '0%';
                    exampleEnEl.textContent = '暂无例句';
                    exampleZhEl.textContent = '';
                    return;
                }

                const item = wordsData[currentIndex];
                wordEl.textContent = item.word;
                posEl.textContent = item.pos;
                meaningEl.textContent = item.meaning;
                counterSpan.textContent = `${currentIndex+1} / ${wordsData.length}`;
                if (counterText) counterText.textContent = `${currentIndex+1} / ${wordsData.length}`;
                progressBar.style.width = `${((currentIndex+1)/wordsData.length)*100}%`;
                if (item.example) {
                    exampleEnEl.textContent = item.example.en;
                    exampleZhEl.textContent = item.example.zh;
                } else {
                    exampleEnEl.textContent = '点击右侧星星生成例句';
                    exampleZhEl.textContent = '';
                }
            }

            // 更新卡片
            function updateCard() {
                wordSection.classList.add('animate');
                setTimeout(() => wordSection.classList.remove('animate'), 250);

                // 重置评级按钮高亮
                masteryBtns.forEach(b => b.classList.remove('active'));
                // 如果当前单词已有评级，高亮对应的按钮
                const savedRating = _ratingMap.get(currentIndex);
                if (savedRating) {
                    const activeBtn = masteryRatings.querySelector(`[data-rating="${savedRating}"]`);
                    if (activeBtn) activeBtn.classList.add('active');
                }

                if (wordsData.length === 0) {
                    updateCardContent();
                    return;
                }

                const item = wordsData[currentIndex];
                if (isFlipMode) {
                    updateFlipContent(item.word, item.meaning);
                    exampleArea.classList.add('hide-zh');
                } else {
                    wordEl.textContent = item.word;
                    posEl.textContent = item.pos;
                    meaningEl.textContent = item.meaning;
                    exampleArea.classList.remove('hide-zh');
                }
                counterSpan.textContent = `${currentIndex+1} / ${wordsData.length}`;
                if (counterText) counterText.textContent = `${currentIndex+1} / ${wordsData.length}`;
                progressBar.style.width = `${((currentIndex+1)/wordsData.length)*100}%`;
                if (item.example) {
                    exampleEnEl.textContent = item.example.en;
                    exampleZhEl.textContent = item.example.zh;
                } else {
                    exampleEnEl.textContent = '点击右侧星星生成例句';
                    exampleZhEl.textContent = '';
                }
            }

            // 生成例句
            async function handleGenerateExample() {
                if (wordsData.length === 0) return;

                const item = wordsData[currentIndex];
                
                // 检查是否已有例句
                if (item.example && item.example.en && item.example.zh) {
                    // 已有例句，直接显示
                    exampleEnEl.textContent = item.example.en;
                    exampleZhEl.textContent = item.example.zh;
                    return;
                }
                
                // 没有例句，生成新的
                exampleEnEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> 生成中...';
                exampleZhEl.textContent = '';
                
                try {
                    // 调用API生成例句
                    const APIRequest = window.APIRequest || (window.GlobalManager && window.GlobalManager.getGlobalObject('APIRequest'));
                    if (APIRequest && APIRequest.requestExample) {
                        const example = await APIRequest.requestExample(item.word, item.meaning);
                        if (example && example.en && example.zh) {
                            // 保存到单词对象中
                            item.example = example;
                            exampleEnEl.textContent = example.en;
                            exampleZhEl.textContent = example.zh;
                            
                            // 保存到 VocabData 中
                            const vocabData = getVocabData();
                            if (vocabData) {
                                const currentNotebookId = vocabData.getCurrentNotebookId();
                                vocabData.updateWord(currentNotebookId, item.word, { example: example });
                            }
                        } else {
                            // 回退到默认例句
                            const defaultExample = FAKE_EXAMPLES[item.word] || { 
                                en: `"${item.word}" is a great word.`, 
                                zh: `「${item.word}」是个好词。` 
                            };
                            item.example = defaultExample;
                            exampleEnEl.textContent = defaultExample.en;
                            exampleZhEl.textContent = defaultExample.zh;
                            
                            // 保存默认例句到 VocabData 中
                            const vocabData = getVocabData();
                            if (vocabData) {
                                const currentNotebookId = vocabData.getCurrentNotebookId();
                                vocabData.updateWord(currentNotebookId, item.word, { example: defaultExample });
                            }
                        }
                    } else {
                        // API不可用时使用默认例句
                        const defaultExample = FAKE_EXAMPLES[item.word] || { 
                            en: `"${item.word}" is a great word.`, 
                            zh: `「${item.word}」是个好词。` 
                        };
                        item.example = defaultExample;
                        exampleEnEl.textContent = defaultExample.en;
                        exampleZhEl.textContent = defaultExample.zh;
                        
                        // 保存默认例句到 VocabData 中
                        const vocabData = getVocabData();
                        if (vocabData) {
                            const currentNotebookId = vocabData.getCurrentNotebookId();
                            vocabData.updateWord(currentNotebookId, item.word, { example: defaultExample });
                        }
                    }
                } catch (error) {
                    console.error('生成例句失败:', error);
                    // 错误时使用默认例句
                    const defaultExample = FAKE_EXAMPLES[item.word] || { 
                        en: `"${item.word}" is a great word.`, 
                        zh: `「${item.word}」是个好词。` 
                    };
                    item.example = defaultExample;
                    exampleEnEl.textContent = defaultExample.en;
                    exampleZhEl.textContent = defaultExample.zh;
                    
                    // 保存默认例句到 VocabData 中
                    const vocabData = getVocabData();
                    if (vocabData) {
                        const currentNotebookId = vocabData.getCurrentNotebookId();
                        vocabData.updateWord(currentNotebookId, item.word, { example: defaultExample });
                    }
                }
            }

            // 上一个单词
            function prevWord() {
                if (wordsData.length === 0) return;
                _rateTimeoutPending = false;
                currentIndex = (currentIndex - 1 + wordsData.length) % wordsData.length;
                updateCard();
            }

            // 下一个单词
            function nextWord() {
                if (wordsData.length === 0) return;
                _rateTimeoutPending = false;
                currentIndex = (currentIndex + 1) % wordsData.length;
                updateCard();
            }

            // 返回按钮事件
            function handleBackBtnClick() {
                // 调用所有清理函数
                _cleanupFns.forEach(fn => fn());
                _cleanupFns.length = 0;
                // 移除键盘事件引用
                _keydownHandler = null;

                // 移除闪卡容器
                if (flashcardContainer) {
                    flashcardContainer.remove();
                }
                
                // 显示记忆模式界面的原有内容
                if (memoryModeContainer) {
                    const memoryModeHeader = memoryModeContainer.querySelector('.memory-mode-header');
                    const memoryModeTitle = memoryModeContainer.querySelector('h4');
                    const modeSelectSection = memoryModeContainer.querySelector('.mode-select-section');
                    
                    if (memoryModeHeader) memoryModeHeader.style.display = '';
                    if (memoryModeTitle) memoryModeTitle.style.display = '';
                    if (modeSelectSection) modeSelectSection.style.display = '';
                }
                
                // 恢复整个 header 区域显示
                const fcAppHeader = document.getElementById('app-header');
                const fcCardHeader = document.querySelector('.card-header');
                const fcCardBody = document.querySelector('.card-body');
                if (fcAppHeader) fcAppHeader.style.display = 'flex';
                if (fcCardHeader) fcCardHeader.style.display = 'flex';
                if (fcCardBody) fcCardBody.style.display = 'block';
            }
            backBtn.addEventListener('click', handleBackBtnClick);
            _cleanupFns.push(() => backBtn.removeEventListener('click', handleBackBtnClick));

            // 事件监听
            generateBtn.addEventListener('click', handleGenerateExample);
            _cleanupFns.push(() => generateBtn.removeEventListener('click', handleGenerateExample));
            prevBtn.addEventListener('click', prevWord);
            _cleanupFns.push(() => prevBtn.removeEventListener('click', prevWord));
            nextBtn.addEventListener('click', nextWord);
            _cleanupFns.push(() => nextBtn.removeEventListener('click', nextWord));
            toggleTransBtn.addEventListener('click', toggleTranslationMode);
            _cleanupFns.push(() => toggleTransBtn.removeEventListener('click', toggleTranslationMode));

            // 键盘事件 - 导航 + 评级快捷（使用命名函数避免累积绑定）
            if (_keydownHandler) {
                window.removeEventListener('keydown', _keydownHandler);
            }

            function handleFlashcardKeydown(e) {
                if (e.key === 'ArrowLeft') { e.preventDefault(); prevWord(); }
                else if (e.key === 'ArrowRight') { e.preventDefault(); nextWord(); }
                else if (e.key === '1') { e.preventDefault(); rateWord('unknown'); }
                else if (e.key === '2') { e.preventDefault(); rateWord('vague'); }
                else if (e.key === '3') { e.preventDefault(); rateWord('known'); }
                else if (e.key === 'Enter') {
                    const retryBtn = document.querySelector('.summary-retry-btn');
                    if (retryBtn) { e.preventDefault(); retryBtn.click(); }
                }
            }

            _keydownHandler = handleFlashcardKeydown;
            window.addEventListener('keydown', handleFlashcardKeydown);
            _cleanupFns.push(() => {
                window.removeEventListener('keydown', handleFlashcardKeydown);
                _keydownHandler = null;
            });

            const masteryRatings = document.getElementById('masteryRatings');
            const masteryBtns = masteryRatings ? masteryRatings.querySelectorAll('.mastery-btn') : [];
            let _ratingMap = new Map();

            function rateWord(rating) {
                if (wordsData.length === 0) return;
                // 防重入保护：如果已有待处理的自动前进，忽略本次评级
                if (_rateTimeoutPending) return;
                // 避免重复评级同一单词
                if (_ratingMap.has(currentIndex)) return;
                _ratingMap.set(currentIndex, rating);

                // 更新评分徽章
                const scoreNumEl = document.getElementById('flashcardScoreNum');
                if (scoreNumEl) {
                    scoreNumEl.textContent = _ratingMap.size;
                }

                // 高亮当前评级按钮
                masteryBtns.forEach(b => b.classList.remove('active'));
                const activeBtn = masteryRatings.querySelector(`[data-rating="${rating}"]`);
                if (activeBtn) activeBtn.classList.add('active');

                // 显示即时反馈覆盖层
                const feedbackOverlay = document.getElementById('feedbackOverlay');
                const feedbackIcon = document.getElementById('feedbackIcon');
                const feedbackText = document.getElementById('feedbackText');
                const feedbackDetail = document.getElementById('feedbackDetail');
                const item = wordsData[currentIndex];

                if (feedbackOverlay && feedbackIcon && feedbackText && feedbackDetail) {
                    if (rating === 'known') {
                        feedbackIcon.innerHTML = '✓';
                        feedbackIcon.className = 'feedback-icon feedback-known';
                        feedbackText.textContent = '你已掌握';
                        feedbackText.className = 'feedback-text feedback-known';
                    } else if (rating === 'vague') {
                        feedbackIcon.innerHTML = '?';
                        feedbackIcon.className = 'feedback-icon feedback-vague';
                        feedbackText.textContent = '模糊';
                        feedbackText.className = 'feedback-text feedback-vague';
                    } else {
                        feedbackIcon.innerHTML = '✗';
                        feedbackIcon.className = 'feedback-icon feedback-unknown';
                        feedbackText.textContent = '不认识';
                        feedbackText.className = 'feedback-text feedback-unknown';
                    }
                    const exampleStr = item.example ? ` — ${item.example.en}` : '';
                    feedbackDetail.innerHTML = `<strong>${item.word}</strong> ${item.pos || ''} ${item.meaning}${exampleStr}`;
                    feedbackOverlay.style.display = 'flex';
                    // 触发入场动画
                    feedbackOverlay.style.animation = 'none';
                    void feedbackOverlay.offsetWidth;
                    feedbackOverlay.style.animation = '';
                }

                // 自动前进（带防重入保护），延迟600ms让用户看到反馈
                _rateTimeoutPending = true;
                setTimeout(() => {
                    _rateTimeoutPending = false;
                    if (feedbackOverlay) feedbackOverlay.style.display = 'none';
                    if (currentIndex < wordsData.length - 1) {
                        nextWord();
                    } else {
                        showCardRoundSummary();
                    }
                }, 600);
            }

            function showCardRoundSummary() {
                // 防止重复翻转
                if (card.classList.contains('flipped')) return;

                // 重置 3D 倾斜和光晕，避免翻转时残留视觉效果导致闪烁
                currentTiltRotateX = 0;
                currentTiltRotateY = 0;
                glare.style.opacity = '0';
                applyReverseTilt(0, 0);

                // 启用过渡动画，然后翻转
                card.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                card.classList.add('flipped');
                updateCardTransform();

                // 动画结束后恢复无过渡状态
                setTimeout(() => { card.style.transition = 'none'; }, 650);

                const known = [..._ratingMap.values()].filter(v => v === 'known').length;
                const vague = [..._ratingMap.values()].filter(v => v === 'vague').length;
                const unknown = [..._ratingMap.values()].filter(v => v === 'unknown').length;
                const total = wordsData.length;
                const rated = known + vague + unknown;

                if (window.StatsTracker) {
                    window.StatsTracker.recordWordsLearned(rated);
                    window.StatsTracker.recordWordsMastered(known);
                    window.StatsTracker.recordModuleActivity('flashcard', rated, window.VocabData ? window.VocabData.getCurrentNotebookId() : null);
                }

                // 填充背面总结内容
                const cardBack = document.getElementById('cardBack');
                cardBack.innerHTML = `
                    <div class="fill-summary">
                        <div class="fill-summary-icon">
                            <div class="trophy-star">
                                <div class="star-eight"></div>
                            </div>
                            <svg class="trophy-svg" viewBox="0 0 100 100" width="80" height="80" fill="#e94822">
                                <path d="M62.11,53.93c22.582-3.125,22.304-23.471,18.152-29.929-4.166-6.444-10.36-2.153-10.36-2.153v-4.166H30.099v4.166s-6.194-4.291-10.36,2.153c-4.152,6.458-4.43,26.804,18.152,29.929l5.236,7.777v8.249s-.944,4.597-4.833,4.986c-3.903,.389-7.791,4.028-7.791,7.374h38.997c0-3.347-3.889-6.986-7.791-7.374-3.889-.389-4.833-4.986-4.833-4.986v-8.249l5.236-7.777Zm7.388-24.818s2.833-3.097,5.111-1.347c2.292,1.75,2.292,15.86-8.999,18.138l3.889-16.791Zm-44.108-1.347c2.278-1.75,5.111,1.347,5.111,1.347l3.889,16.791c-11.291-2.278-11.291-16.388-8.999-18.138Z"/>
                            </svg>
                        </div>
                        <div class="fill-summary-title">本轮回顾完成</div>
                        <div class="fill-summary-stats">
                            <div class="fill-summary-stat" style="animation-delay:0.05s">
                                <span class="fill-summary-val" style="color:#22c55e">${known}</span>
                                <span class="fill-summary-lbl">已掌握</span>
                            </div>
                            <div class="fill-summary-stat" style="animation-delay:0.12s">
                                <span class="fill-summary-val" style="color:#f59e0b">${vague}</span>
                                <span class="fill-summary-lbl">模糊</span>
                            </div>
                            <div class="fill-summary-stat" style="animation-delay:0.19s">
                                <span class="fill-summary-val" style="color:#ef4444">${unknown}</span>
                                <span class="fill-summary-lbl">不认识</span>
                            </div>
                            <div class="fill-summary-stat" style="animation-delay:0.26s">
                                <span class="fill-summary-val rate">${rated}</span>
                                <span class="fill-summary-lbl">已评估</span>
                            </div>
                            <div class="fill-summary-stat" style="animation-delay:0.33s">
                                <span class="fill-summary-val" style="color:var(--accent)">${total}</span>
                                <span class="fill-summary-lbl">总单词</span>
                            </div>
                        </div>
                        <button class="summary-retry-btn"><span>再练一轮</span></button>
                    </div>
                `;

                // 绑定重新开始事件
                const retryBtn = cardBack.querySelector('.summary-retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', restartRound);
                }
            }

            function restartRound() {
                // 启用过渡动画，然后取消翻转
                card.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                card.classList.remove('flipped');
                updateCardTransform();

                // 动画结束后恢复无过渡状态
                setTimeout(() => { card.style.transition = 'none'; }, 650);

                // 清除背面总结内容
                const cardBack = document.getElementById('cardBack');
                cardBack.innerHTML = '';

                // 重置数据
                loadWordsData();
                _ratingMap.clear();
                currentIndex = 0;

                // 更新卡片
                updateCard();
            }

            masteryBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rating = btn.getAttribute('data-rating');
                    if (rating) rateWord(rating);
                });
            });

            // 保存倾斜角度，用于合并翻转 transform
            let currentTiltRotateX = 0;
            let currentTiltRotateY = 0;

            // 合并倾斜 + 翻转 transform（无过渡，由调用方控制 transition）
            function updateCardTransform() {
                const isFlipped = card.classList.contains('flipped');
                const rotateY = currentTiltRotateY + (isFlipped ? 180 : 0);
                card.style.transform = `perspective(1200px) rotateX(${currentTiltRotateX}deg) rotateY(${rotateY}deg)`;
            }

            function applyReverseTilt(rotateX, rotateY) {
                const reverseX = -rotateX;
                const reverseY = -rotateY;
                navButtons.forEach(btn => {
                    btn.style.setProperty('--btn-rotate-x', reverseX + 'deg');
                    btn.style.setProperty('--btn-rotate-y', reverseY + 'deg');
                });
            }

            card.addEventListener('mousemove', (e) => {
                if (card.classList.contains('flipped')) return;
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                currentTiltRotateY = (x - 0.5) * 22;
                currentTiltRotateX = (y - 0.5) * -22;
                updateCardTransform();

                // 光晕效果
                const gX = x * 100, gY = y * 100;
                const isDark = document.body.classList.contains('dark');
                glare.style.background = `radial-gradient(circle at ${gX}% ${gY}%, rgba(255,255,255,${isDark?0.3:0.6}) 0%, transparent 70%)`;
                glare.style.opacity = isDark ? '0.7' : '1';

                // 反向倾斜应用到按钮
                applyReverseTilt(currentTiltRotateX, currentTiltRotateY);
            });

            card.addEventListener('mouseleave', () => {
                if (card.classList.contains('flipped')) return;
                currentTiltRotateX = 0;
                currentTiltRotateY = 0;
                updateCardTransform();
                glare.style.opacity = '0';
                applyReverseTilt(0, 0);
            });

            // ================================================================
            // 陀螺仪倾斜效果（移动端）
            // ================================================================
            let _gyroActive = false;
            let _gyroBeta = 0;   // 前后倾斜
            let _gyroGamma = 0;  // 左右倾斜

            function initGyroTilt() {
                // 检查是否支持陀螺仪
                if (!window.DeviceOrientationEvent) return;

                function handleOrientation(e) {
                    if (card.classList.contains('flipped')) return;
                    if (e.beta === null || e.gamma === null) return;

                    // 平滑插值：beta(前后) → rotateX, gamma(左右) → rotateY
                    // 限制范围：±45度，映射到 ±22度
                    const targetBeta = Math.max(-45, Math.min(45, e.beta || 0));
                    const targetGamma = Math.max(-45, Math.min(45, e.gamma || 0));

                    // 低通滤波平滑
                    _gyroBeta += (targetBeta - _gyroBeta) * 0.15;
                    _gyroGamma += (targetGamma - _gyroGamma) * 0.15;

                    currentTiltRotateX = (_gyroBeta / 45) * -22;
                    currentTiltRotateY = (_gyroGamma / 45) * 22;

                    updateCardTransform();

                    // 光晕跟随
                    const gX = ((_gyroGamma + 45) / 90) * 100;
                    const gY = ((_gyroBeta + 45) / 90) * 100;
                    const isDark = document.body.classList.contains('dark');
                    glare.style.background = `radial-gradient(circle at ${gX}% ${gY}%, rgba(255,255,255,${isDark ? 0.3 : 0.6}) 0%, transparent 70%)`;
                    glare.style.opacity = isDark ? '0.7' : '1';

                    applyReverseTilt(currentTiltRotateX, currentTiltRotateY);
                }

                function startGyroLoop() {
                    _gyroActive = true;
                    // 禁用鼠标倾斜（移动端优先陀螺仪）
                    card.style.pointerEvents = 'auto';
                }

                function stopGyroLoop() {
                    _gyroActive = false;
                    _gyroBeta = 0;
                    _gyroGamma = 0;
                    currentTiltRotateX = 0;
                    currentTiltRotateY = 0;
                    updateCardTransform();
                    glare.style.opacity = '0';
                    applyReverseTilt(0, 0);
                }

                // iOS 13+ 需要用户手势触发权限请求
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    // 在卡片上添加一次性点击来请求权限
                    function requestGyroPermission(e) {
                        e.stopPropagation();
                        DeviceOrientationEvent.requestPermission()
                            .then(state => {
                                if (state === 'granted') {
                                    window.addEventListener('deviceorientation', handleOrientation);
                                    startGyroLoop();
                                }
                            })
                            .catch(() => {
                                console.log('陀螺仪权限被拒绝，使用触摸倾斜');
                            });
                        card.removeEventListener('click', requestGyroPermission);
                    }
                    card.addEventListener('click', requestGyroPermission, { once: true });
                    _cleanupFns.push(() => {
                        card.removeEventListener('click', requestGyroPermission);
                    });
                } else {
                    // Android / 桌面：直接监听
                    window.addEventListener('deviceorientation', handleOrientation);
                    startGyroLoop();
                }

                _cleanupFns.push(() => {
                    window.removeEventListener('deviceorientation', handleOrientation);
                    stopGyroLoop();
                });
            }

            // 检测是否为移动设备（粗略判断），优先启用陀螺仪
            const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
                || window.matchMedia('(pointer: coarse)').matches;

            if (isMobileDevice) {
                initGyroTilt();
            }

            // 初始化按钮倾斜为0
            applyReverseTilt(0, 0);
            // 移除 CSS transition（由 JS 临时控制）
            card.style.transition = 'none';
            updateCardTransform();
            updateCard();

            // 返回 API 以便外部控制
            return {
                next: nextWord,
                prev: prevWord,
                setIndex: (idx) => { currentIndex = idx % wordsData.length; updateCard(); },
                getCurrentWord: () => wordsData[currentIndex]
            };
        }

        // 更新 window.FlashcardUI 为实际的实现
        window.FlashcardUI = {
            showFlashcardModeInterface
        };

        return {
            showFlashcardModeInterface
        };
    });
})();
