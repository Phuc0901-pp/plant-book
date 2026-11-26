const CACHE_NAME = 'pb-farmer-cache-v1.3.7-ops1';

const STATIC_ASSETS = [
  '/user/',
  '/user/index.html',
  '/user/manifest.json',
  '/user/css/user-layout.css',
  '/user/js/auth.js',
  '/user/js/app.js',
  '/user/js/supplies.js',
  '/user/js/core/api.js',
  '/user/js/core/config.js',
  '/user/js/core/router.js',
  '/user/js/core/utils.js',
  '/user/js/core/websocket.js',
  '/user/js/core/offline-db.js',
  '/user/js/core/offline-sync.js',
  '/user/js/modules/dashboard.js',
  '/user/js/modules/plants.js',
  '/user/js/modules/plants-iot-weather.js',
  '/user/js/modules/plants-profile-erp.js',
  '/user/js/modules/notifications.js',
  '/user/js/modules/logs.js',
  '/user/js/modules/reminders.js',
  '/user/js/modules/care-modal.js',
  '/user/js/modules/media.js',
  '/user/js/modules/map.js',
  '/user/js/modules/fab.js',
  '/user/js/modules/settings.js',
  '/user/js/modules/weather-clock.js',
  '/user/js/modules/mascot-chibi.js',
  '/user/js/modules/countup.js',
  '/user/js/modules/nfc.js',
  '/js/i18n-engine.js',
  '/js/bi-analytics-widget.js',
  '/assets/js/lucide-auto-hydrator.js',
  '/assets/js/chibi-iso-icons.js',
  '/assets/js/enterprise-security-guard.js',
  '/user/img/chibi_mascot.png',
  '/user/img/iot_sensors.jpg',
  '/user/img/nfc_tag.png',
  '/assets/favicon.png',
  '/assets/logo.png',
  '/assets/login-hero.jpg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-cache warning for ${url}:`, err.message);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/sockjs-node/') ||
    (url.protocol !== 'http:' && url.protocol !== 'https:')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(req);

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
        console.warn(`[SW] Network fetch failed (offline mode) for ${req.url}:`, err.message);

        const exactCached = await caches.match(req);
        if (exactCached) {
          return exactCached;
        }

        if (req.mode === 'navigate' || req.destination === 'document') {
          const fallbackDoc =
            (await caches.match('/user/index.html')) ||
            (await caches.match('/user/'));

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
    <div style="margin-bottom: 16px;"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg></div>
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

        if (req.destination === 'image' || req.url.match(/\.(png|jpg|jpeg|svg|webp|ico|gif)$/i)) {
          const cachedImg =
            (await caches.match('/assets/favicon.png')) ||
            (await caches.match('/assets/logo.png'));
          if (cachedImg) {
            return cachedImg;
          }

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

        return new Response('', {
          status: 504,
          statusText: 'Gateway Timeout (Offline)'
        });
      }
    })()
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'Sổ Nông Nhàn TBSG', message: event.data ? event.data.text() : 'Có thông báo mới từ hệ thống.' };
  }
  const title = payload.title || 'Tân Bảo AgTech — Thông báo';
  const body = payload.message || payload.body || 'Kiểm tra cập nhật mới từ trang trại.';
  const isDanger = payload.severity === 'danger' || payload.type === 'danger';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/assets/logo.png',
      badge: '/assets/favicon.png',
      tag: payload.event_code || 'tbsg-notif',
      vibrate: isDanger ? [250, 120, 250, 120, 250] : [120, 60, 120],
      data: { url: payload.url || '/user/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/user/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
