/* ============================================================
   sw.js — 英研社移动端 Service Worker
   策略：核心资源预缓存（install）+ stale-while-revalidate（运行时）
   目的：添加到主屏后，离线也能打开并使用。图标已本地化（vendor/
        lucide.min.js），离线不再依赖 CDN。
   版本化：APP_VER 为本地于 sw.js 的唯一版本号，同时用作缓存 key
        命名空间与 index.html 注册 URL 的 ?v=（两者一致，改资源即
        bump APP_VER，离线不命中旧缓存）。
   ============================================================ */
const PREFIX = 'esc-mobile';
const APP_VER = 'v3';
const VERSION = PREFIX + '-' + APP_VER;
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/theme.css',
  './css/views-quiz.css',
  './css/views-cloze.css',
  './css/views-sent.css',
  './vendor/lucide.min.js',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/ui.js',
  './js/api.js',
  './js/speech.js',
  './js/views/home.js',
  './js/views/vocab.js',
  './js/views/history.js',
  './js/views/history_detail.js',
  './js/views/memory.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安装：预缓存核心资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求拦截：导航与同域资源走 stale-while-revalidate；跨域（CDN）走网络优先、失败回退缓存
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 仅处理同源或导航请求（原 !req.mode === 'navigate' 因运算符优先级恒为 false，已修正）
  if (url.origin !== self.location.origin && req.mode !== 'navigate') return;

  // 导航请求：网络优先，失败回退缓存首页（离线可开）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 同源静态资源：缓存优先，后台更新（stale-while-revalidate）
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
