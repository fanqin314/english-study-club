// file_upload_ui.js - 文件上传模块（支持拖拽/点击上传 txt、md、pdf、docx、图片 OCR）
// 架构设计：FileReader 服务层分离，PDF/Word/OCR 库懒加载，全格式可插拔扩展
(function() {
    'use strict';

    ModuleRegistry.register('FileUploadUI', ['EventBus'], function(EventBus) {

        // ========== 支持的格式配置 ==========
        const TEXT_EXTENSIONS = ['.txt', '.md'];
        const PDF_EXTENSIONS = ['.pdf'];
        const WORD_EXTENSIONS = ['.docx', '.doc'];
        const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
        const ALL_EXTENSIONS = [...TEXT_EXTENSIONS, ...PDF_EXTENSIONS, ...WORD_EXTENSIONS, ...IMAGE_EXTENSIONS];

        const ACCEPT_ATTR = ALL_EXTENSIONS.join(',');

        // 文件大小限制
        const TEXT_MAX_SIZE = 5 * 1024 * 1024;   // 5MB
        const DOC_MAX_SIZE = 20 * 1024 * 1024;   // 20MB
        const IMG_MAX_SIZE = 10 * 1024 * 1024;   // 10MB

        // ========== SVG 图标 ==========
        const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>`;

        const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
        </svg>`;

        const CAPTURE_ICON = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="none"/>
            <circle cx="12" cy="12" r="6"/>
        </svg>`;

        const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`;

        // ========== 动态脚本加载 ==========
        function _loadScript(src) {
            return new Promise((resolve, reject) => {
                // 避免重复加载
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`引擎加载失败，请检查网络连接`));
                document.head.appendChild(script);
            });
        }

        // ========== 懒加载 PDF.js ==========
        let _pdfjsLib = null;
        async function _getPdfJs() {
            if (_pdfjsLib) return _pdfjsLib;
            await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            _pdfjsLib = window.pdfjsLib;
            _pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            return _pdfjsLib;
        }

        // ========== 懒加载 Mammoth.js (Word) ==========
        let _mammoth = null;
        async function _getMammoth() {
            if (_mammoth) return _mammoth;
            await _loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
            _mammoth = window.mammoth;
            return _mammoth;
        }

        // ========== 懒加载 Tesseract.js (OCR) ==========
        let _tesseract = null;
        async function _getTesseract() {
            if (_tesseract) return _tesseract;
            await _loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
            _tesseract = window.Tesseract;
            return _tesseract;
        }

        // ========== 文件读取服务（可插拔扩展） ==========
        const FileReaderService = {
            /**
             * 读取文本文件（txt, md）
             */
            async readAsText(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('文件读取失败，请检查文件是否损坏'));
                    reader.readAsText(file, 'UTF-8');
                });
            },

            /**
             * 读取 PDF 文件（pdf.js 懒加载）
             */
            async readPDF(file) {
                const pdfjsLib = await _getPdfJs();
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const pageText = content.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                return fullText.trim();
            },

            /**
             * 读取 Word 文件（mammoth.js 懒加载）
             */
            async readDocx(file) {
                const mammoth = await _getMammoth();
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                return result.value;
            },

            /**
             * 图片 OCR 识别（tesseract.js 懒加载，默认英文）
             * 如需中文识别，将 'eng' 改为 'eng+chi_sim'
             */
            async readImage(file) {
                const Tesseract = await _getTesseract();
                const worker = await Tesseract.createWorker('eng');
                try {
                    const { data: { text } } = await worker.recognize(file);
                    return text.trim();
                } finally {
                    await worker.terminate();
                }
            },

            /**
             * 根据文件类型路由到对应读取器
             */
            async read(file) {
                const ext = '.' + file.name.split('.').pop().toLowerCase();

                if (TEXT_EXTENSIONS.includes(ext)) {
                    return this.readAsText(file);
                }
                if (PDF_EXTENSIONS.includes(ext)) {
                    return this.readPDF(file);
                }
                if (WORD_EXTENSIONS.includes(ext)) {
                    return this.readDocx(file);
                }
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    return this.readImage(file);
                }

                throw new Error(`暂不支持 ${ext} 格式，当前支持：${ALL_EXTENSIONS.join('、')}`);
            },

            /**
             * 验证文件是否可接受
             */
            isValid(file) {
                const ext = '.' + file.name.split('.').pop().toLowerCase();
                return ALL_EXTENSIONS.includes(ext);
            },

            /**
             * 获取文件大小限制
             */
            getMaxSize(file) {
                const ext = '.' + file.name.split('.').pop().toLowerCase();
                if (PDF_EXTENSIONS.includes(ext) || WORD_EXTENSIONS.includes(ext)) {
                    return DOC_MAX_SIZE;
                }
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    return IMG_MAX_SIZE;
                }
                return TEXT_MAX_SIZE;
            }
        };

        // ========== Toast 提示 ==========
        function showToast(msg, type = 'info') {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.style.opacity = '1';
            if (type === 'error') {
                toast.style.background = 'var(--danger, #ef4444)';
            } else {
                toast.style.background = '';
            }
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.background = '';
            }, 2500);
        }

        // ========== 主模块 ==========
        class FileUploadUI {
            constructor() {
                this._fileInput = null;
                this._uploadBtn = null;
                this._cameraBtn = null;
                this._textarea = null;
                this._cameraModal = null;
                this._cameraVideo = null;
                this._cameraCanvas = null;
                this._cameraStream = null;
                this._cleanupFns = [];
            }

            /**
             * 初始化：创建隐藏 file input 和上传按钮，绑定拖拽
             */
            init() {
                this._createFileInput();
                this._addUploadButton();
                this._addCameraButton();
                this._setupDragAndDrop();
                this._setupKeyboardShortcuts();

                // 监听模式切换，重新绑定UI
                if (EventBus && EventBus.on) {
                    EventBus.on('showAnalysisMode', () => {
                        setTimeout(() => {
                            this._addUploadButton();
                            this._addCameraButton();
                        }, 100);
                    });
                }
            }

            /**
             * 创建隐藏的 file input
             */
            _createFileInput() {
                this._fileInput = document.createElement('input');
                this._fileInput.type = 'file';
                this._fileInput.id = 'fileUploadInput';
                this._fileInput.accept = ACCEPT_ATTR;
                this._fileInput.style.display = 'none';
                this._fileInput.setAttribute('aria-label', '上传文件');
                document.body.appendChild(this._fileInput);

                const onFileChange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this._handleFile(file);
                    }
                    this._fileInput.value = '';
                };

                this._fileInput.addEventListener('change', onFileChange);
                this._cleanupFns.push(() => {
                    this._fileInput.removeEventListener('change', onFileChange);
                    if (this._fileInput.parentNode) {
                        this._fileInput.remove();
                    }
                });
            }

            /**
             * 在 textarea 旁边添加上传按钮
             */
            _addUploadButton() {
                if (this._uploadBtn && this._uploadBtn.isConnected) return;

                const textareaWrapper = document.getElementById('textareaWrapper');
                if (!textareaWrapper) return;

                this._textarea = document.getElementById('articleInput');

                this._uploadBtn = document.createElement('button');
                this._uploadBtn.id = 'fileUploadBtn';
                this._uploadBtn.className = 'file-upload-btn';
                this._uploadBtn.innerHTML = UPLOAD_ICON;
                this._uploadBtn.title = '上传文件（支持 .txt、.md、.pdf、.docx、图片）';
                this._uploadBtn.setAttribute('aria-label', '上传文件');

                const onClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this._fileInput) {
                        this._fileInput.click();
                    }
                };
                this._uploadBtn.addEventListener('click', onClick);
                this._cleanupFns.push(() => {
                    if (this._uploadBtn) {
                        this._uploadBtn.removeEventListener('click', onClick);
                    }
                });

                textareaWrapper.style.position = 'relative';
                textareaWrapper.appendChild(this._uploadBtn);
            }

            /**
             * 在 textarea 旁边添加拍照按钮
             */
            _addCameraButton() {
                if (this._cameraBtn && this._cameraBtn.isConnected) return;

                const textareaWrapper = document.getElementById('textareaWrapper');
                if (!textareaWrapper) return;

                this._cameraBtn = document.createElement('button');
                this._cameraBtn.id = 'cameraCaptureBtn';
                this._cameraBtn.className = 'file-upload-btn camera-btn';
                this._cameraBtn.innerHTML = CAMERA_ICON;
                this._cameraBtn.title = '拍照识别文字';
                this._cameraBtn.setAttribute('aria-label', '拍照识别');

                const onClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._openCamera();
                };
                this._cameraBtn.addEventListener('click', onClick);
                this._cleanupFns.push(() => {
                    if (this._cameraBtn) {
                        this._cameraBtn.removeEventListener('click', onClick);
                    }
                });

                textareaWrapper.appendChild(this._cameraBtn);
            }

            /**
             * 设置拖拽上传
             */
            _setupDragAndDrop() {
                const onDragOver = (e) => {
                    const target = e.target.closest('#textareaWrapper') || e.target.closest('#articleInput');
                    if (!target) return;

                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';

                    const textarea = document.getElementById('articleInput');
                    if (textarea && !textarea.classList.contains('file-drag-over')) {
                        textarea.classList.add('file-drag-over');
                    }
                };

                const onDragLeave = (e) => {
                    const target = e.target.closest('#textareaWrapper') || e.target.closest('#articleInput');
                    if (!target) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const relatedTarget = e.relatedTarget;
                    const wrapper = document.getElementById('textareaWrapper');
                    if (wrapper && (!relatedTarget || !wrapper.contains(relatedTarget))) {
                        const textarea = document.getElementById('articleInput');
                        if (textarea) {
                            textarea.classList.remove('file-drag-over');
                        }
                    }
                };

                const onDrop = async (e) => {
                    const target = e.target.closest('#textareaWrapper') || e.target.closest('#articleInput');
                    if (!target) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const textarea = document.getElementById('articleInput');
                    if (textarea) {
                        textarea.classList.remove('file-drag-over');
                    }

                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        await this._handleFile(files[0]);
                    }
                };

                document.addEventListener('dragover', onDragOver);
                document.addEventListener('dragleave', onDragLeave);
                document.addEventListener('drop', onDrop);

                this._cleanupFns.push(() => {
                    document.removeEventListener('dragover', onDragOver);
                    document.removeEventListener('dragleave', onDragLeave);
                    document.removeEventListener('drop', onDrop);
                });
            }

            /**
             * 键盘快捷键（ESC 关闭摄像头）
             */
            _setupKeyboardShortcuts() {
                const onKeyDown = (e) => {
                    if (e.key === 'Escape' && this._cameraModal) {
                        this._closeCamera();
                    }
                };
                document.addEventListener('keydown', onKeyDown);
                this._cleanupFns.push(() => {
                    document.removeEventListener('keydown', onKeyDown);
                });
            }

            /**
             * 打开摄像头拍照
             */
            async _openCamera() {
                try {
                    this._createCameraModal();
                    await this._startCamera();
                } catch (error) {
                    console.error('[FileUploadUI] 摄像头启动失败:', error);
                    this._closeCamera();
                    if (error.name === 'NotAllowedError') {
                        showToast('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头', 'error');
                    } else if (error.name === 'NotFoundError') {
                        showToast('未检测到摄像头设备', 'error');
                    } else {
                        showToast('摄像头启动失败，请检查设备连接', 'error');
                    }
                }
            }

            /**
             * 创建摄像头模态框
             */
            _createCameraModal() {
                this._cameraModal = document.createElement('div');
                this._cameraModal.className = 'camera-modal';
                this._cameraModal.innerHTML = `
                    <div class="camera-backdrop"></div>
                    <div class="camera-container">
                        <video class="camera-video" autoplay playsinline></video>
                        <canvas class="camera-canvas" style="display:none"></canvas>
                        <div class="camera-controls">
                            <button class="camera-capture-btn" title="拍照">${CAPTURE_ICON}</button>
                        </div>
                        <button class="camera-close-btn" title="关闭">${CLOSE_ICON}</button>
                    </div>
                `;
                document.body.appendChild(this._cameraModal);

                // 绑定事件
                this._cameraVideo = this._cameraModal.querySelector('.camera-video');
                this._cameraCanvas = this._cameraModal.querySelector('.camera-canvas');

                const backdrop = this._cameraModal.querySelector('.camera-backdrop');
                backdrop.addEventListener('click', () => this._closeCamera());

                const closeBtn = this._cameraModal.querySelector('.camera-close-btn');
                closeBtn.addEventListener('click', () => this._closeCamera());

                const captureBtn = this._cameraModal.querySelector('.camera-capture-btn');
                captureBtn.addEventListener('click', () => this._capturePhoto());
            }

            /**
             * 启动摄像头
             */
            async _startCamera() {
                // 优先后置摄像头，桌面端无后置则回退到任意摄像头
                const constraints = [
                    { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
                    { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
                    { video: true, audio: false }  // 最终回退：任意摄像头
                ];

                let lastError = null;
                for (const constraint of constraints) {
                    try {
                        this._cameraStream = await navigator.mediaDevices.getUserMedia(constraint);
                        this._cameraVideo.srcObject = this._cameraStream;
                        return;
                    } catch (e) {
                        lastError = e;
                        if (e.name === 'NotAllowedError') throw e;  // 权限拒绝直接抛出
                    }
                }
                throw lastError;
            }

            /**
             * 拍照
             */
            async _capturePhoto() {
                if (!this._cameraVideo || !this._cameraCanvas) return;

                const video = this._cameraVideo;
                const canvas = this._cameraCanvas;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);

                // 停止摄像头
                this._stopCamera();

                // 将 canvas 转为 Blob 再转为 File
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.9);
                });

                if (!blob) {
                    showToast('拍照失败，请重试', 'error');
                    this._closeCamera();
                    return;
                }

                const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });

                // 关闭摄像头界面
                this._closeCamera();

                // 送入 OCR 管道
                await this._handleCameraImage(file);
            }

            /**
             * 停止摄像头流
             */
            _stopCamera() {
                if (this._cameraStream) {
                    this._cameraStream.getTracks().forEach(track => track.stop());
                    this._cameraStream = null;
                }
            }

            /**
             * 关闭摄像头模态框
             */
            _closeCamera() {
                this._stopCamera();
                if (this._cameraModal && this._cameraModal.parentNode) {
                    this._cameraModal.remove();
                }
                this._cameraModal = null;
                this._cameraVideo = null;
                this._cameraCanvas = null;
            }

            /**
             * 处理摄像头拍摄的图片（接入 OCR 管道）
             */
            async _handleCameraImage(file) {
                showToast('正在 OCR 识别拍照内容...');

                try {
                    const text = await FileReaderService.readImage(file);

                    if (!text || text.trim().length === 0) {
                        showToast('未识别到文字内容，请确认拍摄清晰且包含英文文本', 'error');
                        return;
                    }

                    const textarea = document.getElementById('articleInput');
                    if (!textarea) {
                        showToast('文本输入框未找到，请切换到深度解析模式', 'error');
                        return;
                    }

                    textarea.value = text;

                    const event = new Event('input', { bubbles: true });
                    textarea.dispatchEvent(event);

                    if (EventBus && EventBus.emit) {
                        EventBus.emit('fileUploaded', {
                            fileName: '拍照识别',
                            fileSize: file.size,
                            text: text
                        });
                    }

                    showToast('拍照识别成功');
                } catch (error) {
                    console.error('[FileUploadUI] 拍照 OCR 失败:', error);
                    showToast(error.message || 'OCR 识别失败', 'error');
                }
            }

            /**
             * 处理上传的文件
             * @param {File} file
             */
            async _handleFile(file) {
                // 验证文件类型
                if (!FileReaderService.isValid(file)) {
                    const ext = '.' + file.name.split('.').pop().toLowerCase();
                    showToast(`不支持 ${ext} 格式，请上传 ${ALL_EXTENSIONS.join('、')} 文件`, 'error');
                    return;
                }

                // 验证文件大小
                const maxSize = FileReaderService.getMaxSize(file);
                if (file.size > maxSize) {
                    const maxMB = Math.round(maxSize / (1024 * 1024));
                    showToast(`文件过大，请上传小于 ${maxMB}MB 的文件`, 'error');
                    return;
                }

                showToast(`正在读取 ${file.name}...`);

                try {
                    const text = await FileReaderService.read(file);

                    // 空结果检查（OCR 可能识别为空）
                    if (!text || text.trim().length === 0) {
                        showToast('未识别到文字内容，请确认图片清晰且包含英文文本', 'error');
                        return;
                    }

                    const textarea = document.getElementById('articleInput');
                    if (!textarea) {
                        showToast('文本输入框未找到，请切换到深度解析模式', 'error');
                        return;
                    }

                    textarea.value = text;

                    const event = new Event('input', { bubbles: true });
                    textarea.dispatchEvent(event);

                    if (EventBus && EventBus.emit) {
                        EventBus.emit('fileUploaded', {
                            fileName: file.name,
                            fileSize: file.size,
                            text: text
                        });
                    }

                    showToast(`${file.name} 加载成功`);
                } catch (error) {
                    console.error('[FileUploadUI] 文件读取失败:', error);
                    showToast(error.message || '文件读取失败', 'error');
                }
            }

            /**
             * 销毁模块，清理资源
             */
            destroy() {
                this._cleanupFns.forEach(fn => {
                    try { fn(); } catch (e) { /* ignore */ }
                });
                this._cleanupFns = [];
                this._uploadBtn = null;
                this._fileInput = null;
                this._textarea = null;
            }
        }

        // ========== 创建实例并初始化 ==========
        const instance = new FileUploadUI();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => instance.init());
        } else {
            instance.init();
        }

        // 暴露接口
        return {
            init: () => instance.init(),
            destroy: () => instance.destroy(),
            // 未来扩展：注册自定义文件读取器（如 OCR）
            registerReader: (ext, readerFn) => {
                const originalRead = FileReaderService.read;
                FileReaderService.read = async function(file) {
                    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
                    if (fileExt === ext) {
                        return readerFn(file);
                    }
                    return originalRead.call(this, file);
                };
                ALL_EXTENSIONS.push(ext);
            }
        };
    });
})();