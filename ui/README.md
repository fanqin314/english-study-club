# 用户界面 (UI)

用户界面模块包含所有与用户交互相关的组件，提供直观友好的操作界面。

## 界面列表

### main/
**主界面**

提供应用的主要入口和基础界面组件。

#### main_buttons.js
**主按钮管理器**

管理主界面的按钮，包括深度解析和生词本按钮。

**主要功能：**
- 创建主按钮
- 切换显示模式（深度解析/生词本）
- 管理界面状态
- 响应用户交互

**依赖：**
- EventBus：事件通信

**使用示例：**
```javascript
MainButtonManager.init();
```

### analysis/
**分析界面**

提供深度解析相关的所有界面组件。

#### second_row_ui.js
**第二行界面管理**

管理分析模式下的第二行按钮和界面元素。

**主要功能：**
- 创建第二行按钮
- 管理界面元素显示/隐藏
- 处理用户交互

#### highlight_switch.js
**高亮开关**

控制词性高亮功能的开关。

**主要功能：**
- 切换高亮状态
- 保存高亮设置
- 应用高亮效果

#### highlight_render.js
**高亮渲染器**

渲染词性高亮效果。

**主要功能：**
- 渲染词性高亮
- 应用自定义高亮样式
- 处理高亮更新

#### highlight_settings.js
**高亮设置**

提供词性高亮的设置界面。

**主要功能：**
- 显示高亮设置弹窗
- 保存高亮设置
- 应用高亮配置

#### add_all_pos.js
**添加所有词性**

批量添加所有句子的词性分析。

**主要功能：**
- 批量请求词性分析
- 显示加载状态
- 更新界面

#### save_analysis.js
**保存分析**

保存分析结果到历史记录。

**主要功能：**
- 保存当前分析
- 显示保存状态
- 提供保存选项

#### load_example.js
**加载示例**

加载示例文本用于演示。

**主要功能：**
- 加载示例文本
- 清空当前内容
- 自动开始分析

#### pos_button.js
**词性按钮**

处理单个句子的词性分析请求。

**主要功能：**
- 请求词性分析
- 显示词性结果
- 缓存分析结果

**依赖：**
- APIRequest：API请求
- Security：安全工具
- ErrorHandler：错误处理
- Performance：性能优化

#### syntax_button.js
**语法按钮**

处理单个句子的语法结构分析请求。

**主要功能：**
- 请求语法结构
- 显示语法结果
- 缓存分析结果

**依赖：**
- APIRequest：API请求
- Security：安全工具
- ErrorHandler：错误处理
- Performance：性能优化

#### knowledge_button.js
**知识点按钮**

处理单个句子的知识点分析请求。

**主要功能：**
- 请求知识点分析
- 显示知识点结果
- 缓存分析结果

**依赖：**
- APIRequest：API请求
- Security：安全工具
- ErrorHandler：错误处理
- Performance：性能优化

#### reload_button.js
**重新加载按钮**

重新加载单个句子的所有分析。

**主要功能：**
- 清除缓存
- 重新请求分析
- 更新界面

### vocabulary/
**词汇界面**

提供生词本相关的所有界面组件。

#### vocab_ui.js
**生词本界面**

管理生词本的主界面。

**主要功能：**
- 显示生词列表
- 添加新单词
- 编辑单词
- 删除单词
- 导出生词

**依赖：**
- VocabData：词汇数据
- EventBus：事件通信

#### vocab_button.js
**生词本按钮**

主界面上的生词本入口按钮。

**主要功能：**
- 切换到生词本界面
- 显示生词数量
- 处理用户交互

#### word_menu.js
**单词菜单**

提供单词的右键菜单功能。

**主要功能：**
- 显示右键菜单
- 添加单词到生词本
- 查看单词释义
- 编辑单词信息

**依赖：**
- DictService：词库服务
- EventBus：事件通信

### settings/
**设置界面**

提供应用设置相关的界面组件。

#### settings_ui.js
**设置界面**

管理设置界面的显示和交互。

**主要功能：**
- 显示设置弹窗
- 管理设置选项
- 保存设置
- 应用设置

**依赖：**
- EventBus：事件通信

#### api_config.js
**API配置**

提供API配置界面。

**主要功能：**
- 显示API配置表单
- 保存API配置
- 测试API连接
- 显示API状态

**依赖：**
- Security：安全工具
- ErrorHandler：错误处理
- Performance：性能优化

#### dark_mode.js
**暗黑模式**

管理暗黑模式的切换。

**主要功能：**
- 切换明暗主题
- 保存主题设置
- 应用主题样式

**依赖：**
- EventBus：事件通信

## 依赖关系

```
main/main_buttons.js
    ↓ 依赖
EventBus

analysis/second_row_ui.js
    ↓ 依赖
无直接依赖

analysis/highlight_switch.js
    ↓ 依赖
无直接依赖

analysis/highlight_render.js
    ↓ 依赖
无直接依赖

analysis/highlight_settings.js
    ↓ 依赖
无直接依赖

analysis/add_all_pos.js
    ↓ 依赖
APIRequest, CacheManager

analysis/save_analysis.js
    ↓ 依赖
CacheManager, EventBus

analysis/load_example.js
    ↓ 依赖
无直接依赖

analysis/pos_button.js
    ↓ 依赖
APIRequest, Security, ErrorHandler, Performance

analysis/syntax_button.js
    ↓ 依赖
APIRequest, Security, ErrorHandler, Performance

analysis/knowledge_button.js
    ↓ 依赖
APIRequest, Security, ErrorHandler, Performance

analysis/reload_button.js
    ↓ 依赖
CacheManager, EventBus

vocabulary/vocab_ui.js
    ↓ 依赖
VocabData, EventBus

vocabulary/vocab_button.js
    ↓ 依赖
EventBus

vocabulary/word_menu.js
    ↓ 依赖
DictService, EventBus

settings/settings_ui.js
    ↓ 依赖
EventBus

settings/api_config.js
    ↓ 依赖
Security, ErrorHandler, Performance

settings/dark_mode.js
    ↓ 依赖
EventBus
```

## 使用原则

1. **单一职责**：每个UI组件只负责一个特定的界面功能
2. **事件驱动**：使用EventBus进行组件间通信
3. **用户友好**：提供清晰的用户反馈和错误提示
4. **响应式设计**：适配不同屏幕尺寸
5. **性能优化**：避免频繁的DOM操作

## 扩展指南

如需添加新的UI组件：

1. 在对应的 `ui/` 子目录下创建新的JS文件
2. 遵循现有的代码风格和命名规范
3. 使用ModuleRegistry注册模块（如果需要）
4. 添加详细的JSDoc注释
5. 在 `index.html` 中添加script引用
6. 更新本README文档

## UI组件开发示例

```javascript
ModuleRegistry.register('NewUIComponent', ['EventBus', 'ErrorHandler'], function(EventBus, ErrorHandler) {
    // 初始化函数
    function init() {
        // 创建UI元素
        // 绑定事件
        // 初始化状态
    }
    
    // 导出接口
    window.NewUIComponent = {
        init: init
    };
    
    return {
        init: init
    };
});
```

## DOM操作规范

1. **使用安全的DOM操作**：避免直接使用innerHTML，优先使用createElement
2. **事件委托**：对于动态元素，使用事件委托提高性能
3. **批量更新**：使用文档片段或批量更新减少重绘
4. **清理资源**：组件销毁时清理事件监听器和定时器

## 样式规范

1. **使用CSS变量**：优先使用CSS变量定义颜色和尺寸
2. **响应式设计**：使用媒体查询适配不同屏幕
3. **主题支持**：支持明暗主题切换
4. **动画效果**：使用CSS过渡和动画提升用户体验

## 用户体验优化

1. **加载状态**：提供清晰的加载指示器
2. **错误提示**：使用友好的错误提示，避免技术术语
3. **操作反馈**：每个操作都应提供即时反馈
4. **键盘支持**：支持键盘操作提高可访问性
5. **防误操作**：重要操作需要确认

## 注意事项

- UI组件不应包含复杂的业务逻辑
- 避免在UI组件中直接调用API
- 所有数据操作应通过对应的业务模块进行
- 注意内存泄漏，及时清理事件监听器
- 保持UI组件的独立性和可复用性

## 测试建议

1. **功能测试**：测试所有交互功能是否正常
2. **兼容性测试**：测试不同浏览器的兼容性
3. **性能测试**：测试大量数据下的性能表现
4. **可访问性测试**：测试键盘操作和屏幕阅读器支持
5. **响应式测试**：测试不同屏幕尺寸下的显示效果