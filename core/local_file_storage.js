// local_file_storage.js - 本地文件夹存储服务
// 使用 File System Access API 将数据保存到用户选择的本地文件夹
// 即使清除浏览器缓存，数据也不会丢失
(function() {
    'use strict';

    const DB_NAME = 'english-study-club-fs';
    const DB_VERSION = 1;
    const HANDLE_KEY = 'dirHandle';

    const LocalFileStorage = {
        _dirHandle: null,
        _active: false,
        _initDone: false,

        /**
         * 检查浏览器是否支持 File System Access API
         */
        isSupported() {
            return 'showDirectoryPicker' in window;
        },

        /**
         * 是否已激活（已选择文件夹且有权限）
         */
        isActive() {
            return this._active;
        },

        /**
         * 初始化：尝试恢复之前保存的文件夹句柄
         * @returns {Promise<boolean>} 是否成功恢复
         */
        async init() {
            if (this._initDone) return this._active;
            this._initDone = true;

            if (!this.isSupported()) {
                console.log('[LocalFileStorage] 浏览器不支持 File System Access API');
                return false;
            }

            try {
                const handle = await this._loadHandleFromDB();
                if (!handle) return false;

                // 验证权限是否仍然有效
                const opts = { mode: 'readwrite' };
                let permission = await handle.queryPermission(opts);
                if (permission !== 'granted') {
                    permission = await handle.requestPermission(opts);
                }

                if (permission === 'granted') {
                    this._dirHandle = handle;
                    this._active = true;
                    console.log('[LocalFileStorage] 已恢复本地文件夹访问权限');
                    return true;
                }
            } catch (e) {
                console.warn('[LocalFileStorage] 恢复文件夹句柄失败:', e.message);
            }
            return false;
        },

        /**
         * 弹出文件夹选择器，让用户选择数据存储文件夹
         * @returns {Promise<boolean>} 是否成功
         */
        async selectFolder() {
            if (!this.isSupported()) {
                throw new Error('当前浏览器不支持本地文件存储，请使用 Chrome 或 Edge');
            }

            try {
                this._dirHandle = await window.showDirectoryPicker({
                    id: 'english-study-club',
                    mode: 'readwrite',
                    startIn: 'documents'
                });
                await this._saveHandleToDB(this._dirHandle);
                this._active = true;
                console.log('[LocalFileStorage] 已选择本地文件夹');
                broadcastFolderState();
                return true;
            } catch (e) {
                if (e.name === 'AbortError') {
                    // 用户取消了选择
                    return false;
                }
                throw e;
            }
        },

        /**
         * 读取 JSON 文件
         * @param {string} filename - 文件名
         * @returns {Promise<object|null>} 解析后的数据，文件不存在返回 null
         */
        async readJSON(filename) {
            if (!this._active || !this._dirHandle) return null;
            try {
                const fileHandle = await this._dirHandle.getFileHandle(filename);
                const file = await fileHandle.getFile();
                const text = await file.text();
                return JSON.parse(text);
            } catch (e) {
                if (e.name === 'NotFoundError') return null;
                console.error(`[LocalFileStorage] 读取 ${filename} 失败:`, e);
                return null;
            }
        },

        /**
         * 获取或创建子目录句柄
         * @param {string} dirName - 子目录名
         * @returns {Promise<FileSystemDirectoryHandle>}
         */
        async getDirectoryHandle(dirName) {
            if (!this._active || !this._dirHandle) return null;
            try {
                return await this._dirHandle.getDirectoryHandle(dirName, { create: true });
            } catch (e) {
                console.error(`[LocalFileStorage] 获取子目录 ${dirName} 失败:`, e);
                return null;
            }
        },

        /**
         * 写入文本文件到子目录
         * @param {string} dirName - 子目录名
         * @param {string} filename - 文件名（含扩展名）
         * @param {string} content - 文件内容
         */
        async writeTextFileInDir(dirName, filename, content) {
            if (!this._active || !this._dirHandle) return;
            try {
                const dirHandle = await this.getDirectoryHandle(dirName);
                if (!dirHandle) return;
                const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write('\uFEFF' + content);
                await writable.close();
            } catch (e) {
                console.error(`[LocalFileStorage] 写入 ${dirName}/${filename} 失败:`, e);
            }
        },

        /**
         * 写入文本文件（支持任意文本内容）
         * @param {string} filename - 文件名（含扩展名）
         * @param {string} content - 文件内容
         */
        async writeTextFile(filename, content) {
            if (!this._active || !this._dirHandle) return;
            try {
                const fileHandle = await this._dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write('\uFEFF' + content);
                await writable.close();
            } catch (e) {
                console.error(`[LocalFileStorage] 写入 ${filename} 失败:`, e);
            }
        },

        /**
         * 写入 JSON 文件
         * @param {string} filename - 文件名
         * @param {object} data - 要保存的数据
         */
        async writeJSON(filename, data) {
            if (!this._active || !this._dirHandle) return;
            try {
                const fileHandle = await this._dirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(data, null, 2));
                await writable.close();
            } catch (e) {
                console.error(`[LocalFileStorage] 写入 ${filename} 失败:`, e);
            }
        },

        /**
         * 断开本地文件夹连接（不删除文件）
         */
        async disconnect() {
            this._dirHandle = null;
            this._active = false;
            await this._deleteHandleFromDB();
            broadcastFolderState();
        },

        /**
         * 将浏览器 localStorage 中的数据迁移到本地文件夹
         * @param {function} onProgress - 进度回调 (step, total, label)
         * @returns {Promise<{history: number, vocab: number}>} 迁移的数据量
         */
        async migrateFromLocalStorage(onProgress) {
            if (!this._active || !this._dirHandle) {
                throw new Error('未连接到本地文件夹');
            }

            const tasks = [
                {
                    key: 'analysis_history',
                    file: 'analysis_history.json',
                    label: '历史记录'
                },
                {
                    key: 'vocabData',
                    file: 'vocabData.json',
                    label: '生词本'
                }
            ];

            const result = { history: 0, vocab: 0 };
            const total = tasks.length;

            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                if (onProgress) onProgress(i + 1, total, task.label);

                try {
                    const raw = localStorage.getItem(task.key);
                    if (raw) {
                        const data = JSON.parse(raw);
                        await this.writeJSON(task.file, data);
                        if (task.key === 'analysis_history') {
                            result.history = Array.isArray(data) ? data.length : 0;
                        } else {
                            result.vocab = data.notebooks
                                ? Object.values(data.notebooks).reduce((sum, nb) => sum + (nb.words ? nb.words.length : 0), 0)
                                : 0;
                        }
                    }
                } catch (e) {
                    console.error(`[LocalFileStorage] 迁移 ${task.label} 失败:`, e);
                }
            }

            return result;
        },

        // ========== 内部：IndexedDB 存储文件夹句柄 ==========

        async _openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    if (!request.result.objectStoreNames.contains('handles')) {
                        request.result.createObjectStore('handles');
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        async _saveHandleToDB(handle) {
            const db = await this._openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, HANDLE_KEY);
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); reject(tx.error); };
            });
        },

        async _loadHandleFromDB() {
            try {
                const db = await this._openDB();
                return new Promise((resolve) => {
                    const tx = db.transaction('handles', 'readonly');
                    const req = tx.objectStore('handles').get(HANDLE_KEY);
                    req.onsuccess = () => { db.close(); resolve(req.result || null); };
                    req.onerror = () => { db.close(); resolve(null); };
                });
            } catch (e) {
                return null;
            }
        },

        async _deleteHandleFromDB() {
            try {
                const db = await this._openDB();
                return new Promise((resolve) => {
                    const tx = db.transaction('handles', 'readwrite');
                    tx.objectStore('handles').delete(HANDLE_KEY);
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => { db.close(); resolve(); };
                });
            } catch (e) { /* ignore */ }
        }
    };

    // 暴露到全局
    window.LocalFileStorage = LocalFileStorage;

    // 向浏览器扩展（content script）广播本地文件夹连接状态。
    // 仅发送文件夹名，不含句柄，无隐私/句柄泄露风险。
    function broadcastFolderState() {
        try {
            window.postMessage({
                source: 'esc-web-folder',
                active: LocalFileStorage.isActive(),
                name: LocalFileStorage.isActive() && LocalFileStorage._dirHandle ? LocalFileStorage._dirHandle.name : ''
            }, '*');
        } catch (e) { /* ignore */ }
    }
    window.LocalFileStorage._broadcast = broadcastFolderState;

    // 响应浏览器扩展 content script 的「请重发状态」请求。
    // 解决时序问题：页面 init 广播可能早于 content script 监听注册，
    // 由 content script 注入后主动请求一次，确保插件能感知网页端已选文件夹。
    window.addEventListener('message', (event) => {
        try {
            const data = event.data;
            if (data && data.source === 'esc-web-req-folder') {
                broadcastFolderState();
            }
        } catch (e) { /* ignore */ }
    });

    // 自动初始化
    LocalFileStorage.init().then(active => {
        broadcastFolderState();
        if (active) {
            // 触发事件通知其他模块
            if (window.EventBus && window.EventBus.emit) {
                window.EventBus.emit('localStorageReady');
            }
        }
    });

    // init 完成后延迟再广播一次，覆盖 content script 注入晚于 init 的情况
    setTimeout(broadcastFolderState, 1500);
})();