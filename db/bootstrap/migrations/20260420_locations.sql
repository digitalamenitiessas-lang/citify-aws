-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260420_locations.sql

-- Add location fields to buildings
-- Note: 'address' already exists in buildings, so we only need latitude and longitude
ALTER TABLE IF EXISTS citify.buildings
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;
