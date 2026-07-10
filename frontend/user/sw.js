/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   sw.js — PWA Service Worker for offline support and speed
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'pb-farmer-cache-v1';
const ASSETS = [
  '/user/',
  '/user/index.html',
  '/user/css/user-layout.css',
  '/user/js/auth.js',
  '/user/js/app.js',
  '/user/js/core/api.js',
  '/user/js/core/router.js',
  '/user/js/core/utils.js',
  '/user/js/core/websocket.js',
  '/user/js/modules/dashboard.js',
  '/user/js/modules/plants.js',
  '/user/js/modules/logs.js',
  '/user/js/modules/reminders.js',
  '/user/js/modules/care-modal.js',
  '/user/js/modules/media.js',
  '/user/js/modules/map.js',
  '/user/js/modules/fab.js',
  '/assets/logo.png',
  '/assets/login-hero.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => console.warn('PWA Asset caching error during installation:', err));
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests and skip API / external CDN requests
  if (e.request.method !== 'GET' || e.request.url.includes('/api/') || !e.request.url.startsWith(self.location.origin)) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).then((response) => {
        // Cache newly fetched assets
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, response.clone());
          return response;
        });
      }).catch(() => {
        // Fallback for document navigation if offline
        if (e.request.mode === 'navigate') {
          return caches.match('/user/');
        }
      });
    })
  );
});
