/* ============================================================
   foldersync.js — 本地文件夹持久化（Obsidian 式「自选文件夹自动保存」）
   ------------------------------------------------------------
   仅在支持 File System Access API 的浏览器（桌面版 Chrome / Edge）可用；
   移动端浏览器（iOS Safari、多数安卓浏览器）出于安全不开放系统文件夹读写，
   此时自动降级：功能隐藏/提示，保留「导出学习数据」(下载) 作为替代。

   行为：
   · 选择文件夹：showDirectoryPicker 取得目录句柄，句柄存入 IndexedDB
     （可跨会话恢复），文件夹名存入 localStorage 便于同步展示。
   · 自动保存：订阅 Store 事件（vocab/history/settings/progress/readingStyle），
     数据变更后防抖落盘；每次进入软件（app 启动）立即同步一次。
   · 落盘内容：localStorage 中每个键写成一个 <key>.json 文件，并额外生成
     一份 yingyanshe-data.json 整体快照，便于整体恢复。
   不新增任何桌面端共享存储键，仅使用移动端独有 localStorage 标记（文件夹名）。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});
  const Store = Mobile.Store;

  const FS_KEY = 'esc.folderSync';     // localStorage 标记：绑定的文件夹名（'' 表示未绑定）
  const IDB_NAME = 'esc-foldersync';
  const IDB_STORE = 'handles';
  const HANDLE_KEY = 'dir';

  function isSupported() {
    return typeof global.showDirectoryPicker === 'function';
  }
  function getFolderName() {
    return localStorage.getItem(FS_KEY) || '';
  }
  function hasFolder() {
    return !!getFolderName();
  }

  /* ---------- IndexedDB 句柄持久化（句柄可结构化克隆存储） ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(IDB_STORE); } catch (e) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbPut(key, val) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function idbDel(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // 校验/申请目录读写权限；allowRequest=false 时仅在已授权('granted')才返回 true，
  // 避免在启动/自动保存（无用户手势）时误触发权限弹窗。
  async function verifyPermission(handle, withWrite, allowRequest) {
    const opts = { mode: withWrite ? 'readwrite' : 'read' };
    try {
      if (handle.queryPermission) {
        const p = await handle.queryPermission(opts);
        if (p === 'granted') return true;
        if (p === 'denied') return false;
      }
      if (allowRequest && handle.requestPermission) {
        return (await handle.requestPermission(opts)) === 'granted';
      }
    } catch (e) { /* 无手势时 requestPermission 可能抛错，视为未授权 */ }
    return false;
  }

  // 选择文件夹并保存句柄；返回 { ok, name, error }
  async function pickFolder() {
    if (!isSupported()) return { ok: false, error: 'unsupported' };
    let handle;
    try {
      handle = await global.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'cancel' : 'cancel' };
    }
    const ok = await verifyPermission(handle, true, true);
    if (!ok) return { ok: false, error: 'permission' };
    try { await idbPut(HANDLE_KEY, handle); } catch (e) { return { ok: false, error: 'storage' }; }
    const name = handle.name || '数据文件夹';
    localStorage.setItem(FS_KEY, name);
    return { ok: true, name };
  }

  async function clearFolder() {
    try { await idbDel(HANDLE_KEY); } catch (e) {}
    localStorage.setItem(FS_KEY, '');
  }

  /* ---------- 落盘：每个键一个 <key>.json + 整体快照 ---------- */
  async function saveAllNow() {
    const name = getFolderName();
    if (!name) return false;
    let handle = null;
    try { handle = await idbGet(HANDLE_KEY); } catch (e) { return false; }
    if (!handle) return false;
    if (!(await verifyPermission(handle, true, false))) return false;
    try {
      const keys = Object.keys(localStorage);
      const snapshot = {};
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (val == null) continue;
        // 键名安全化，避免 '/' 或中文等造成的路径/文件名问题
        const fname = encodeURIComponent(k) + '.json';
        const fh = await handle.getFileHandle(fname, { create: true });
        const w = await fh.createWritable();
        await w.write(val);
        await w.close();
        try { snapshot[k] = JSON.parse(val); } catch (e) { snapshot[k] = val; }
      }
      const sfh = await handle.getFileHandle('yingyanshe-data.json', { create: true });
      const sw = await sfh.createWritable();
      await sw.write(JSON.stringify(snapshot, null, 2));
      await sw.close();
      return true;
    } catch (e) {
      console.warn('[foldersync] save failed', e);
      return false;
    }
  }

  // 防抖保存（数据变更频繁时合并）
  let saveTimer = null, saving = false, pending = false;
  function scheduleSave() {
    if (!hasFolder()) return;
    pending = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      if (saving) { pending = true; return; }
      saving = true;
      try { await saveAllNow(); } catch (e) {}
      saving = false;
      if (pending) { pending = false; scheduleSave(); }
    }, 1000);
  }

  // 进入软件时立即同步一次
  async function syncOnStartup() {
    if (!hasFolder()) return false;
    return await saveAllNow();
  }

  // 订阅 Store 事件，数据变化时自动落盘
  function bindStore() {
    if (!Store || !Store.on) return;
    ['vocab', 'history', 'settings', 'progress', 'readingStyle'].forEach((evt) => {
      Store.on(evt, () => scheduleSave());
    });
  }

  Mobile.FolderSync = {
    isSupported, getFolderName, hasFolder,
    pickFolder, clearFolder, saveAllNow, scheduleSave, syncOnStartup, bindStore
  };
})(window);
