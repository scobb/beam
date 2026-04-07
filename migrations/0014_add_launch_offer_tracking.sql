-- Migration: 0014_add_launch_offer_tracking
-- Description: Persist launch offer attribution and checkout offer status for conversion analysis

ALTER TABLE users ADD COLUMN first_touch_offer_code TEXT;
ALTER TABLE users ADD COLUMN checkout_offer_code TEXT;
ALTER TABLE users ADD COLUMN checkout_offer_status TEXT;
ALTER TABLE users ADD COLUMN checkout_offer_applied_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_checkout_offer_code ON users(checkout_offer_code);
CREATE INDEX IF NOT EXISTS idx_users_first_touch_offer_code ON users(first_touch_offer_code);
