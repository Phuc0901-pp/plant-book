-- +migrate Up
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_plant_logs_is_deleted ON plant_logs(is_deleted) WHERE is_deleted IS TRUE;
CREATE INDEX IF NOT EXISTS idx_plant_logs_active_date ON plant_logs(plant_id, log_date DESC) WHERE is_deleted IS FALSE OR is_deleted IS NULL;
