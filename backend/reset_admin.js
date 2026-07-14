const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const hash = await bcrypt.hash('Tanbao@123', 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@tanbaocorp.vn'", [hash]);
    console.log('✅ Admin password has been reset to Tanbao@123 in the database.');
  } catch (err) {
    console.error('Error resetting admin password:', err);
  } finally {
    await pool.end();
  }
}

main();
