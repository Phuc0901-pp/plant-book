-- Migration: 008_utf8_and_hashchain_optimization.sql
-- Description: UTF-8 Normalization Flag & Hash-Chain Index Optimization (v1.3.5 Build 19)

-- +migrate Up
-- 1. Tạo Composite Partial Index tối ưu truy vấn Hash-Chain ISO/IEC 27001
CREATE INDEX IF NOT EXISTS idx_plant_logs_hashchain
  ON plant_logs(id DESC)
  WHERE is_deleted IS NOT TRUE AND record_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_hashchain
  ON plant_logs(plant_id, id DESC)
  WHERE is_deleted IS NOT TRUE AND record_hash IS NOT NULL;

-- 2. Đánh dấu đã hoàn tất chuẩn hóa dữ liệu lịch sử & UTF-8 (Idempotent One-Time Flag)
INSERT INTO system_configs (key, value)
VALUES ('legacy_data_normalization_v135', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', updated_at = NOW();
