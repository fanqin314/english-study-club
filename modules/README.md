# 业务模块 (Modules)

业务模块包含项目的核心业务逻辑，提供API请求、文本分析、词汇管理、历史记录等功能。

## 模块列表

### api/
**API请求模块**

处理所有与外部API的交互，包括词性分析、语法结构、知识点、翻译等。

#### api_request.js
**API请求处理器**

提供统一的API请求接口，处理所有AI相关的请求。

**主要功能：**
- 词性分析：`requestPos(sentence)`
- 语法结构：`requestSyntax(sentence)`
- 知识点分析：`requestKnowledge(sentence)`
- 句子翻译：`requestTranslation(sentence)`
- 单词释义：`requestWordMeaning(word)`
- 全文翻译：`requestFullTranslation(text)`

**依赖：**
- Security：输入验证、敏感信息过滤
- ErrorHandler：错误处理
- Performance：缓存、性能跟踪

**使用示例：**
```javascript
const posData = await APIRequest.requestPos('This is a sentence.');
```

### analysis/
**分析模块**

提供文本分析相关的功能，包括文本分割、渲染、全文翻译等。

#### split.js
**文本分割器**

将英文文章分割为句子，支持多种分割规则。

**主要功能：**
- 分割文本为句子数组
- 处理缩写和特殊标点
- 保留原始文本格式

#### render.js
**渲染器**

渲染句子列表，包括词性高亮、翻译等。

**主要功能：**
- 渲染句子列表
- 应用词性高亮
- 显示翻译结果
- 处理用户交互

#### full_translation.js
**全文翻译器**

提供整篇文章的翻译功能。

**主要功能：**
- 请求全文翻译
- 显示翻译结果
- 缓存翻译数据

**依赖：**
- APIRequest：API请求
- CacheManager：缓存管理
- EventBus：事件通信

### vocabulary/
**词汇模块**

管理词汇数据，提供词汇的增删改查功能。

#### vocab_data.js
**词汇数据管理**

管理词汇数据，包括生词本、单词释义等。

**主要功能：**
- 添加单词
- 删除单词
- 更新单词释义
- 查询单词
- 导出词汇数据

**依赖：**
- CacheManager：缓存管理
- DictService：词库服务

### history/
**历史记录模块**

管理用户的分析历史记录。

#### history_module.js
**历史记录管理**

保存和加载用户的分析历史。

**主要功能：**
- 保存分析历史
- 加载历史记录
- 删除历史记录
- 清空历史

**依赖：**
- CacheManager：缓存管理
- EventBus：事件通信

### dictionary/
**字典模块**

提供词库服务，包括外部词库和用户自定义词库。

#### dict.js
**词库服务**

管理外部词库和补充词库，提供单词查询功能。

**主要功能：**
- 加载外部词库：`loadExternalDict(dictPath)`
- 查询单词释义：`getWordMeaningFromDict(word)`
- 添加补充词库：`addToSupplementDict(word, meaning, pos)`
- 删除补充词库：`removeFromSupplementDict(word)`
- 获取所有补充词条：`getAllSupplementWords()`

**依赖：**
- 无直接依赖

#### dict.json
**外部词库数据**

包含常用单词的释义和词性信息。

**格式：**
```json
{
  "word": {
    "meaning": "中文释义",
    "pos": "词性"
  }
}
```

## 依赖关系

```
api/api_request.js
    ↓ 依赖
Security, ErrorHandler, Performance

analysis/split.js
    ↓ 依赖
无直接依赖

analysis/render.js
    ↓ 依赖
APIRequest, CacheManager, EventBus

analysis/full_translation.js
    ↓ 依赖
APIRequest, CacheManager, EventBus

vocabulary/vocab_data.js
    ↓ 依赖
CacheManager, DictService

history/history_module.js
    ↓ 依赖
CacheManager, EventBus

dictionary/dict.js
    ↓ 依赖
无直接依赖
```

## 使用原则

1. **单一职责**：每个模块只负责一个特定的业务功能
2. **依赖注入**：通过ModuleRegistry进行依赖注入
3. **事件驱动**：使用EventBus进行模块间通信
4. **缓存优先**：合理使用缓存减少API请求
5. **错误处理**：统一使用ErrorHandler处理错误

## 扩展指南

如需添加新的业务模块：

1. 在 `modules/` 下创建新的子目录
2. 创建模块文件，遵循现有代码风格
3. 使用ModuleRegistry注册模块
4. 添加详细的JSDoc注释
5. 在 `index.html` 中添加script引用
6. 更新本README文档

## 模块注册示例

```javascript
ModuleRegistry.register('NewModule', ['Dependency1', 'Dependency2'], function(Dependency1, Dependency2) {
    // 模块实现
    
    // 导出接口
    window.NewModule = {
        // 公开的方法
    };
    
    return {
        // 返回的对象
    };
});
```

## 注意事项

- 业务模块不应直接操作DOM（UI操作应在ui/目录下）
- 避免模块间的直接依赖，优先使用EventBus通信
- 所有API请求都应通过api_request.js进行
- 合理使用缓存，避免重复请求
- 注意错误处理，提供友好的错误提示

## 性能优化建议

1. **API请求缓存**：使用Performance.cacheAPIRequest缓存API请求
2. **批量操作**：尽量减少API请求次数
3. **懒加载**：按需加载数据
4. **防抖节流**：对频繁操作使用防抖或节流

## 安全注意事项

1. **输入验证**：所有用户输入都应经过Security.validateText验证
2. **敏感信息过滤**：使用Security.filterSensitiveInfo过滤敏感信息
3. **XSS防护**：使用Security.escapeHtml转义用户输入
4. **API Key保护**：API Key应加密存储，不应在日志中输出