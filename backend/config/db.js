const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

// Force IPv4 — Render free tier does not support outbound IPv6
dns.setDefaultResultOrder('ipv4first');

const primaryUrl = process.env.DATABASE_URL || process.env.DATABASE_WRITE_URL || '';
const replicaUrl = process.env.DATABASE_READ_URL || primaryUrl;

const poolConfig = {
  ssl: { rejectUnauthorized: false },
  max: 15,                     // Tối đa 15 kết nối đồng thời
  idleTimeoutMillis: 30000,    // Đóng kết nối nhàn rỗi sau 30s
  connectionTimeoutMillis: 6000 // Timeout kết nối 6s
};

// 1. Primary Master Pool (Chuyên xử lý GHI - INSERT / UPDATE / DELETE)
const writePool = primaryUrl
  ? new Pool({ connectionString: primaryUrl, ...poolConfig })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ...poolConfig
    });

// 2. Read Replica Pool (Chuyên xử lý ĐỌC - SELECT / Phục vụ Bé Mầm & Bản đồ)
const readPool = (replicaUrl && replicaUrl !== primaryUrl)
  ? new Pool({ connectionString: replicaUrl, ...poolConfig })
  : writePool; // Tự động dùng chung nếu chưa cấu hình replica riêng

writePool.on('error', (err) => {
  console.error('❌ PostgreSQL Write Pool error:', err.message);
});

if (readPool !== writePool) {
  readPool.on('error', (err) => {
    console.error('❌ PostgreSQL Read Pool error:', err.message);
  });
}

/**
 * Gắn các helper phân luồng trực tiếp lên đối tượng Pool chính
 */
writePool.writeQuery = (text, params) => writePool.query(text, params);
writePool.readQuery = (text, params) => readPool.query(text, params);
writePool.readPool = readPool;
writePool.writePool = writePool;

/**
 * Thực thi Transaction an toàn (ACID) trên Master Pool
 */
writePool.transaction = async (callback) => {
  const client = await writePool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = writePool;
