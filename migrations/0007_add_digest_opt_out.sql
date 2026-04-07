-- Migration: 0007_add_digest_opt_out
-- Adds digest_opt_out flag to users for CAN-SPAM compliant unsubscribe

ALTER TABLE users ADD COLUMN digest_opt_out INTEGER DEFAULT 0;
