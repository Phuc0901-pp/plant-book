SET client_encoding = 'UTF8';
SET timezone = 'Asia/Ho_Chi_Minh';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "postgis";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS extension not present in current image — falling back to standard GIS coordinate storage.';
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nas_system_info (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO nas_system_info (key, value)
VALUES
    ('deployment_target', 'Company Local NAS'),
    ('app_version', 'v1.3.5'),
    ('initialized_at', NOW()::text)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
