# 英语精读实验室

一个基于模块化架构的英语学习工具，提供深度解析、词汇管理、历史记录等功能。

## 项目简介

英语精读实验室是一个专注于英语深度学习的Web应用，通过AI技术提供词性分析、语法结构解析、知识点提取、翻译等功能，帮助用户深入理解英文文章。

## 核心功能

- **深度解析**：对英文句子进行词性分析、语法结构解析、知识点提取
- **全文翻译**：提供整篇文章的中文翻译
- **词汇管理**：生词本功能，支持添加、编辑、删除单词
- **历史记录**：保存用户的分析历史
- **词库服务**：内置词库和用户自定义词库
- **高亮显示**：支持词性高亮，可自定义高亮设置
- **暗黑模式**：支持明暗主题切换

## 技术架构

### 模块化设计

项目采用模块化架构，通过模块注册系统和事件总线实现组件间的解耦通信。

#### 核心模块 (core/)

- **module_registry.js**：模块注册系统，管理模块依赖和初始化
- **event_bus.js**：事件总线，实现模块间的事件通信
- **error_handler.js**：统一错误处理，提供用户友好的错误提示
- **security.js**：安全工具，提供API Key加密、输入验证、XSS防护
- **performance.js**：性能优化，提供缓存、防抖、节流等功能
- **cache.js**：缓存管理，统一管理句子解析缓存、全文翻译等

#### 业务模块 (modules/)

- **api/**：API请求模块
  - `api_request.js`：处理所有API请求，包括词性分析、语法结构、知识点、翻译等

- **analysis/**：分析模块
  - `split.js`：文本分割，将文章分割为句子
  - `render.js`：渲染句子列表
  - `full_translation.js`：全文翻译功能

- **vocabulary/**：词汇模块
  - `vocab_data.js`：词汇数据管理

- **history/**：历史记录模块
  - `history_module.js`：历史记录管理

- **dictionary/**：字典模块
  - `dict.js`：词库服务，管理外部词库和补充词库
  - `dict.json`：外部词库数据

#### 用户界面 (ui/)

- **main/**：主界面
  - `main_buttons.js`：主按钮管理（深度解析、生词本）

- **analysis/**：分析界面
  - `second_row_ui.js`：第二行按钮界面
  - `highlight_switch.js`：高亮开关
  - `highlight_render.js`：高亮渲染
  - `highlight_settings.js`：高亮设置
  - `add_all_pos.js`：添加所有词性
  - `save_analysis.js`：保存分析结果
  - `load_example.js`：加载示例文本
  - `pos_button.js`：词性按钮
  - `syntax_button.js`：语法按钮
  - `knowledge_button.js`：知识点按钮
  - `reload_button.js`：重新加载按钮

- **vocabulary/**：词汇界面
  - `vocab_ui.js`：生词本界面
  - `vocab_button.js`：生词本按钮
  - `word_menu.js`：单词菜单

- **settings/**：设置界面
  - `settings_ui.js`：设置界面
  - `api_config.js`：API配置
  - `dark_mode.js`：暗黑模式

#### 静态资源 (assets/)

- **style.css**：样式文件

## 目录结构

```
英语阅读实验室/
├── index.html                 # 主页面
├── core/                      # 核心模块
│   ├── module_registry.js     # 模块注册系统
│   ├── event_bus.js           # 事件总线
│   ├── error_handler.js      # 错误处理
│   ├── security.js           # 安全工具
│   ├── performance.js        # 性能优化
│   └── cache.js              # 缓存管理
├── modules/                   # 业务模块
│   ├── api/                  # API请求
│   │   └── api_request.js
│   ├── analysis/             # 分析模块
│   │   ├── split.js
│   │   ├── render.js
│   │   └── full_translation.js
│   ├── vocabulary/           # 词汇模块
│   │   └── vocab_data.js
│   ├── history/              # 历史记录
│   │   └── history_module.js
│   └── dictionary/           # 字典模块
│       ├── dict.js
│       └── dict.json
├── ui/                       # 用户界面
│   ├── main/                 # 主界面
│   │   └── main_buttons.js
│   ├── analysis/             # 分析界面
│   │   ├── second_row_ui.js
│   │   ├── highlight_switch.js
│   │   ├── highlight_render.js
│   │   ├── highlight_settings.js
│   │   ├── add_all_pos.js
│   │   ├── save_analysis.js
│   │   ├── load_example.js
│   │   ├── pos_button.js
│   │   ├── syntax_button.js
│   │   ├── knowledge_button.js
│   │   └── reload_button.js
│   ├── vocabulary/           # 词汇界面
│   │   ├── vocab_ui.js
│   │   ├── vocab_button.js
│   │   └── word_menu.js
│   └── settings/            # 设置界面
│       ├── settings_ui.js
│       ├── api_config.js
│       └── dark_mode.js
├── assets/                   # 静态资源
│   └── style.css
└── docs/                     # 文档
    └── README.md
```

## 快速开始

### 环境要求

- 现代浏览器（Chrome、Firefox、Safari、Edge）
- 支持ES6+的JavaScript环境

### 安装运行

1. 克隆或下载项目
2. 在浏览器中打开 `index.html` 文件
3. 配置API Key（点击右上角设置按钮）
4. 开始使用

### API配置

1. 点击右上角设置按钮
2. 输入Base URL（如：https://api.deepseek.com）
3. 输入API Key
4. 输入模型名称（如：deepseek-chat）
5. 点击保存

## 开发指南

### 添加新功能

1. **创建新模块**：在 `modules/` 下创建对应的子目录和文件
2. **创建UI组件**：在 `ui/` 下创建对应的界面文件
3. **注册模块**：使用 `ModuleRegistry.register()` 注册新模块
4. **更新HTML**：在 `index.html` 中添加新的script引用

### 模块注册示例

```javascript
ModuleRegistry.register('ModuleName', ['Dependency1', 'Dependency2'], function(Dependency1, Dependency2) {
    // 模块实现
    
    // 导出接口
    return {
        // 公开的方法
    };
});
```

### 事件通信示例

```javascript
// 发送事件
EventBus.emit('eventName', data);

// 监听事件
EventBus.on('eventName', function(data) {
    // 处理事件
});

// 移除事件监听
EventBus.off('eventName', handler);
```

### 错误处理示例

```javascript
const asyncFunction = ErrorHandler.wrapAsyncFunction(async function() {
    // 异步操作
});
```

## 文件命名规范

- **核心模块**：使用下划线命名法（如：`module_registry.js`）
- **业务模块**：使用下划线命名法（如：`api_request.js`）
- **UI组件**：使用下划线命名法（如：`main_buttons.js`）
- **目录名**：使用小写字母和下划线（如：`ui/analysis/`）

## 代码规范

- 使用ES6+语法
- 函数使用JSDoc注释
- 变量命名清晰易懂
- 避免全局变量污染
- 使用模块化架构

## 安全性

- API Key加密存储
- 输入验证和过滤
- XSS防护
- 敏感信息过滤

## 性能优化

- API请求缓存
- DOM操作优化
- 防抖和节流
- 懒加载

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 贡献指南

欢迎提交Issue和Pull Request来改进项目。

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-04-03)

- 完成模块化重构
- 优化文件结构
- 添加详细文档
- 修复已知问题

## 联系方式

如有问题或建议，请通过Issue联系我们。