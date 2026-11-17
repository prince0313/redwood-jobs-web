/* Redwood Jobs service worker: keeps the app working offline. */
const VERSION = 'rj-20261117.1653';
const SHELL = ['./', 'index.html', 'app.js', 'est.js', 'cloud.js', 'pwa.js', 'jspdf.umd.min.js', 'jspdf.autotable.min.js',
  'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = req.mode === 'navigate' ? './' : req;
    const hit = await cache.match(key, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(key, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
