# 英研社 · 移动端（mobile/）

手机端界面代码，依据设计稿「深度解析 等 5 个设计」还原。界面元素与功能逻辑**完全对齐**：每个页面、组件、交互元素都有对应的处理函数、状态管理与事件绑定，视觉呈现与后端行为一致。

> 纯前端静态 SPA，无构建步骤，直接用浏览器打开 `index.html` 即可（建议用本地静态服务器，如 `python -m http.server`）。离线时图标（lucide CDN）不显示，但布局与全部功能不受影响。

---

## 1. 架构总览

```
mobile/
├─ index.html              # 应用外壳：5 个空视图容器 + 底部全局导航 + toast
├─ css/theme.css           # 自包含设计系统（study-* 令牌 + .esc-* 组件类）
└─ js/
   ├─ ui.js                # 共享辅助：转义 / 图标 / toast / 确认
   ├─ store.js             # 本地数据层（localStorage + 事件总线）
   ├─ api.js               # AI 深度解析（与桌面端后端行为对齐）
   ├─ speech.js            # 发音封装（Web Speech API）
   ├─ router.js            # 视图路由 + 底部导航状态
   ├─ app.js               # 引导：应用偏好 + 初始化路由
   └─ views/
      ├─ home.js           # 深度解析（首页）
      ├─ vocab.js          # 生词本
      ├─ history.js        # 历史记录
      ├─ memory.js         # 记忆模式
      └─ settings.js       # 设置
```

**模块加载顺序（依赖关系）**：`ui → store → api → speech → router → 5 个 view → app`。
所有模块统一挂在 `window.Mobile` 命名空间（移动端独立，不引用桌面端的 ModuleRegistry/EventBus）。

**设计系统**：`theme.css` 用 `study-*` CSS 变量定义浅/深色主题与字体档位（`data-theme`、`data-fontsize`），所有组件用 `.esc-*` 类实现（不依赖 Tailwind 运行时，保证离线动态渲染可靠）。

---

## 2. 全局外壳与路由

### 2.1 应用外壳（`index.html`）

| 结构 | 元素 | 说明 |
|------|------|------|
| 视图容器 | `section.esc-view[data-view="home\|vocab\|history\|memory\|settings"]` ×5 | 初始全部 `hidden`，由路由切换可见性 |
| 底部导航 | `nav.esc-nav[data-mobile-nav="global"]` | 5 个 `<a data-nav-key>` 链接，lucide 图标 |
| 轻提示 | `#esc-toast` | 全局 toast 容器 |

### 2.2 路由（`router.js`）

| 项目 | 内容 |
|------|------|
| 导出对象 | `Mobile.Router = { go(key, params), init(), current }` |
| 状态 | `current`（当前视图 key，getter 只读） |
| 核心函数 | `go(key, params)`：切换视图可见性（`hidden`）、更新导航 `is-active`、滚动复位、调用 `Mobile.Views[key].render(container, params)`、写 `location.hash` |
| 导航绑定 | `init()` 中给所有 `[data-nav-key]` 绑定 click → `go(key)`；给 `[data-action="go-settings"]` 绑定 click → `go('settings')` |
| 深链 | 启动时读取 `location.hash`（`#/home` 等）决定初始视图，无效则回退 `home` |
| 容错 | `render` 抛错时显示「页面渲染出错」兜底卡片 |

### 2.3 引导（`app.js`）

| 函数 | 作用 |
|------|------|
| `applyPrefs()` | 读取 `Store.getSettings()`，写 `data-theme`（深色）与 `data-fontsize`（字体大小）到 `<html>` |
| `boot()` | `applyPrefs()` → 订阅 `Store.on('settings', applyPrefs)`（设置变化即时生效）→ `Router.init()` |
| 启动时机 | `DOMContentLoaded` 或立即（若已就绪） |

---

## 3. 数据层与基础设施

### 3.1 本地数据层（`store.js`）—— `Mobile.Store`

移动端只是桌面端的「另一种界面」——两者读写**完全相同的 localStorage 数据**，设置与数据天然一致。

**与桌面端共享的存储键（数据打通的核心）**：

| 数据 | 存储键 | 说明 |
|------|--------|------|
| 生词本 | `vocabData` | 桌面端多生词本结构 `{notebooks, currentNotebookId}`，移动端自动展平 |
| 历史记录 | `analysis_history` | 桌面端结构 `{id,originalText,fullTranslation,sentences,sentenceData,savedAt}` |
| 深色模式 | `darkMode` | `'true'/'false'` 明文，与桌面端一致 |
| API 凭证 | `encrypted_api_key` / `encrypted_api_base` / `encrypted_model_name` | 与 `core/security.js` 相同的 `btoa(encodeURIComponent())` 混淆方案 |
| 进度统计 | `stats_streak_days` / `stats_today_learned` / `stats_total_learned` / `stats_mastered_words` / `stats_module_data` | 连胜天数/今日已学/累计已学/已掌握数/各模块活动量，均为「计数器累加」（对齐桌面端 StatsTracker，非按单词 status 重算） |
| 每日目标 | `dailyWordGoal` | 每日目标词数（对齐桌面端 learning_plan_ui.js 键名；旧 `esc.settings.dailyGoal` 作回退） |
| 移动端独有偏好 | `esc.settings` | 仅移动端用：解析模式/自动发音/自动收藏/字号/资料（每日目标已改用 `dailyWordGoal`） |
| 移动端独有进度 | `esc.progress` | 仅移动端用：正确率/待复习（桌面端无对应字段） |

> 启动时执行一次性迁移：若桌面端键为空且旧 `esc.vocab`/`esc.history` 有数据，自动导入，避免历史数据丢失。

**事件总线**：`on(evt, cb)` / `off(evt, cb)` / `emit(evt, payload)`。事件名：`'vocab'` `'history'` `'settings'` `'progress'`。

| 域 | 函数 | 行为 |
|----|------|------|
| 生词 | `getVocab()` | 读取生词列表（默认 `[]`）；VM 含 `meaning`（=桌面端 `meaning` 别名）无 `status` |
| | `addWord(w)` | 同词（忽略大小写）不重复；新增写入桌面端 `vocabData.word` 结构；触发 `vocab` |
| | `removeWord(id)` | 删除；触发 `vocab` |
| | `getWord(id)` | 按 id 查词 |
| 历史 | `getHistory()` / `addHistory(rec)` | 新增含 `id/date`（今日）；触发 `history` |
| | `getHistoryItem(id)` / `removeHistory(id)` | 查/删；删除触发 `history` |
| 设置 | `getSettings()` / `updateSettings(partial)` | 与默认合并；`dailyGoal` 读写 `dailyWordGoal` 桌面端键；写后触发 `settings` |
| 进度读取 | `getProgress()` | 合并桌面端 `stats_*`（todayCount/totalLearned/masteredCount/streak）+ 移动端独有 `correctRate/reviewDue`；只读不覆盖计数器 |
| 进度累加 | `recordWordsLearned(n)` | 等价于桌面端 `StatsTracker.recordWordsLearned`：今日已学 + 累计已学 同时累加 |
| | `recordWordsMastered(n)` | 等价于 `recordWordsMastered`：已掌握全局计数器累加（桌面端无按单词掌握状态） |
| | `recordModuleActivity(key,n)` | 等价于 `recordModuleActivity`：按桌面端 `MODULE_META` 名记录今日模块活动量到 `stats_module_data` |
| | `updateProgress(partial)` | 仅写移动端独有进度（正确率/待复习）；触发 `progress` |
| 维护 | `exportAll()` | 返回 `{vocab,history,settings,progress,exportedAt}` |
| | `clearCache()` | 仅清生词+历史（保留设置/进度）；触发 `vocab`/`history` |
| | `resetAll()` | 清全部键并触发所有事件 |

**默认设置（SETTINGS_DEFAULT）**：`apiKey:''`、`baseUrl:'https://api-inference.modelscope.cn/v1'`、`model:'Qwen/Qwen3.5-35B-A3B'`、`dailyGoal:20`、`parseMode:'deep'`、`autoPronounce:true`、`autoCollect:true`、`darkMode:false`、`fontSize:'medium'`、`profileName:'英语学习者'`、`profileEmail:'learner@example.com'`。
**默认进度（PROGRESS_DEFAULT）**：`streak:7`、`todayCount:12`、`masteredCount:89`、`correctRate:78`、`reviewDue:15`。

### 3.2 AI 解析（`api.js`）—— `Mobile.API`

与桌面端「深度解析」后端行为对齐：`POST {baseUrl}/chat/completions`、`Bearer {apiKey}`、模型 `Qwen/Qwen3.5-35B-A3B`、`chat_template_kwargs.enable_thinking:false`。无 Key / 网络失败 / 解析失败时**优雅降级**为示例解析（`demo:true`），界面始终可用（与桌面端 offline 降级策略一致）。

| 导出 | 说明 |
|------|------|
| `parse(text)` | → `{sentences, stats, demo, error?}`；空输入 `error:'EMPTY'`、无 Key `error:'NO_KEY'`、请求失败 `error:PARSE_FAIL` 并回退 |
| `hasKey()` | 是否有有效 `apiKey` |
| `computeStats(text)` | 计算单词数 / 句子数 / 阅读分钟数 |
| `DEFAULT_MODEL` / `SAMPLE_SENTENCES` | 模型常量 / 3 条内置示例句（对齐设计稿） |

- `buildPrompt(text, fast)`：深度模式要求词性、语法点；快速模式仅切分+翻译+句类。
- `requestReal()`：真实请求，60s 超时（AbortController），从模型返回稳健提取 JSON（`extractJSON` 容错）。
- `demoParse(text)`：无 Key 或失败时返回示例/启发式解析。

### 3.3 发音（`speech.js`）—— `Mobile.Speech`

| 导出 | 说明 |
|------|------|
| `speak(text, opts)` | `SpeechSynthesisUtterance`，优先选英文 voice，`rate:0.95`；返回 bool |
| `stop()` | 取消当前发音 |
| `supported()` | 浏览器是否支持 `speechSynthesis` |

### 3.4 共享 UI（`ui.js`）—— `Mobile.UI`

| 函数 | 说明 |
|------|------|
| `esc(s)` | HTML 转义（防 XSS，用户输入/解析结果统一走它） |
| `icon(name, cls)` | 生成 `<i data-lucide>`，渲染后需 `refreshIcons()` |
| `refreshIcons()` | 调 `lucide.createIcons()` 全局刷新图标（已转换的 `<i>` 不会重复） |
| `toast(msg)` | 顶部轻提示，2.6s 自动消失 |
| `confirmDialog(msg)` | 移动端友好确认（包裹 `confirm`） |

---

## 4. 页面 · 组件 · 交互 → 处理函数 / 状态 / 事件 对照表

### 4.1 深度解析（home · 底部导航「深度解析」）

**状态**：`state = { text:'', parsing:false }`（模块级闭包，跨渲染保留输入）。

| 组件 | 交互元素（id / 选择器） | 处理函数 | 事件绑定 | 状态/副作用 |
|------|------------------------|----------|----------|-------------|
| 顶部栏 | `button[data-action="go-settings"]` | 路由 → `go('settings')` | click | — |
| 输入面板 | `textarea#m-input` | `bind` 内 input 监听 | `input` | `state.text = value` |
| 上传文件 | `#m-upload` + 隐藏 `#m-file` | FileReader 读文本 | click→`fileInput.click()`；`change`→读入 `state.text` + toast | `state.text` 更新 |
| 开始解析 | `#m-parse` | `doParse(root)` | click | 置 `parsing`，禁用按钮，显示 loading |
| 示例文章 | `#m-sample` | 填入 `SAMPLE_TEXT` | click | `state.text = SAMPLE_TEXT` |
| 剪贴板导入 | `#m-paste` | `navigator.clipboard.readText()` | click（async） | 读入 `state.text`；失败时 toast 引导手动粘贴 |
| 统计条 | `#m-stats` | `statsHTML(res.stats)` | 解析后填充 | 单词/句子/阅读时间 |
| 逐句解析卡 | `#m-cards` + `.esc-sentence` | `sentenceCard()`：英文句子拆成可点按单词 + 4 个动作按钮（词性/语法结构/知识点/翻译）各展开对应面板 | 解析后绑单词点按与面板单开切换、词性标签发音 | `Speech.speak` / 底部弹层 / 面板切换 |
| ├ 单词点按 | `.esc-sw[data-word]` | `sentenceEnHTML(s)` 拆词 + 绑 click | 点单词发音 + 弹「加入生词本」底部弹层（选本/新建本，已在本内打勾） | `Speech.speak(word)` → `openWordSheet` → `Store.addWordToNotebook` / `Store.createNotebook` |
| ├ 词性面板 | `.esc-spanel[data-panel="pos"]` | `posHTML(s)` | 预渲染（含 `words`） | 标签点按发音 |
| ├ 语法结构面板 | `.esc-spanel[data-panel="syntax"]` | `syntaxHTML(s)` | 预渲染（含 `syntax` 结构化对象） | 结构/功能/句式徽章 + 综合描述 + 从句/成分 |
| ├ 知识点面板 | `.esc-spanel[data-panel="knowledge"]` | `knowledgeHTML(s)` | 预渲染（含 `knowledge` 文本） | 自由文本，保留换行 |
| └ 翻译面板 | `.esc-spanel[data-panel="translation"]` | `translationHTML(s)` | 预渲染（含 `zh`） | 中文翻译 |
| 自动收藏 | — | 遍历 `res.sentences[].words` | 解析后（受 `autoCollect` 控制） | `Store.addWord(...)` → 触发 `vocab`（加入当前生词本） |
| 写入历史 | — | 按文本去重后 `Store.addHistory` | 解析后 | 触发 `history` |

> 逐句卡片对齐桌面端「深度解析」：`API.parse` 在深度模式下除 `en/zh/type/words/grammar` 外，额外返回每句 `syntax`（结构化语法分析：结构/功能/句式/综合描述/从句/成分）与 `knowledge`（知识点文本）；卡片由「全内联」改为桌面式 **4 个可展开面板**（单一展开，点击同一切换）。快速模式（`parseMode:'fast'`）仅返回 `en/zh/type/words`，面板显示对应空态提示。`SAMPLE_SENTENCES` 与离线 `demoParse` 均已补齐这两项字段。
>
> **单词点按交互**（对齐桌面端点单词加入生词本）：`sentenceEnHTML` 把英文句子按词拆分，仅字母开头的 token 渲染为可点按 `.esc-sw`（标点/空格原样保留），`data-word/pos/meaning` 来自解析结果的 `words` 映射。点击单词 → 发音（`Speech.speak`）+ 弹出底部弹层 `openWordSheet`：列出所有生词本（已含该词的本显示「✓ 已添加」并高亮），点本即 `Store.addWordToNotebook` 加入；底部「+ 新建生词本」可内联输入名称并 `Store.createNotebook` 后加入。弹层为移动端原生底部抽屉（`.esc-bsheet`），等价桌面端单词气泡。自动收藏（`autoCollect`）仍默认加入当前生词本，与手动点按互不冲突。

`doParse` 流程：`text` 校验 → 设 `parsing` → 调 `API.parse(text)` → 渲染统计与句子卡 → 绑英文发音与面板切换 →（按 `autoCollect`）收藏生词 →（去重）写历史 → `refreshIcons`。

### 4.2 生词本（vocab · 底部导航「生词本」）

**状态**：`state = { filter:'all', search:'' }`；`rootEl` 缓存当前容器（用于事件刷新）。

| 组件 | 交互元素 | 处理函数 | 事件绑定 | 状态/副作用 |
|------|----------|----------|----------|-------------|
| 总数徽章 | `#m-vocab-badge` | `paint()` | 数据变化时刷新 | `共 N 词` |
| 统计卡 | `#m-vocab-stats` | `paint()` | — | 今日/待复习/已掌握 + 进度条 |
| 搜索框 | `#m-vocab-search` | `state.search = v; paint()` | `input` | 实时过滤 |
| 筛选标签 | `.esc-tab[data-f=all\|alpha]` | 切换 `is-active` + `state.filter` | click | `paint()` 重渲染列表 |
| 单词卡 | `.esc-word[data-id]` | `wordCard(w)` | 卡片内绑事件 | — |
| └ 发音 | `[data-act="pron"]` | `Store.getWord(id)` → `Speech.speak` | click（`stopPropagation`） | — |
| 空状态 | — | `paint()` 内判断 | — | 无生词时提示去解析 |

> 生词本**无「标记掌握」操作**：桌面端不维护按单词的掌握状态，「已掌握」是全局累加计数器（`stats_mastered_words`），由记忆模式完成时累加。移动端与之一致，故移除了原 `toggleWordStatus` 与标记掌握按钮。

**自动刷新**：`Store.on('vocab', () => { if (rootEl && !rootEl.hidden) paint(); })` —— 首页自动收藏后，生词本打开时即时同步。
`filtered(list)` 支持：关键词搜索、按字母排序。

### 4.3 历史记录（history · 底部导航「历史记录」）

**状态**：`state = { order:'recent' }`；`rootEl` 缓存容器。

| 组件 | 交互元素 | 处理函数 | 事件绑定 | 状态/副作用 |
|------|----------|----------|----------|-------------|
| 筛选按钮 | `#m-hist-filter` | 切换 `state.order` | click | `recent` ↔ `oldest`，toast 提示，`paint()` |
| 统计条 | `#m-hist-stats` | `paint()` | — | 共解析/本周/总词数 |
| 历史卡 | `.esc-history[data-id]` | `historyCard(h)` | 卡内绑事件 | — |
| ├ 查看解析 | `[data-act="view"]` | `Store.getHistoryItem(id)` → `Router.go('home',{text})` | click（`stopPropagation`） | 带文本跳首页 |
| └ 开始复习 | `[data-act="review"]` | `Router.go('memory')` | click（`stopPropagation`） | 跳记忆模式 |
| 卡片本体点击 | `.esc-history` | 同「查看解析」 | click | 跳首页带文本 |
| 空状态 | — | `paint()` 内判断 | — | 无历史提示去解析 |

**自动刷新**：`Store.on('history', () => { if (rootEl && !rootEl.hidden) paint(); })`。

### 4.4 记忆模式（memory · 底部导航「记忆模式」）

**数据来源**：`Store.getProgress()` + `Store.getSettings().dailyGoal`（读取桌面端 `dailyWordGoal`）。
**练习队列**：单词练习用 `buildWordQueue()`（取生词前 10，无生词用 `FALLBACK`；桌面端不区分「已掌握」，故不再按 status 排序）；文章练习按模式用 `buildArticleClozeQueue` / `buildArticleVocabQueue` / `splitSentences` 从所选历史文章生成。

| 组件 | 交互元素 | 处理函数 | 事件绑定 | 状态/副作用 |
|------|----------|----------|----------|-------------|
| 连续学习徽章 | `.esc-badge` | `render` 内渲染 | — | `streak` 天 |
| 进度环 | SVG `stroke-dashoffset` | `render` 内计算 | — | 今日/目标百分比 |
| 单词/文章 标签 | `#m-mmtabs button[data-tab]` | `selectTab(name)` | click | 切换 单词/文章 内容区（保留 `currentTab`） |
| 生词本卡片 | `.esc-nbcard` | `render` 内 | — | 显示默认生词本与词数 |
| 单词模式网格 | `.esc-mode[data-mode]`（word）×4 | `openExercise(mode)` | click | 闪卡/填空/听写/选词 |
| 文章选择器 | `#m-art`（select） | change → `selectedArticleId` | change | 选定复习文章 |
| 文章模式网格 | `.esc-mode[data-mode]`（article）×4 | `openExercise(mode)` | click | 语境填空/全文回顾/逐句精读/生词测验 |
| 快速统计 | `.esc-grid-3`（页内） | `render` 内 | — | 待复习/已掌握/正确率 |

**练习弹层（overlay）引擎**：

| 函数 | 作用 |
|------|------|
| `openExercise(mode)` | 依模式建队列（单词队列 / 文章队列），建 `session={mode,ctx,queue,idx,correct,total,graded}`，建 `.esc-overlay` 挂到 `.esc-app`，绑关闭，调 `step()` |
| `step()` | 按 `session.mode` 分派到对应渲染器（见下表） |
| `next()` | `idx++`，到末尾调 `finish()`，否则 `step()` |
| `finish()` | 计分模式：计算正确率，按桌面端语义累加进度——`Store.recordWordsLearned(已完成数)`（今日已学+累计已学）、`Store.recordWordsMastered(答对)`（已掌握全局计数器）、`Store.recordModuleActivity(MODULE_MAP[mode], 已完成数)`（记录模块活动量，对齐 `MODULE_META`），最后 `Store.updateProgress({correctRate,reviewDue})`（仅写移动端独有进度）；非计分模式（逐句/回顾）额外记一次 `recordModuleActivity` 后显示完成；点击「完成」关闭 |
| `closeOverlay()` | 移除 overlay，清 `session`；**点击底部导航离开时亦自动关闭**（修复残留） |

| 模式 | 标签 | 渲染函数 | 交互 | 计分 |
|------|------|----------|------|------|
| 闪卡 | 单词 | `renderFlash` | 点击卡片翻转释义；`[data-act="yes"]`/`[data-act="no"]` | yes：`total++ correct++`；no：`total++` |
| 填空 | 单词 | `renderCloze` | 例句挖空，输入单词，提交（按钮或回车） | 大小写不敏感判等 |
| 听写 | 单词 | `renderDictation` | 自动播发音，可重播，输入拼写提交（按钮或回车） | 同上 |
| 选词 | 单词 | `renderChoice` | 4 选项 click（含原文词义与 3 个随机干扰），标对错，0.8s 后 `next` | 对：`total++ correct++` |
| 语境填空 | 文章 | `renderCloze` | 文章含生词句挖空，输入该生词，提交 | 大小写不敏感判等 |
| 生词测验 | 文章 | `renderChoice` | 文章中出现过的生词释义选词 | 对：`total++ correct++` |
| 逐句精读 | 文章 | `renderArticleSentence` | 逐句展示，上/下一句 | 不计分 |
| 全文回顾 | 文章 | `renderArticleReview` | 展示所选文章全文（只读） | 不计分 |

### 4.5 设置（settings · 底部导航「设置」）

**状态**：全部来自 `Store.getSettings()`，写后即时持久化+部分即时生效。

| 组件 | 交互元素 | 处理函数 | 事件绑定 | 状态/副作用 |
|------|----------|----------|----------|-------------|
| 编辑资料 | `#m-set-edit` | `prompt` 改昵称 | click | `updateSettings({profileName})` → toast + 就地更新 |
| 每日目标 | `[data-act="goal-minus"]`/`goal-plus` | `setGoal(±5)`（限 5~100） | click | `updateSettings({dailyGoal})` + 文本更新 |
| 解析模式 | `#m-set-mode button[data-v]` | 切换 `is-active` | click | `updateSettings({parseMode})` |
| 自动发音 | `#m-set-pron` | change | `change` | `updateSettings({autoPronounce})` |
| 生词自动收藏 | `#m-set-collect` | change | `change` | `updateSettings({autoCollect})` |
| 深色模式 | `#m-set-dark` | change → `applyTheme` | `change` | `updateSettings({darkMode})` + 即时切主题 |
| 字体大小 | `#m-set-font button[data-v=small\|medium\|large]` | 切换 `is-active` → `applyFont` | click | `updateSettings({fontSize})` + 即时换档 |
| 导出数据 | `[data-act="export"]` | `exportData()` | click | 下载 `yingyanshe-data.json` |
| 清除缓存 | `[data-act="clear"]` | `confirmDialog` → `Store.clearCache()` | click | 保留设置 |
| 重置所有 | `[data-act="reset"]` | `confirmDialog` → `Store.resetAll()` | click | 重置后 `location.reload()` |
| 关于链接 | `[data-act="about"]`/`about-app` | toast 演示 | click | — |

**即时生效链路**：`app.js` 中 `Store.on('settings', applyPrefs)` 订阅，设置页任何 `updateSettings` 都会触发全局主题/字体重应用；深色与字体大小额外在控件 `change`/`click` 时同步调用 `applyTheme/applyFont` 立即可见。

---

## 5. 视觉 ↔ 逻辑对齐要点

- **导航高亮**：`router.setNavActive` 依据 `data-nav-key` 切换 `.is-active`，CSS 用 `study-primary` 着色当前项（含 `.esc-nav-item svg` 尺寸与颜色规则）。
- **主题/字体**：`<html data-theme/data-fontsize>` 驱动全部 `study-*` 令牌；设置页开关即时改属性 → 全应用换肤。
- **数据驱动渲染**：生词本/历史/记忆进度均由 `Store` 读取并 `render`，事件总线保证跨页一致（如首页解析自动收藏 → 生词本打开即刷新）。
- **降级一致性**：无 API Key 时 `API.parse` 返回 `demo` + `error:'NO_KEY'`，首页 toast 提示但仍渲染示例解析，与桌面端「离线提示」降级策略一致。
- **安全**：所有用户输入与模型返回经 `UI.esc()` 转义后插入 DOM，杜绝 XSS。

---

## 6. 运行与发布

```bash
# 本地预览（在 mobile/ 目录）
cd mobile
python -m http.server 8080
# 浏览器打开 http://localhost:8080

# 首次使用：进入「设置」填写 ModelScope API Key 即可启用真实 AI 解析；
# 不填则自动使用内置示例解析，所有界面功能仍可完整演示。
```

仓库根已配置 GitHub Pages，可直接将 `mobile/` 作为静态站点发布（无需构建）。
