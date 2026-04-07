-- Migration: 0015_add_activation_alert_milestones
-- Adds dedupe state for first-site and first-activity admin alerts.

ALTER TABLE users ADD COLUMN first_site_alert_sent_at TEXT;
ALTER TABLE users ADD COLUMN first_activity_alert_sent_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_first_site_alert_sent_at ON users(first_site_alert_sent_at);
CREATE INDEX IF NOT EXISTS idx_users_first_activity_alert_sent_at ON users(first_activity_alert_sent_at);
