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

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schemas', require('./routes/schemas'));
app.use('/api/plants', require('./routes/plants'));
app.use('/api/config', require('./routes/config'));
app.use('/api/farms', require('./routes/farms'));


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'Plant Book API v1.0' });
});

// ─── SPA fallback ────────────────────────────────────────────────
app.get('/plant/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/plant.html'));
});

app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
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
