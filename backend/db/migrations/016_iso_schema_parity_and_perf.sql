-- +migrate Up
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS cost NUMERIC(14,2) DEFAULT 0;
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS client_uuid VARCHAR(100);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS prev_log_hash VARCHAR(64);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS record_hash VARCHAR(64);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plant_logs_client_uuid_uniq ON plant_logs(client_uuid) WHERE client_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plants_farm_plot_type ON plants(farm_id, plot_code, plant_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plant_logs_date_type ON plant_logs(log_date DESC, log_type) WHERE is_deleted IS NOT TRUE;
