-- ═══════════════════════════════════════════════════════════════════════════════
-- TÂN BẢO AGTECH | SỔ NÔNG SỐ PLANT BOOK ERP v1.3.5
-- KHỞI TẠO NỀN TẢNG CƠ SỞ DỮ LIỆU POSTGRESQL TRÊN MÁY CHỦ NAS CÔNG TY
-- File này tự động thực thi 1 lần duy nhất khi PostgreSQL container khởi chạy lần đầu.
-- Toàn bộ cấu trúc bảng và dữ liệu nghiệp vụ sau đó sẽ được:
--   1. Backend Server tự động cập nhật qua initDB() & migrations khi khởi động, HOẶC
--   2. Công cụ migrate_to_nas.js di chuyển toàn bộ từ Cloud sang với độ chính xác 100%.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Cấu hình bảng mã UTF-8 & Múi giờ Việt Nam
SET client_encoding = 'UTF8';
SET timezone = 'Asia/Ho_Chi_Minh';

-- 2. Kích hoạt các Extension Nông nghiệp & Bảo mật thiết yếu
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- PostGIS phục vụ bản đồ GIS và phân cụm tọa độ cây trồng (tùy chọn theo image)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "postgis";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS extension not present in current image — falling back to standard GIS coordinate storage.';
END $$;

-- 3. Tạo Schema quản trị di chuyển dữ liệu
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ghi nhận thời điểm khởi tạo NAS
CREATE TABLE IF NOT EXISTS nas_system_info (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO nas_system_info (key, value)
VALUES 
    ('deployment_target', 'Company Local NAS'),
    ('app_version', 'v1.3.5'),
    ('initialized_at', NOW()::text)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
