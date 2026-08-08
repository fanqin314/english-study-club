# 英语精读实验室 - 新架构文档

## 📋 概述

解决原有代码重复、AI修改困难的问题，建立了一套清晰的架构，便于维护和扩展。

## 📁 目录结构

```
src/
├── components/                   # UI组件层
│   ├── BaseComponent.js         # 统一组件基类
│   └── vocabulary/
│       ├── CollapseButtonComponent.js  # 折叠按钮组件
│       └── VocabStatsComponent.js       # 统计组件
├── core/                        # 核心基础设施
│   ├── StateManager.js          # 状态管理器
│   └── ComponentRegistry.js     # 组件注册表
└── init-new-architecture.js     # 新架构初始化脚本
```

## 🚀 快速开始

### 查看当前运行

新架构已与现有系统集成！打开 `index.html` 访问应用，在词汇界面可以看到新增的折叠按钮。

### 使用已有组件

```javascript
// 方式1：通过组件注册表
const CollapseBtn = window.componentRegistry.getClass('CollapseButton');
const btn = new CollapseBtn(container, options);

// 方式2：直接使用类
const btn = new window.CollapseButtonComponent(container, options);
btn.init();
btn.mount();
```

## 📚 核心概念

### 1. BaseComponent（统一组件基类）

所有组件继承自 `BaseComponent`，提供统一的生命周期：

```javascript
class MyComponent extends BaseComponent {
    onInit() { /* 初始化 */ }
    onMount() { /* 挂载后 */ }
    onRender() { /* 渲染 */ }
    onUpdate() { /* 状态更新后 */ }
    onDestroy() { /* 销毁前 */ }
}
```

### 2. 事件管理系统

使用 `this.on()` 绑定事件，组件销毁时自动清理，防止内存泄漏：

```javascript
this.on('.my-button', 'click', this.handleClick);
```

### 3. 状态管理

使用 `globalState` 管理跨组件状态：

```javascript
const unsubscribe = window.globalState.subscribe((newState, oldState) => {
    console.log('状态更新:', newState);
});

window.globalState.setState({ theme: 'dark' });
```

### 4. 组件注册表

查看所有可用组件：

```javascript
console.log(window.componentRegistry.list());
```

## 📝 开发指南

### 创建新组件

1. 继承 `BaseComponent`
2. 在文件开头添加详细说明
3. 注册到 `componentRegistry`

```javascript
/**
 * MyComponent - 我的组件
 *
 * 用途：描述组件的用途
 * 注册名称：MyComponent
 */

class MyComponent extends BaseComponent {
    onInit() {
        this.state = { /* 初始状态 */ };
    }

    onMount() {
        this.bindEvents();
    }

    onRender() {
        this.renderTemplate(this.getTemplate());
    }

    getTemplate() {
        return `<div>内容</div>`;
    }
}

// 注册组件
window.componentRegistry.register('MyComponent', MyComponent, '组件描述');
```

### 更新 stats（不会删除按钮！）

```javascript
// ✅ 正确方式：只更新文本，不要用 innerHTML 覆盖整个区域
const statsText = statsContainer.querySelector('.stats-text');
statsText.innerHTML = '新内容';

// ❌ 错误方式（被禁止）：
// statsContainer.innerHTML = '新内容'; // 这会删除按钮！
```

## 🎯 架构优势

1. **清晰的组件职责**：每个组件只负责一件事
2. **AI友好**：每个文件都有清晰说明和统一结构
3. **安全的DOM操作**：事件自动清理，防止内存泄漏
4. **状态可追踪**：StateManager保存历史记录，便于调试
5. **渐进式集成**：与现有代码完美兼容，不影响功能

## 📊 已完成的组件

| 组件名 | 类名 | 用途 |
|--------|------|------|
| CollapseButton | CollapseButtonComponent | 折叠/展开区域 |
| VocabStats | VocabStatsComponent | 显示统计数据 |

## 🔧 问题解决

### 折叠按钮没有显示？

检查：
1. 浏览器控制台是否有错误？
2. `src/` 下的文件是否正确加载？
3. DOM 元素 `.vocab-stats` 是否存在？

### 修改组件后没有更新？

清除浏览器缓存，或硬刷新（Ctrl+Shift+R / Cmd+Shift+R）

## 📌 注意事项

1. **不要直接修改 `vocab_ui.js`**：使用新架构的组件系统
2. **不要用 `innerHTML` 覆盖整个容器**：使用精细的 DOM 更新
3. **保持组件单一职责**：一个组件只做一件事
4. **添加文件注释**：每个新文件都需要说明用途

## 🚀 下一步计划

- 迁移更多现有组件到新架构
- 完善组件单元测试
- 添加更多示例
- 编写完整的 API 文档

---
**最后更新**: 2026-05-02
