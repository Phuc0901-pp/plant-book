-- +migrate Up
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(255);
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS batch_no VARCHAR(120);
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS min_stock_alert NUMERIC(12,3) DEFAULT 0;

CREATE TABLE IF NOT EXISTS supply_restock_logs (
  id SERIAL PRIMARY KEY,
  supply_id INTEGER REFERENCES supplies(id) ON DELETE CASCADE,
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  operator_name VARCHAR(255),
  added_qty NUMERIC(12,3) NOT NULL,
  added_base_qty NUMERIC(12,3) NOT NULL,
  package_price NUMERIC(15,2) DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  batch_no VARCHAR(120),
  expiry_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_active_latest ON plant_logs(plant_id, log_date DESC, id DESC) WHERE is_deleted IS NOT TRUE;
CREATE INDEX IF NOT EXISTS idx_supply_restock_logs_supply ON supply_restock_logs(supply_id, created_at DESC);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS secret_token VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
CREATE TABLE IF NOT EXISTS iot_readings (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
  metric_key VARCHAR(100) NOT NULL,
  metric_value NUMERIC(12, 4) NOT NULL,
  unit VARCHAR(32),
  battery_level INTEGER,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_iot_readings_farm_recorded ON iot_readings(farm_id, recorded_at DESC);
