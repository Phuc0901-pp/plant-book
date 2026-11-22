-- +migrate Up
CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  standard_code VARCHAR(80) DEFAULT 'vietgap_globalgap_iso',
  standard_label TEXT DEFAULT '',
  categories JSONB DEFAULT '[]'::jsonb,
  from_date VARCHAR(20),
  to_date VARCHAR(20),
  total_logs INTEGER DEFAULT 0,
  report_html TEXT NOT NULL,
  report_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_user_created ON saved_reports(user_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
