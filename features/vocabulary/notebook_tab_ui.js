// notebook_tab_ui.js - 专门处理生词本标签页的界面设置

(function() {
    // 缓存容器引用用于窗口resize
    let currentContainer = null;
    let currentOnRefresh = null;
    let resizeTimeout = null;
    
    // 防抖函数
    function debounce(func, wait) {
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(resizeTimeout);
                func(...args);
            };
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(later, wait);
        };
    }
    
    // 处理窗口resize
    const handleResize = debounce(function() {
        if (currentContainer && currentOnRefresh) {
            renderNotebookTabs(currentContainer, currentOnRefresh);
        }
    }, 200);
    
    // 获取VocabData实例
    function getVocabData() {
        return window.VocabData;
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
    
    // 显示自定义输入对话框（替代 prompt）
    function showInputDialog(title, defaultValue) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-width: 300px;
            `;
            
            const titleEl = document.createElement('div');
            titleEl.textContent = title;
            titleEl.style.cssText = `
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #333;
            `;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue || '';
            input.style.cssText = `
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                box-sizing: border-box;
                margin-bottom: 15px;
            `;
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            `;
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = `
                padding: 8px 16px;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: #f5f5f5;
                cursor: pointer;
            `;
            
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = '确定';
            confirmBtn.style.cssText = `
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                background: #4CAF50;
                color: white;
                cursor: pointer;
            `;
            
            const close = (value) => {
                overlay.remove();
                resolve(value);
            };
            
            cancelBtn.onclick = () => close(null);
            confirmBtn.onclick = () => close(input.value);
            overlay.onclick = (e) => {
                if (e.target === overlay) close(null);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') close(input.value);
                if (e.key === 'Escape') close(null);
            };
            
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
            dialog.appendChild(titleEl);
            dialog.appendChild(input);
            dialog.appendChild(buttonContainer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            input.focus();
            input.select();
        });
    }
    
    // 生成随机颜色
    function getRandomColor() {
        const colors = [
            '#4f7aa6', '#4a90e2', '#50e3c2', '#7ed321', '#b8e986',
            '#f5a623', '#d0021b', '#9013fe', '#417505', '#bd10e0'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // 格式化日期
    function formatDate(dateString) {
        if (!dateString) return '未知';
        const date = new Date(dateString);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    }
    
    // 计算今日新词数
    function getTodayNewWords(notebook) {
        if (!notebook.words) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return notebook.words.filter(word => {
            const addedDate = new Date(word.addedDate);
            addedDate.setHours(0, 0, 0, 0);
            return addedDate.getTime() === today.getTime();
        }).length;
    }
    
    // 渲染生词本标签页
    function renderNotebookTabs(container, onRefresh) {
        container.innerHTML = '';
        
        // 缓存容器引用用于窗口resize
        currentContainer = container;
        currentOnRefresh = onRefresh;
        
        // 添加窗口resize监听（确保只添加一次）
        window.removeEventListener('resize', handleResize);
        window.addEventListener('resize', handleResize);
        
        const vocabData = getVocabData();
        if (!vocabData) {
            console.error('VocabData 未初始化');
            return;
        }
        
        // 添加卡片容器样式 - 重叠布局
        container.style.display = 'block';
        container.style.position = 'relative';
        container.style.height = '254px';
        container.style.width = '100%';
        container.style.maxWidth = '100%';
        container.style.overflow = 'visible';
        
        const notebooks = vocabData.getAllNotebooks();
        const currentId = vocabData.getCurrentNotebookId();
        const cardWidth = 240;
        const cardHeight = 320;
        const notebookCount = Object.keys(notebooks).length;
        
        // 获取实际容器宽度
        const containerWidth = container.clientWidth || container.offsetWidth || 800;
        
        // 计算最佳重叠比例
        const overlapConfig = calculateOptimalOverlap(
            notebookCount,
            cardWidth,
            containerWidth
        );
        
        // 输出计算结果到控制台（用于验证）
        console.log('=== 生词本卡片重叠比例计算结果 ===');
        console.log(`卡片数量: ${notebookCount}`);
        console.log(`卡片宽度: ${cardWidth}px`);
        console.log(`容器宽度: ${overlapConfig.containerWidth}px`);
        console.log(`最佳重叠比例: ${(overlapConfig.overlapRatio * 100).toFixed(2)}%`);
        console.log(`实际重叠像素: ${overlapConfig.overlapPixels}px`);
        console.log(`卡片间距: ${overlapConfig.cardSpacing}px`);
        console.log(`预计总宽度: ${overlapConfig.totalWidth}px`);
        console.log(`是否满足约束: ${overlapConfig.isValid ? '是' : '否'}`);
        console.log('===================================');
        
        const overlap = overlapConfig.overlapPixels;
        
        // 计算第一张卡片的起始偏移量，确保最后一张卡片不超出容器
        let startOffset = 0;
        const availableWidth = overlapConfig.availableWidth;
        
        if (!overlapConfig.isSpacedEvenly) {
            // 非均匀分布模式：计算最后一张卡片的位置
            const lastCardPosition = (notebookCount - 1) * (cardWidth - overlap);
            const lastCardEnd = lastCardPosition + cardWidth;
            
            // 如果最后一张卡片超出容器，计算需要的偏移量
            if (lastCardEnd > availableWidth) {
                const overflow = lastCardEnd - availableWidth;
                startOffset = -overflow;
            }
        }
        
        let index = 0;
        for (const [id, nb] of Object.entries(notebooks)) {
            const card = createNotebookCard(id, nb, currentId, onRefresh);
            
            // 设置卡片位置
            card.style.position = 'absolute';
            
            // 如果是均匀分布模式，计算每个卡片的位置
            if (overlapConfig.isSpacedEvenly) {
                // 均匀分布：第一张卡片左边有间距，最后一张卡片右边有间距
                const spacing = overlapConfig.cardSpacing;
                card.style.left = `${spacing + index * (cardWidth + spacing)}px`;
            } else {
                // 重叠模式：左下右上阶梯式排列，考虑起始偏移
                const leftPosition = startOffset + index * (cardWidth - overlap);
                // 确保位置不小于0
                card.style.left = `${Math.max(0, leftPosition)}px`;
            }
            
            card.style.bottom = '0px';
            card.style.zIndex = index + 1;
            
            // 添加鼠标悬停事件 - 置顶显示
            card.addEventListener('mouseenter', function() {
                // 找到所有卡片并设置z-index
                const allCards = container.querySelectorAll('.vocab-card-container');
                allCards.forEach((c, i) => {
                    if (c === card) {
                        c.style.zIndex = 1000; // 当前卡片置顶
                    } else {
                        c.style.zIndex = i + 1;
                    }
                });
            });
            
            container.appendChild(card);
            index++;
        }
    }
    
    // 计算最佳重叠比例
    function calculateOptimalOverlap(notebookCount, cardWidth, containerWidth) {
        // 约束条件
        const MIN_OVERLAP_RATIO = 0.10; // 最小重叠比例 10%（至少有一点重叠效果）
        const MAX_OVERLAP_RATIO = 0.85; // 最大重叠比例 85%
        const MIN_CARD_SPACING = 8;     // 卡片之间最小间距 8px
        const PADDING = 20;             // 容器内边距 20px
        const MIN_VISIBLE_WIDTH = 70;   // 每张卡片最小可见宽度
        
        // 可用宽度（减去内边距）
        const availableWidth = containerWidth - (PADDING * 2);
        
        // 如果只有1张卡片，不需要重叠
        if (notebookCount <= 1) {
            return {
                overlapRatio: 0,
                overlapPixels: 0,
                cardSpacing: 0,
                totalWidth: cardWidth,
                containerWidth: containerWidth,
                availableWidth: availableWidth,
                isValid: true
            };
        }
        
        const additionalCards = notebookCount - 1;
        
        // 计算当前数量下的目标重叠比例（动态过渡）
        // 公式：基于卡片数量和可用空间计算平滑过渡的重叠比例
        
        // 计算完全不重叠时需要的宽度
        const nonOverlappingWidth = notebookCount * cardWidth;
        
        // 计算理想状态：所有卡片刚好填满容器时的重叠比例
        // 当 nonOverlappingWidth <= availableWidth 时，重叠比例为 MIN_OVERLAP_RATIO
        // 当卡片过多时，逐渐增加到 MAX_OVERLAP_RATIO
        
        // 计算"临界数量"：卡片刚好完全不重叠填满容器时的数量
        const criticalCount = Math.floor(availableWidth / cardWidth);
        
        // 如果卡片数量小于等于临界数量，使用最小重叠比例
        if (notebookCount <= criticalCount) {
            // 计算均匀分布时的间距
            const idealWidth = notebookCount * cardWidth + (notebookCount - 1) * MIN_CARD_SPACING;
            const extraSpace = Math.max(0, availableWidth - idealWidth);
            const equalSpacing = extraSpace / (notebookCount + 1);
            
            return {
                overlapRatio: MIN_OVERLAP_RATIO,
                overlapPixels: cardWidth * MIN_OVERLAP_RATIO,
                cardSpacing: MIN_CARD_SPACING + equalSpacing,
                totalWidth: availableWidth,
                containerWidth: containerWidth,
                availableWidth: availableWidth,
                isValid: true,
                isSpacedEvenly: true
            };
        }
        
        // 卡片数量超过临界数量，需要动态增加重叠比例
        // 计算需要的重叠比例，使其平滑过渡
        
        // 计算当前卡片数量下，要填满容器所需的最小重叠比例
        const requiredVisibleWidth = availableWidth - cardWidth;
        const visibleWidthPerCard = requiredVisibleWidth / additionalCards;
        const requiredOverlapPixels = cardWidth - visibleWidthPerCard;
        const requiredOverlapRatio = requiredOverlapPixels / cardWidth;
        
        // 使用平滑过渡：根据卡片数量与临界数量的比例来调整重叠程度
        const overflowRatio = (notebookCount - criticalCount) / (notebookCount);
        const dynamicOverlapRatio = MIN_OVERLAP_RATIO + (Math.min(requiredOverlapRatio, MAX_OVERLAP_RATIO) - MIN_OVERLAP_RATIO) * overflowRatio;
        
        // 限制在合理范围内
        const finalOverlapRatio = Math.max(MIN_OVERLAP_RATIO, Math.min(MAX_OVERLAP_RATIO, dynamicOverlapRatio));
        const finalOverlapPixels = cardWidth * finalOverlapRatio;
        
        // 计算实际可见宽度和间距
        const actualVisibleWidth = cardWidth - finalOverlapPixels;
        const cardSpacing = Math.max(MIN_CARD_SPACING, actualVisibleWidth * 0.08);
        
        // 计算实际总宽度
        const totalWidth = cardWidth + (additionalCards * (cardWidth - finalOverlapPixels + cardSpacing)) - cardSpacing;
        
        // 验证是否满足约束条件
        const isValid = totalWidth <= availableWidth && 
                       finalOverlapRatio >= MIN_OVERLAP_RATIO && 
                       finalOverlapRatio <= MAX_OVERLAP_RATIO;
        
        return {
            overlapRatio: finalOverlapRatio,
            overlapPixels: finalOverlapPixels,
            cardSpacing: cardSpacing,
            totalWidth: totalWidth,
            containerWidth: containerWidth,
            availableWidth: availableWidth,
            minOverlapRatio: MIN_OVERLAP_RATIO,
            maxOverlapRatio: MAX_OVERLAP_RATIO,
            criticalCount: criticalCount,
            isValid: isValid,
            isSpacedEvenly: false
        };
    }
    
    // 验证重叠比例计算结果
    function validateOverlapCalculation(config) {
        console.log('=== 重叠比例计算验证 ===');
        
        const checks = [
            {
                name: '总宽度约束',
                condition: config.totalWidth <= config.availableWidth,
                expected: `<= ${config.availableWidth}px`,
                actual: `${config.totalWidth.toFixed(2)}px`
            },
            {
                name: '最小重叠比例约束',
                condition: config.overlapRatio >= config.minOverlapRatio,
                expected: `>= ${(config.minOverlapRatio * 100).toFixed(0)}%`,
                actual: `${(config.overlapRatio * 100).toFixed(2)}%`
            },
            {
                name: '最大重叠比例约束',
                condition: config.overlapRatio <= config.maxOverlapRatio,
                expected: `<= ${(config.maxOverlapRatio * 100).toFixed(0)}%`,
                actual: `${(config.overlapRatio * 100).toFixed(2)}%`
            },
            {
                name: '卡片可见性',
                condition: (config.cardWidth - config.overlapPixels) >= 30,
                expected: '>= 30px',
                actual: `${(config.cardWidth - config.overlapPixels).toFixed(2)}px`
            }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            const status = check.condition ? '通过' : '失败';
            console.log(`${check.name}: ${status}`);
            console.log(`  期望值: ${check.expected}`);
            console.log(`  实际值: ${check.actual}`);
            if (!check.condition) allPassed = false;
        });
        
        console.log(`\n验证结果: ${allPassed ? '全部通过' : '存在失败项'}`);
        console.log('========================');
        
        return allPassed;
    }
    
    // 合并选择模式状态
    let mergeSelectionMode = false;
    let selectedNotebooks = [];
    let mergeSelectionToast = null;
    let mergeSelectionToastBottom = null;
    
    // 显示提示信息
    function showMergeSelectionToast() {
        // 移除旧的提示
        if (mergeSelectionToast) {
            document.body.removeChild(mergeSelectionToast);
        }
        if (mergeSelectionToastBottom) {
            document.body.removeChild(mergeSelectionToastBottom);
        }
        
        // 创建顶部提示
        mergeSelectionToast = document.createElement('div');
        mergeSelectionToast.className = 'merge-selection-toast';
        mergeSelectionToast.textContent = `请选择要合并的生词本（已选择：${selectedNotebooks.length}个）`;
        document.body.appendChild(mergeSelectionToast);
        
        // 创建底部提示
        mergeSelectionToastBottom = document.createElement('div');
        mergeSelectionToastBottom.className = 'merge-selection-toast merge-selection-toast-bottom';
        mergeSelectionToastBottom.textContent = '按ESC取消，再次点击合并按钮完成选择';
        document.body.appendChild(mergeSelectionToastBottom);
    }
    
    // 隐藏提示信息
    function hideMergeSelectionToast() {
        if (mergeSelectionToast) {
            document.body.removeChild(mergeSelectionToast);
            mergeSelectionToast = null;
        }
        if (mergeSelectionToastBottom) {
            document.body.removeChild(mergeSelectionToastBottom);
            mergeSelectionToastBottom = null;
        }
    }
    
    // 进入合并选择模式
    function enterMergeSelectionMode(initialNotebookId) {
        mergeSelectionMode = true;
        selectedNotebooks = [];
        
        // 添加选择模式样式
        document.body.classList.add('merge-selection-mode');
        
        // 为所有卡片添加可选择样式
        const cards = document.querySelectorAll('.card-inner');
        cards.forEach(card => {
            card.classList.add('selectable');
            
            const mergeButton = card.querySelector('.card__action-btn.merge');
            if (mergeButton) {
                mergeButton.style.display = 'flex';
                
                // 检查是否是初始卡片
                const notebookId = card.closest('.vocab-card-container').getAttribute('data-notebook-id');
                if (notebookId === initialNotebookId) {
                    // 初始卡片设置为确认状态
                    mergeButton.classList.add('confirm');
                    mergeButton.classList.remove('cancel');
                } else {
                    // 其他卡片设置为取消状态
                    mergeButton.classList.add('cancel');
                    mergeButton.classList.remove('confirm');
                }
            }
        });
        
        // 自动选中初始生词本
        if (initialNotebookId) {
            const initialCard = document.querySelector(`[data-notebook-id="${initialNotebookId}"] .card-inner`);
            if (initialCard) {
                selectedNotebooks.push(initialNotebookId);
                initialCard.classList.add('selected');

                // 展开卡片
                const collapsible = initialCard.querySelector('.card__collapsible');
                if (collapsible) {
                    collapsible.classList.add('show');
                }
                initialCard.classList.remove('collapsed');

                // 添加选择指示器
                const indicator = document.createElement('div');
                indicator.className = 'selection-indicator';
                indicator.textContent = selectedNotebooks.length;
                initialCard.appendChild(indicator);
            }
        }
        
        // 显示提示信息
        showMergeSelectionToast();
        
        // 添加键盘事件监听
        document.addEventListener('keydown', handleMergeSelectionKeydown);
        
        // 添加鼠标移动事件监听
        document.addEventListener('mousemove', handleMergeSelectionMouseMove);
    }
    
    // 退出合并选择模式
    function exitMergeSelectionMode() {
        mergeSelectionMode = false;
        selectedNotebooks = [];
        
        // 移除选择模式样式
        document.body.classList.remove('merge-selection-mode');
        
        // 移除所有卡片的可选择样式
        const cards = document.querySelectorAll('.card-inner');
        cards.forEach(card => {
            card.classList.remove('selectable', 'selected');
            // 恢复折叠状态
            card.classList.add('collapsed');
            const collapsible = card.querySelector('.card__collapsible');
            if (collapsible) {
                collapsible.classList.remove('show');
            }
            // 移除选择指示器
            const indicator = card.querySelector('.selection-indicator');
            if (indicator && card.contains(indicator)) {
                card.removeChild(indicator);
            }
            // 重置合并按钮状态
            const mergeButton = card.querySelector('.card__action-btn.merge');
            if (mergeButton) {
                mergeButton.classList.remove('confirm', 'selected', 'cancel');
                mergeButton.style.display = 'flex';
            }
        });
        
        // 隐藏提示信息
        hideMergeSelectionToast();
        
        // 移除事件监听
        document.removeEventListener('keydown', handleMergeSelectionKeydown);
        document.removeEventListener('mousemove', handleMergeSelectionMouseMove);
    }
    
    // 处理键盘事件
    function handleMergeSelectionKeydown(e) {
        if (e.key === 'Escape') {
            exitMergeSelectionMode();
        }
    }
    
    // 处理鼠标移动事件
    function handleMergeSelectionMouseMove(e) {
        const targetCard = e.target.closest('.card-inner');
        const cards = document.querySelectorAll('.card-inner');
        
        cards.forEach(card => {
            const mergeButton = card.querySelector('.card__action-btn.merge');
            if (mergeButton) {
                // 检查是否是取消状态的按钮
                if (mergeButton.classList.contains('cancel')) {
                    // 保持取消状态，不随鼠标悬停改变
                    return;
                }
                
                if (card === targetCard) {
                    mergeButton.classList.add('confirm');
                } else {
                    mergeButton.classList.remove('confirm');
                }
            }
        });
    }
    
    // 处理卡片点击事件
    function handleCardClick(e, id, notebook, onRefresh) {
        if (!mergeSelectionMode) return;
        
        e.stopPropagation();
        
        const card = e.currentTarget;
        
        // 检查是否点击了取消按钮
        const mergeButton = e.target.closest('.card__action-btn.merge');
        if (mergeButton && mergeButton.classList.contains('cancel')) {
            // 退出合并选择模式
            exitMergeSelectionMode();
            return;
        }
        
        // 检查是否点击了确认按钮
        if (mergeButton && mergeButton.classList.contains('confirm')) {
            // 执行合并操作
            performMerge(onRefresh);
            return;
        }
        
        if (selectedNotebooks.includes(id)) {
            // 取消选择
            selectedNotebooks = selectedNotebooks.filter(notebookId => notebookId !== id);
            card.classList.remove('selected');
            // 恢复折叠状态
            card.classList.add('collapsed');
            const collapsible = card.querySelector('.card__collapsible');
            if (collapsible) {
                collapsible.classList.remove('show');
            }
            // 移除选择指示器
            const indicator = card.querySelector('.selection-indicator');
            if (indicator && card.contains(indicator)) {
                card.removeChild(indicator);
            }
        } else {
            // 添加选择
            selectedNotebooks.push(id);
            card.classList.add('selected');
            // 展开卡片
            card.classList.remove('collapsed');
            const collapsible = card.querySelector('.card__collapsible');
            if (collapsible) {
                collapsible.classList.add('show');
            }
            // 添加选择指示器
            const indicator = document.createElement('div');
            indicator.className = 'selection-indicator';
            indicator.textContent = selectedNotebooks.length;
            card.appendChild(indicator);
        }
        
        // 更新提示信息
        showMergeSelectionToast();
    }
    
    // 创建合并对话框
    function createMergeDialog(onRefreshCallback, button) {
        // 检查是否已存在对话框
        const existingDialog = document.getElementById('merge-dialog');
        if (existingDialog) {
            document.body.removeChild(existingDialog);
        }
        
        // 创建对话框容器
        const dialog = document.createElement('div');
        dialog.id = 'merge-dialog';
        
        if (button) {
            // 获取按钮位置
            const rect = button.getBoundingClientRect();
            dialog.style.cssText = `
                position: fixed;
                top: ${rect.top - 200}px;
                left: ${rect.left - 100}px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                border-radius: 16px;
                padding: 20px;
                width: 240px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                z-index: 99999;
                animation: bubbleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: 1px solid rgba(255, 255, 255, 0.8);
            `;
        } else {
            //  fallback 位置
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                border-radius: 16px;
                padding: 20px;
                width: 240px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                z-index: 99999;
                animation: bubbleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: 1px solid rgba(255, 255, 255, 0.8);
            `;
        }
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes bubbleUp {
                0% {
                    transform: scale(0.9);
                    opacity: 0;
                    transform-origin: bottom center;
                }
                70% {
                    transform: scale(1.02);
                    opacity: 0.9;
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            .merge-input:focus {
                outline: none;
                border-color: #3B82F6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .merge-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            .merge-button:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
        
        // 创建对话框内容
        const dialogContent = document.createElement('div');
        
        // 添加标题
        const title = document.createElement('h3');
        title.textContent = '合并生词本';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 16px;
            color: #333;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        dialogContent.appendChild(title);
        
        // 添加输入框
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            margin-bottom: 20px;
        `;
        
        const label = document.createElement('label');
        label.textContent = '新生词本名称:';
        label.style.cssText = `
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            color: #666;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        inputContainer.appendChild(label);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '合并生词本';
        input.className = 'merge-input';
        input.style.cssText = `
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 13px;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            transition: all 0.3s ease;
            background: white;
        `;
        inputContainer.appendChild(input);
        dialogContent.appendChild(inputContainer);
        
        // 添加按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 12px;
        `;
        
        // 添加取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.className = 'merge-button';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            background: white;
            color: #333;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            flex: 1;
        `;
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.background = '#f8fafc';
            cancelButton.style.borderColor = '#cbd5e1';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.background = 'white';
            cancelButton.style.borderColor = '#e2e8f0';
        });
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(dialog);
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        });
        buttonContainer.appendChild(cancelButton);
        
        // 添加确认按钮
        const confirmButton = document.createElement('button');
        confirmButton.textContent = '合并';
        confirmButton.className = 'merge-button';
        confirmButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 10px;
            background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
            color: white;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            flex: 1;
        `;
        confirmButton.addEventListener('mouseenter', () => {
            confirmButton.style.background = 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)';
        });
        confirmButton.addEventListener('mouseleave', () => {
            confirmButton.style.background = 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
        });
        confirmButton.addEventListener('click', () => {
            const newNotebookName = input.value.trim();
            if (newNotebookName) {
                document.body.removeChild(dialog);
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
                executeMerge(newNotebookName, onRefreshCallback);
            } else {
                showToast('请输入生词本名称');
            }
        });
        buttonContainer.appendChild(confirmButton);
        dialogContent.appendChild(buttonContainer);
        
        // 组装对话框
        dialog.appendChild(dialogContent);
        document.body.appendChild(dialog);
        
        // 自动聚焦输入框
        input.focus();
        input.select();
        
        // 点击外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }
        });
    }
    
    // 执行合并操作
    function performMerge(onRefreshCallback) {
        if (selectedNotebooks.length < 2) {
            showToast('至少需要选择两个生词本进行合并');
            return;
        }
        
        // 找到当前选中的第一个生词本的合并按钮
        const firstSelectedNotebookId = selectedNotebooks[0];
        const firstSelectedCard = document.querySelector(`[data-notebook-id="${firstSelectedNotebookId}"] .card-inner`);
        const mergeButton = firstSelectedCard ? firstSelectedCard.querySelector('.card__action-btn.merge') : null;
        
        // 显示合并对话框
        createMergeDialog(onRefreshCallback, mergeButton);
    }
    
    // 执行合并逻辑
    function executeMerge(newNotebookName, onRefreshCallback) {
        const vocabData = getVocabData();
        if (vocabData) {
            // 创建新的生词本
            const result = vocabData.createNotebook(newNotebookName);
            if (result && result.success) {
                const newNotebookId = result.id;
                
                // 收集并去重单词
                const wordMap = new Map();
                
                selectedNotebooks.forEach(notebookId => {
                    const notebook = vocabData.getNotebook(notebookId);
                    if (notebook && notebook.words) {
                        notebook.words.forEach(word => {
                            const wordKey = word.word.toLowerCase();
                            const existingWord = wordMap.get(wordKey);
                            
                            // 去重逻辑：如果已存在，保留带例句的版本
                            if (!existingWord || (word.example && (!existingWord.example || !existingWord.example.en || !existingWord.example.zh))) {
                                wordMap.set(wordKey, word);
                            }
                        });
                    }
                });
                
                // 添加去重后的单词到新的生词本
                wordMap.forEach(word => {
                    vocabData.addWord(newNotebookId, {
                        word: word.word,
                        meaning: word.meaning,
                        addedDate: word.addedDate,
                        reviewCount: word.reviewCount,
                        lastReviewed: word.lastReviewed,
                        context: word.context,
                        example: word.example
                    });
                });
                
                showToast(`已成功合并 ${selectedNotebooks.length} 个生词本到 "${newNotebookName}"`);
                exitMergeSelectionMode();
                
                // 刷新界面
                if (typeof onRefreshCallback === 'function') {
                    onRefreshCallback();
                }
            } else {
                showToast(result ? result.error : '创建生词本失败');
            }
        }
    }
    
    // 创建单个生词本卡片
    function createNotebookCard(id, notebook, currentId, onRefresh) {
        if (!window.createVocabCard) {
            console.error('createVocabCard 函数未加载');
            return createFallbackNotebookTab(id, notebook, currentId, onRefresh);
        }
        
        // 为每个生词本设置固定颜色
        if (!notebook.color) {
            const vocabData = getVocabData();
            if (vocabData) {
                notebook.color = getRandomColor();
                vocabData.updateNotebook(id, { color: notebook.color });
            }
        }
        
        const card = createVocabCard({
            name: notebook.name,
            wordCount: notebook.words ? notebook.words.length : 0,
            createdDate: formatDate(notebook.createdDate),
            todayNew: getTodayNewWords(notebook),
            bgColor: notebook.color || getRandomColor(),
            isActive: id === currentId,
            onColorChange: (newColor) => {
                const vocabData = getVocabData();
                if (vocabData) {
                    vocabData.updateNotebook(id, { color: newColor });
                    if (onRefresh) onRefresh();
                }
            },
            onMerge: () => {
                if (mergeSelectionMode) {
                    // 退出选择模式并执行合并
                    performMerge(onRefresh);
                } else {
                    // 进入选择模式，自动选中当前生词本
                    enterMergeSelectionMode(id);
                }
            },
            onAdd: (word, meaning) => {
                // 添加新单词的逻辑
                const vocabData = getVocabData();
                if (vocabData && word) {
                    const result = vocabData.addWord(id, {
                        word: word,
                        meaning: meaning || '',
                        addedDate: new Date().toISOString(),
                        reviewCount: 0,
                        lastReviewed: null
                    });
                    if (result.success) {
                        showToast(`已添加单词: ${word}`);
                        if (onRefresh) onRefresh();
                    } else {
                        showToast(result.error);
                    }
                }
            },
            onRename: () => {
                enableCardEditing(id, notebook, onRefresh);
            },
            onDelete: () => {
                const vocabData = getVocabData();
                if (vocabData && Object.keys(vocabData.getAllNotebooks()).length > 1) {
                    if (confirm(`确定删除生词本"${notebook.name}"吗？其中的 ${notebook.words ? notebook.words.length : 0} 个单词将丢失。`)) {
                        const result = vocabData.deleteNotebook(id);
                        if (result.success) {
                            if (onRefresh) onRefresh();
                            showToast(`已删除生词本"${notebook.name}"`);
                        } else {
                            showToast(result.error);
                        }
                    }
                }
            }
        });
        
        // 添加点击事件切换生词本
        const cardInner = card.querySelector('.card-inner');
        if (cardInner) {
            cardInner.addEventListener('click', (e) => {
                // 检查是否点击了取消按钮
                const mergeButton = e.target.closest('.card__action-btn.merge');
                if (mergeButton && mergeButton.classList.contains('cancel')) {
                    // 退出合并选择模式
                    exitMergeSelectionMode();
                    return;
                }
                
                // 检查是否点击了确认按钮
                if (mergeButton && mergeButton.classList.contains('confirm')) {
                    // 执行合并操作
                    performMerge(onRefresh);
                    return;
                }
                
                if (mergeSelectionMode) {
                    // 处理合并选择模式下的卡片点击
                    handleCardClick(e, id, notebook, onRefresh);
                } else {
                    // 避免点击操作按钮、输入框和添加按钮时触发切换
                    if (!e.target.closest('.card__action-btn') && 
                        !e.target.closest('.card__button') && 
                        !e.target.closest('.add-word-section') &&
                        !e.target.closest('.word-input') &&
                        !e.target.closest('.meaning-input') &&
                        !e.target.closest('.secondary')) {
                        const vocabData = getVocabData();
                        if (vocabData) {
                            // 检查是否是双击
                            if (e.detail === 2) {
                                // 双击修改生词本名字
                                enableCardEditing(id, notebook, onRefresh);
                            } else {
                                // 单击切换生词本 - 只更新 active 类，不销毁重建卡片
                                vocabData.setCurrentNotebookId(id);
                                const cardsContainer = card.parentElement;
                                if (cardsContainer) {
                                    const allInners = cardsContainer.querySelectorAll('.card-inner');
                                    allInners.forEach(inner => {
                                        inner.classList.toggle('active', inner.closest('.vocab-card-container')?.getAttribute('data-notebook-id') === id);
                                    });
                                }
                                // 轻量刷新：只更新单词列表和统计，不重渲染卡片
                                if (window.NotebookTabUI && window.NotebookTabUI.refreshWordsAndStats) {
                                    window.NotebookTabUI.refreshWordsAndStats();
                                } else if (onRefresh) {
                                    onRefresh();
                                }
                            }
                        }
                    }
                }
            });
        }
        
        card.setAttribute('data-notebook-id', id);
        return card;
    }
    
    // 创建降级版本的生词本标签（当 createVocabCard 不可用时）
    function createFallbackNotebookTab(id, notebook, currentId, onRefresh) {
        const tabWrapper = document.createElement('div');
        tabWrapper.className = 'notebook-tab-wrapper';
        
        const tab = document.createElement('button');
        tab.innerText = notebook.name;
        tab.className = 'notebook-tab';
        if (id === currentId) tab.classList.add('active');
        
        // 双击重命名
        tab.ondblclick = () => enableCardEditing(id, notebook, onRefresh);
        
        // 点击切换生词本
        tab.onclick = () => {
            const vocabData = getVocabData();
            if (vocabData) {
                vocabData.setCurrentNotebookId(id);
                if (onRefresh) onRefresh();
            }
        };
        tabWrapper.appendChild(tab);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'notebook-actions';
        
        // 重命名按钮
        const renameBtn = document.createElement('button');
        renameBtn.innerText = '✏️';
        renameBtn.className = 'notebook-action-btn';
        renameBtn.title = '重命名';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            enableCardEditing(id, notebook, onRefresh);
        };
        actionsDiv.appendChild(renameBtn);
        
        // 删除按钮（如果不是最后一个生词本）
        const vocabData = getVocabData();
        if (vocabData && Object.keys(vocabData.getAllNotebooks()).length > 1) {
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.className = 'notebook-action-btn delete';
            delBtn.title = '删除';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`确定删除生词本"${notebook.name}"吗？其中的 ${notebook.words ? notebook.words.length : 0} 个单词将丢失。`)) {
                    const result = vocabData.deleteNotebook(id);
                    if (result.success) {
                        if (onRefresh) onRefresh();
                        showToast(`已删除生词本"${notebook.name}"`);
                    } else {
                        showToast(result.error);
                    }
                }
            };
            actionsDiv.appendChild(delBtn);
        }
        
        tabWrapper.appendChild(actionsDiv);
        return tabWrapper;
    }
    
    // 启用卡片编辑模式 - 直接在卡片上编辑
    function enableCardEditing(id, notebook, onRefresh) {
        const container = document.querySelector(`[data-notebook-id="${id}"]`);
        if (!container) return;
        
        const cardImage = container.querySelector('.card__image');
        if (!cardImage) return;
        
        const originalText = notebook.name;
        const originalBg = cardImage.style.background;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            background: ${originalBg};
            font-size: inherit;
            font-weight: inherit;
            text-align: center;
            outline: none;
            padding: 0;
            margin: 0;
        `;
        
        const finishEdit = (save) => {
            if (save) {
                const newName = input.value.trim();
                if (newName && newName !== originalText) {
                    const vocabData = getVocabData();
                    if (vocabData) {
                        const result = vocabData.renameNotebook(id, newName);
                        if (result.success) {
                            if (onRefresh) onRefresh();
                            showToast('重命名成功');
                        } else {
                            showToast(result.error);
                            cardImage.textContent = originalText;
                        }
                    }
                } else {
                    cardImage.textContent = originalText;
                }
            } else {
                cardImage.textContent = originalText;
            }
        };
        
        input.onblur = () => finishEdit(true);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                finishEdit(false);
            }
        };
        
        cardImage.textContent = '';
        cardImage.appendChild(input);
        input.focus();
        input.select();
    }
    
    // 暴露到全局作用域
    window.NotebookTabUI = {
        renderNotebookTabs: renderNotebookTabs,
        createNotebookCard: createNotebookCard,
        exitMergeSelectionMode: exitMergeSelectionMode
    };
    
    // 同时注册到 ModuleRegistry
    if (window.ModuleRegistry) {
        ModuleRegistry.register('NotebookTabUI', [], function() {
            return window.NotebookTabUI;
        });
    }
})();