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

    // Ensure status & tier columns exist in users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_tier VARCHAR(20) DEFAULT 'normal';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_admin_note TEXT NULL;
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

    // Audit logs table for data edits & deletions (Vật tư, Nhật ký, Media, Cây trồng)
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        action_type VARCHAR(50) NOT NULL,
        target_type VARCHAR(100) NOT NULL,
        record_id INTEGER,
        title VARCHAR(500) NOT NULL,
        old_data JSONB DEFAULT '{}',
        new_data JSONB DEFAULT '{}',
        note TEXT,
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

    // Alter plants table for GIS & assigned user
    await client.query(`
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS tree_code VARCHAR(100);
      ALTER TABLE plants ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);


    // Alter farms table to assign a user/farmer & permission toggles for farmers
    await client.query(`
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS allow_view_plants BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS allow_shared_history BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS allow_shared_supplies BOOLEAN DEFAULT true;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS total_plants INTEGER DEFAULT 0;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
      ALTER TABLE farms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
    `);

    // Farm IoT Sensors & 6-Day Weather forecast table (Persistent DB per farm)
    await client.query(`
      CREATE TABLE IF NOT EXISTS farm_iot_sensors (
        id SERIAL PRIMARY KEY,
        farm_id INTEGER UNIQUE REFERENCES farms(id) ON DELETE CASCADE,
        air_data JSONB NOT NULL DEFAULT '{}',
        soil_data JSONB NOT NULL DEFAULT '{}',
        water_data JSONB NOT NULL DEFAULT '{}',
        weather_forecast JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // User Notifications Table (Autonomous In-App & Web Push Notification System)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'warning',
        is_read BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        archived_at TIMESTAMPTZ NULL,
        rule_id INTEGER NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
      ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
      ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS rule_id INTEGER NULL;
    `);

    // User Sensor Threshold & Automated Alert Rules Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_alert_rules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
        title VARCHAR(255),
        category_type VARCHAR(50) DEFAULT 'warning',
        metric_key VARCHAR(100),
        metric_name VARCHAR(255),
        operator VARCHAR(10),
        threshold_value NUMERIC,
        unit VARCHAR(50) DEFAULT '%',
        action_type VARCHAR(100) DEFAULT 'Tưới nước',
        action_recommendation TEXT NOT NULL,
        alert_level VARCHAR(50) DEFAULT 'warning',
        conditions_json JSONB DEFAULT '[]',
        check_offline_iot BOOLEAN DEFAULT false,
        check_disease_history BOOLEAN DEFAULT false,
        reconfirm_event_type VARCHAR(100) NULL,
        is_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS category_type VARCHAR(50) DEFAULT 'warning';
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS conditions_json JSONB DEFAULT '[]';
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS check_offline_iot BOOLEAN DEFAULT false;
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS check_disease_history BOOLEAN DEFAULT false;
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS reconfirm_event_type VARCHAR(100) NULL;
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS match_type VARCHAR(10) DEFAULT 'AND';
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS notify_time_type VARCHAR(50) DEFAULT 'instant';
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS custom_time VARCHAR(20) DEFAULT '07:00';
      ALTER TABLE user_alert_rules ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'always';
    `);



    // User profile extension columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS dob VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_type VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_variety VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_age VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_area NUMERIC;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS view_plants_scope VARCHAR(20) DEFAULT 'all';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS view_history_from_date DATE DEFAULT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_shared_history BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_view_supplies BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS rules_initialized BOOLEAN DEFAULT false;
    `);


    // Backfill farm_id for existing farmers who created farms previously
    await client.query(`
      UPDATE users u
      SET farm_id = (SELECT id FROM farms WHERE user_id = u.id ORDER BY id ASC LIMIT 1)
      WHERE u.farm_id IS NULL AND EXISTS (SELECT 1 FROM farms WHERE user_id = u.id);
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

    // Supplies (Vật tư khai báo) table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        package_size VARCHAR(100),
        unit_price NUMERIC NOT NULL DEFAULT 0,
        stock_quantity NUMERIC DEFAULT 0,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS package_size VARCHAR(100);
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS package_qty NUMERIC DEFAULT 1;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS package_unit VARCHAR(50);
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS package_price NUMERIC DEFAULT 0;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS unit_price_small NUMERIC DEFAULT 0;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS fertilizer_type VARCHAR(100);
      ALTER TABLE supplies ADD COLUMN IF NOT EXISTS farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE;

      UPDATE supplies 
      SET 
        package_price = CASE WHEN COALESCE(package_price, 0) = 0 THEN unit_price ELSE package_price END,
        unit_price = CASE WHEN COALESCE(package_qty, 1) > 1 AND unit_price >= COALESCE(package_price, unit_price) THEN (CASE WHEN COALESCE(package_price, 0) > 0 THEN package_price ELSE unit_price END) / package_qty ELSE unit_price END,
        unit_price_small = CASE WHEN COALESCE(package_qty, 1) > 1 THEN (CASE WHEN COALESCE(package_price, 0) > 0 THEN package_price ELSE unit_price END) / (package_qty * 1000) ELSE unit_price END
      WHERE COALESCE(package_qty, 1) > 1;
    `);

    // Supply Usages (Giám sát tiêu hao vật tư) table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supply_usages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        supply_id INTEGER REFERENCES supplies(id) ON DELETE CASCADE,
        farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
        plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
        usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
        quantity NUMERIC NOT NULL DEFAULT 1,
        unit_price NUMERIC NOT NULL DEFAULT 0,
        total_cost NUMERIC NOT NULL DEFAULT 0,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Fixed Assets (Tài sản cố định vĩnh cửu) table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fixed_assets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL DEFAULT 2024,
        cost NUMERIC NOT NULL DEFAULT 0,
        life INTEGER NOT NULL DEFAULT 5,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);



    // Database Performance Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plants_farm_id ON plants(farm_id);
      CREATE INDEX IF NOT EXISTS idx_plants_health ON plants(health_status);
      CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
      CREATE INDEX IF NOT EXISTS idx_supply_usages_farm_date ON supply_usages(farm_id, usage_date);
      CREATE INDEX IF NOT EXISTS idx_fixed_assets_farm_year ON fixed_assets(farm_id, year);
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
