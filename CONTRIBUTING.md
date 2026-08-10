# 贡献指南

感谢你对英语阅读实验室的关注！本项目欢迎一切形式的贡献：Bug 报告、功能建议、代码改进、文档完善。

## 快速开始

```bash
git clone https://github.com/fanqin314/English-Reading-Lab.git
cd English-Reading-Lab

# 方式一：浏览器直接打开 index.html
# 方式二：本地静态服务器（推荐）
python -m http.server 8080
```

## 如何贡献

### 报告 Bug

1. 先搜索 [Issues](https://github.com/fanqin314/English-Reading-Lab/issues) 是否已有相同问题
2. 创建 Issue 时请包含：
   - 复现步骤
   - 期望行为与实际行为
   - 浏览器版本与操作系统
   - 控制台错误信息（如有）

### 提交功能

1. Fork 本仓库并创建功能分支：`git checkout -b feature/xxx`
2. 遵循下面的**代码规范**
3. 提交后发起 Pull Request，描述清楚改动内容与动机

## 代码规范

- **ES6+ 语法**，函数使用 JSDoc 注释
- **模块化**：新增功能放入 `features/` 目录，通过 `ModuleRegistry.register()` 注册
- **UI 图标**：一律使用内联 SVG，禁止 Emoji
- **颜色**：统一使用 CSS 变量（`assets/css/variables.css`），支持暗色模式
- **事件监听**：使用 `addEventListener` 并加入 `_cleanupFns` 清理机制，避免内存泄漏
- **交互元素**：需防重入保护（如 `_rateTimeoutPending` 标志），防止重复触发
- **学习数据**：统一通过 `StatsTracker` 记录

## 目录结构

```
core/        # 核心基础设施（模块注册、事件总线、API、存储）
features/    # 业务功能（深度解析、记忆模式、生词本、历史、上传）
modules/     # 业务逻辑（分析、词库）
ui/          # 界面层（主按钮、事件委托、设置面板）
assets/      # 样式与静态资源（CSS 变量主题体系）
```

## 许可证

参与贡献即表示你同意你的贡献在 [MIT License](LICENSE) 下发布。
