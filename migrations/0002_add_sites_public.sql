-- Migration: 0002_add_sites_public
-- Adds public flag to sites table for shareable dashboard links

ALTER TABLE sites ADD COLUMN public INTEGER NOT NULL DEFAULT 0;
