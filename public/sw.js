// Service Worker：让网页可以“添加到主屏幕”，并在断网时仍能打开页面、查看示例题。
// 策略：页面和静态文件“网络优先、失败时用缓存”——在线时总是拿到最新代码（改了代码刷新就生效），
// 离线时退回缓存。/api/ 接口永远直接走网络，不缓存。
const CACHE = 'shuxing-v3';
const SHELL = [
  '/', '/index.html', '/styles.css', '/app.js', '/examples.js', '/manifest.webmanifest',
  '/lib/api.js', '/lib/api-device.js', '/lib/checks.js', '/lib/constraints.js', '/lib/expr.js', '/lib/gbnf.js', '/lib/geom.js', '/lib/image.js',
  '/lib/labelLayout.js', '/lib/labels.js', '/lib/markdown.js', '/lib/partial-json.js', '/lib/pipeline.js', '/lib/prompts.js', '/lib/render2d.js', '/lib/render3d.js',
  '/lib/repair.js', '/lib/runs.js',
  '/lib/scene.js', '/lib/theme.js',
  '/vendor/katex/katex.min.js', '/vendor/katex/katex.min.css',
  '/vendor/jsxgraph/jsxgraphcore.js', '/vendor/jsxgraph/jsxgraph.css',
  '/icons/icon-192.png', '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error()))),
  );
});
