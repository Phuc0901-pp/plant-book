const pool = require('../config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Plant fields definition table (template/schema for a plant type)
    await client.query(`
      CREATE TABLE IF NOT EXISTS plant_schemas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        fields JSONB NOT NULL DEFAULT '[]',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Plants table (actual plant records)
    await client.query(`
      CREATE TABLE IF NOT EXISTS plants (
        id SERIAL PRIMARY KEY,
        public_slug VARCHAR(100) UNIQUE NOT NULL,
        schema_id INTEGER REFERENCES plant_schemas(id),
        plant_type VARCHAR(255),
        plant_variety VARCHAR(255),
        plant_age VARCHAR(100),
        health_status VARCHAR(100) DEFAULT 'Tốt',
        location TEXT,
        data JSONB NOT NULL DEFAULT '{}',
        cover_image TEXT,
        created_by INTEGER REFERENCES users(id),
        is_public BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Media table (images & videos linked to plants)
    await client.query(`
      CREATE TABLE IF NOT EXISTS plant_media (
        id SERIAL PRIMARY KEY,
        plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
        object_name VARCHAR(500) NOT NULL,
        url TEXT NOT NULL,
        media_type VARCHAR(50) DEFAULT 'image',
        caption TEXT,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Plant diary / log entries
    await client.query(`
      CREATE TABLE IF NOT EXISTS plant_logs (
        id SERIAL PRIMARY KEY,
        plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
        log_date DATE DEFAULT CURRENT_DATE,
        log_type VARCHAR(100),
        note TEXT,
        media_urls JSONB DEFAULT '[]',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'
    `);
    await client.query(`
      ALTER TABLE plant_media ADD COLUMN IF NOT EXISTS delete_pending BOOLEAN DEFAULT false
    `);
    await client.query(`
      ALTER TABLE plant_logs ALTER COLUMN created_by DROP NOT NULL
    `);
    await client.query(`
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]';
      ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);


    // System configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_configs (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Password reset requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        identity VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        note TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        approved_at TIMESTAMPTZ
      )
    `);

    // Ensure status columns exist in users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // User activities history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Farms table (GIS boundaries)
    await client.query(`
      CREATE TABLE IF NOT EXISTS farms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        polygon_coordinates JSONB NOT NULL DEFAULT '[]',
        area NUMERIC,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Alter plants table for GIS
    await client.query(`
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS tree_code VARCHAR(100);
    `);

    // Alter farms table to assign a user/farmer
    await client.query(`
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // User profile extension columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
    `);

    // NFC Tag UID column for plants (physical tag serial, unique system-wide)
    await client.query(`
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS nfc_uid VARCHAR(100) UNIQUE;
    `);

    // Devices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        device_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Hoạt động',
        farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
        last_connection TIMESTAMPTZ DEFAULT NOW(),
        ip_address VARCHAR(50),
        battery_level INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);


    // Seed default configurations
    const defaultConfigs = [
      { key: 'fertilizers', value: JSON.stringify(["Phân NPK 16-16-8", "Phân hữu cơ trùn quế", "Phân bón lá Đầu Trâu", "Phân chuồng hoai mục"]) },
      { key: 'pesticides', value: JSON.stringify(["Thuốc trừ sâu sinh học", "Thuốc trừ bệnh Anvil", "Thuốc trừ nấm Ridomil Gold", "Chất kích thích sinh trưởng Atonik"]) },
      { key: 'water_methods', value: JSON.stringify(["Tưới tay thủ công", "Tưới nhỏ giọt", "Tưới phun mưa", "Tưới phun sương"]) },
      { key: 'leaf_cut_reasons', value: JSON.stringify(["Lá già úa/vàng", "Lá bị sâu bệnh hại", "Tỉa cành tạo tán", "Tỉa bớt lá thông thoáng"]) },
      { key: 'flower_prune_reasons', value: JSON.stringify(["Tỉa hoa tàn", "Tỉa bớt nụ còi", "Tỉa cành tạo dáng", "Kích thích ra chồi mới"]) }
    ];

    for (const config of defaultConfigs) {
      await client.query(`
        INSERT INTO system_configs (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
      `, [config.key, config.value]);
    }


    // Seed admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tanbaocorp.vn';
    const adminPass = process.env.ADMIN_PASSWORD || 'Tanbao@123';
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [adminEmail]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPass, 12);
      await client.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)',
        [adminEmail, hash, 'Quản trị viên Tanbao Corp', 'admin']
      );
      console.log(`✅ Admin user created: ${adminEmail}`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }

    await client.query('COMMIT');
    console.log('✅ Database schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ DB init error:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = initDB;
