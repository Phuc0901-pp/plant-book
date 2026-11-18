const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureBucket } = require('./config/supabase');
const initDB = require('./db/init');
const http = require('http');
const WebSocket = require('ws');
const compression = require('compression');

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
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(compression());
app.use(cors(buildCorsOptions()));
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
app.get(['/health', '/healthz', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString(), app: `Plant Book API ${getAppVersion()}` });
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
app.use('/api/plants', require('./routes/plants'));
app.use('/api/nfc', require('./routes/plants'));
app.use('/api/gis', require('./routes/gis'));
app.use('/api/config', require('./routes/config'));
app.use('/api/farms', require('./routes/farms'));
app.use('/api/users', require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/supplies', require('./routes/supplies'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/costs', require('./routes/costs'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/history', require('./routes/history'));
app.use('/api/database', require('./routes/database'));
app.use('/api/ai/training', require('./routes/ai_training'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/diagnostics', require('./routes/diagnostics'));
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

app.get(['/usr-*', '/usr-*/*', '/user', '/user/*'], (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(__dirname, '../frontend/user/index.html'));
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

  if (isApi) {
    return res.status(statusCode).json({
      success: false,
      error: err.message || 'Lỗi xử lý yêu cầu hệ thống.',
      code: err.code || 'INTERNAL_SERVER_ERROR'
    });
  }
  return res.status(statusCode).send('<h3>500 - Lỗi hệ thống</h3><p>Vui lòng thử lại sau.</p>');
});

async function start() {
  try {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    const clients = new Set();

    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.on('error', (err) => {
        console.warn('⚠️ WebSocket client error:', err.message);
        clients.delete(ws);
      });
      ws.on('close', () => {
        clients.delete(ws);
      });
    });

    const broadcast = (event, data) => {
      try {
        const payload = JSON.stringify({ event, data });
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
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
        const pool = require('./config/db');
        setInterval(async () => {
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
      } catch (poolErr) {
        console.error('[Session Timer Warning] ⚠️ Lỗi khởi tạo bộ hẹn giờ:', poolErr.message);
      }

      const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
      if (appUrl) {
        const pingUrl = `${appUrl.replace(/\/$/, '')}/api/health`;
        const httpModule = pingUrl.startsWith('https') ? require('https') : require('http');
        setInterval(() => {
          httpModule.get(pingUrl, (res) => {
            console.log(`[Keep-Alive Engine] ⏰ Ping duy trì dịch vụ: ${pingUrl} (Mã phản hồi: ${res.statusCode})`);
          }).on('error', (e) => {
            console.warn(`[Keep-Alive Warning] ⚠️ Không thể ping dịch vụ: ${e.message}`);
          });
        }, 10 * 60 * 1000);
      }
    });

  } catch (err) {
    console.error('❌ Startup error:', err);
    setTimeout(start, 5000);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Process Guard] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Process Guard] Uncaught Exception:', err);
});

start();
