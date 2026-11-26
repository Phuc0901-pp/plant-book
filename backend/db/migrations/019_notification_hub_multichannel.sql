-- +migrate Up
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS event_code VARCHAR(80);
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'info';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS sound_profile VARCHAR(30) DEFAULT 'chime';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS entity_id INTEGER;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sound_enabled BOOLEAN DEFAULT true,
  sound_profile VARCHAR(30) DEFAULT 'chime',
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_start VARCHAR(10) DEFAULT '22:00',
  quiet_end VARCHAR(10) DEFAULT '06:00',
  muted_categories JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL,
  token TEXT NOT NULL,
  device_label VARCHAR(120),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, token)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON user_notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user
  ON user_push_tokens(user_id, is_active);
