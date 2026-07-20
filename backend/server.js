// Force IPv4 first — required for Render free tier (no outbound IPv6)
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

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/assets/logo.png'));
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '../frontend/public')));

const { antiScraper, apiLimiter } = require('./middleware/antiScraper');

// ─── API Routes (Protected by anti-scraper & rate limiter) ──────────
app.use('/api', antiScraper);
app.use('/api', apiLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/schemas', require('./routes/schemas'));
app.use('/api/plants', require('./routes/plants'));
app.use('/api/config', require('./routes/config'));
app.use('/api/farms', require('./routes/farms'));
app.use('/api/users', require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/supplies', require('./routes/supplies'));



// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'Plant Book API v1.0' });
});

// ─── SPA fallback ────────────────────────────────────────────────
app.get('/plant/:slug/report', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/report.html'));
});

app.get('/plant/:slug/map', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/map.html'));
});

app.get('/plant/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/plant.html'));
});

app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
});

app.get('/user*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/user/index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────
async function start() {
  try {
    await initDB();
    await ensureBucket();

    // Setup interval to mark users offline after 30 minutes of inactivity
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
          console.log(`🧹 Marked ${res.rows.length} inactive users as offline:`, res.rows.map(r => r.email));
          for (const u of res.rows) {
            await pool.query(`
              INSERT INTO user_activities (user_id, activity_type, description)
              VALUES ($1, 'Đăng xuất', 'Hệ thống tự động đăng xuất do không hoạt động (quá 30 phút)')
            `, [u.id]);
            
            // Broadcast real-time status change
            if (global.broadcastWS) {
              global.broadcastWS('user_status_changed', { id: u.id, is_online: false, last_active_at: new Date() });
            }
          }
        }
      } catch (err) {
        console.error('Error cleaning up inactive users:', err);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Create HTTP Server wrapped around Express
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    const clients = new Set();

    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.on('close', () => {
        clients.delete(ws);
      });
    });

    const broadcast = (event, data) => {
      const payload = JSON.stringify({ event, data });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    };

    // Store broadcast function globally and in app
    global.broadcastWS = broadcast;
    app.set('broadcast', broadcast);

    server.listen(PORT, () => {
      console.log(`\n🌿 Plant Book Server running at port ${PORT}`);
      console.log(`📋 Admin panel: /admin`);
      console.log(`🔑 Login: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}\n`);
    });
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

start();
