// browser-companion.js
// 网页端 companion：接收 English Study Club 浏览器插件（content script）的消息，
// 让插件能"看到"网页端生词本并实时加词。
// 通信采用 window.postMessage（同源、无需 manifest 的 externally_connectable）。
// 协议：
//   插件 -> 网页：{ source:'esc-browser-ext', type:'esc_getNotebooks'|'esc_createNotebook'|'esc_addWord', reqId, payload }
//   网页 -> 插件：{ source:'esc-web-companion', type:'esc_response', reqId, ok, data|error }
(function () {
  'use strict';

  function post(res) {
    res.source = 'esc-web-companion';
    window.postMessage(res, '*');
  }

  function handleGetNotebooks(reqId) {
    try {
      const VD = window.VocabData;
      if (!VD) {
        post({ type: 'esc_response', reqId: reqId, ok: false, error: 'VocabData 未就绪' });
        return;
      }
      const notebooks = VD.getAllNotebooks() || {};
      const list = Object.keys(notebooks).map(function (id) {
        return { id: id, name: notebooks[id].name || '未命名', count: (notebooks[id].words || []).length };
      });
      post({ type: 'esc_response', reqId: reqId, ok: true, data: { notebooks: list, currentId: VD.getCurrentNotebookId() } });
    } catch (e) {
      post({ type: 'esc_response', reqId: reqId, ok: false, error: String(e && e.message || e) });
    }
  }

  function handleCreateNotebook(reqId, payload) {
    try {
      const VD = window.VocabData;
      const name = (payload && payload.name || '').trim();
      if (!name) {
        post({ type: 'esc_response', reqId: reqId, ok: false, error: '生词本名称不能为空' });
        return;
      }
      const r = VD.createNotebook(name);
      if (!r.success) {
        post({ type: 'esc_response', reqId: reqId, ok: false, error: r.error });
        return;
      }
      post({ type: 'esc_response', reqId: reqId, ok: true, data: { id: r.id, name: r.name } });
    } catch (e) {
      post({ type: 'esc_response', reqId: reqId, ok: false, error: String(e && e.message || e) });
    }
  }

  function handleAddWord(reqId, payload) {
    try {
      const VD = window.VocabData;
      const notebookId = payload && payload.notebookId;
      const wordData = payload && payload.wordData;
      if (!notebookId || !wordData || !wordData.word) {
        post({ type: 'esc_response', reqId: reqId, ok: false, error: '参数缺失' });
        return;
      }
      const r = VD.addWord(notebookId, {
        word: wordData.word,
        meaning: wordData.meaning || '',
        pos: wordData.pos || '',
        context: wordData.context || '',
        timestamp: wordData.timestamp || Date.now()
      });
      if (!r.success) {
        post({ type: 'esc_response', reqId: reqId, ok: false, error: r.error });
        return;
      }
      post({ type: 'esc_response', reqId: reqId, ok: true, data: { added: true } });
    } catch (e) {
      post({ type: 'esc_response', reqId: reqId, ok: false, error: String(e && e.message || e) });
    }
  }

  // 把网页端已存的 API 配置（Key/BaseUrl/Model）提供给插件，避免插件重复填 Key。
  // 注意：仅暴露 baseUrl/apiKey/model，忽略代理（插件直连 modelscope）。
  function handleGetApiConfig(reqId) {
    try {
      const cfg = (window.Security && window.Security.getApiConfig && window.Security.getApiConfig()) || {};
      post({
        type: 'esc_response',
        reqId: reqId,
        ok: true,
        data: {
          baseUrl: cfg.baseUrl || '',
          apiKey: cfg.apiKey || '',
          model: cfg.model || '',
        },
      });
    } catch (e) {
      post({ type: 'esc_response', reqId: reqId, ok: false, error: String(e && e.message || e) });
    }
  }

  window.addEventListener('message', function (ev) {
    // 只处理来自同窗口（插件 content script 注入到本页面）且带标识的消息
    const msg = ev.data;
    if (!msg || msg.source !== 'esc-browser-ext' || msg.type !== 'esc_request') return;
    try {
      const action = msg.action;
      const reqId = msg.reqId;
      const payload = msg.payload;
      if (action === 'esc_getNotebooks') handleGetNotebooks(reqId);
      else if (action === 'esc_createNotebook') handleCreateNotebook(reqId, payload);
      else if (action === 'esc_addWord') handleAddWord(reqId, payload);
      else if (action === 'esc_getApiConfig') handleGetApiConfig(reqId);
      else post({ type: 'esc_response', reqId: reqId, ok: false, error: '未知操作: ' + action });
    } catch (e) {
      // 静默失败，不干扰网页
    }
  });

  // 通知插件：companion 已就绪
  post({ type: 'esc_ready' });
})();
