-- Migration: 0010_add_users_api_key
-- Adds hashed API key support for Pro stats API access

ALTER TABLE users ADD COLUMN api_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
