const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db');
const { ensureBucket } = require('./config/supabase');
const initDB = require('./db/init');
const http = require('http');
const WebSocket = require('ws');
const compression = require('compression');
const jwt = require('jsonwebtoken');

function extractWsTokenFromReq(req) {
  if (!req || !req.headers) return { provided: false, token: null };
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
    const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    return { provided: true, token: raw };
  }
  const proto = req.headers['sec-websocket-protocol'];
  if (typeof proto === 'string' && proto.trim().length > 0) {
    const parts = proto.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts.length >= 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
      return { provided: true, token: candidate };
    }
  }
  try {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    if (urlObj.searchParams.has('token')) {
      return { provided: true, token: (urlObj.searchParams.get('token') || '').trim() };
    }
  } catch (_) {}
  return { provided: false, token: null };
}

function authenticateWsToken(rawToken) {
  if (!rawToken || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    return {
      id: decoded.id,
      role: decoded.role || 'farmer',
      sub_role: decoded.sub_role || null,
      farm_id: decoded.farm_id || null,
      parent_user_id: decoded.parent_user_id || null
    };
  } catch (_) {
    return null;
  }
}

function shouldDeliverBroadcast(wsUser, event, data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (event === 'new_notification') {
    const targetUserId = payload.target_user_id ?? payload.targetUserId ?? null;
    return Boolean(wsUser && targetUserId !== null && Number(wsUser.id) === Number(targetUserId));
  }
  const scopedFarmId = payload.farmId ?? payload.farm_id ?? null;
  const scopedUserId = payload.userId ?? payload.user_id ?? null;
  const isSensitiveUserEvent = event === 'user_status_changed' || event === 'user_registered';
  if (scopedFarmId !== null || scopedUserId !== null || isSensitiveUserEvent) {
    if (!wsUser) return false;
    if (wsUser.role === 'admin') return true;
    if (scopedFarmId !== null && wsUser.farm_id && Number(wsUser.farm_id) === Number(scopedFarmId)) return true;
    if (scopedUserId !== null && (Number(wsUser.id) === Number(scopedUserId) || (wsUser.parent_user_id && Number(wsUser.parent_user_id) === Number(scopedUserId)))) return true;
    if (isSensitiveUserEvent && payload.id && Number(wsUser.id) === Number(payload.id)) return true;
    return false;
  }
  return Boolean(wsUser || payload.public === true);
}

function createScopedBroadcast(clients) {
  return (event, data) => {
    try {
      const payload = JSON.stringify({ event, data });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN && shouldDeliverBroadcast(client.user || null, event, data)) {
          try {
            client.send(payload, (err) => {
              if (err) clients.delete(client);
            });
          } catch (e) {
            clients.delete(client);
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Broadcast error:', err);
    }
  };
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

try {
  const { buildAll } = require('./scripts/build-html');
  buildAll();
} catch (e) {
  console.warn('[server] Warning running HTML component builder:', e.message);
}

const { securityHeaders, buildCorsOptions } = require('./middleware/securityHeaders');
const authMiddleware = require('./middleware/auth');
const adminMiddleware = require('./middleware/admin');
const adminIpGuard = require('./middleware/adminIpGuard');
const dlpAntiExfiltration = require('./middleware/dlpAntiExfiltration');
const { apmRequestMiddleware, getApmSummary, renderPrometheusMetrics, metricsAuthGuard } = require('./services/apmMetricsService');
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(compression());
app.use(cors(buildCorsOptions()));
app.use(apmRequestMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/assets/favicon.ico'));
});

app.use(['/user/img', '/img', '/usr-*/img', '/usr-*/*/img'], express.static(path.join(__dirname, '../frontend/user/img')));

app.use(express.static(path.join(__dirname, '../frontend'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      if (filePath.endsWith('sw.js')) res.setHeader('Service-Worker-Allowed', '/');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

app.use(express.static(path.join(__dirname, '../frontend/public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

app.use(['/build_output', '/'], express.static(path.join(__dirname, '../build_output'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    } else if (filePath.endsWith('.ipa')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
  }
}));

const { getAppVersion } = require('./config/appConfig');
app.get(['/health', '/healthz', '/api/health'], async (req, res) => {
  let dbStatus = 'up';
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB_HEALTH_TIMEOUT')), 2000))
    ]);
  } catch (err) {
    dbStatus = 'down';
  }

  let cacheMode = 'memory';
  let cacheStatus = 'up';
  try {
    const redisModule = require('./config/redis');
    if (redisModule && typeof redisModule.isRedisConnected === 'function' && redisModule.isRedisConnected()) {
      cacheMode = 'redis';
      if (redisModule.redisClient && typeof redisModule.redisClient.ping === 'function') {
        await Promise.race([
          redisModule.redisClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_HEALTH_TIMEOUT')), 1500))
        ]);
      }
    }
  } catch (err) {
    cacheStatus = 'degraded';
  }

  const healthy = dbStatus === 'up';
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    app: `Plant Book API ${getAppVersion()}`,
    checks: {
      database: dbStatus,
      cache: cacheStatus,
      cache_mode: cacheMode
    }
  });
});

const { antiScraper, apiLimiter } = require('./middleware/antiScraper');
const { userRateLimiter } = require('./middleware/userRateLimiter');

app.use('/api', antiScraper);
app.use('/api', apiLimiter);
app.use('/api', userRateLimiter);

app.get('/api', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host');
  const base = `${protocol}://${host}/api`;
  res.json({
    version: '8.30.5-AGTECH-ISO27001',
    standard: 'Gallagher-REST-HATEOAS-8.30 / ISO-25010 / ISO-27001 / GlobalGAP-v6 / IPCC-Carbon-MRV',
    server_time: new Date().toISOString(),
    features: {
      farms: {
        farms: { href: `${base}/farms` },
        live_dataset_template: { href: `${base}/farms/{id}/full-dataset?api_key={api_key}` },
        delta_sync_template: { href: `${base}/farms/{id}/full-dataset?api_key={api_key}&updated_after={iso_timestamp}` },
        field_filter_template: { href: `${base}/farms/{id}/full-dataset?api_key={api_key}&fields=farm_profile,plants_and_cultivation,iso27001_governance_and_carbon_mrv` }
      },
      biological_entities: {
        items: { href: `${base}/plants` },
        schemas: { href: `${base}/schemas` }
      },
      nfc_cards: {
        cards: { href: `${base}/nfc` },
        card_types: ['NTAG213_CRYPTO', 'NTAG216_PIV', 'MIFARE_DESFIRE_EV3']
      },
      supplies_and_inventory: {
        supplies: { href: `${base}/supplies` },
        costs: { href: `${base}/costs` }
      },
      iot_and_devices: {
        devices: { href: `${base}/devices` },
        diagnostics: { href: `${base}/diagnostics` }
      },
      gis_spatial_engine: {
        vector_tiles: { href: `${base}/gis/tiles/{z}/{x}/{y}.pbf` },
        clusters: { href: `${base}/gis/clusters?bbox={minLon,minLat,maxLon,maxLat}&zoom={zoom}&farm_id={farm_id}` },
        metrics: { href: `${base}/gis/metrics` }
      },
      audit_and_events: {
        events: { href: `${base}/history` },
        iso27001_hash_chain: { enabled: true, algorithm: 'SHA-256' },
        carbon_mrv_engine: { enabled: true, methodology: 'IPCC-2006-AFOLU-Tier2 / Chave-et-al-2014' }
      },
      bi_analytics_and_i18n: {
        bi_overview: { href: `${base}/analytics/bi-overview` },
        cost_breakdown: { href: `${base}/analytics/cost-breakdown` },
        plot_comparison: { href: `${base}/analytics/plot-comparison` },
        predictive_yield: { href: `${base}/analytics/predictive-yield` },
        i18n_dictionary: { href: `${base}/analytics/i18n/{lang}`, supported: ['vi', 'en', 'zh'] }
      }
    }
  });
});

app.use('/api/version', require('./routes/version'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schemas', require('./routes/schemas'));
app.use('/api/plants', dlpAntiExfiltration, require('./routes/plants'));
app.use('/api/nfc', require('./routes/plants'));
app.use('/api/gis', require('./routes/gis'));
app.use('/api/config', require('./routes/config'));
app.use('/api/farms', dlpAntiExfiltration, require('./routes/farms'));
app.use('/api/users', dlpAntiExfiltration, require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/supplies', require('./routes/supplies'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/costs', require('./routes/costs'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/history', require('./routes/history'));
app.use('/api/database', authMiddleware, adminMiddleware, adminIpGuard, dlpAntiExfiltration, require('./routes/database'));
app.use('/api/ai/training', require('./routes/ai_training'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/diagnostics', require('./routes/diagnostics'));
app.get('/metrics', metricsAuthGuard(authMiddleware, adminMiddleware), (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(renderPrometheusMetrics(pool, activeWss));
});
app.get('/api/admin/apm/summary', authMiddleware, adminMiddleware, adminIpGuard, (req, res) => {
  res.json(getApmSummary(pool, activeWss));
});
app.get('/api/admin/security-incidents', authMiddleware, adminMiddleware, adminIpGuard, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10) || 50));
    const r = await pool.query(
      `SELECT id, event_type, severity, user_id, ip_address, route_path, details, created_at
       FROM security_incidents
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, count: r.rows.length, incidents: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải nhật ký sự cố bảo mật: ' + err.message });
  }
});
app.use('/api', require('./middleware/errorHandler'));

app.get([
  '/user',
  '/user/*',
  '/usr-*',
  '/usr-*/*'
], (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, '../frontend/user/index.html'));
});
app.get([
  '/plant/:slug/report',
  '/:farmId/public/:slug/report',
  '/:farmId/public/report',
  '/:farmId/:plantId/report',
  '/:farmId/:plantId/:nfcUid/report',
  '/:userId/:farmId/:plantId/:nfcUid/report'
], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/report.html'));
});

app.get([
  '/plant/:slug/map',
  '/:farmId/public/:slug/map',
  '/:farmId/public/map',
  '/:farmId/:plantId/map',
  '/:farmId/:plantId/:nfcUid/map',
  '/:userId/:farmId/:plantId/:nfcUid/map'
], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/map.html'));
});

app.get('/nfc/:uid', async (req, res) => {
  try {
    const uid = req.params.uid.trim();
    const result = await pool.query(
      `SELECT p.id, p.farm_id, p.nfc_uid, f.user_id
       FROM plants p
       LEFT JOIN farms f ON f.id = p.farm_id
       WHERE UPPER(p.nfc_uid) = UPPER($1) OR p.public_slug = $1 OR p.id::text = $1`,
      [uid]
    );
    if (result.rows.length > 0) {
      const p = result.rows[0];
      const uidSuffix = p.nfc_uid ? `/${encodeURIComponent(p.nfc_uid)}` : '';
      return res.redirect(`/${p.farm_id || 0}/${p.id}${uidSuffix}`);
    }
    res.status(404).send('<div style="font-family:sans-serif; text-align:center; padding:50px;"><h2>⚠️ 404 - Không tìm thấy cây trồng tương ứng với mã thẻ NFC này</h2><p>Mã thẻ chưa được gán cho bất kỳ cây trồng nào trên hệ thống Plant Book.</p><a href="/">Về trang chủ</a></div>');
  } catch (err) {
    res.redirect('/');
  }
});

app.get('/plant/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/plant.html'));
});

app.get(['/sub', '/sub/*', '/sub.html'], (req, res, next) => {
  if (req.path.includes('.') && !req.path.endsWith('.html')) return next();
  res.sendFile(path.join(__dirname, '../frontend/public/sub.html'));
});

app.get(['/:farmId/public', '/:farmId/public/', '/:farmId/public/:nfcUid'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/plant.html'));
});

app.get(['/:farmId/:plantId/:nfcUid?', '/:userId/:farmId/:plantId/:nfcUid?'], (req, res, next) => {
  const reserved = ['admin', 'user', 'api', 'plant', 'nfc', 'assets', 'public', 'favicon.ico'];
  const fId = req.params.farmId || '';
  const uId = req.params.userId || '';
  if (reserved.includes(fId) || reserved.includes(uId) || fId.startsWith('adm-') || fId.startsWith('usr-') || uId.startsWith('adm-') || uId.startsWith('usr-')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/public/plant.html'));
});

app.get(['/adm-*', '/adm-*/*', '/admin', '/admin/*'], (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint API không tồn tại hoặc đã thay đổi.' });
});

app.use((err, req, res, next) => {
  const isApi = req.originalUrl && req.originalUrl.startsWith('/api');
  const statusCode = err.status || err.statusCode || 500;
  console.error(`[Server Error] [${req.method}] ${req.originalUrl}:`, err.message || err);
  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage = (isProd && statusCode >= 500)
    ? 'Lỗi hệ thống máy chủ. Vui lòng thử lại sau.'
    : (err.message || 'Lỗi xử lý yêu cầu hệ thống.');

  if (isApi) {
    return res.status(statusCode).json({
      success: false,
      error: safeMessage,
      code: err.code || 'INTERNAL_SERVER_ERROR'
    });
  }
  return res.status(statusCode).send('<h3>500 - Lỗi hệ thống</h3><p>Vui lòng thử lại sau.</p>');
});

let activeHttpServer = null;
let activeWss = null;
let sessionTimer = null;
let keepAliveTimer = null;
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`🛑 [Process Guard] Nhận tín hiệu ${signal}, bắt đầu đóng kết nối an toàn...`);

  const forceExitTimer = setTimeout(() => {
    process.exit(1);
  }, 10000);
  if (typeof forceExitTimer.unref === 'function') forceExitTimer.unref();

  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  try {
    const queueService = require('./services/queueService');
    if (queueService && typeof queueService.shutdown === 'function') {
      queueService.shutdown();
    }
  } catch (_) {}

  if (activeWss) {
    try {
      for (const client of activeWss.clients) {
        try { client.close(1001, 'SERVER_SHUTDOWN'); } catch (_) {}
      }
      await new Promise((resolve) => activeWss.close(() => resolve()));
    } catch (_) {}
  }

  if (activeHttpServer) {
    try {
      await new Promise((resolve) => activeHttpServer.close(() => resolve()));
    } catch (_) {}
  }

  try {
    const redisModule = require('./config/redis');
    if (redisModule && redisModule.redisClient && typeof redisModule.redisClient.quit === 'function') {
      await redisModule.redisClient.quit().catch(() => {});
    }
  } catch (_) {}

  try {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  } catch (_) {}

  process.exit(0);
}

async function start() {
  try {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    activeHttpServer = server;
    activeWss = wss;
    const clients = new Set();

    app.set('wsSecurity', {
      extractWsTokenFromReq,
      authenticateWsToken,
      shouldDeliverBroadcast,
      createScopedBroadcast
    });

    wss.on('connection', (ws, req) => {
      const { provided, token } = extractWsTokenFromReq(req);
      if (provided) {
        const decodedUser = authenticateWsToken(token);
        if (!decodedUser) {
          try { ws.close(4001, 'INVALID_WS_TOKEN'); } catch (_) {}
          return;
        }
        ws.user = decodedUser;
      } else {
        ws.user = null;
      }

      clients.add(ws);

      ws.on('message', (rawMsg) => {
        try {
          const parsed = JSON.parse(String(rawMsg || ''));
          if (parsed && parsed.type === 'auth') {
            const decodedUser = authenticateWsToken(parsed.token);
            if (!decodedUser) {
              try { ws.close(4001, 'INVALID_WS_TOKEN'); } catch (_) {}
              clients.delete(ws);
              return;
            }
            ws.user = decodedUser;
          }
        } catch (_) {}
      });

      ws.on('error', (err) => {
        console.warn('⚠️ WebSocket client error:', err.message);
        clients.delete(ws);
      });
      ws.on('close', () => {
        clients.delete(ws);
      });
    });

    const broadcast = createScopedBroadcast(clients);

    global.broadcastWS = broadcast;
    app.set('broadcast', broadcast);

    server.listen(PORT, async () => {
      console.log('\n╔══════════════════════════════════════════════════════════════════╗');
      console.log('║        🌿 TÂN BẢO SÀI GÒN AGTECH - PLANT BOOK PLATFORM           ║');
      console.log('║             Hệ Thống Quản Trị & Định Danh Số Cây Trồng           ║');
      console.log('╚══════════════════════════════════════════════════════════════════╝');
      console.log(`🚀 [Server Engine] Sẵn sàng tại cổng : http://localhost:${PORT}`);
      console.log(`📋 [Admin Portal]  Bảng điều khiển   : /admin`);
      console.log(`📱 [Smart Gateway] Cổng nạp thẻ NFC : /sub\n`);

      try {
        await initDB();
        await ensureBucket();
        console.log('[Database & Storage] ✅ Khởi tạo PostgreSQL DB Pool & Supabase Storage Thành Công');
      } catch (dbErr) {
        console.error('[Database Warning] ⚠️ Lỗi khởi tạo DB/Storage:', dbErr.message);
      }

      try {
        sessionTimer = setInterval(async () => {
          try {
            const res = await pool.query(`
              UPDATE users
              SET is_online = false
              WHERE is_online = true
                AND last_active_at < NOW() - INTERVAL '30 minutes'
              RETURNING id, email
            `);
            if (res.rows.length > 0) {
              console.log(`[Session Manager] 🧹 Đã thu hồi phiên ${res.rows.length} tài khoản không hoạt động:`, res.rows.map(r => r.email).join(', '));
              for (const u of res.rows) {
                await pool.query(`
                  INSERT INTO user_activities (user_id, activity_type, description)
                  VALUES ($1, 'Đăng xuất', 'Hệ thống tự động đăng xuất do không hoạt động (quá 30 phút)')
                `, [u.id]);

                if (global.broadcastWS) {
                  global.broadcastWS('user_status_changed', { id: u.id, is_online: false, last_active_at: new Date() });
                }
              }
            }
          } catch (err) {
            console.error('[Session Error] ⚠️ Lỗi dọn dẹp tài khoản không hoạt động:', err.message);
          }
        }, 30 * 60 * 1000);
        if (typeof sessionTimer.unref === 'function') sessionTimer.unref();
      } catch (poolErr) {
        console.error('[Session Timer Warning] ⚠️ Lỗi khởi tạo bộ hẹn giờ:', poolErr.message);
      }

      const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
      if (appUrl) {
        const pingUrl = `${appUrl.replace(/\/$/, '')}/api/health`;
        const httpModule = pingUrl.startsWith('https') ? require('https') : require('http');
        keepAliveTimer = setInterval(() => {
          httpModule.get(pingUrl, (res) => {
            console.log(`[Keep-Alive Engine] ⏰ Ping duy trì dịch vụ: ${pingUrl} (Mã phản hồi: ${res.statusCode})`);
          }).on('error', (e) => {
            console.warn(`[Keep-Alive Warning] ⚠️ Không thể ping dịch vụ: ${e.message}`);
          });
        }, 10 * 60 * 1000);
        if (typeof keepAliveTimer.unref === 'function') keepAliveTimer.unref();
      }
    });

  } catch (err) {
    console.error('❌ Startup error:', err);
    setTimeout(start, 5000);
  }
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Process Guard] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Process Guard] Uncaught Exception:', err);
});

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start,
  gracefulShutdown,
  extractWsTokenFromReq,
  authenticateWsToken,
  shouldDeliverBroadcast,
  createScopedBroadcast
};
