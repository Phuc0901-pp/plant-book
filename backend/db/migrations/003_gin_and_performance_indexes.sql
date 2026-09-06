-- Migration: 003_gin_and_performance_indexes.sql
-- Description: Performance optimization via GIN indexes on JSONB and composite B-Tree indexes

-- +migrate Up
CREATE INDEX IF NOT EXISTS idx_plants_farm_id ON plants(farm_id);
CREATE INDEX IF NOT EXISTS idx_plants_health ON plants(health_status);
CREATE INDEX IF NOT EXISTS idx_plants_phi_status ON plants(phi_status);
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_supply_usages_farm_date ON supply_usages(farm_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_farm_year ON fixed_assets(farm_id, year);

-- GIN Indexes for deep JSONB queries
CREATE INDEX IF NOT EXISTS idx_plant_logs_details_gin ON plant_logs USING gin (details jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_plants_data_gin ON plants USING gin (data jsonb_path_ops);

-- Composite indexes for time-series and GIS queries
CREATE INDEX IF NOT EXISTS idx_plant_logs_plant_date ON plant_logs(plant_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_plant_logs_type ON plant_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_plants_coords ON plants(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- +migrate Down
-- DROP INDEX IF EXISTS idx_plant_logs_details_gin, idx_plants_data_gin, idx_plant_logs_plant_date, idx_plant_logs_type, idx_plants_coords;
