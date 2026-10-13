-- +migrate Up
-- ============================================================================
-- Migration 007: Gallagher 8.30 API Standards, Global Digital ID (DID/GS1),
--                Multi-Role Field Privilege, RFID IssueLevel & ISO 27001 Hash-Chain
-- ============================================================================

-- 1. Phân tách Quyền & Vai trò người dùng theo chức năng (Người chăm sóc, Quản lý kho, Quản trại, Kiểm toán)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sub_role VARCHAR(50) DEFAULT 'farm_owner',
  ADD COLUMN IF NOT EXISTS parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allow_view_finance BOOLEAN DEFAULT true;

-- 2. Định danh Global Digital ID (DID/GS1) & Thực thể Đa hình (Cây / Con) + Sinh khối Carbon
ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS global_did VARCHAR(140),
  ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS api_key_version INTEGER DEFAULT 1;

ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS global_did VARCHAR(140),
  ADD COLUMN IF NOT EXISTS entity_class VARCHAR(30) DEFAULT 'plant',
  ADD COLUMN IF NOT EXISTS biomass_dbh_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS canopy_height_m NUMERIC(8,2);

-- 3. Chuẩn hóa Bảng Thẻ RFID/NFC Chống Sao Chép (IssueLevel, CardType, TraceFlag, PIV CHUID)
ALTER TABLE nfc_tags_inventory
  ADD COLUMN IF NOT EXISTS issue_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS card_type VARCHAR(50) DEFAULT 'NTAG213_HMAC_GEOFENCE',
  ADD COLUMN IF NOT EXISTS trace_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chuid_hash VARCHAR(128);

-- 4. Sổ cái Bất biến ISO/IEC 27001 (Cryptographic SHA-256 Hash Chain cho plant_logs)
ALTER TABLE plant_logs
  ADD COLUMN IF NOT EXISTS prev_log_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS record_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_plants_entity_class ON plants(entity_class);
CREATE INDEX IF NOT EXISTS idx_plants_global_did ON plants(global_did);
CREATE INDEX IF NOT EXISTS idx_plant_logs_record_hash ON plant_logs(record_hash);
