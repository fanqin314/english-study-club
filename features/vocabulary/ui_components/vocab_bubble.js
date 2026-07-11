(function() {
    ModuleRegistry.register('VocabBubble', ['GlobalManager'], function(GlobalManager) {
        let currentBubble = null;

        function getVocabData() {
            return GlobalManager.getGlobalObject('VocabData');
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.innerText = msg;
                toast.style.opacity = '1';
                setTimeout(() => toast.style.opacity = '0', 2000);
            }
        }

        function createEditBubble(wordData, targetElement) {
            closeCurrentBubble();

            const bubble = document.createElement('div');
            bubble.className = 'word-bubble';
            bubble.id = 'editWordBubble';

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

            document.body.appendChild(bubble);
            currentBubble = bubble;

            positionBubble(bubble, targetElement);
            bindCloseEvents(bubble);

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

                const vocabData = getVocabData();
                if (vocabData) {
                    const result = vocabData.updateWord(vocabData.getCurrentNotebookId(), wordData.word, {
                        pos: pos,
                        meaning: meaning,
                        context: context
                    });

                    if (result.success) {
                        closeCurrentBubble();
                        if (window.VocabList) {
                            window.VocabList.renderWordsList(document.getElementById('vocabWordsList'));
                        }
                        showToast('单词信息已更新');
                    } else {
                        showToast(result.error);
                    }
                } else {
                    showToast('生词本数据服务未初始化');
                }
            });

            const cancelBtn = bubble.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeCurrentBubble();
            });
        }

        function createDeleteBubble(wordData, targetElement) {
            closeCurrentBubble();

            const bubble = document.createElement('div');
            bubble.className = 'word-bubble';
            bubble.id = 'deleteWordBubble';

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

            document.body.appendChild(bubble);
            currentBubble = bubble;

            positionBubble(bubble, targetElement);
            bindCloseEvents(bubble);

            const deleteBtn = bubble.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                const vocabData = getVocabData();
                if (vocabData) {
                    const result = vocabData.deleteWord(vocabData.getCurrentNotebookId(), wordData.word);
                    if (result.success) {
                        closeCurrentBubble();
                        if (window.VocabList) {
                            window.VocabList.renderWordsList(document.getElementById('vocabWordsList'));
                        }
                        showToast('单词已删除');
                    } else {
                        showToast(result.error);
                    }
                } else {
                    showToast('生词本数据服务未初始化');
                }
            });

            const cancelBtn = bubble.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeCurrentBubble();
            });
        }

        function positionBubble(bubble, targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const bubbleRect = bubble.getBoundingClientRect();

            let left = rect.left;
            let top = rect.bottom + 8;

            const viewportWidth = window.innerWidth;
            if (left + 260 > viewportWidth) {
                left = viewportWidth - 270;
            }

            const viewportHeight = window.innerHeight;
            const bubbleHeight = bubbleRect.height || 300;
            if (top + bubbleHeight > viewportHeight) {
                top = rect.top - bubbleHeight - 8;
                bubble.classList.add('bubble-top');
            }

            bubble.style.left = `${left + window.scrollX}px`;
            bubble.style.top = `${top + window.scrollY}px`;
        }

        function bindCloseEvents(bubble) {
            const closeHandler = (e) => {
                if (!bubble.contains(e.target)) {
                    closeCurrentBubble();
                }
            };

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeCurrentBubble();
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('keydown', escHandler);
            }, 10);

            bubble._closeHandler = closeHandler;
            bubble._escHandler = escHandler;
        }

        function closeCurrentBubble() {
            if (currentBubble) {
                if (currentBubble._closeHandler) {
                    document.removeEventListener('click', currentBubble._closeHandler);
                }
                if (currentBubble._escHandler) {
                    document.removeEventListener('keydown', currentBubble._escHandler);
                }
                currentBubble.remove();
                currentBubble = null;
            }
        }

        return {
            createEditBubble,
            createDeleteBubble,
            closeCurrentBubble
        };
    });
})();