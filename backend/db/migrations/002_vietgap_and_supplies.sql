-- Migration: 002_vietgap_and_supplies.sql
-- Description: VietGAP compliance, supplies management, supply_usages, and fixed assets

-- +migrate Up
CREATE TABLE IF NOT EXISTS supplies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  min_stock_alert NUMERIC DEFAULT 0,
  package_size VARCHAR(100),
  package_qty NUMERIC DEFAULT 1,
  package_unit VARCHAR(50),
  package_price NUMERIC DEFAULT 0,
  unit_price_small NUMERIC DEFAULT 0,
  image_url TEXT,
  fertilizer_type VARCHAR(100),
  phi_days INTEGER DEFAULT 0,
  active_ingredient VARCHAR(255),
  target_pests VARCHAR(255),
  safety_interval_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
);

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
);

ALTER TABLE farms ADD COLUMN IF NOT EXISTS puc_code VARCHAR(100);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS vietgap_cert_number VARCHAR(100);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS vietgap_cert_date DATE;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS vietgap_cert_org VARCHAR(255);

ALTER TABLE plants ADD COLUMN IF NOT EXISTS phi_until_date DATE;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS phi_status VARCHAR(50) DEFAULT 'safe';
ALTER TABLE plants ADD COLUMN IF NOT EXISTS last_pesticide_date DATE;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS last_pesticide_name VARCHAR(255);

ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS batch_code VARCHAR(150);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS puc_code VARCHAR(100);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS equipment_used VARCHAR(255);
ALTER TABLE plant_logs ADD COLUMN IF NOT EXISTS is_phi_violation BOOLEAN DEFAULT false;

-- +migrate Down
-- DROP TABLE IF EXISTS supply_usages, supplies, fixed_assets CASCADE;
