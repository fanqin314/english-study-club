# 英研社 (English Study Club)

**文章驱动的人工智能英语精读学习工具** — *an article-driven AI deep-reading tool for learning English grammar, vocabulary & language points*

阅读真实英文文章，AI 自动解析词性、语法、知识点与翻译，并通过闪卡、填空、听写、选词等练习模式，在语境中自然积累词汇与语法知识。
*Read real English articles; AI parses parts of speech (POS), grammar structures, language points and translations; then drill words in context with flashcards, cloze, dictation and word-choice exercises — all in your browser, no backend.*

> 🌐 **Language / 语言**: [English README](README.en.md) | 简体中文
>
> **Keywords / 关键词**: english learning · grammar · vocabulary · language points · deep reading · article-driven · AI · LLM · flashcards · spaced repetition · GitHub Pages · static site

<p align="center">
  <img src="assets/screens/desktop-home.png" alt="英研社界面预览 English Study Club UI preview" width="90%" />
</p>

<p align="center">
  <a href="https://fanqin314.github.io/english-study-club/"><strong>在线体验 Demo</strong></a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#核心功能">核心功能</a> ·
  <a href="#技术架构">技术架构</a>
</p>

---

## 为什么是"文章驱动"？

传统背单词脱离语境，记住了单词却不会用。英研社让**一切学习围绕真实文章展开**：
*Memorizing words out of context means knowing the word but not how to use it. English Study Club keeps **every learning activity anchored in real articles**:*

1. 粘贴一篇英文文章，AI 逐句分析词性、语法结构、知识点并翻译 / *Paste an article; AI analyzes each sentence (POS, grammar, language points) and translates it*
2. 阅读中随手标注生词，自动存入生词本 / *Tap any word while reading to save it to your vocabulary notebook*
3. 用闪卡、填空、听写、选词、语境填空多种模式反复练习 / *Practice with flashcards, cloze, dictation, word-choice and gap-fill drills*
4. 用全文回顾、逐句精读、生词测验进行阶段性复习 / *Review via full-text re-reading, sentence-by-sentence deep reading and vocabulary quizzes*
5. 学习统计追踪掌握度，个性化驱动复习计划 / *Learning statistics track mastery and drive review plans*

**阅读是第一优先级，学习功能融入阅读而非打断它。**
*Reading comes first — learning features blend into reading instead of interrupting it.*

---

## 界面预览 / Screenshots

#### 桌面端 Desktop

<p align="center">
  <img src="assets/screens/desktop-home.png" alt="桌面端 · 深度解析 Desktop deep-parse" width="88%" />
  <img src="assets/screens/desktop-memory.png" alt="桌面端 · 记忆模式 Desktop memory modes" width="48%" />
  <img src="assets/screens/desktop-vocab.png" alt="桌面端 · 生词本 Desktop vocabulary" width="48%" />
  <img src="assets/screens/desktop-history.png" alt="桌面端 · 历史记录 Desktop history" width="48%" />
  <img src="assets/screens/desktop-settings.png" alt="桌面端 · 设置 Desktop settings" width="48%" />
</p>

#### 移动端 Mobile

<p align="center">
  <img src="assets/screens/mobile/mobile-home.png" alt="移动端 · 深度解析 Mobile deep-parse" width="24%" />
  <img src="assets/screens/mobile/mobile-memory.png" alt="移动端 · 记忆模式 Mobile memory modes" width="24%" />
  <img src="assets/screens/mobile/mobile-vocab.png" alt="移动端 · 生词本 Mobile vocabulary" width="24%" />
  <img src="assets/screens/mobile/mobile-history.png" alt="移动端 · 历史记录 Mobile history" width="24%" />
</p>

---

## 核心功能

### 人工智能深度解析 / AI Deep Parsing
- **词性分析 Part-of-Speech (POS)**：逐词标注词性并高亮（可自定义高亮配色）/ *per-word POS tagging with customizable highlighting*
- **语法结构 Grammar Structure**：解析句子成分与句型结构 / *sentence constituents & clause-pattern parsing*
- **知识点提取 Language Points**：自动提炼值得记忆的语言点 / *auto-extracted, memorization-worthy notes*
- **逐句 + 全文翻译 Translation**：中文对照理解 / *sentence & full-text Chinese translation*

### 记忆模式（4 种练习）/ Practice Modes (4)
| 模式 Mode | 说明 Description |
|---|---|
| 闪卡模式 Flashcards | 翻转卡片，快速记忆单词 / flip cards for fast memorization |
| 填空练习 Cloze | 语境填空，加深词汇理解 / gap-fill in context |
| 听写练习 Dictation | 听音拼写，强化听写能力 / listen & spell |
| 选词练习 Word Choice | 释义 · 听音 · 选中文 · 填空，多维训练 / definition, audio, translation & fill-in drills |

### 复习模式（3 种方式）/ Review Modes (3)
- **全文回顾 Full-text Review**：沉浸式重读原文，7 种阅读风格可切换（书本 / 杂志 / 报纸 / 可爱 / 像素 / 极简 / 典籍） / *7 reading themes*
- **逐句精读 Sentence Review**：逐句回看分析结果，细嚼慢咽
- **生词测验 Vocab Quiz**：针对生词本出题，检验掌握度

### 词汇管理 / Vocabulary Management
- 多生词本管理，支持合并、删除、重命名 / *multiple notebooks: merge, delete, rename*
- 点击单词即时查词，右键菜单快捷操作 / *click-to-lookup dictionary, right-click shortcuts*
- 单词掌握度分级统计 / *mastery-level statistics per word*

### 数据与生态 / Data & Ecosystem
- **本地文件夹持久化**：数据可保存到本地文件夹，浏览器清缓存也不丢失 / *local-folder persistence (File System Access API)*
- **JSON / TXT / MD 导出**：历史记录与生词本一键导出 / *export history & notebooks with one click*
- **浏览器插件 + Obsidian 插件**：网页划线、视频字幕采集进同一数据闭环 / *browser & Obsidian plugins feed the same data loop*
- **文件上传 / 图片 OCR / 拍照识别**：PDF、Word、图片文字一键导入 / *PDF, Word & OCR import*

### 体验细节 / UX
- 暗色 / 浅色主题切换 dark/light theme
- 全键盘快捷键（ESC 退出、Enter 提交）full keyboard shortcuts
- 响应式布局，桌面端与移动端均可使用 responsive (desktop & mobile)
- 学习进度在模式卡片上实时可见 live progress on mode cards

---

## 快速开始

### 在线体验（零配置）

直接访问 **https://fanqin314.github.io/english-study-club/** 即可使用。
项目内置默认 AI API Key，打开就能体验深度解析，无需任何配置。
*A default AI API key is bundled — open the demo and try deep parsing immediately, no setup needed.*

### 本地运行

```bash
git clone https://github.com/fanqin314/english-study-club.git
cd english-study-club

# 方式一：直接用浏览器打开（纯静态应用，无需构建）/ Option 1: open index.html directly (pure static app, no build)
open index.html

# 方式二：本地静态服务器（推荐，避免 CORS 问题）/ Option 2: local static server (recommended, avoids CORS)
python -m http.server 8080
# 访问 http://localhost:8080
```

### 配置自定义 API（可选）

1. 点击右上角**设置**按钮 / click the **Settings** button
2. 填入 Base URL、API Key、模型名称 / fill in Base URL, API Key and model name
3. 保存后即可使用自己的 AI 服务（默认已内置可用的默认 Key）/ *bring your own LLM; a working default key is bundled*

---

## 技术架构

### 设计理念

- **纯前端 Pure front-end**：无后端依赖，HTML + CSS + 原生 JavaScript（ES6+），可部署到 GitHub Pages / *no backend — deployable to GitHub Pages*
- **模块化架构 Modular**：ModuleRegistry 模块注册系统 + EventBus 事件总线，组件彻底解耦
- **可扩展 Extensible**：新增功能只需创建模块 → 注册 → 接入 UI，不影响既有功能

### 目录结构

```
english-study-club/
├── index.html                 # 主页面（应用入口）main entry
├── core/                      # 核心基础设施 core infrastructure
│   ├── module_registry.js     # 模块注册系统 module registry
│   ├── event_bus.js           # 事件总线（模块通信）event bus
│   ├── api_request.js         # AI API 请求（重试/缓存/错误处理）AI request layer
│   ├── local_file_storage.js  # 本地文件夹持久化（File System Access API）
│   ├── security.js            # 安全与 API Key 处理 security & API keys
│   └── cache.js               # 解析结果缓存 analysis cache
├── features/                  # 业务功能模块 features
│   ├── deep_parse/            # 深度解析（词性/语法/知识点/翻译）deep parsing
│   ├── memory_mode/           # 记忆与复习模式 practice & review
│   ├── vocabulary/            # 生词本 vocabulary notebook
│   ├── history/               # 历史记录 history
│   ├── file_upload/           # 文件上传 / OCR / 拍照 import & OCR
│   └── stats_tracker.js       # 学习统计 learning stats
├── modules/                   # 业务逻辑模块 business logic
│   ├── analysis/              # 文章分析 article analysis
│   └── dictionary/            # 词库服务 dictionary service
├── ui/                        # 界面层 UI layer
│   ├── main_button.js         # 主按钮（深度解析/生词本/历史）
│   ├── event_delegation.js    # 事件委托 event delegation
│   └── settings/              # 设置面板（API/主题/导出/存储）settings panel
├── mobile/                    # 移动端应用（响应式 PWA，与桌面端共享数据）
│   ├── index.html             # 移动端入口（<769px 自动跳转）mobile entry
│   ├── css/theme.css          # 移动端主题样式 mobile theme
│   └── js/                    # Store / API / UI + views（home·memory·vocab·history·settings）
└── assets/                    # 样式与静态资源（CSS 变量主题体系 + 截图）styles, assets & screenshots
```

### 模块注册示例

```javascript
ModuleRegistry.register('MyModule', ['EventBus'], function (EventBus) {
    // 模块实现 module implementation
    return { /* 公开接口 public API */ };
});
```

### 事件通信示例

```javascript
// 发送事件 emit
EventBus.emit('analysis.completed', { articleId: 'xxx' });

// 监听事件 listen
EventBus.on('analysis.completed', function (data) {
    // 处理 handle
});
```

---

## 开发指南

### 添加新功能

1. 在 `features/` 下创建功能目录与 JS 文件 / *create a feature dir under `features/`*
2. 通过 `ModuleRegistry.register()` 注册模块 / *register via `ModuleRegistry.register()`*
3. 在 `index.html` 中添加 `<script>` 引用 / *add the `<script>` tag in `index.html`*
4. 使用 `EventBus` 与既有模块通信 / *communicate via `EventBus`*

### 代码规范

- ES6+ 语法，JSDoc 注释
- UI 图标一律使用 SVG（禁止 emoji）
- 颜色统一走 CSS 变量（`assets/css/variables.css`），支持暗色模式
- 事件监听使用 `addEventListener` + `_cleanupFns` 清理，避免内存泄漏
- 交互元素需防重入保护

---

## 贡献指南

欢迎提交 Issue 和 Pull Request 改进项目。建议先阅读 [ARCHITECTURE.md](ARCHITECTURE.md) 了解模块化设计。
*Issues and PRs welcome — please read [ARCHITECTURE.md](ARCHITECTURE.md) first.*

## 许可证

MIT License
