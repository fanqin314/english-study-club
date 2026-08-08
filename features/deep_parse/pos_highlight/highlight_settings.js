// highlight_settings.js - 词性选择弹窗（含一键添加所有该词性单词）

(function() {
    let modal = null;
    
    const posList = [
        { code: 'n', name: '名词', color: '#8B5A2B' },
        { code: 'v', name: '动词', color: '#EF4444' },
        { code: 'adj', name: '形容词', color: '#F97316' },
        { code: 'adv', name: '副词', color: '#EAB308' },
        { code: 'pron', name: '代词', color: '#22C55E' },
        { code: 'prep', name: '介词', color: '#3B82F6' },
        { code: 'conj', name: '连词', color: '#6366F1' },
        { code: 'interj', name: '感叹词', color: '#A855F7' },
        { code: 'art', name: '冠词', color: '#EC4899' },
        { code: 'num', name: '数词', color: '#6B7280' }
    ];
    
    let currentPosMap = {};
    
    function init() {
        modal = document.getElementById('posSettingsModal');
        if (!modal) {
            console.warn('高亮设置弹窗容器 #posSettingsModal 未找到');
            return;
        }
        
        loadCurrentConfig();
        renderContent();
        bindCloseEvents();
    }
    
    function loadCurrentConfig() {
        if (window.HighlightRenderer) {
            currentPosMap = window.HighlightRenderer.getHighlightPosMap();
        } else {
            posList.forEach(pos => {
                currentPosMap[pos.code] = true;
            });
        }
    }
    
    function renderContent() {
        if (!modal) return;
        
        modal.innerHTML = `
            <div class="modal-content" style="opacity: 0.85; box-shadow: 0px 4px 8px 0px rgba(0, 0, 0, 0.25);">
                <div class="setting-row">
                    <span style="font-weight:600; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3 3-3 3" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8" /><path d="M12 6h8" /><path d="M12 12h8" /><path d="M12 18h8" /></svg> 词性高亮设置</span>
                </div>
                <div id="posCheckboxGroup" class="checkbox-group"></div>
                <div class="button-group">
                    <button id="applyHighlightSettings">应用高亮</button>
                    <button id="addAllPosToVocabBtn" class="secondary">一键添加所有该词性单词</button>
                </div>
                <div class="vocab-select-section">
                    <label for="vocabNotebookSelect" style="display: block; margin: 12px 0 6px 0; font-size: 14px;">添加到生词本：</label>
                    <div style="display: flex; gap: 8px; align-items: center; padding-left: 10px; padding-right: 10px;">
                        <select id="vocabNotebookSelect" style="flex: 1; padding: 6px 12px; border: 1px solid var(--border); border-radius: 40px; font-size: 14px; background: var(--bg-page); color: var(--text);"></select>
                        <button id="createNotebookBtn" style="padding: 6px 12px; background-color: var(--accent); color: white; border: none; border-radius: 40px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 4px;">新建生词本 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button>
                    </div>
                    <div id="createNotebookForm" style="padding: 0 10px; background-color: transparent; border: 0px solid #000000; border-radius: 40px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="newNotebookName" placeholder="请输入生词本名称" style="flex: 1; padding: 6px 12px; border: 1px solid var(--border); border-radius: 40px; font-size: 14px; box-sizing: border-box; background: var(--bg-page); color: var(--text);">
                            <button id="confirmCreateNotebook" style="padding: 6px 12px; background-color: var(--accent); color: white; border: none; border-radius: 40px; font-size: 13px; cursor: pointer; white-space: nowrap;">创建</button>
                        </div>
                        <div id="createNotebookError" style="margin-top: 6px; color: #ef4444; font-size: 12px; display: none;"></div>
                    </div>
                </div>
                <div style="font-size: 12px; color: var(--text-light); margin: 0;">
                    💡 单击"词性高亮"按钮开关高亮显示，右键/长按此按钮打开设置。
                </div>
            </div>
        `;
        
        const checkboxGroup = document.getElementById('posCheckboxGroup');
        if (checkboxGroup) {
            // 清空现有内容
            checkboxGroup.innerHTML = '';
            
            // 将 posList 分成两组，每组5个
            const posGroups = [];
            for (let i = 0; i < posList.length; i += 5) {
                posGroups.push(posList.slice(i, i + 5));
            }
            
            // 为每组创建一个列
            posGroups.forEach(group => {
                const column = document.createElement('div');
                column.className = 'checkbox-column';
                
                group.forEach(pos => {
                    const label = document.createElement('label');
                    label.className = 'checkbox-label';
                    label.style.color = pos.color;
                    
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = pos.code;
                    cb.checked = currentPosMap[pos.code];
                    cb.addEventListener('change', (e) => {
                        currentPosMap[pos.code] = e.target.checked;
                    });
                    
                    label.appendChild(cb);
                    label.appendChild(document.createTextNode(` ${pos.name} (${pos.code})`));
                    
                    column.appendChild(label);
                });
                
                checkboxGroup.appendChild(column);
            });
        }
        
        bindButtonEvents();
    }
    
    function loadNotebooks() {
        const select = document.getElementById('vocabNotebookSelect');
        if (!select) return;
        
        select.innerHTML = '';
        
        if (window.VocabData) {
            const notebooks = window.VocabData.getAllNotebooks();
            Object.entries(notebooks).forEach(([id, notebook]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = notebook.name;
                select.appendChild(option);
            });
        }
    }

    function bindButtonEvents() {
        const applyBtn = document.getElementById('applyHighlightSettings');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (window.HighlightRenderer) {
                    window.HighlightRenderer.updateHighlightPosMap(currentPosMap);
                }
                
                if (window.HighlightSwitch && window.HighlightSwitch.isEnabled()) {
                    if (window.HighlightRenderer) {
                        window.HighlightRenderer.applyHighlightToAll();
                    }
                }
                
                hide();
                showToast('高亮设置已应用');
            });
        }
        
        const addAllBtn = document.getElementById('addAllPosToVocabBtn');
        if (addAllBtn) {
            addAllBtn.addEventListener('click', () => {
                const select = document.getElementById('vocabNotebookSelect');
                const selectedNotebookId = select.value;
                
                if (!selectedNotebookId) {
                    showToast('请选择目标生词本');
                    return;
                }
                
                if (window.AddAllPosToVocab && window.AddAllPosToVocab.execute) {
                    window.AddAllPosToVocab.execute(currentPosMap, selectedNotebookId);
                } else {
                    console.warn('AddAllPosToVocab 模块未加载');
                    showToast('一键添加功能暂不可用');
                }
                hide();
            });
        }
        
        const createNotebookBtn = document.getElementById('createNotebookBtn');
        const createNotebookForm = document.getElementById('createNotebookForm');
        const newNotebookName = document.getElementById('newNotebookName');
        const confirmCreateNotebook = document.getElementById('confirmCreateNotebook');
        const createNotebookError = document.getElementById('createNotebookError');
        
        if (createNotebookBtn) {
            createNotebookBtn.addEventListener('click', () => {
                if (createNotebookForm) {
                    const svg = createNotebookBtn.querySelector('svg');
                    if (createNotebookForm.classList.contains('expanded')) {
                        // 收起表单
                        createNotebookForm.classList.remove('expanded');
                        if (newNotebookName) {
                            newNotebookName.value = '';
                        }
                        if (createNotebookError) {
                            createNotebookError.style.display = 'none';
                        }
                        if (svg) {
                            svg.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                            svg.style.transform = 'rotate(0deg)';
                        }
                    } else {
                        // 展开表单
                        createNotebookForm.classList.add('expanded');
                        newNotebookName.focus();
                        if (svg) {
                            svg.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                            svg.style.transform = 'rotate(180deg)';
                        }
                    }
                }
            });
        }
        

        
        if (confirmCreateNotebook) {
            confirmCreateNotebook.addEventListener('click', () => {
                if (!newNotebookName) return;
                
                const name = newNotebookName.value;
                if (!name || name.trim() === '') {
                    if (createNotebookError) {
                        createNotebookError.textContent = '请输入生词本名称';
                        createNotebookError.style.display = 'block';
                    }
                    return;
                }
                
                if (window.VocabData) {
                    const result = window.VocabData.createNotebook(name.trim());
                    if (result && result.success) {
                        loadNotebooks();
                        const select = document.getElementById('vocabNotebookSelect');
                        select.value = result.id;
                        showToast('生词本创建成功');
                        if (createNotebookForm) {
                            createNotebookForm.classList.remove('expanded');
                            newNotebookName.value = '';
                            if (createNotebookError) {
                                createNotebookError.style.display = 'none';
                            }
                            const svg = createNotebookBtn.querySelector('svg');
                            if (svg) {
                                svg.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                                svg.style.transform = 'rotate(0deg)';
                            }
                        }
                    } else {
                        if (createNotebookError) {
                            createNotebookError.textContent = '生词本创建失败：' + (result.error || '');
                            createNotebookError.style.display = 'block';
                        }
                    }
                }
            });
        }
    }
    
    function bindCloseEvents() {
        if (!modal) return;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hide();
            }
        });
    }
    
    function show(buttonRect) {
        if (!modal) {
            init();
        }
        if (!modal) {
            console.error('无法初始化词性高亮设置弹窗');
            return;
        }
        loadCurrentConfig();
        const checkboxes = modal.querySelectorAll('#posCheckboxGroup input[type="checkbox"]');
        if (checkboxes.length) {
            checkboxes.forEach(cb => {
                cb.checked = currentPosMap[cb.value] === true;
            });
        }
        loadNotebooks();
        
        // 设置动画开始状态
        const content = modal.querySelector('.modal-content');
        if (content) {
            // 计算按钮中心位置
            const buttonX = buttonRect.left + buttonRect.width / 2;
            const buttonY = buttonRect.top + buttonRect.height / 2;
            
            // 计算屏幕中心位置
            const screenX = window.innerWidth / 2;
            const screenY = window.innerHeight / 2;
            
            // 计算缩放比例（从按钮大小到弹窗大小）
            const scale = Math.min(buttonRect.width / content.offsetWidth, buttonRect.height / content.offsetHeight);
            
            // 设置初始状态
            content.style.transform = `translate(${buttonX - screenX}px, ${buttonY - screenY}px) scale(${scale})`;
            content.style.opacity = '0';
            content.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // 设置背景为透明并添加模糊效果
            modal.style.display = 'flex';
            modal.style.backdropFilter = 'blur(0px)';
            modal.style.backgroundColor = 'transparent';
            modal.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // 触发重排
            void content.offsetWidth;
            
            // 设置最终状态
            content.style.transform = 'translate(0, 0) scale(1)';
            content.style.opacity = '1';
            modal.style.backdropFilter = 'blur(8px)';
            modal.style.backgroundColor = 'transparent';
        } else {
            modal.style.display = 'flex';
        }
    }
    
    function hide() {
        if (modal) {
            const content = modal.querySelector('.modal-content');
            if (content) {
                // 计算按钮中心位置（假设按钮仍然在原来的位置）
                const highlightButton = document.getElementById('highlightToggleBtn');
                if (highlightButton) {
                    const buttonRect = highlightButton.getBoundingClientRect();
                    const buttonX = buttonRect.left + buttonRect.width / 2;
                    const buttonY = buttonRect.top + buttonRect.height / 2;
                    
                    // 计算屏幕中心位置
                    const screenX = window.innerWidth / 2;
                    const screenY = window.innerHeight / 2;
                    
                    // 计算缩放比例（从弹窗大小到按钮大小）
                    const scale = Math.min(buttonRect.width / content.offsetWidth, buttonRect.height / content.offsetHeight);
                    
                    // 设置动画结束状态
                    content.style.transform = `translate(${buttonX - screenX}px, ${buttonY - screenY}px) scale(${scale})`;
                    content.style.opacity = '0';
                    modal.style.backdropFilter = 'blur(0px)';
                    modal.style.backgroundColor = 'transparent';
                    
                    // 动画结束后隐藏
                    setTimeout(() => {
                        modal.style.display = 'none';
                    }, 300);
                } else {
                    modal.style.display = 'none';
                }
            } else {
                modal.style.display = 'none';
            }
        }
    }
    
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    }
    
    function getPosList() {
        return [...posList];
    }
    
    window.HighlightSettingsModal = {
        init,
        show,
        hide,
        getPosList
    };
})();
