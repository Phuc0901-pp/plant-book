-- +migrate Up
-- Migration 011: ISO 19111 / ISO 19115 / ISO 19157 / SQL-MM Spatial (PostGIS) Hardening
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.plants
  ADD COLUMN IF NOT EXISTS gps_altitude NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gps_srid INTEGER NOT NULL DEFAULT 4326;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_plants_wgs84_lng') THEN
    ALTER TABLE public.plants
      ADD CONSTRAINT chk_plants_wgs84_lng
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_farms_wgs84_lng') THEN
    ALTER TABLE public.farms
      ADD CONSTRAINT chk_farms_wgs84_lng
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_plants_gps_accuracy_nonneg') THEN
    ALTER TABLE public.plants
      ADD CONSTRAINT chk_plants_gps_accuracy_nonneg
      CHECK (gps_accuracy IS NULL OR gps_accuracy >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_plants_gps_srid_4326') THEN
    ALTER TABLE public.plants
      ADD CONSTRAINT chk_plants_gps_srid_4326
      CHECK (gps_srid = 4326);
  END IF;
END $$;

-- Functional PostGIS GIST Spatial Index (EPSG:4326) for high-speed spatial queries & ST_AsMVT
CREATE INDEX IF NOT EXISTS idx_plants_postgis_gist
  ON public.plants
  USING GIST (ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326))
  WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
