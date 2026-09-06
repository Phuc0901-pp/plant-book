-- Migration: 001_initial_schema.sql
-- Description: Core tables (users, farms, plant_schemas, plants, plant_media, plant_logs, system_configs)

-- +migrate Up
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'farmer',
  phone VARCHAR(50),
  is_online BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  account_tier VARCHAR(20) DEFAULT 'normal',
  tier_expires_at TIMESTAMPTZ NULL,
  tier_admin_note TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location TEXT,
  area NUMERIC,
  perimeter NUMERIC,
  coordinates JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plant_schemas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plants (
  id SERIAL PRIMARY KEY,
  public_slug VARCHAR(100) UNIQUE NOT NULL,
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  tree_code VARCHAR(50),
  plant_type VARCHAR(255),
  plant_variety VARCHAR(255),
  plant_age VARCHAR(100),
  health_status VARCHAR(100) DEFAULT 'Tốt',
  location TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  data JSONB NOT NULL DEFAULT '{}',
  cover_image TEXT,
  created_by INTEGER REFERENCES users(id),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plant_media (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
  object_name VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  media_type VARCHAR(50) DEFAULT 'image',
  caption TEXT,
  delete_pending BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plant_logs (
  id SERIAL PRIMARY KEY,
  plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
  log_date DATE DEFAULT CURRENT_DATE,
  log_type VARCHAR(100),
  note TEXT,
  media_urls JSONB DEFAULT '[]',
  details JSONB DEFAULT '{}',
  edit_history JSONB DEFAULT '[]',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_configs (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- +migrate Down
-- DROP TABLE IF EXISTS plant_logs, plant_media, plants, plant_schemas, farms, users, system_configs CASCADE;
