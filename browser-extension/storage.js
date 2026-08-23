// storage.js - English Study Club 浏览器插件本地存储
//
// 设计原则（按用户决策）：
//   1. 插件使用自己的 chrome.storage.local，不与网页 localStorage 混用；
//   2. 保存内容优先写入本地存储，保证「不依赖 native host 也能跑通」；
//   3. 数据按 plugins/DATA_SCHEMA.md 约定的统一结构存储，便于导出后由
//      Obsidian 插件导入对齐。
//
// 数据结构（chrome.storage.local 顶层键）：
//   escStore: {
//     schemaVersion: 1,
//     captures: [ { id, title, text, url, source, createdAt } ],
//     articles: [ { id, title, source, content, lang, createdAt } ],
//     vocab:    [ { word, phonetic, definition, example, notebook, createdAt } ]
//   }
//
// 暴露为全局 window.ESCStore（无打包，纯 IIFE），供 popup.js / content.js 复用。

(function (global) {
  'use strict';

  const STORAGE_KEY = 'escStore';
  const SCHEMA_VERSION = 1;

  function nowIso() {
    // 本地时间 ISO（带时区偏移），避免 toISOString 的 UTC 偏差
    const d = new Date();
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const pad = (n) => String(Math.abs(n)).padStart(2, '0');
    const hh = pad(Math.floor(Math.abs(off) / 60));
    const mm = pad(Math.abs(off) % 60);
    return (
      d.getFullYear() +
      '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0') +
      'T' + String(d.getHours()).padStart(2, '0') +
      ':' + String(d.getMinutes()).padStart(2, '0') +
      ':' + String(d.getSeconds()).padStart(2, '0') +
      sign + hh + ':' + mm
    );
  }

  function emptyStore() {
    return {
      schemaVersion: SCHEMA_VERSION,
      captures: [],
      articles: [],
      vocab: [],
    };
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : null;
    } catch (e) {
      return null;
    }
  }

  // 读取整个 store（缺省返回空结构）
  async function getStore() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          const val = result && result[STORAGE_KEY];
          if (val && typeof val === 'object' && Array.isArray(val.captures)) {
            // 补齐可能缺失的数组，保持前向兼容
            const store = emptyStore();
            store.captures = val.captures || [];
            store.articles = val.articles || [];
            store.vocab = val.vocab || [];
            store.schemaVersion = val.schemaVersion || SCHEMA_VERSION;
            resolve(store);
          } else {
            resolve(emptyStore());
          }
        });
      } catch (e) {
        resolve(emptyStore());
      }
    });
  }

  // 写入整个 store
  async function setStore(store) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: store }, () => resolve(true));
      } catch (e) {
        resolve(false);
      }
    });
  }

  // 把三类数据分别写入已选定的本地文件夹的 browser-extension/ 子目录
  // （articles.json / vocab.json / captures.json），与网页端的
  // analysis_history.json / vocabData.json 分层共存，互不覆盖。
  // 依赖 chrome.storage.session 中由「选定本地文件夹」存入的 DirectoryHandle
  // （该 handle 通过 showDirectoryPicker({id:'english-study-club'}) 与网页端共享同一文件夹）。
  // 未选定文件夹时静默返回；任何失败都不阻断主流程。
  const FOLDER_SUBDIR = 'browser-extension';
  async function persistFolderSplit() {
    try {
      const s = await chrome.storage.session.get('escFolder');
      const fh = s && s.escFolder && s.escFolder.handle;
      if (!fh) return; // 未选定本地文件夹
      // 写入专属子目录，避免与网页端根目录文件冲突
      const dirHandle = await fh.getDirectoryHandle(FOLDER_SUBDIR, { create: true });
      const store = await getStore();
      const stamp = nowIso();
      const buckets = {
        articles: store.articles,
        vocab: store.vocab,
        captures: store.captures,
      };
      for (const key of Object.keys(buckets)) {
        const payload = JSON.stringify(
          { schemaVersion: SCHEMA_VERSION, exportedAt: stamp, [key]: buckets[key] },
          null,
          2
        );
        const fileHandle = await dirHandle.getFileHandle(key + '.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(payload);
        await writable.close();
      }
    } catch (e) {
      // 文件夹不可写 / 权限失效：忽略，不影响浏览器本地存储
    }
  }

  function genId() {
    return (
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8)
    );
  }

  // 追加一条采集（网页划线 / YouTube 字幕）
  async function addCapture(capture) {
    const store = await getStore();
    const item = {
      id: capture.id || genId(),
      title: capture.title || '网页采集',
      text: capture.text || '',
      url: capture.url || '',
      source: capture.source || 'selection', // selection | youtube
      createdAt: capture.createdAt || nowIso(),
    };
    store.captures.unshift(item);
    // 简单上限保护，避免 storage 膨胀（最多保留 500 条）
    if (store.captures.length > 500) {
      store.captures = store.captures.slice(0, 500);
    }
    await setStore(store);
    persistFolderSplit(); // 实时落盘到选定的本地文件夹（分文件）
    return item;
  }

  // 追加一条已解析文章
  async function addArticle(article) {
    const store = await getStore();
    const item = {
      id: article.id || genId(),
      title: article.title || '未命名文章',
      source: article.source || 'web',
      content: article.content || '',
      lang: article.lang || '',
      createdAt: article.createdAt || nowIso(),
    };
    store.articles.unshift(item);
    await setStore(store);
    persistFolderSplit(); // 实时落盘到选定的本地文件夹（分文件）
    return item;
  }

  // 追加一条生词
  async function addVocab(vocab) {
    const store = await getStore();
    const item = {
      word: vocab.word || '',
      phonetic: vocab.phonetic || '',
      definition: vocab.definition || '',
      example: vocab.example || '',
      pos: vocab.pos || '',
      context: vocab.context || '',
      notebook: vocab.notebook || 'default',
      createdAt: vocab.createdAt || nowIso(),
    };
    if (!item.word) return null;
    // 去重（同单词同笔记本）
    const exists = store.vocab.find(
      (v) => v.word === item.word && (v.notebook || 'default') === item.notebook
    );
    if (!exists) {
      store.vocab.unshift(item);
      await setStore(store);
      persistFolderSplit(); // 实时落盘到选定的本地文件夹（分文件）
    }
    return item;
  }

  // 导出为统一 schema 的 JSON 字符串
  async function exportJson() {
    const store = await getStore();
    return JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: nowIso(),
        articles: store.articles,
        vocab: store.vocab,
        captures: store.captures,
      },
      null,
      2
    );
  }

  // 从统一 schema 的 JSON 导入并合并（已有同 id/同单词则跳过）
  async function importJson(text) {
    const parsed = safeParse(text);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('JSON 解析失败');
    }
    const store = await getStore();
    let added = 0;

    if (Array.isArray(parsed.captures)) {
      const seen = new Set(store.captures.map((c) => c.id));
      for (const c of parsed.captures) {
        if (c && c.id && !seen.has(c.id)) {
          store.captures.unshift(c);
          seen.add(c.id);
          added++;
        }
      }
    }
    if (Array.isArray(parsed.articles)) {
      const seen = new Set(store.articles.map((a) => a.id));
      for (const a of parsed.articles) {
        if (a && a.id && !seen.has(a.id)) {
          store.articles.unshift(a);
          seen.add(a.id);
          added++;
        }
      }
    }
    if (Array.isArray(parsed.vocab)) {
      for (const v of parsed.vocab) {
        if (v && v.word) {
          const dup = store.vocab.find(
            (x) => x.word === v.word && (x.notebook || 'default') === (v.notebook || 'default')
          );
          if (!dup) {
            store.vocab.unshift(v);
            added++;
          }
        }
      }
    }
    await setStore(store);
    return added;
  }

  // 清空本地存储
  async function clearAll() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(STORAGE_KEY, () => resolve(true));
      } catch (e) {
        resolve(false);
      }
    });
  }

  // ---- 插件设置（翻译源 / API Key）----
  // 独立键 escSettings，不混用 escStore。
  const SETTINGS_KEY = 'escSettings';
  const SETTINGS_DEFAULT = {
    apiKey: '',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    translateSource: 'A', // 'A' = 魔塔 AI（modelscope）；'B' = 本地内置词库
  };

  async function getSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(SETTINGS_KEY, (result) => {
          const val = (result && result[SETTINGS_KEY]) || {};
          resolve(Object.assign({}, SETTINGS_DEFAULT, val));
        });
      } catch (e) {
        resolve(Object.assign({}, SETTINGS_DEFAULT));
      }
    });
  }

  async function updateSettings(patch) {
    const cur = await getSettings();
    const next = Object.assign({}, cur, patch);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [SETTINGS_KEY]: next }, () => resolve(next));
      } catch (e) {
        resolve(cur);
      }
    });
  }

  global.ESCStore = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    getStore,
    setStore,
    addCapture,
    addArticle,
    addVocab,
    exportJson,
    importJson,
    clearAll,
    getSettings,
    updateSettings,
    persistFolderSplit,
    nowIso,
    genId,
  };
})(window);
