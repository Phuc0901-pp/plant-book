-- +migrate Up
ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS last_counter INT DEFAULT 0;
ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS hmac_signature VARCHAR(128) NULL;
ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS lock_password_hash VARCHAR(128) NULL;
ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS last_scanned_lat NUMERIC NULL;
ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS last_scanned_lng NUMERIC NULL;
ALTER TABLE nfc_tags_inventory ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ NULL;

ALTER TABLE farms ADD COLUMN IF NOT EXISTS geofence_radius_meters NUMERIC DEFAULT 8.0;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS geofence_radius_meters NUMERIC DEFAULT 8.0;

CREATE TABLE IF NOT EXISTS nfc_security_audit_logs (
  id SERIAL PRIMARY KEY,
  farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
  plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
  nfc_uid VARCHAR(100) NOT NULL,
  scanned_counter INT,
  last_counter INT,
  scanned_lat NUMERIC,
  scanned_lng NUMERIC,
  plant_lat NUMERIC,
  plant_lng NUMERIC,
  distance_meters NUMERIC,
  status VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'INFO',
  notes TEXT,
  scanned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_audit_farm ON nfc_security_audit_logs(farm_id);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_plant ON nfc_security_audit_logs(plant_id);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_uid ON nfc_security_audit_logs(nfc_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_status ON nfc_security_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_nfc_audit_created ON nfc_security_audit_logs(created_at DESC);
