// save_settings.js - 设置面板中的保存设置（导出数据 + 下载说明）
(function() {
    'use strict';

    const SAVE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
    </svg>`;

    // ========== 保存说明 TXT 内容 ==========
    function getSaveDescriptionText() {
        return `英语阅读实验室 - 数据保存说明
===============================

📁 本地文件存储
----------------
开启本地文件存储后，数据将保存在你选择的文件夹中：
- analysis_history.json   → 历史记录
- vocabData.json           → 生词本数据
- history/                 → 历史记录 MD 文件（逐条分析）
- vocab/                   → 生词本 MD 文件（按笔记本）
- browser-captures/        → 浏览器插件采集内容（视频字幕、网页文章）

即使清除浏览器缓存，本地文件夹中的文件也不会丢失。

📄 文件格式说明
----------------

🕐 analysis_history.json（历史记录）
[
  {
    "id": "时间戳字符串（唯一标识）",
    "originalText": "原文内容（必填）",
    "fullTranslation": "全文翻译",
    "sentences": ["句子数组"],
    "sentenceData": { "句子索引": { "分析数据": "..." } },
    "savedAt": "2026-01-01T00:00:00.000Z"
  }
]
- 最多保存 50 条，超出自动删除旧记录
- 数组按时间倒序（最新在前）

📚 vocabData.json（生词本）
{
  "notebooks": {
    "笔记本ID（时间戳）": {
      "name": "笔记本名称（最长50字符）",
      "createdDate": "2026-01-01T00:00:00.000Z",
      "words": [
        {
          "word": "单词（必填，最长50字符，不区分大小写去重）",
          "meaning": "释义（最长500字符）",
          "pos": "词性（最长20字符）",
          "context": "上下文例句（最长1000字符）",
          "timestamp": 1755443200000
        }
      ]
    }
  },
  "currentNotebookId": "当前选中的笔记本ID"
}
- 至少保留 1 个笔记本（默认生词本）
- 同一笔记本内单词不重复

💾 导出格式
----------------
- JSON: 完整数据结构，可重新导入
- TXT:  纯文本格式，方便阅读
- MD:   Markdown 格式，支持标题和排版

导出时间: ${new Date().toLocaleString()}
`;
    }

    function downloadSaveDescription() {
        const content = getSaveDescriptionText();
        const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '保存说明.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ========== 导出生词本（全部笔记本，支持多格式） ==========

    // 获取生词本导出内容（不触发下载）
    function getVocabExportContent(format) {
        const vocabData = window.VocabData;
        if (!vocabData) return null;

        const notebooks = vocabData.getAllNotebooks();
        const notebookIds = Object.keys(notebooks);
        if (notebookIds.length === 0) return null;

        const dateStr = new Date().toISOString().slice(0, 10);
        let content, filename, mimeType;

        switch (format) {
            case 'json':
                content = vocabData.exportData();
                filename = `vocab_${dateStr}.json`;
                mimeType = 'application/json';
                break;
            case 'txt': {
                let txt = '英语阅读实验室 - 生词本\n';
                txt += '='.repeat(40) + '\n';
                txt += `导出时间: ${new Date().toLocaleString()}\n\n`;
                for (const id of notebookIds) {
                    const nb = notebooks[id];
                    txt += `--- ${nb.name} (${nb.words.length} 个单词) ---\n`;
                    nb.words.forEach(w => {
                        txt += `${w.word}`;
                        if (w.meaning) txt += `\t${w.meaning}`;
                        if (w.pos) txt += `\t[${w.pos}]`;
                        txt += '\n';
                    });
                    txt += '\n';
                }
                content = txt;
                filename = `vocab_${dateStr}.txt`;
                mimeType = 'text/plain';
                break;
            }
            case 'md': {
                let md = '# 英语阅读实验室 - 生词本\n\n';
                md += `> 导出时间: ${new Date().toLocaleString()}\n\n`;
                for (const id of notebookIds) {
                    const nb = notebooks[id];
                    md += `## ${nb.name} (${nb.words.length} 个单词)\n\n`;
                    md += '| 单词 | 释义 | 词性 |\n';
                    md += '|------|------|------|\n';
                    nb.words.forEach(w => {
                        md += `| ${w.word} | ${w.meaning || '-'} | ${w.pos || '-'} |\n`;
                    });
                    md += '\n';
                }
                content = md;
                filename = `vocab_${dateStr}.md`;
                mimeType = 'text/markdown';
                break;
            }
            default:
                return null;
        }

        return { content, filename, mimeType };
    }

    // 获取单个笔记本的 MD 导出内容
    function getVocabNotebookMD(notebook) {
        let md = `# ${notebook.name}\n\n`;
        md += `> ${notebook.words.length} 个单词  |  导出时间: ${new Date().toLocaleString()}\n\n`;
        md += '| 单词 | 释义 | 词性 |\n';
        md += '|------|------|------|\n';
        notebook.words.forEach(w => {
            md += `| ${w.word} | ${w.meaning || '-'} | ${w.pos || '-'} |\n`;
        });
        md += '\n';
        return md;
    }

    // 获取所有笔记本列表（用于逐本导出到本地文件夹）
    function getVocabNotebooks() {
        if (!window.VocabData) return null;
        const notebooks = window.VocabData.getAllNotebooks();
        return Object.entries(notebooks).map(([id, nb]) => ({ id, ...nb }));
    }

    function exportAllVocab(format) {
        const result = getVocabExportContent(format);
        if (!result) {
            if (typeof showToast === 'function') showToast('没有可导出的数据');
            return;
        }
        _triggerDownload(result.content, result.filename, result.mimeType);
    }

    function _triggerDownload(content, filename, mimeType) {
        const blob = new Blob(['\uFEFF' + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ========== 渲染设置面板 ==========
    let _exportDirty = false;
    let _confirmBtn = null;

    function fillSaveSettings(modalContainer) {
        _exportDirty = false;

        const section = document.createElement('div');
        section.className = 'settings-section';

        section.innerHTML = `
            <div class="setting-header-row">
                <h3>${SAVE_ICON} 保存设置</h3>
            </div>
            <div class="setting-description" style="font-size:12px;color:var(--text-light);margin-bottom:12px;">
                导出数据或下载保存格式说明
            </div>

            <!-- 下载保存说明 -->
            <div style="margin-bottom:14px;">
                <button id="downloadDescBtn" class="settings-action-btn" style="width:100%;">
                    下载保存说明 (TXT)
                </button>
            </div>

            <!-- 导出历史记录 -->
            <div style="margin-bottom:14px;">
                <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">导出历史记录</div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <label class="export-check-label"><input type="checkbox" class="history-format-chk" value="json" checked> JSON</label>
                    <label class="export-check-label"><input type="checkbox" class="history-format-chk" value="txt"> TXT</label>
                    <label class="export-check-label"><input type="checkbox" class="history-format-chk" value="md"> MD</label>
                </div>
            </div>

            <!-- 导出生词本 -->
            <div style="margin-bottom:14px;">
                <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">导出生词本</div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <label class="export-check-label"><input type="checkbox" class="vocab-format-chk" value="json" checked> JSON</label>
                    <label class="export-check-label"><input type="checkbox" class="vocab-format-chk" value="txt"> TXT</label>
                    <label class="export-check-label"><input type="checkbox" class="vocab-format-chk" value="md"> MD</label>
                </div>
            </div>

            <!-- 确认按钮 -->
            <button id="confirmExportBtn" class="settings-action-btn" style="width:100%;">确认</button>
        `;

        modalContainer.appendChild(section);

        _confirmBtn = document.getElementById('confirmExportBtn');

        // 绑定：下载保存说明
        const descBtn = document.getElementById('downloadDescBtn');
        if (descBtn) {
            descBtn.addEventListener('click', downloadSaveDescription);
        }

        // 监听 checkbox 变化 → 标记 dirty + 按钮变蓝
        section.querySelectorAll('.history-format-chk, .vocab-format-chk').forEach(cb => {
            cb.addEventListener('change', () => {
                _exportDirty = true;
                if (_confirmBtn) {
                    _confirmBtn.classList.add('confirm-active');
                    _confirmBtn.textContent = '确认导出';
                }
            });
        });

        // 绑定：确认按钮
        if (_confirmBtn) {
            _confirmBtn.addEventListener('click', async () => {
                await _doExport(section);
            });
        }

        // 存储当前 section 引用用于关闭时自动导出
        section._saveSettingsSection = true;
    }

    async function _doExport(section) {
        const historyChecked = section.querySelectorAll('.history-format-chk:checked');
        const vocabChecked = section.querySelectorAll('.vocab-format-chk:checked');

        const useLocal = window.LocalFileStorage && window.LocalFileStorage.isActive();
        const exported = [];

        if (useLocal) {
            const LFS = window.LocalFileStorage;

            // ===== 历史记录导出到本地文件夹 =====
            for (const cb of historyChecked) {
                try {
                    const format = cb.value;
                    let result;
                    // 聚合格式（JSON/TXT）直接从 getExportContent 获取
                    if (format !== 'md') {
                        result = window.HistoryManager && window.HistoryManager.getExportContent
                            ? window.HistoryManager.getExportContent(format)
                            : null;
                        if (result) {
                            await LFS.writeTextFileInDir('history', result.filename, result.content);
                        }
                    }
                } catch (e) {
                    console.error(`[SaveSettings] 写入历史记录 ${cb.value} 失败:`, e);
                }
            }
            // MD 格式：逐条写入 history/ 子目录
            if (Array.from(historyChecked).some(cb => cb.value === 'md')) {
                const items = window.HistoryManager && window.HistoryManager.getHistoryItems
                    ? window.HistoryManager.getHistoryItems()
                    : [];
                for (const item of items) {
                    try {
                        const mdContent = window.HistoryManager.getItemMD(item);
                        const filename = window.HistoryManager.getItemFilename(item);
                        await LFS.writeTextFileInDir('history', filename, mdContent);
                    } catch (e) {
                        console.error(`[SaveSettings] 写入历史记录 MD 失败:`, e);
                    }
                }
            }
            if (historyChecked.length > 0) exported.push('历史记录');

            // ===== 生词本导出到本地文件夹 =====
            for (const cb of vocabChecked) {
                try {
                    const format = cb.value;
                    // 聚合格式（JSON/TXT）写入 vocab/ 子目录
                    if (format !== 'md') {
                        const result = getVocabExportContent(format);
                        if (result) {
                            await LFS.writeTextFileInDir('vocab', result.filename, result.content);
                        }
                    }
                } catch (e) {
                    console.error(`[SaveSettings] 写出生词本 ${cb.value} 失败:`, e);
                }
            }
            // MD 格式：逐本写入 vocab/ 子目录，以笔记本名称命名
            if (Array.from(vocabChecked).some(cb => cb.value === 'md')) {
                const notebooks = getVocabNotebooks();
                if (notebooks) {
                    for (const nb of notebooks) {
                        try {
                            const mdContent = getVocabNotebookMD(nb);
                            const safeName = nb.name.replace(/[\\/:*?"<>|]/g, '_');
                            await LFS.writeTextFileInDir('vocab', `${safeName}.md`, mdContent);
                        } catch (e) {
                            console.error(`[SaveSettings] 写出生词本 MD 失败:`, e);
                        }
                    }
                }
            }
            if (vocabChecked.length > 0) exported.push('生词本');
        } else {
            // 未连接本地文件夹：浏览器下载（聚合导出）
            if (historyChecked.length > 0 && window.HistoryManager && window.HistoryManager.exportHistory) {
                historyChecked.forEach(cb => {
                    window.HistoryManager.exportHistory(cb.value);
                });
                exported.push('历史记录');
            }

            if (vocabChecked.length > 0) {
                vocabChecked.forEach(cb => {
                    exportAllVocab(cb.value);
                });
                exported.push('生词本');
            }
        }

        if (exported.length > 0 && typeof showToast === 'function') {
            const location = useLocal ? '到本地文件夹' : '';
            showToast(`已导出${location}: ${exported.join('、')}`);
        }

        _exportDirty = false;
        if (_confirmBtn) {
            _confirmBtn.classList.remove('confirm-active');
            _confirmBtn.textContent = '确认';
        }
    }

    /**
     * 关闭设置时自动确认导出（仅当 checkbox 被修改过）
     */
    async function triggerExportIfDirty() {
        if (!_exportDirty) return;
        const allSections = document.querySelectorAll('.settings-section');
        for (const sec of allSections) {
            if (sec._saveSettingsSection) {
                await _doExport(sec);
                break;
            }
        }
    }

    window.fillSaveSettings = fillSaveSettings;
    window.triggerExportIfDirty = triggerExportIfDirty;
})();