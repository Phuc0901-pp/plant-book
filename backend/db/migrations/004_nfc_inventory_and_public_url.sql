-- Migration: 004_nfc_inventory_and_public_url.sql
-- Description: NFC Tags Inventory table, indexes, and public_url column on plants

-- +migrate Up
-- 1. Add public_url column to plants table
ALTER TABLE plants ADD COLUMN IF NOT EXISTS public_url TEXT;

-- 2. Backfill public_url for existing plants
UPDATE plants 
SET public_url = 'https://plant-book.onrender.com/' || COALESCE(farm_id, 0)::text || '/' || id::text || CASE WHEN nfc_uid IS NOT NULL AND nfc_uid != '' THEN '/' || nfc_uid ELSE '' END
WHERE public_url IS NULL OR public_url = '';

-- 3. Create NFC tags inventory table
CREATE TABLE IF NOT EXISTS nfc_tags_inventory (
  id SERIAL PRIMARY KEY,
  farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
  nfc_uid VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'unassigned',
  plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  tagged_at TIMESTAMPTZ NULL,
  created_by INTEGER REFERENCES users(id)
);

-- 4. Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_nfc_inventory_farm ON nfc_tags_inventory(farm_id);
CREATE INDEX IF NOT EXISTS idx_nfc_inventory_uid ON nfc_tags_inventory(nfc_uid);
CREATE INDEX IF NOT EXISTS idx_nfc_inventory_status ON nfc_tags_inventory(status);
