-- Migration: 0013_add_user_acquisition_attribution
-- Adds first-touch attribution and first-site activation linkage to users.

ALTER TABLE users ADD COLUMN first_touch_ref TEXT;
ALTER TABLE users ADD COLUMN first_touch_utm_source TEXT;
ALTER TABLE users ADD COLUMN first_touch_utm_medium TEXT;
ALTER TABLE users ADD COLUMN first_touch_utm_campaign TEXT;
ALTER TABLE users ADD COLUMN first_touch_referrer_host TEXT;
ALTER TABLE users ADD COLUMN first_touch_landing_path TEXT;
ALTER TABLE users ADD COLUMN first_touch_captured_at TEXT;
ALTER TABLE users ADD COLUMN first_touch_is_internal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN first_site_id TEXT;
ALTER TABLE users ADD COLUMN first_site_created_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_first_touch_internal ON users(first_touch_is_internal);
CREATE INDEX IF NOT EXISTS idx_users_first_site_created_at ON users(first_site_created_at);
