-- +migrate Up
CREATE INDEX IF NOT EXISTS idx_plant_logs_hashchain
  ON plant_logs(id DESC)
  WHERE is_deleted IS NOT TRUE AND record_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_hashchain
  ON plant_logs(plant_id, id DESC)
  WHERE is_deleted IS NOT TRUE AND record_hash IS NOT NULL;

INSERT INTO system_configs (key, value)
VALUES ('legacy_data_normalization_v135', '"done"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '"done"'::jsonb, updated_at = NOW();
