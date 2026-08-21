const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

// Force IPv4 — Render free tier does not support outbound IPv6
dns.setDefaultResultOrder('ipv4first');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

pool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL');
  // Auto-migration for tier management fields
  client.query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS account_tier VARCHAR(20) DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS tier_admin_note TEXT NULL;

    -- Auto-set PRO tier for existing farmers who already have plants assigned or created
    UPDATE users 
    SET account_tier = 'pro'
    WHERE role = 'user' 
      AND (account_tier IS NULL OR account_tier = 'normal')
      AND (
        id IN (SELECT DISTINCT assigned_to_user_id FROM plants WHERE assigned_to_user_id IS NOT NULL)
        OR id IN (SELECT DISTINCT created_by FROM plants WHERE created_by IS NOT NULL)
        OR farm_id IN (SELECT DISTINCT farm_id FROM plants WHERE farm_id IS NOT NULL)
      );
  `).catch(err => console.error('Migration tier columns error:', err.message));
});



pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

module.exports = pool;
