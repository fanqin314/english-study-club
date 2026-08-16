# 英研社 - 项目结构分析文档

## 项目概述

**英研社** 是一个基于模块化架构的英语学习Web应用，通过AI技术提供词性分析、语法结构解析、知识点提取、翻译等功能，帮助用户深入理解英文文章。

**技术特点：**
- 采用模块化架构设计，通过模块注册系统和事件总线实现组件间解耦
- 支持Capacitor构建跨平台移动应用
- 提供完整的深度解析、词汇管理、历史记录等功能

---

## 目录结构树

```
英研社/
├── .trae/                              # Trae IDE 配置目录
│   └── specs/                          # 规格文档
│       ├── deep-parse-two-column-layout/
│       │   ├── checklist.md            # 检查清单
│       │   ├── spec.md                 # 规格说明
│       │   └── tasks.md                # 任务列表
│       └── interface-space-optimization/
│           ├── checklist.md            # 检查清单
│           └── tasks.md                # 任务列表
├── android/                            # Android 平台目录
│   ├── .idea/
│   │   └── .gitignore
│   ├── app/
│   │   └── .gitignore
│   └── .gitignore
├── assets/                             # 静态资源目录
│   └── style.css                       # 全局样式文件
├── backup_20260428/                    # 备份目录 (2026-04-28)
│   ├── flashcard_ui.js                 # 闪卡UI备份
│   ├── history.js                      # 历史记录备份
│   └── index.html                      # 主页备份
├── core/                               # 核心模块目录
│   ├── README.md                       # 核心模块说明
│   ├── api_request.js                  # API请求封装
│   ├── base_analysis_button.js         # 分析按钮基类
│   ├── cache.js                        # 缓存管理
│   ├── code_quality.js                 # 代码质量检测
│   ├── di_container.js                 # 依赖注入容器
│   ├── error_handler.js                # 统一错误处理
│   ├── event_bus.js                    # 事件总线系统
│   ├── extension_manager.js            # 扩展管理器
│   ├── global_manager.js               # 全局对象管理
│   ├── module_interface_spec.js        # 模块接口规范
│   ├── module_registry.js              # 模块注册系统
│   ├── performance.js                  # 性能优化工具
│   ├── security.js                     # 安全工具
│   ├── service_registration.js         # 服务注册
│   └── utils.js                        # 通用工具函数
├── features/                           # 功能特性目录
│   ├── deep_parse/                     # 深度解析功能
│   │   ├── full_translation/           # 全文翻译
│   │   │   └── full_translation_logic.js
│   │   ├── pos_highlight/              # 词性高亮
│   │   │   ├── add_all_pos.js          # 添加所有词性
│   │   │   ├── highlight_controller.js # 高亮控制器
│   │   │   ├── highlight_render.js     # 高亮渲染
│   │   │   ├── highlight_service.js    # 高亮服务
│   │   │   ├── highlight_settings.js   # 高亮设置
│   │   │   ├── highlight_switch.js     # 高亮开关
│   │   │   └── pos_highlight.css       # 词性高亮样式
│   │   └── sentence_analysis/          # 句子分析
│   │       ├── knowledge_button.js     # 知识点按钮
│   │       ├── pos_button.js           # 词性分析按钮
│   │       ├── sentence_card_render.js # 句子卡片渲染
│   │       ├── sentence_translate_button.js
│   │       ├── split.js                # 文本分割
│   │       └── syntax_button.js        # 语法分析按钮
│   ├── history/                        # 历史记录功能
│   │   ├── history_analysis_renderer.js
│   │   ├── history_data.js             # 历史数据管理
│   │   ├── history_detail_ui.js        # 历史详情UI
│   │   └── history_list_ui.js          # 历史列表UI
│   └── vocabulary/                     # 词汇管理功能
│       ├── memory_mode/                # 记忆模式
│       │   ├── flashcard_mode/         # 闪卡模式
│       │   │   ├── flashcard_mode.css  # 闪卡样式
│       │   │   ├── flashcard_mode.js   # 闪卡模式逻辑
│       │   │   └── flashcard_ui.js     # 闪卡UI
│       │   ├── learning_plan/          # 学习计划
│       │   │   └── learning_plan_ui.js # 学习计划UI
│       │   └── learning_stats/         # 学习统计
│       │       └── learning_stats_ui.js
│       ├── notebook_tab_ui.js          # 生词本标签页UI
│       ├── vocab_card.js               # 词汇卡片
│       ├── vocab_data.js               # 词汇数据管理
│       ├── vocab_ui.js                 # 词汇UI
│       └── word_context_menu.js        # 单词右键菜单
├── modules/                            # 业务模块目录
│   ├── analysis/                       # 分析模块
│   │   ├── deep_parse.js               # 深度解析核心
│   │   └── sentence_detail_handler.js  # 句子详情处理器
│   ├── dictionary/                     # 字典模块
│   │   ├── dict.js                     # 词库服务
│   │   └── dict.json                   # 词库数据
│   └── README.md                       # 模块说明
├── test/                               # 测试目录
│   └── optimization_evaluation.js      # 优化评估测试
├── ui/                                 # 用户界面目录
│   ├── second_row/                     # 第二行操作
│   │   ├── load_example.js             # 加载示例
│   │   ├── reload_button.js            # 重新加载按钮
│   │   └── save_analysis.js            # 保存分析
│   ├── settings/                       # 设置界面
│   │   ├── api_config.js               # API配置
│   │   ├── dark_mode.js                # 暗黑模式
│   │   └── settings_ui.js              # 设置UI
│   ├── vocabulary/                     # 词汇界面
│   │   └── vocab_button.js             # 词汇按钮
│   ├── README.md                       # UI说明
│   └── main_button.js                  # 主按钮管理
├── www/                                # Web部署目录 (Capacitor)
│   ├── assets/                         # Web资源
│   ├── core/                           # Web核心模块
│   ├── features/                       # Web功能模块
│   ├── modules/                        # Web业务模块
│   ├── ui/                             # Web界面组件
│   ├── history.js                      # Web历史记录
│   └── index.html                      # Web入口页面
├── README.md                           # 项目说明文档
├── capacitor.config.json               # Capacitor配置
├── index.html                          # 主入口页面
└── package-lock.json                   # 依赖锁定文件
```

---

## 目录详细说明

### 1. .trae/

**功能定位：** Trae IDE 的项目配置和规格文档目录

| 文件/目录 | 说明 |
|-----------|------|
| `specs/deep-parse-two-column-layout/` | 深度解析双栏布局规格 |
| `specs/interface-space-optimization/` | 界面空间优化规格 |

---

### 2. android/

**功能定位：** Capacitor Android 平台相关文件，用于构建Android原生应用

| 文件/目录 | 说明 |
|-----------|------|
| `.idea/` | Android Studio配置 |
| `app/` | Android应用源代码目录 |

---

### 3. assets/

**功能定位：** 全局静态资源目录

| 文件 | 说明 |
|------|------|
| `style.css` | 全局样式文件，定义应用基础样式和主题变量 |

---

### 4. backup_20260428/

**功能定位：** 项目备份目录，包含2026年4月28日的关键文件备份

| 文件 | 说明 |
|------|------|
| `flashcard_ui.js` | 闪卡UI组件备份 |
| `history.js` | 历史记录模块备份 |
| `index.html` | 主页备份 |

---

### 5. core/

**功能定位：** 核心模块目录，提供应用基础架构和工具服务

| 文件 | 功能说明 |
|------|----------|
| `README.md` | 核心模块说明文档 |
| `api_request.js` | API请求封装，处理所有与后端API的通信 |
| `base_analysis_button.js` | 分析按钮基类，提供按钮通用功能 |
| `cache.js` | 缓存管理器，统一管理句子解析缓存、全文翻译缓存 |
| `code_quality.js` | 代码质量检测工具 |
| `di_container.js` | 依赖注入容器，管理模块依赖关系 |
| `error_handler.js` | 统一错误处理，提供用户友好的错误提示 |
| `event_bus.js` | 事件总线系统，实现模块间的解耦通信 |
| `extension_manager.js` | 扩展管理器，管理应用扩展功能 |
| `global_manager.js` | 全局对象管理器，统一管理应用级全局对象 |
| `module_interface_spec.js` | 模块接口规范定义 |
| `module_registry.js` | **核心模块**：模块注册系统，管理模块依赖和初始化 |
| `performance.js` | 性能优化工具，提供防抖、节流等功能 |
| `security.js` | 安全工具，提供API Key加密、输入验证、XSS防护 |
| `service_registration.js` | 服务注册管理器 |
| `utils.js` | 通用工具函数集合 |

---

### 6. features/

**功能定位：** 功能特性目录，包含应用的核心业务功能模块

#### 6.1 deep_parse/ - 深度解析功能

| 文件 | 功能说明 |
|------|----------|
| `full_translation/full_translation_logic.js` | 全文翻译逻辑处理 |
| `pos_highlight/add_all_pos.js` | 添加所有词性标记功能 |
| `pos_highlight/highlight_controller.js` | 词性高亮控制器 |
| `pos_highlight/highlight_render.js` | 词性高亮渲染器 |
| `pos_highlight/highlight_service.js` | 词性高亮服务 |
| `pos_highlight/highlight_settings.js` | 词性高亮设置管理 |
| `pos_highlight/highlight_switch.js` | 词性高亮开关控制 |
| `pos_highlight/pos_highlight.css` | 词性高亮样式定义 |
| `sentence_analysis/knowledge_button.js` | 知识点分析按钮组件 |
| `sentence_analysis/pos_button.js` | 词性分析按钮组件 |
| `sentence_analysis/sentence_card_render.js` | 句子卡片渲染器 |
| `sentence_analysis/sentence_translate_button.js` | 句子翻译按钮 |
| `sentence_analysis/split.js` | 文本分割器，将文章分割为句子 |
| `sentence_analysis/syntax_button.js` | 语法分析按钮组件 |

#### 6.2 history/ - 历史记录功能

| 文件 | 功能说明 |
|------|----------|
| `history_analysis_renderer.js` | 历史分析结果渲染器 |
| `history_data.js` | 历史数据管理，处理数据存储和读取 |
| `history_detail_ui.js` | 历史详情界面组件 |
| `history_list_ui.js` | 历史列表界面组件 |

#### 6.3 vocabulary/ - 词汇管理功能

| 文件 | 功能说明 |
|------|----------|
| `memory_mode/flashcard_mode/flashcard_mode.css` | 闪卡模式样式 |
| `memory_mode/flashcard_mode/flashcard_mode.js` | 闪卡模式核心逻辑 |
| `memory_mode/flashcard_mode/flashcard_ui.js` | 闪卡模式界面 |
| `memory_mode/learning_plan/learning_plan_ui.js` | 学习计划界面 |
| `memory_mode/learning_stats/learning_stats_ui.js` | 学习统计界面 |
| `notebook_tab_ui.js` | 生词本标签页界面 |
| `vocab_card.js` | 词汇卡片组件 |
| `vocab_data.js` | 词汇数据管理 |
| `vocab_ui.js` | 词汇界面主组件 |
| `word_context_menu.js` | 单词右键菜单组件 |

---

### 7. modules/

**功能定位：** 业务模块目录，包含核心业务逻辑模块

| 文件 | 功能说明 |
|------|----------|
| `README.md` | 模块说明文档 |
| `analysis/deep_parse.js` | 深度解析核心模块 |
| `analysis/sentence_detail_handler.js` | 句子详情处理器 |
| `dictionary/dict.js` | 词库服务，管理内置词库和用户自定义词库 |
| `dictionary/dict.json` | 内置词库数据文件 |

---

### 8. test/

**功能定位：** 测试目录

| 文件 | 功能说明 |
|------|----------|
| `optimization_evaluation.js` | 优化评估测试脚本 |

---

### 9. ui/

**功能定位：** 用户界面组件目录

| 文件 | 功能说明 |
|------|----------|
| `README.md` | UI说明文档 |
| `second_row/load_example.js` | 加载示例文本功能 |
| `second_row/reload_button.js` | 重新加载按钮组件 |
| `second_row/save_analysis.js` | 保存分析结果功能 |
| `settings/api_config.js` | API配置界面组件 |
| `settings/dark_mode.js` | 暗黑模式切换功能 |
| `settings/settings_ui.js` | 设置界面主组件 |
| `vocabulary/vocab_button.js` | 词汇按钮组件 |
| `main_button.js` | 主按钮管理器（深度解析、生词本按钮） |

---

### 10. www/

**功能定位：** Capacitor Web部署目录，包含Web应用的完整副本

此目录结构与根目录类似，用于Capacitor构建时将Web资源打包到移动应用中。

---

### 根目录文件

| 文件 | 功能说明 |
|------|----------|
| `README.md` | 项目主说明文档 |
| `capacitor.config.json` | Capacitor配置文件，定义appId、appName、webDir等 |
| `index.html` | **应用主入口**，包含DOM结构和脚本引用 |
| `package-lock.json` | npm依赖锁定文件 |

---

## 架构设计

### 模块化架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户界面层 (UI)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ main_ui  │ │ analysis │ │ settings │ │ vocabulary   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
└───────┼────────────┼────────────┼───────────────┼──────────┘
        │            │            │               │
        ▼            ▼            ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                      功能特性层 (Features)                  │
│  ┌───────────────┐ ┌───────────┐ ┌──────────────────┐      │
│  │  deep_parse   │ │  history  │ │   vocabulary     │      │
│  │ (深度解析)    │ │ (历史记录)│ │   (词汇管理)      │      │
│  └───────┬───────┘ └─────┬─────┘ └────────┬─────────┘      │
└──────────┼───────────────┼────────────────┼─────────────────┘
           │               │                │
           ▼               ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                      核心服务层 (Core)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Registry  │ │EventBus  │ │Cache     │ │ErrorHandler  │   │
│  │(模块注册) │ │(事件总线)│ │(缓存管理)│ │(错误处理)    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
└───────┼────────────┼────────────┼───────────────┼──────────┘
        │            │            │               │
        └────────────┴────────────┴───────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │   API层/数据层   │
              │ (api_request,    │
              │  dict, storage)  │
              └──────────────────┘
```

### 核心设计模式

1. **模块注册模式**：通过 `ModuleRegistry` 实现模块的注册、依赖管理和初始化
2. **事件总线模式**：通过 `EventBus` 实现模块间的解耦通信
3. **依赖注入模式**：通过 `DI Container` 管理组件依赖
4. **单例模式**：核心服务模块采用单例设计

---

## 主要功能模块

| 模块 | 功能描述 | 核心文件 |
|------|----------|----------|
| **深度解析** | 词性分析、语法结构解析、知识点提取 | `features/deep_parse/*` |
| **全文翻译** | 整篇文章的中文翻译 | `features/deep_parse/full_translation/*` |
| **词汇管理** | 生词本功能，支持添加、编辑、删除单词 | `features/vocabulary/*` |
| **历史记录** | 保存用户的分析历史 | `features/history/*` |
| **词库服务** | 内置词库和用户自定义词库管理 | `modules/dictionary/*` |
| **词性高亮** | 支持词性高亮显示，可自定义高亮设置 | `features/deep_parse/pos_highlight/*` |
| **暗黑模式** | 支持明暗主题切换 | `ui/settings/dark_mode.js` |

---

## 技术栈

| 分类 | 技术 | 版本要求 |
|------|------|----------|
| 语言 | JavaScript (ES6+) | ES6+ |
| 框架 | 原生Web | - |
| 构建工具 | Capacitor | - |
| 浏览器支持 | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |

---

## 启动方式

1. **开发模式**：直接在浏览器中打开 `index.html`
2. **移动构建**：使用 Capacitor 构建 Android/iOS 应用

```bash
# 安装依赖
npm install

# 构建Android应用
npx cap add android
npx cap sync
npx cap open android
```

---

## 总结

本项目采用模块化架构设计，具有良好的可扩展性和可维护性。核心模块提供基础设施服务，功能特性层实现具体业务逻辑，UI层负责用户交互。通过事件总线和模块注册系统实现组件间的解耦通信，便于后续功能扩展和迭代开发。