// settings.js - English Study Club Settings Page

const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const statusDesc = document.getElementById('statusDesc');
const reconnectBtn = document.getElementById('reconnectBtn');
const reconnectLabel = reconnectBtn.querySelector('.btn-label');

async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'ping' });
    if (response && response.connected) {
      statusDot.classList.remove('disconnected');
      statusDot.classList.add('connected');
      statusLabel.textContent = '已连接';
      statusDesc.textContent = 'Native Host 服务运行正常';
    } else {
      statusDot.classList.remove('connected');
      statusDot.classList.add('disconnected');
      statusLabel.textContent = '未连接';
      statusDesc.textContent = 'Native Host 服务未运行或未安装';
    }
  } catch (e) {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusLabel.textContent = '未连接';
    statusDesc.textContent = '无法获取连接状态: ' + e.message;
  }
}

reconnectBtn.addEventListener('click', async () => {
  reconnectBtn.disabled = true;
  reconnectBtn.classList.add('loading');
  reconnectLabel.textContent = '连接中...';
  await updateStatus();
  setTimeout(() => {
    reconnectBtn.disabled = false;
    reconnectBtn.classList.remove('loading');
    reconnectLabel.textContent = '重新连接';
  }, 2000);
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
});