// Force IPv4 first — required for Render free tier (no outbound IPv6)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureBucket } = require('./config/supabase');
const initDB = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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



// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'Plant Book API v1.0' });
});

// ─── SPA fallback ────────────────────────────────────────────────
app.get('/plant/:slug/report', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/report.html'));
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
    app.listen(PORT, () => {
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
