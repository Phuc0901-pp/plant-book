-- ==============================================================================
-- TÂN BẢO AGTECH | SỔ NÔNG SỐ & TRỢ LÝ AI - KHỞI TẠO CƠ SỞ DỮ LIỆU POSTGRESQL (NAS)
-- ==============================================================================

-- 1. BẢNG NGƯỜI DÙNG & TÀI KHOẢN (USERS)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user', 'manager', 'farmer'
    phone VARCHAR(50),
    farm_id INTEGER,
    status VARCHAR(50) DEFAULT 'approved',
    public_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG TRANG TRẠI & NÔNG HỘ (FARMS)
CREATE TABLE IF NOT EXISTS farms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    area NUMERIC(10, 2) DEFAULT 0,
    boundary JSONB DEFAULT '{}', -- Lưu trữ Đa giác GeoJSON
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm liên kết khóa ngoại users.farm_id -> farms.id
ALTER TABLE users ADD CONSTRAINT fk_user_farm FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE SET NULL;

-- 3. BẢNG MẪU ĐỊNH NGHĨA CÂY TRỒNG (PLANT_SCHEMAS)
CREATE TABLE IF NOT EXISTS plant_schemas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG CÂY TRỒNG THỰC ĐỊA (PLANTS)
CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    public_slug VARCHAR(100) UNIQUE NOT NULL,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    schema_id INTEGER REFERENCES plant_schemas(id) ON DELETE SET NULL,
    tree_code VARCHAR(100),
    plant_type VARCHAR(255),
    plant_variety VARCHAR(255),
    plant_age VARCHAR(100),
    health_status VARCHAR(100) DEFAULT 'Tốt',
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    nfc_id VARCHAR(100),
    qr_code VARCHAR(100),
    data JSONB NOT NULL DEFAULT '{}',
    cover_image TEXT,
    is_public BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BẢNG NHẬT KÝ CANH TÁC & CHĂM SÓC (PLANT_LOGS)
CREATE TABLE IF NOT EXISTS plant_logs (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    log_date DATE DEFAULT CURRENT_DATE,
    log_type VARCHAR(100), -- 'Bón phân', 'Phun thuốc', 'Tưới nước', 'Thu hoạch', 'Cắt tỉa'
    note TEXT,
    details JSONB DEFAULT '{}',
    media_urls JSONB DEFAULT '[]',
    edit_history JSONB DEFAULT '[]',
    is_locked BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BẢNG THƯ VIỆN HÌNH ẢNH & VIDEO (PLANT_MEDIA)
CREATE TABLE IF NOT EXISTS plant_media (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    object_name VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    media_type VARCHAR(50) DEFAULT 'image',
    caption TEXT,
    delete_pending BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BẢNG KHO VẬT TƯ NÔNG NGHIỆP (SUPPLIES)
CREATE TABLE IF NOT EXISTS supplies (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) DEFAULT 'Khác', -- 'Phân bón', 'Thuốc BVTV', 'Hạt giống', 'Vật tư tưới'
    unit VARCHAR(50) DEFAULT 'kg',
    quantity NUMERIC(12, 2) DEFAULT 0,
    min_threshold NUMERIC(12, 2) DEFAULT 0,
    unit_price NUMERIC(15, 2) DEFAULT 0,
    supplier VARCHAR(255),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BẢNG GHI NHẬN TIÊU HAO VẬT TƯ (SUPPLY_USAGES)
CREATE TABLE IF NOT EXISTS supply_usages (
    id SERIAL PRIMARY KEY,
    supply_id INTEGER REFERENCES supplies(id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    log_id INTEGER REFERENCES plant_logs(id) ON DELETE SET NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    cost NUMERIC(15, 2) DEFAULT 0,
    usage_date DATE DEFAULT CURRENT_DATE,
    purpose TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. BẢNG QUẢN LÝ THIẾT BỊ & CẢM BIẾN IOT (DEVICES & FARM_IOT_SENSORS)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'online',
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_iot_sensors (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    sensor_code VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(100), -- 'soil_moisture', 'temperature', 'humidity', 'ph', 'ec'
    value NUMERIC(10, 2),
    unit VARCHAR(20),
    quality_flag VARCHAR(20) DEFAULT 'good',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. BẢNG HẠCH TOÁN CHI PHÍ & TÀI SẢN (COSTS & FIXED_ASSETS)
CREATE TABLE IF NOT EXISTS costs (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT,
    cost_date DATE DEFAULT CURRENT_DATE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixed_assets (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    initial_value NUMERIC(15, 2) DEFAULT 0,
    depreciation_years INTEGER DEFAULT 5,
    purchase_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BẢNG THÔNG BÁO & KIỂM TOÁN DỮ LIỆU (NOTIFICATIONS & AUDIT LOGS)
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TẠO CÁC CHỈ MỤC TĂNG TỐC TRUY VẤN (INDEXES)
CREATE INDEX IF NOT EXISTS idx_plants_farm_id ON plants(farm_id);
CREATE INDEX IF NOT EXISTS idx_plants_slug ON plants(public_slug);
CREATE INDEX IF NOT EXISTS idx_logs_plant_id ON plant_logs(plant_id);
CREATE INDEX IF NOT EXISTS idx_logs_farm_id ON plant_logs(farm_id);
CREATE INDEX IF NOT EXISTS idx_supplies_farm_id ON supplies(farm_id);
CREATE INDEX IF NOT EXISTS idx_media_plant_id ON plant_media(plant_id);

-- CHÈN TÀI KHOẢN QUẢN TRỊ ADMIN MẶC ĐỊNH (Mật khẩu mặc định: Tanbao@123)
-- Hash bcrypt tương ứng với 'Tanbao@123'
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES ('admin@tanbaocorp.vn', '$2a$10$w8T06N8YjXzQ4C5eZJ1QFeZ0J6U7C7YQ8vQ9sU1l6sU6sU1l6sU6s', 'Quản Trị Viên Tân Bảo', 'admin', 'approved')
ON CONFLICT (email) DO NOTHING;
