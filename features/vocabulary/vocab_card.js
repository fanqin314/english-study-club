/**
 * 创建毛玻璃 3D 生词本卡片
 * @param {Object} options 配置项
 * @param {string} options.name - 生词本名称 (显示在图片区)
 * @param {number} options.wordCount - 单词总数
 * @param {string} options.createdDate - 创建日期
 * @param {number} options.todayNew - 今日新词数
 * @param {string} options.bgColor - 图片区背景色 (CSS颜色值)
 * @param {Function} options.onAdd - 点击加号按钮的回调
 * @param {Function} options.onRename - 点击重命名按钮的回调
 * @param {Function} options.onDelete - 点击删除按钮的回调
 * @param {boolean} options.isActive - 是否为当前激活的生词本
 * @returns {HTMLElement} 卡片 DOM 元素
 */
function createVocabCard(options = {}) {
  const {
    name = '雅思核心',
    wordCount = 156,
    createdDate = '2024.09.01',
    todayNew = 5,
    bgColor = '#4f7aa6',
    onAdd = () => alert('📖 添加新单词'),
    onRename = () => {},
    onDelete = () => {},
    isActive = false
  } = options;

  // ---------- 确保样式只注入一次 ----------
  if (!document.getElementById('vocab-card-styles')) {
    const style = document.createElement('style');
    style.id = 'vocab-card-styles';
    style.textContent = `
      /* 卡片容器基础 */
      .vocab-card-container {
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 10px;
        position: relative;
      }
      .card-effect {
        perspective: 1000px;
      }
      .card-inner {
        --card-bg: #ffffff;
        --card-accent: #ff8a65;
        --card-text: #263238;
        --card-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        --card-border: rgba(255, 255, 255, 0.3);
        width: 280px;
        min-height: 200px;
        background: var(--card-bg);
        border-radius: 20px;
        position: relative;
        overflow: visible;
        transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s, min-height 0.4s ease, border-radius 0.3s ease;
        box-shadow: var(--card-shadow);
        border: 1px solid var(--card-border);
        transform-style: preserve-3d;
      }
      .card-inner:not(.collapsed) {
        border-radius: 20px 20px 0 0;
        border-bottom: 1px solid transparent;
      }
      .card-inner.active:not(.collapsed) {
        border-bottom: 2px solid transparent;
      }
      .card__visual {
        position: relative;
        overflow: hidden;
        border-radius: inherit;
      }
      [data-theme="dark"] .card-inner {
        --card-bg: #1e293b;
        --card-text: #f1f5f9;
        --card-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
        --card-border: rgba(255, 255, 255, 0.1);
      }
      [data-theme="dark"] .card__collapsible {
        background-color: #1e293b;
        color: #f1f5f9;
      }
      .card-inner:hover {
        transform: rotateY(10deg) rotateX(10deg) translateZ(10px);
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
      }
      .card-inner.active {
        border: 2px solid var(--card-accent);
        box-shadow: 0 0 20px rgba(255, 138, 101, 0.3);
      }
      .card__liquid-wrap {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        transition: opacity 0.4s;
        opacity: 0;
      }
      .card__liquid {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at 50% 100%, rgba(37,99,235,1) 0%, transparent 80%);
        filter: blur(30px);
        pointer-events: none;
      }
      .card__liquid-top {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 0%, rgba(37,99,235,1) 0%, transparent 80%);
        filter: blur(30px);
        transition: opacity 0.4s;
        opacity: 0;
        pointer-events: none;
      }
      .card-inner:hover .card__liquid-wrap,
      .card-inner:hover .card__liquid-top {
        opacity: 1;
      }
      .card-inner:hover .card__liquid-top {
        animation: glow-drift 5s ease-in-out infinite;
      }
      .card__shine,
      .card__collapsible-shine {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0.6) 55%, rgba(255,255,255,0) 100%);
        background-size: 300% 100%;
        opacity: 0;
        transition: opacity 0.4s;
        pointer-events: none;
        border-radius: inherit;
      }
      .card-inner:hover .card__shine,
      .card-inner:not(.collapsed):hover .card__collapsible-shine {
        opacity: 1;
        animation: shine-effect 4s infinite linear;
      }
      .card__content {
        padding: 1.5em;
        height: auto;
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        position: relative;
        z-index: 2;
        background: var(--card-bg);
      }
      .card__image {
        width: 100%;
        height: 120px;
        border-radius: 15px;
        transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
        position: relative;
        overflow: hidden;
        box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.8rem;
        font-weight: 600;
        text-shadow: 0 2px 5px rgba(0,0,0,0.2);
        cursor: pointer;
      }
      .card-inner:hover .card__image {
        transform: translateY(-8px) scale(1.05);
      }
      .card__image::after {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 40%),
                    repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 3px, transparent 3px, transparent 6px);
        opacity: 0.6;
        pointer-events: none;
      }
      .card__text {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
      }
      .card__title {
        color: var(--card-text);
        font-size: 1.2em;
        margin: 0;
        font-weight: 700;
        transition: color 0.4s, transform 0.4s;
      }
      .card-inner:hover .card__title {
        color: var(--card-accent);
        transform: translateX(3px);
      }
      .card__description {
        color: var(--card-text);
        font-size: 0.85em;
        margin-top: -11px;
        margin-bottom: -11px;
        padding-left: 2px;
        padding-right: 2px;
        height: 31px;
        opacity: 0.8;
        transition: opacity 0.4s, transform 0.4s;
      }
      .card-inner:hover .card__description {
        opacity: 1;
        transform: translateX(3px);
      }
      .card__title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .card__title-row .card__title {
        flex: 1;
        min-width: 0;
      }
      .card__collapsible {
        position: absolute;
        left: 0;
        top: calc(100% - 1px);
        width: 280px;
        box-sizing: border-box;
        margin-left: -1px;
        margin-right: -1px;
        z-index: 10;
        transform-style: flat;
        border-radius: 0 0 20px 20px;
        padding: 1em 1.5em 1.4em;
        overflow: visible;
        clip-path: inset(-120px 0 0 0 round 0 0 20px 20px);
        opacity: 0;
        transform: translateY(-10px);
        pointer-events: auto;
        transition: opacity 0.3s ease, transform 0.3s ease;
        background-color: rgba(255, 255, 255, 0.93);
        box-shadow: var(--card-shadow);
        border: 1px solid var(--card-border);
        border-top: none;
      }
      .card__collapsible.show {
        opacity: 0.93;
        transform: translateY(0);
      }
      .card-inner.active .card__collapsible {
        border: 2px solid var(--card-accent);
        border-top: none;
        margin-left: -2px;
        margin-right: -2px;
      }
      .card-inner.selected .card__collapsible {
        border: 2px solid #3B82F6;
        border-top: none;
        margin-left: -2px;
        margin-right: -2px;
      }
      .card-inner.collapsed .card__collapsible {
        pointer-events: none;
      }
      .card__footer {
        margin-top: -10px;
        margin-bottom: -10px;
      }
      .add-word-section {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        flex-wrap: nowrap;
      }
      .add-word-section input {
        flex: 1;
        min-width: 0;
      }
      .add-word-section .word-input, .add-word-section .meaning-input {
        padding: 6px 10px;
        border: 1px solid #ddd;
        font-size: 0.8em;
        transition: border-color 0.3s;
        height: 30px;
        box-shadow: inset 0px 4px 8px 0px rgba(0, 0, 0, 0.25);
        background: white;
        color: #333;
      }
      [data-theme="dark"] .add-word-section .word-input, [data-theme="dark"] .add-word-section .meaning-input {
        border: 1px solid #444;
        background: #2d3748;
        color: #f1f5f9;
        box-shadow: inset 0px 4px 8px 0px rgba(0, 0, 0, 0.4);
      }
      .add-word-section .word-input {
        border-radius: 6px;
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
        border-top-left-radius: 50px;
        border-bottom-left-radius: 50px;
      }
      .add-word-section .meaning-input {
        border-radius: 4px;
        border-top-right-radius: 50px;
        border-bottom-right-radius: 50px;
        border-top-left-radius: 20px;
        border-bottom-left-radius: 20px;
      }
      .add-word-section .word-input:focus, .add-word-section .meaning-input:focus {
        outline: none;
        border-color: var(--card-accent);
        box-shadow: 0 0 0 2px rgba(255, 138, 101, 0.2);
      }
      .add-word-section .secondary {
        padding: 6px;
        background: var(--card-accent);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1.2em;
        transition: all 0.3s;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .add-word-section .secondary:hover {
        background: #e67e5f;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      .card__button {
        width: 36px;
        height: 36px;
        background: var(--card-accent);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        cursor: pointer;
        transition: transform 0.4s, box-shadow 0.4s;
        transform: scale(0.85);
      }
      .card-inner:hover .card__button {
        transform: scale(1);
        box-shadow: 0 0 0 5px rgba(255, 138, 101, 0.3);
      }
      .card-inner:hover .card__button svg {
        animation: pulse-button 1.5s infinite;
      }
      .card__actions {
        display: flex;
        gap: 6px;
        margin-top: -24px;
        margin-bottom: -24px;
        margin-left: -10px;
        margin-right: -10px;
        width: 250px;
        height: 55px;
        align-items: center;
        justify-content: center;
      }
      .card__actions .secondary {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #4CAF50;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.164);
        cursor: pointer;
        transition-duration: .3s;
        overflow: hidden;
        position: relative;
        margin-left: 0px;
        margin-right: 0px;
      }
      .card__actions .secondary .svgIcon {
        position: absolute;
        width: 20px !important;
        height: 20px;
        transition-duration: .3s;
      }
      .card__actions .secondary .svgIcon path {
        fill: white;
      }
      .card__actions .secondary:hover {
        width: 100px;
        border-radius: 50px;
        transition-duration: .3s;
        background-color: #45a049;
      }
      .card__actions .secondary:hover .svgIcon {
        transform: translateY(60%);
      }
      .card__actions .secondary::before {
        position: absolute;
        top: -15px;
        content: "添加";
        color: white;
        transition-duration: .3s;
        font-size: 2px;
        opacity: 0;
      }
      .card__actions .secondary:hover::before {
        font-size: 12px;
        opacity: 1;
        transform: translateY(22px);
        transition-duration: .3s;
      }
      .card__action-btn.delete {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #f44336;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.164);
        cursor: pointer;
        transition-duration: .3s;
        overflow: hidden;
        position: relative;
      }
      .card__action-btn.delete .svgIcon {
        position: absolute;
        width: 20px !important;
        height: 20px;
        transition-duration: .3s;
      }
      .card__action-btn.delete .svgIcon path {
        fill: white;
      }
      .card__action-btn.delete:hover {
        width: 100px;
        border-radius: 50px;
        transition-duration: .3s;
        background-color: #d32f2f;
      }
      .card__action-btn.delete:hover .svgIcon {
        transform: translateY(60%);
      }
      .card__action-btn.delete::before {
        position: absolute;
        top: -15px;
        content: "删除";
        color: white;
        transition-duration: .3s;
        font-size: 2px;
        opacity: 0;
      }
      .card__action-btn.delete:hover::before {
        font-size: 12px;
        opacity: 1;
        transform: translateY(22px);
        transition-duration: .3s;
      }
      .card__action-btn.merge {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #3B82F6;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.164);
        cursor: pointer;
        transition-duration: .3s;
        overflow: hidden;
        position: relative;
        margin-left: 30px;
        margin-right: 30px;
      }
      .card__action-btn.merge .svgIcon {
        position: absolute;
        width: 20px !important;
        height: 20px;
        transition-duration: .3s;
      }
      .card__action-btn.merge .svgIcon path {
        fill: white;
      }
      .card__action-btn.merge:hover {
        width: 100px;
        border-radius: 50px;
        transition-duration: .3s;
        background-color: #2563EB;
      }
      .card__action-btn.merge:hover .svgIcon {
        transform: translateY(60%);
      }
      .card__action-btn.merge::before {
        position: absolute;
        top: -15px;
        content: "合并";
        color: white;
        transition-duration: .3s;
        font-size: 2px;
        opacity: 0;
      }
      .card__action-btn.merge:hover::before {
        font-size: 12px;
        opacity: 1;
        transform: translateY(22px);
        transition-duration: .3s;
      }
      .card__action-btn.merge.confirm::before {
        content: "确定合并";
      }
      .card__action-btn.merge.selected::before {
        content: "已选择";
      }
      .card__action-btn.merge.cancel {
        background-color: #9CA3AF;
      }
      .card__action-btn.merge.cancel:hover {
        background-color: #6B7280;
      }
      .card__action-btn.merge.cancel::before {
        content: "取消";
      }
      .card__action-btn {
        padding: 0px;
        border: none;
        cursor: pointer;
        font-size: 0.85em;
        transition: all 0.3s;
      }
      .card__action-btn.rename {
        background: #4CAF50;
        color: white;
        border-radius: 50px;
        height: 40px;
        width: 40px;
        padding: 0px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card__action-btn.delete {
        background: #f44336;
        color: white;
        border-radius: 50px;
        height: 40px;
        width: 40px;
        padding: 8px 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* 选择模式样式 */
      .merge-selection-mode {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' fill='%233B82F6'%3E%3Cpath d='M17,10H7V7H17M17,14H7V11H17M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2Z'/%3E%3C/svg%3E"), auto;
      }
      .card-inner.selectable {
        transition: all 0.3s;
      }
      .card-inner.selectable:hover {
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
        transform: rotateY(5deg) rotateX(5deg) translateZ(5px);
      }
      .card-inner.selected {
        box-shadow: 0 0 25px rgba(59, 130, 246, 0.7);
        border: 2px solid #3B82F6;
      }
      .selection-indicator {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #3B82F6;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        z-index: 10;
      }
      
      /* 提示信息样式 */
      .merge-selection-toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      .merge-selection-toast-bottom {
        top: auto;
        bottom: 20px;
      }
      .card__action-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      .svgIcon {
        display: inline-block;
        vertical-align: middle;
        fill: currentColor;
      }
      @keyframes shine-effect {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes glow-drift {
        0% { transform: translate(0, 0); }
        20% { transform: translate(-10%, 6%); }
        40% { transform: translate(8%, -8%); }
        60% { transform: translate(-5%, 12%); }
        80% { transform: translate(12%, -4%); }
        100% { transform: translate(0, 0); }
      }
      @keyframes pulse-button {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      
      /* 环形色彩选择器 */
      .color-picker {
        position: absolute;
        z-index: 9999;
        transform: translate(-50%, -50%);
      }
      
      .ring-color-picker {
        position: relative;
        width: 288px;
        height: 288px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .center-button {
        position: absolute;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--card-bg);
        border: 2px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10;
        transition: all 0.3s ease;
      }
      
      .center-button:hover {
        border-color: var(--accent);
        transform: scale(1.05);
      }
      
      .center-button.active {
        background: var(--accent);
        color: white;
      }
      
      .center-icon {
        width: 24px;
        height: 24px;
        position: absolute;
        transition: transform 0.3s ease;
      }
      
      .center-button.active .center-icon {
        transform: rotate(45deg);
      }
      
      .color-options {
        position: absolute;
        width: 100%;
        height: 100%;
      }
      
      .color-option {
        position: absolute;
        width: 48px; /* 增大尺寸 */
        height: 48px; /* 增大尺寸 */
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
      }
      
      .color-option:hover {
        transform: translate(-50%, -50%) scale(1.15) !important;
      }
      
      .color-option.selected {
        box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
      }
      
      .color-option.show {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      
      /* 展开动画 */
      @keyframes expand {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
      }
      
      /* 收起动画 */
      @keyframes collapse {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- 构建 DOM 结构 ----------
  const container = document.createElement('div');
  container.className = 'vocab-card-container';

  const cardEffect = document.createElement('div');
  cardEffect.className = 'card-effect';

  const cardInner = document.createElement('div');
  cardInner.className = 'card-inner';
  if (isActive) cardInner.classList.add('active');

  // 液体层（用 wrap 容器裁剪 blur 发散）
  const liquid = document.createElement('div');
  liquid.className = 'card__liquid';
  const liquidWrap = document.createElement('div');
  liquidWrap.className = 'card__liquid-wrap';
  liquidWrap.appendChild(liquid);
  cardInner.appendChild(liquidWrap);

  // 视觉包装层（裁剪效果，不让溢出到 collapsible）
  const visualWrapper = document.createElement('div');
  visualWrapper.className = 'card__visual';

  // 内容层
  const content = document.createElement('div');
  content.className = 'card__content';

  // 顶部蓝色光晕
  const liquidTop = document.createElement('div');
  liquidTop.className = 'card__liquid-top';
  content.appendChild(liquidTop);

  // 光泽层
  const shine = document.createElement('div');
  shine.className = 'card__shine';
  content.appendChild(shine);

  visualWrapper.appendChild(content);

  // 图片区 (显示名称)
  const imageDiv = document.createElement('div');
  imageDiv.className = 'card__image';
  imageDiv.style.background = bgColor;
  imageDiv.textContent = name;
  // 添加双击事件修改生词本名字
  imageDiv.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    onRename();
  });
  
  // 添加右键点击事件选择颜色
  imageDiv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showColorPicker(e.clientX, e.clientY, bgColor, (newColor) => {
      imageDiv.style.background = newColor;
      // 通知外部颜色已更改
      if (options.onColorChange) {
        options.onColorChange(newColor);
      }
    });
  });
  
  content.appendChild(imageDiv);

  // 文本区 - 只包含标题行
  const textDiv = document.createElement('div');
  textDiv.className = 'card__text';

  const titleRow = document.createElement('div');
  titleRow.className = 'card__title-row';

  const title = document.createElement('p');
  title.className = 'card__title';
  title.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>单词数 · ${wordCount}`;
  titleRow.appendChild(title);

  textDiv.appendChild(titleRow);
  content.appendChild(textDiv);

  // 可折叠区域 wrapper
  const collapsible = document.createElement('div');
  collapsible.className = 'card__collapsible';

  // collapsible 内的流光装饰（在 card-inner hover 时显示）
  const collapsibleShine = document.createElement('div');
  collapsibleShine.className = 'card__collapsible-shine';
  collapsible.appendChild(collapsibleShine);

  const desc = document.createElement('p');
  desc.className = 'card__description';
  desc.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: -3px; margin-bottom: -3px;"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> 创建于 ' + createdDate;
  collapsible.appendChild(desc);

  // 底部 - 集成添加单词功能
  const footer = document.createElement('div');
  footer.className = 'card__footer';
  
  // 添加单词输入区域
  const addWordSection = document.createElement('div');
  addWordSection.className = 'add-word-section';
  
  const wordInput = document.createElement('input');
  wordInput.type = 'text';
  wordInput.placeholder = '要添加的单词';
  wordInput.className = 'word-input';
  // 添加事件阻止冒泡
  wordInput.addEventListener('click', (e) => e.stopPropagation());
  wordInput.addEventListener('focus', (e) => e.stopPropagation());
  addWordSection.appendChild(wordInput);
  
  const meaningInput = document.createElement('input');
  meaningInput.type = 'text';
  meaningInput.placeholder = '中文释义（可选）';
  meaningInput.className = 'meaning-input';
  // 添加事件阻止冒泡
  meaningInput.addEventListener('click', (e) => e.stopPropagation());
  meaningInput.addEventListener('focus', (e) => e.stopPropagation());
  addWordSection.appendChild(meaningInput);
  
  footer.appendChild(addWordSection);

  collapsible.appendChild(footer);

  // 操作按钮
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card__actions';

  const addButton = document.createElement('button');
  addButton.className = 'secondary';
  addButton.title = '手动添加';
  addButton.innerHTML = `
    <svg class="svgIcon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"></path>
    </svg>
  `;
  addButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const word = wordInput.value.trim();
    let meaning = meaningInput.value.trim();
    
    if (!word) return;
    
    // 如果没有输入释义，尝试使用 AI 获取
    if (!meaning && window.DictService) {
      try {
        meaningInput.disabled = true;
        addButton.disabled = true;
        
        const dictResult = await window.DictService.getWordMeaning(word, {
          apiCall: async (w) => {
            const APIRequest = window.APIRequest || (window.GlobalManager && window.GlobalManager.getGlobalObject('APIRequest'));
            if (APIRequest && APIRequest.requestWordMeaning) {
              return await APIRequest.requestWordMeaning(w);
            }
            return null;
          }
        });
        
        if (dictResult && dictResult.meaning) {
          meaning = dictResult.meaning;
          meaningInput.value = meaning;
        }
      } catch (error) {
        console.error('获取单词释义失败:', error);
      } finally {
        meaningInput.disabled = false;
        addButton.disabled = false;
      }
    }
    
    // 调用添加单词的回调
    onAdd(word, meaning);
    // 清空输入框
    wordInput.value = '';
    meaningInput.value = '';
  });
  // 添加事件阻止冒泡
  addButton.addEventListener('click', (e) => e.stopPropagation());
  actionsDiv.appendChild(addButton);

  // 合并按钮
  const mergeButton = document.createElement('button');
  mergeButton.className = 'card__action-btn merge';
  mergeButton.title = '合并生词本';
  mergeButton.innerHTML = `
    <svg class="svgIcon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M17,10H7V7H17M17,14H7V11H17M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2Z"></path>
    </svg>
  `;
  mergeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    // 检查是否是取消状态
    if (mergeButton.classList.contains('cancel')) {
      // 退出合并选择模式
      if (window.NotebookTabUI && window.NotebookTabUI.exitMergeSelectionMode) {
        window.NotebookTabUI.exitMergeSelectionMode();
      }
    } else {
      // 正常的合并按钮点击逻辑
      if (options.onMerge) {
        options.onMerge();
      }
    }
  });
  actionsDiv.appendChild(mergeButton);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'card__action-btn delete';
  deleteBtn.title = '删除';
  deleteBtn.innerHTML = `
    <svg class="svgIcon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path>
    </svg>
  `;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete();
  });
  actionsDiv.appendChild(deleteBtn);

  collapsible.appendChild(actionsDiv);

  cardInner.appendChild(visualWrapper);
  cardInner.appendChild(collapsible);
  cardEffect.appendChild(cardInner);
  container.appendChild(cardEffect);

  // ---------- 折叠/展开交互 ----------
  // 默认折叠
  cardInner.classList.add('collapsed');

  // ---------- 鼠标悬停展开/折叠 ----------
  cardInner.addEventListener('mouseenter', () => {
    cardInner.classList.remove('collapsed');
    collapsible.classList.add('show');
  });

  cardInner.addEventListener('mouseleave', () => {
    cardInner.classList.add('collapsed');
    collapsible.classList.remove('show');
  });

  return container;
}

// 显示颜色选择器
function showColorPicker(x, y, currentColor, onColorSelect) {
  // 颜色列表（从词性颜色中提取）
  const colors = [
    { value: '#8B5A2B', label: '名词' },
    { value: '#EF4444', label: '动词' },
    { value: '#F97316', label: '形容词' },
    { value: '#EAB308', label: '副词' },
    { value: '#22C55E', label: '代词' },
    { value: '#3B82F6', label: '介词' },
    { value: '#6366F1', label: '连词' },
    { value: '#A855F7', label: '感叹词' },
    { value: '#EC4899', label: '冠词' },
    { value: '#6B7280', label: '数词' }
  ];
  
  // 创建颜色选择器元素
  const colorPicker = document.createElement('div');
  colorPicker.className = 'color-picker';
  colorPicker.style.left = `${x}px`;
  colorPicker.style.top = `${y}px`;
  
  // 创建环形选择器容器
  const ringPicker = document.createElement('div');
  ringPicker.className = 'ring-color-picker';
  
  // 创建中心按钮
  const centerButton = document.createElement('button');
  centerButton.className = 'center-button';
  centerButton.innerHTML = `
    <svg class="center-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  ringPicker.appendChild(centerButton);
  
  // 创建颜色选项容器
  const colorOptions = document.createElement('div');
  colorOptions.className = 'color-options';
  
  // 添加颜色选项
  colors.forEach((color, index) => {
    const colorOption = document.createElement('div');
    colorOption.className = 'color-option';
    colorOption.style.backgroundColor = color.value;
    colorOption.setAttribute('aria-color', color.label);
    
    // 计算位置（80px半径，更靠近中心）
    const angle = (index * 36) * Math.PI / 180; // 10个选项，每个36度
    const radius = 80; // 减小半径，更靠近中心
    const posX = Math.cos(angle) * radius + 144; // 144是容器中心
    const posY = Math.sin(angle) * radius + 144;
    
    colorOption.style.left = `${posX}px`;
    colorOption.style.top = `${posY}px`;
    
    // 处理颜色选择
    colorOption.addEventListener('click', () => {
      onColorSelect(color.value);
      closeColorPicker();
    });
    
    colorOptions.appendChild(colorOption);
  });
  
  ringPicker.appendChild(colorOptions);
  colorPicker.appendChild(ringPicker);
  
  // 添加到页面
  document.body.appendChild(colorPicker);
  
  // 状态管理
  let isExpanded = false;
  
  // 中心按钮点击事件 - 直接关闭
  centerButton.addEventListener('click', () => {
    closeColorPicker();
  });
  
  // 初始展开 - 自动显示所有颜色选项
  const options = colorOptions.querySelectorAll('.color-option');
  options.forEach((option, index) => {
    setTimeout(() => {
      option.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      option.classList.add('show');
    }, index * 50);
  });
  
  // 关闭函数
  function closeColorPicker() {
    // 收起动画
    const options = colorOptions.querySelectorAll('.color-option');
    options.forEach((option, index) => {
      setTimeout(() => {
        option.style.transition = 'all 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045)';
        option.classList.remove('show');
      }, index * 30);
    });
    
    // 移除元素
    setTimeout(() => {
      if (colorPicker.parentNode) {
        colorPicker.parentNode.removeChild(colorPicker);
      }
    }, 500);
  }
  
  // 点击外部关闭
  function handleOutsideClick(e) {
    if (!colorPicker.contains(e.target)) {
      closeColorPicker();
      document.removeEventListener('click', handleOutsideClick);
    }
  }
  
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 100);
}

// 暴露到全局作用域
window.createVocabCard = createVocabCard;