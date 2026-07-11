// 单词菜单.js - 右键/长按单词添加生词本的菜单

(function() {
    let menu = null;
    let closeMenuHandler = null;
    
    // 初始化菜单
    function init() {
        menu = document.getElementById('customMenu');
        if (!menu) {
            console.warn('自定义菜单容器 #customMenu 未找到');
            return;
        }
        
        // 绑定右键事件
        document.body.addEventListener('contextmenu', handleContextMenu);
        
        // 绑定手机长按事件
        bindLongPress();
        
        // 应用保存的词性颜色
        applyPosColors();
    }
    
    // 处理右键菜单
    function handleContextMenu(e) {
        // 查找被点击的单词 span
        let target = e.target;
        
        // 处理文本节点
        while (target && target.nodeType === 3) {
            target = target.parentNode;
        }
        
        while (target && !target.classList?.contains('word-span')) {
            target = target.parentElement;
        }
        
        if (!target) return;
        
        e.preventDefault();
        
        const word = target.dataset.word;
        if (!word) return;
        
        const context = getContextWord(target);
        
        // 构建菜单
        buildMenu(word, context, e.pageX, e.pageY, target);
    }
    
    // 构建菜单
    function buildMenu(word, context, x, y, target) {
        if (!menu) return;
        
        menu.innerHTML = '';
        
        // 标题
        const header = document.createElement('div');
        header.className = 'custom-menu-item';
        header.innerText = `📖 操作 "${word}"`;
        header.style.fontWeight = 'bold';
        menu.appendChild(header);
        
        // 自定义词性颜色选项
        if (target && target.classList.length > 1) {
            const posClass = Array.from(target.classList).find(cls => cls.startsWith('pos-'));
            if (posClass) {
                const colorItem = document.createElement('div');
                colorItem.className = 'custom-menu-item';
                colorItem.innerText = '🎨 自定义词性颜色';
                colorItem.addEventListener('click', () => {
                    openColorPicker(posClass);
                    menu.style.display = 'none';
                });
                menu.appendChild(colorItem);
            }
        }
        
        // 分隔线
        const divider1 = document.createElement('div');
        divider1.className = 'menu-divider';
        menu.appendChild(divider1);
        
        // 标题：添加到生词本
        const vocabHeader = document.createElement('div');
        vocabHeader.className = 'custom-menu-item';
        vocabHeader.innerText = '📚 添加到生词本：';
        vocabHeader.style.fontWeight = 'bold';
        menu.appendChild(vocabHeader);
        
        // 获取所有生词本
        const notebooks = window.VocabData ? window.VocabData.getAllNotebooks() : {};
        
        for (const [id, nb] of Object.entries(notebooks)) {
            const item = document.createElement('div');
            item.className = 'custom-menu-item';
            item.innerText = nb.name;
            item.addEventListener('click', async () => {
                await addWordToNotebook(id, word, context);
                menu.style.display = 'none';
            });
            menu.appendChild(item);
        }
        
        // 新建生词本选项
        const newItem = document.createElement('div');
        newItem.className = 'custom-menu-item';
        newItem.innerText = '➕ 新建生词本';
        newItem.addEventListener('click', () => {
            const name = prompt('新生词本名称');
            if (name && name.trim() && window.VocabData) {
                const trimmedName = name.trim();
                // 验证名称长度和内容
                if (trimmedName.length > 50) {
                    showToast('生词本名称过长，请使用50个字符以内');
                    return;
                }
                const result = window.VocabData.createNotebook(trimmedName);
                if (result.success) {
                    showToast(`已创建生词本"${trimmedName}"`);
                    menu.style.display = 'none';
                } else {
                    showToast(result.error);
                }
            } else {
                menu.style.display = 'none';
            }
        });
        menu.appendChild(newItem);
        
        // 移除旧的关闭监听器，防止重复绑定
        if (closeMenuHandler) {
            document.removeEventListener('click', closeMenuHandler);
            closeMenuHandler = null;
        }
        
        // 显示菜单
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('show');
        
        // 创建关闭处理函数
        closeMenuHandler = function(e) {
            // 检查是否点击菜单内部
            if (!menu.contains(e.target)) {
                menu.classList.remove('show');
                document.removeEventListener('click', closeMenuHandler);
                closeMenuHandler = null;
            }
        };
        
        // 使用捕获阶段确保优先处理
        setTimeout(() => {
            document.addEventListener('click', closeMenuHandler, { capture: true });
        }, 0);
    }
    
    // 打开颜色选择器
    function openColorPicker(posClass) {
        const currentColor = getCurrentPosColor(posClass);
        const color = prompt('请输入颜色值（如 #FF0000）:', currentColor);
        if (color) {
            const trimmedColor = color.trim();
            // 验证颜色格式
            if (/^#[0-9A-F]{6}$/i.test(trimmedColor)) {
                savePosColor(posClass, trimmedColor);
                showToast('颜色已更新');
                // 重新应用高亮
                if (window.HighlightRenderer && window.HighlightRenderer.applyHighlightToAll) {
                    window.HighlightRenderer.applyHighlightToAll();
                }
            } else {
                showToast('颜色格式错误，请使用 #RRGGBB 格式');
            }
        }
    }
    
    // 获取当前词性颜色
    function getCurrentPosColor(posClass) {
        try {
            const savedColors = JSON.parse(localStorage.getItem('posColors') || '{}');
            if (savedColors[posClass]) {
                return savedColors[posClass];
            }
        } catch (e) {
            console.warn('解析词性颜色配置失败:', e);
        }
        // 获取默认颜色
        const element = document.createElement('div');
        element.className = posClass;
        document.body.appendChild(element);
        const computedColor = window.getComputedStyle(element).backgroundColor;
        document.body.removeChild(element);
        return rgbToHex(computedColor);
    }
    
    // 保存词性颜色
    function savePosColor(posClass, color) {
        try {
            const savedColors = JSON.parse(localStorage.getItem('posColors') || '{}');
            savedColors[posClass] = color;
            localStorage.setItem('posColors', JSON.stringify(savedColors));
            // 应用新颜色
            applyPosColors();
        } catch (e) {
            console.error('保存词性颜色失败:', e);
            showToast('保存颜色设置失败');
        }
    }
    
    // 应用词性颜色
    function applyPosColors() {
        try {
            const savedColors = JSON.parse(localStorage.getItem('posColors') || '{}');
            for (const [posClass, color] of Object.entries(savedColors)) {
                const style = document.createElement('style');
                style.textContent = `.${posClass} { background-color: ${color} !important; }`;
                document.head.appendChild(style);
            }
        } catch (e) {
            console.warn('应用词性颜色失败:', e);
        }
    }
    
    // RGB转HEX
    function rgbToHex(rgb) {
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return '#000000';
        function hex(x) {
            return ('0' + parseInt(x).toString(16)).slice(-2);
        }
        return '#' + hex(match[1]) + hex(match[2]) + hex(match[3]);
    }
    
    // 获取单词所在的句子上下文
    function getContextWord(spanElem) {
        const sentenceDiv = spanElem.closest('.sentence-text');
        return sentenceDiv ? sentenceDiv.innerText.trim() : '';
    }
    
    // 添加单词到生词本
    async function addWordToNotebook(notebookId, word, context) {
        if (!window.VocabData) {
            showToast('生词本模块未加载');
            return;
        }
        
        const notebook = window.VocabData.getNotebook(notebookId);
        if (!notebook) {
            showToast('生词本不存在');
            return;
        }
        
        // 检查是否已存在
        const exists = notebook.words.some(w => w.word === word);
        if (exists) {
            showToast(`"${word}"已存在生词本"${notebook.name}"中`);
            return;
        }
        
        // 尝试获取单词释义
        let meaning = '';
        let pos = '';
        
        if (window.DictService) {
            const dictResult = await window.DictService.getWordMeaning(word, {
                apiCall: async (w) => {
                    if (window.APIRequest && window.APIRequest.requestWordMeaning) {
                        return await window.APIRequest.requestWordMeaning(w);
                    }
                    return null;
                }
            });
            if (dictResult) {
                meaning = dictResult.meaning;
                pos = dictResult.pos;
            }
        }
        
        // 添加到生词本
        const result = window.VocabData.addWord(notebookId, {
            word: word,
            meaning: meaning,
            pos: pos,
            context: context,
            timestamp: Date.now()
        });
        
        if (result.success) {
            showToast(`✅ 已添加"${word}"到 ${notebook.name}`);
            // 如果生词本界面正在显示，刷新它
            if (window.VocabInterface && window.VocabInterface.refresh) {
                window.VocabInterface.refresh();
            }
        } else {
            showToast(result.error);
        }
    }
    
    // 绑定手机长按事件
    function bindLongPress() {
        let pressTimer = null;
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.body.addEventListener('touchstart', (e) => {
            // 查找被触摸的单词 span
            let target = e.target;
            while (target && !target.classList?.contains('word-span')) {
                target = target.parentElement;
            }
            
            if (target) {
                e.preventDefault(); // 在事件处理函数开始时调用
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                
                pressTimer = setTimeout(() => {
                    // 长按触发
                    const word = target.dataset.word;
                    if (word) {
                        // 手机端弹出操作菜单
                        buildMenu(word, getContextWord(target), touchStartX, touchStartY, target);
                    }
                }, 500);
            }
        }, { passive: false });
        
        document.body.addEventListener('touchend', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });
        
        document.body.addEventListener('touchmove', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });
        
        document.body.addEventListener('touchcancel', () => {
            if (pressTimer) clearTimeout(pressTimer);
        });
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
    
    // 导出接口
    window.WordMenu = {
        init
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 确保在全局初始化时也调用
    if (window.ModuleRegistry) {
        window.ModuleRegistry.register('WordMenu', [], function() {
            return {
                init: init
            };
        });
    }
})();