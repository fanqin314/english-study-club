// background.js - 英研社 (English Study Club) Service Worker
//
// 说明：本插件不再依赖 native messaging host（本地文件夹持久化已废弃）。
// 保存采集统一走「下载兜底」或「网页端 companion 实时写入」，因此后台无需连接 native host。

// ============================================================
// Message Handlers
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping：返回连接状态（本地 host 已废弃，恒为 false，避免页面误用）
  if (request.action === 'ping') {
    sendResponse({ connected: false });
    return true;
  }

  // 兼容旧调用：写文件走 native host 的接口已停用，直接返回未连接
  if (request.action === 'write') {
    sendResponse({ success: false, error: '本地写入已停用，采集将自动下载保存' });
    return true;
  }

  // 获取连接状态
  if (request.action === 'getStatus') {
    sendResponse({ connected: false });
    return true;
  }
});

// ============================================================
// Lifecycle
// ============================================================
// 仅保留 service worker 存活，不再连接 native host。
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepalive') {
    port.onDisconnect.addListener(() => { /* noop */ });
  }
});

// ============================================================
// Side Panel：点击工具栏图标从右侧拉出常驻侧边栏
// ============================================================
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.warn('[英研社] 打开侧边栏失败：', e);
  }
});

console.log('[英研社] 后台 Service Worker 已加载');
