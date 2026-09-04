/* ═══════════════════════════════════════════════════════════════
   Plant Book – User Portal
   sw.js — PWA Service Worker with Robust Offline & Cache Engine
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'pb-farmer-cache-v1.2.0';

const STATIC_ASSETS = [
  '/user/',
  '/user/index.html',
  '/user/manifest.json',
  '/user/css/user-layout.css?v=1.2.0',
  '/user/js/auth.js?v=1.2.0',
  '/user/js/app.js?v=1.2.0',
  '/user/js/core/api.js?v=1.2.0',
  '/user/js/core/config.js?v=1.2.0',
  '/user/js/core/router.js?v=1.2.0',
  '/user/js/core/utils.js?v=1.2.0',
  '/user/js/core/websocket.js?v=1.2.0',
  '/user/js/modules/dashboard.js?v=1.2.0',
  '/user/js/modules/plants.js?v=1.2.0',
  '/user/js/modules/notifications.js?v=1.2.0',
  '/user/js/modules/logs.js?v=1.2.0',
  '/user/js/modules/reminders.js?v=1.2.0',
  '/user/js/modules/care-modal.js?v=1.2.0',
  '/user/js/modules/media.js?v=1.2.0',
  '/user/js/modules/map.js?v=1.2.0',
  '/user/js/modules/fab.js?v=1.2.0',
  '/user/js/modules/settings.js?v=1.2.0',
  '/user/js/modules/weather-clock.js?v=1.2.0',
  '/user/js/modules/mascot-chibi.js?v=1.2.0',
  '/user/js/modules/countup.js?v=1.2.0',
  '/user/js/modules/nfc.js?v=1.2.0',
  '/assets/favicon.png',
  '/assets/logo.png',
  '/assets/login-hero.jpg'
];

// 1. Install Event — Pre-cache critical assets safely with Promise.allSettled
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-cache non-fatal warning for ${url}:`, err.message);
          })
        )
      );
    })
  );
});

// 2. Activate Event — Clean up stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event — Guaranteed valid Response object in all circumstances
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (req.method !== 'GET') {
    return;
  }

  // Skip cross-origin, API, WebSocket, Mapbox, and browser extension requests
  const url = new URL(req.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/sockjs-node/') ||
    url.protocol !== 'http:' && url.protocol !== 'https:'
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Strategy 1: Check cache with exact match
        const exactCached = await caches.match(req);
        if (exactCached) {
          return exactCached;
        }

        // Strategy 2: Check cache ignoring search query params (?v=1.2.0)
        const fuzzyCached = await caches.match(req, { ignoreSearch: true });
        if (fuzzyCached) {
          return fuzzyCached;
        }

        // Strategy 3: Fetch from network
        const networkResponse = await fetch(req);

        // Dynamically cache valid GET responses for local assets
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          !url.pathname.startsWith('/api/')
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, networkResponse.clone()).catch(() => {});
        }

        return networkResponse;
      } catch (err) {
        console.warn(`[SW] Network fetch failed for ${req.url}:`, err);

        // Fallback A: Document Navigation -> Return cached index.html or offline fallback page
        if (req.mode === 'navigate') {
          const fallbackDoc =
            (await caches.match('/user/index.html')) ||
            (await caches.match('/user/')) ||
            (await caches.match('/user/index.html', { ignoreSearch: true }));

          if (fallbackDoc) {
            return fallbackDoc;
          }

          return new Response(
            `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sổ Nông Tân Bảo — Chế độ Ngoại tuyến</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 40px 20px; }
    .card { background: #1e293b; max-width: 480px; margin: 40px auto; padding: 32px 24px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
    h1 { color: #10b981; font-size: 22px; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14.5px; line-height: 1.6; margin-bottom: 24px; }
    button { background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 48px; margin-bottom: 16px;">🌱</div>
    <h1>Bạn đang ở chế độ Ngoại tuyến</h1>
    <p>Hiện không thể kết nối tới máy chủ Sổ Nông Tân Bảo. Vui lòng kiểm tra lại kết nối WiFi / 4G của bạn và thử lại.</p>
    <button onclick="window.location.reload()">Thử tải lại trang</button>
  </div>
</body>
</html>`,
            {
              status: 503,
              statusText: 'Service Unavailable (Offline)',
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        }

        // Fallback B: Images -> Return cached logo or transparent 1x1 GIF
        if (req.destination === 'image' || req.url.match(/\.(png|jpg|jpeg|svg|webp|ico|gif)$/i)) {
          const cachedImg =
            (await caches.match('/assets/favicon.png')) ||
            (await caches.match('/assets/logo.png'));
          if (cachedImg) {
            return cachedImg;
          }

          // 1x1 Transparent GIF buffer
          const transparentGif = new Uint8Array([
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
            0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
            0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
            0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
          ]);

          return new Response(transparentGif, {
            status: 200,
            headers: { 'Content-Type': 'image/gif' }
          });
        }

        // Fallback C: All other assets (CSS, JS, Fonts) -> Return safe empty 504 Response
        return new Response('', {
          status: 504,
          statusText: 'Gateway Timeout (Offline)'
        });
      }
    })()
  );
});
