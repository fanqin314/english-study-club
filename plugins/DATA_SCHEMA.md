# English Study Club — 插件共享数据 Schema

本文件约定 **browser-extension** 与 **obsidian-plugin** 之间对齐学习数据时使用的统一 JSON 结构。
两个插件各自独立存储（浏览器写 `chrome.storage.local`，Obsidian 读写 vault），通过「导出 / 导入 JSON」桥接对齐，不依赖任何原生程序（native host）。

## 本地文件夹闭环（推荐）

浏览器插件 / 网页端「选定本地文件夹」后，会**实时写出三个分散文件**到所选目录：

```
<你选定的本地文件夹>/
├── browser-extension/          ← 浏览器插件写出（子目录）
│   ├── articles.json           ← 文章（同顶层 articles 结构）
│   ├── vocab.json              ← 生词（同顶层 vocab 结构）
│   └── captures.json           ← 采集（同顶层 captures 结构）
└── （网页端直接写出在根目录，无 browser-extension/ 前缀）
    ├── articles.json
    └── vocab.json
```

每个文件本身即对应顶层 `articles` / `vocab` / `captures` 的**数组**（或包裹成 `{ "articles": [...] }` 形式），导入方需两种都兼容。

**Obsidian 插件对接方式**：设置项「本地文件夹同步路径」填写该文件夹在 **vault 内**的相对路径（如 `english-study-club`），然后执行「从文件夹同步」命令（或在设置页点击「从文件夹同步」）。插件会按 `基础目录 → 基础目录/browser-extension` 顺序探测 JSON 文件，读取后复用统一 JSON 导入逻辑写入 `history/` `vocab/` `browser-captures/`，自动去重。

> 由于 Obsidian 插件沙箱只能读写 **vault 内** 文件，请把浏览器插件 / 网页端所选的本地文件夹放在 vault 目录之内（或软链到 vault 内），同步路径填对应的相对路径即可。

## 顶层结构

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-23T00:00:00.000Z",
  "articles": [ /* 深度解析 / 网页划线 / 字幕导出 的文章 */ ],
  "vocab":    [ /* 生词本单词 */ ],
  "captures": [ /* 浏览器划线 / YouTube 字幕 的原始片段，尚未解析 */ ]
}
```

- `articles` / `vocab` / `captures` 任一数组可空 `[]`，导入方需容错。
- 字段缺失时导入方使用合理默认值，不抛错。

## articles（已解析文章）

与 Obsidian vault `history/<id>.md` 的 frontmatter 对齐：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一 ID（建议 `yyyy-mm-dd-hhmmss` 或 uuid） |
| `title` | string | 文章标题 |
| `source` | string | 来源：`web` / `youtube` / `file` / `manual` |
| `content` | string | 文章正文（纯文本或带换行） |
| `lang` | string? | 字幕/原文语言代码，如 `en`、`zh` |
| `createdAt` | string | ISO 时间 |

## vocab（生词）

与 Obsidian vault `vocab/<notebook>/<word>.md` 的 frontmatter 对齐：

| 字段 | 类型 | 说明 |
|------|------|------|
| `word` | string | 单词（作为文件名，需做文件系统安全转义） |
| `phonetic` | string? | 音标 |
| `definition` | string? | 释义 |
| `example` | string? | 例句 |
| `notebook` | string? | 所属生词本名（默认 `default`） |
| `createdAt` | string? | ISO 时间 |

## captures（原始采集片段，未解析）

与 Obsidian vault `browser-captures/<timestamp>.md` 对齐：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一 ID |
| `title` | string | 片段标题（网页标题 / 视频标题） |
| `text` | string | 采集的纯文本 |
| `url` | string? | 来源 URL |
| `source` | string? | `selection` / `youtube` |
| `createdAt` | string | ISO 时间 |

## 导出约定

- 浏览器插件「导出」：从 `chrome.storage.local` 汇总为上述结构，触发文件下载（文件名 `english-study-club-<date>.json`）。
- Obsidian 插件「导入」：读取该 JSON，写入对应 vault 目录；已存在同 ID / 同单词则跳过或覆盖（以较新 `createdAt` 为准）。
- Obsidian 插件「导出」：扫描 vault 的 `history/`、`vocab/`、`browser-captures/`，聚合成上述结构供浏览器插件导入。
