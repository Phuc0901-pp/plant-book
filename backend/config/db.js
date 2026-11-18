const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

dns.setDefaultResultOrder('ipv4first');

const primaryUrl = process.env.DATABASE_URL || process.env.DATABASE_WRITE_URL || '';
const replicaUrl = process.env.DATABASE_READ_URL || primaryUrl;

const { resolveSslConfig } = require('./dbSsl');

const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX, 10) || 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 6000,
  options: '-c client_encoding=UTF8'
};

const writePool = primaryUrl
  ? new Pool({ connectionString: primaryUrl, ssl: resolveSslConfig(primaryUrl), ...poolConfig })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: resolveSslConfig('', { host: process.env.DB_HOST }),
      ...poolConfig
    });

const readPool = (replicaUrl && replicaUrl !== primaryUrl)
  ? new Pool({ connectionString: replicaUrl, ssl: resolveSslConfig(replicaUrl), ...poolConfig })
  : writePool;

writePool.on('error', (err) => {
  console.error('❌ PostgreSQL Write Pool error:', err.message);
});

if (readPool !== writePool) {
  readPool.on('error', (err) => {
    console.error('❌ PostgreSQL Read Pool error:', err.message);
  });
}

writePool.writeQuery = (text, params) => writePool.query(text, params);
writePool.readQuery = (text, params) => readPool.query(text, params);
writePool.readPool = readPool;
writePool.writePool = writePool;

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
