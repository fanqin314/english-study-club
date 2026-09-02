/* ============================================================
   shared/backup.js — 数据备份/恢复 纯核心（桌面/移动两端复用）
   · 目的：一键整包备份当前 localStorage 中的学习数据，并在
     换浏览器/清缓存前导出迁移、或之后再导入恢复。
   · 设计：本项目所有学习数据（生词本、历史、阅读进度、统计、
     计划、设置、主题选择、SRS 字段）均存于 localStorage，
     故整包备份即「枚举 localStorage 全部键」，排除运行期无害
     的临时键后序列化。restore 时按原键全量写回，天然与桌面/
     移动两端共用存储一致。
   · 挂载：window.EnglishStudyShared.Backup
   · 依赖：无
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var Backup = (Shared.Backup = Shared.Backup || {});

  var APP = 'english-study-club';
  // 备份格式版本：升级结构/导出策略时自增，供 parse 识别与未来迁移
  var VERSION = 1;
  // 运行期临时键：不参与备份，避免导入污染会话态
  // 前缀 '_' 的桌面端临时缓存、移动端 esc. 会话进度等（移动端 esc.progress 有含义，故仅跳运行期键）
  var SKIP_PREFIXES = ['_'];

  /**
   * 收集整包数据 —— 枚举 localStorage 全部键，排除跳过前缀
   * @returns {object} { [key]: string 原始存储值 }
   */
  Backup.collect = function () {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      var skip = false;
      for (var p = 0; p < SKIP_PREFIXES.length; p++) {
        if (key.indexOf(SKIP_PREFIXES[p]) === 0) { skip = true; break; }
      }
      if (skip) continue;
      data[key] = localStorage.getItem(key);
    }
    return data;
  };

  /**
   * 组装备份包对象
   * @param {object} [data] 由 collect() 得到的键值对；缺省时自动 collect
   * @returns {object} { app, version, exportedAt, data }
   */
  Backup.build = function (data) {
    return {
      app: APP,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: data || Backup.collect()
    };
  };

  /**
   * 序列化备份包为 JSON 字符串
   * @param {object} pack 备份包
   * @returns {string}
   */
  Backup.serialize = function (pack) {
    return JSON.stringify(pack, null, 2);
  };

  /**
   * 解析并严格校验备份字符串
   * @param {string} text JSON 字符串
   * @returns {{ok:true, pack:object}|{ok:false, reason:string}}
   */
  Backup.parse = function (text) {
    if (!text || typeof text !== 'string') return { ok: false, reason: '备份内容为空' };
    var pack;
    try {
      pack = JSON.parse(text);
    } catch (e) {
      return { ok: false, reason: '文件不是合法 JSON：' + (e && e.message ? e.message : String(e)) };
    }
    if (!pack || typeof pack !== 'object') return { ok: false, reason: '备份结构不是对象' };
    if (pack.app !== APP) return { ok: false, reason: '这不是英研社备份文件（app 标识不符）' };
    if (!pack.data || typeof pack.data !== 'object') return { ok: false, reason: '备份文件中缺少 data 数据区' };
    if (!pack.hasOwnProperty('version')) pack.version = 1; // 兼容最早期导出
    return { ok: true, pack: pack };
  };

  /**
   * 触发浏览器下载 JSON 备份文件
   * @param {string} filename 文件名（建议含日期）
   * @param {string} text JSON 字符串
   */
  Backup.download = function (filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  /**
   * 恢复备份到 localStorage（全量写回，失败可回滚）
   * @param {object} data 备份包中的 data 键值对
   * @param {function} [onEach] 每键写回前的回调，可拦截；返回 false 则跳过该键
   * @returns {{ok:true, applied:number}|{ok:false, reason:string, applied:number}}
   */
  Backup.restore = function (data, onEach) {
    var applied = 0;
    var backup = {};
    var keys = Object.keys(data);

    // 1) 先备份当前状态，用于失败回滚
    keys.forEach(function (k) {
      if (localStorage.getItem(k) !== null) backup[k] = localStorage.getItem(k);
    });

    try {
      keys.forEach(function (k) {
        if (onEach && typeof onEach === 'function') {
          if (onEach(k, data[k]) === false) return;
        }
        localStorage.setItem(k, data[k]);
        applied++;
      });
    } catch (e) {
      // 2) 回滚：写回被改前的状态，删除原本不存在的键
      keys.forEach(function (k) {
        if (backup.hasOwnProperty(k)) localStorage.setItem(k, backup[k]);
        else localStorage.removeItem(k);
      });
      return { ok: false, reason: '写入失败已回滚：' + (e && e.message ? e.message : String(e)), applied: applied };
    }
    return { ok: true, applied: applied };
  };

})(typeof window !== 'undefined' ? window : globalThis);