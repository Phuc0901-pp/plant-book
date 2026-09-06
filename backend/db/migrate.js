/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   db/migrate.js — Lightweight & Robust Database Migration Runner
   Usage:
     node backend/db/migrate.js up
     node backend/db/migrate.js status
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(client) {
  const res = await client.query('SELECT version FROM schema_migrations ORDER BY id ASC');
  return new Set(res.rows.map(r => r.version));
}

function getMigrationFiles() {
  const dir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function parseSqlMigration(content) {
  // Extract +migrate Up section
  const upMatch = content.match(/-- \+migrate Up([\s\S]*?)(?:-- \+migrate Down|$)/i);
  return upMatch ? upMatch[1].trim() : content;
}

async function migrateUp() {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const executed = await getExecutedMigrations(client);
    const files = getMigrationFiles();

    console.log(`\n📦 [DB MIGRATION] Found ${files.length} migration files.`);
    let appliedCount = 0;

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`  ⏩ [SKIPPED] ${file} (Already executed)`);
        continue;
      }

      console.log(`  🚀 [EXECUTING] ${file}...`);
      const filePath = path.join(__dirname, 'migrations', file);
      const content = fs.readFileSync(filePath, 'utf8');
      const sql = parseSqlMigration(content);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✅ [SUCCESS] ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ [FAILED] ${file}:`, err.message);
        throw err;
      }
    }

    console.log(`\n🎉 [DB MIGRATION] Finished. ${appliedCount} migrations applied successfully.\n`);
  } finally {
    client.release();
  }
}

async function migrateStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const executed = await getExecutedMigrations(client);
    const files = getMigrationFiles();

    console.log(`\n📋 [DB MIGRATION STATUS]`);
    console.log(`─────────────────────────────────────────────────────────────────`);
    for (const file of files) {
      const isApplied = executed.has(file);
      console.log(`  ${isApplied ? '✅ [APPLIED]' : '⏳ [PENDING]'}  ${file}`);
    }
    console.log(`─────────────────────────────────────────────────────────────────\n`);
  } finally {
    client.release();
  }
}

async function main() {
  const cmd = process.argv[2] || 'up';
  try {
    if (cmd === 'status') {
      await migrateStatus();
    } else if (cmd === 'up') {
      await migrateUp();
    } else {
      console.log(`Unknown command "${cmd}". Supported commands: up, status`);
    }
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateUp, migrateStatus };
