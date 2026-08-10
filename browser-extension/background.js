// background.js - English Study Club Service Worker

const NATIVE_HOST_NAME = 'com.englishstudyclub.nativehost';
let nativePort = null;
let pendingRequests = new Map();
let requestId = 0;

// ============================================================
// Native Messaging Connection
// ============================================================

function connectNativeHost() {
  if (nativePort) {
    try {
      nativePort.disconnect();
    } catch (e) { /* ignore */ }
    nativePort = null;
  }

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    console.log('[English Study Club] Connected to native host');

    nativePort.onMessage.addListener((message) => {
      console.log('[English Study Club] Native host message:', message);
      if (message.requestId !== undefined && pendingRequests.has(message.requestId)) {
        const { resolve } = pendingRequests.get(message.requestId);
        pendingRequests.delete(message.requestId);
        resolve(message);
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('[English Study Club] Native host disconnected');
      nativePort = null;
      // Reject all pending requests
      pendingRequests.forEach(({ reject }, id) => {
        reject(new Error('Native host disconnected'));
      });
      pendingRequests.clear();
      updateConnectionStatus(false);
    });

    updateConnectionStatus(true);
    return true;
  } catch (err) {
    console.error('[English Study Club] Failed to connect native host:', err.message);
    nativePort = null;
    updateConnectionStatus(false);
    return false;
  }
}

function updateConnectionStatus(connected) {
  chrome.storage.local.set({ nativeHostConnected: connected });
}

function isNativeHostConnected() {
  return nativePort !== null;
}

function sendToNativeHost(data) {
  return new Promise((resolve, reject) => {
    if (!nativePort) {
      reject(new Error('Native host not connected'));
      return;
    }

    const id = ++requestId;
    const message = { ...data, requestId: id };
    pendingRequests.set(id, { resolve, reject });

    try {
      nativePort.postMessage(message);
    } catch (err) {
      pendingRequests.delete(id);
      reject(err);
    }

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// ============================================================
// Message Handlers
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping to check connection status
  if (request.action === 'ping') {
    sendResponse({ connected: isNativeHostConnected() });
    return true;
  }

  // Write file via native host
  if (request.action === 'write') {
    if (!request.path || request.content === undefined) {
      sendResponse({ success: false, error: 'Missing path or content' });
      return true;
    }

    if (!isNativeHostConnected()) {
      sendResponse({ success: false, error: 'Native host not connected' });
      return true;
    }

    sendToNativeHost({
      command: 'write',
      path: request.path,
      content: request.content
    }).then(result => {
      sendResponse({ success: true, result: result });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });

    return true; // Keep channel open for async response
  }

  // Get connection status
  if (request.action === 'getStatus') {
    sendResponse({ connected: isNativeHostConnected() });
    return true;
  }
});

// ============================================================
// Lifecycle
// ============================================================

// Try to connect on startup
connectNativeHost();

// Keep service worker alive for native messaging
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepalive') {
    port.onDisconnect.addListener(() => {
      // Service worker may be terminated
    });
  }
});

// Reconnect if needed
setInterval(() => {
  if (!isNativeHostConnected()) {
    console.log('[English Study Club] Attempting reconnection to native host...');
    connectNativeHost();
  }
}, 60000);
