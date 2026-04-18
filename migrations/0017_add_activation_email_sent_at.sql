-- Migration: 0017_add_activation_email_sent_at
-- Tracks when a signup-activation drip email was sent to prevent duplicate sends

ALTER TABLE users ADD COLUMN activation_email_sent_at TEXT;
