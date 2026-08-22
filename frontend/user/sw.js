/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   sw.js — PWA Service Worker for offline support and speed
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'pb-farmer-cache-v4.0.0';
const ASSETS = [
  '/user/',
  '/user/index.html',
  '/user/css/user-layout.css?v=4.0.0',
  '/user/js/auth.js?v=4.0.0',
  '/user/js/app.js?v=4.0.0',
  '/user/js/core/api.js?v=4.0.0',
  '/user/js/core/router.js?v=4.0.0',
  '/user/js/core/utils.js?v=4.0.0',
  '/user/js/core/websocket.js?v=4.0.0',
  '/user/js/modules/dashboard.js?v=4.0.0',
  '/user/js/modules/plants.js?v=4.0.0',
  '/user/js/modules/notifications.js?v=4.0.0',
  '/user/js/modules/logs.js?v=4.0.0',
  '/user/js/modules/reminders.js?v=4.0.0',
  '/user/js/modules/care-modal.js?v=4.0.0',
  '/user/js/modules/media.js?v=4.0.0',
  '/user/js/modules/map.js?v=4.0.0',
  '/user/js/modules/fab.js?v=4.0.0',
  '/assets/logo.png',
  '/assets/login-hero.jpg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => console.warn('PWA Asset caching error during installation:', err));
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Clearing old PWA cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
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
