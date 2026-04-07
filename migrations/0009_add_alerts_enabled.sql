-- Migration: 0009_add_alerts_enabled
-- Adds per-site traffic alert toggle for anomaly detection emails

ALTER TABLE sites ADD COLUMN alerts_enabled INTEGER DEFAULT 1;
