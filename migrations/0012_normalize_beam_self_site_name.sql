-- Migration: 0012_normalize_beam_self_site_name
-- Ensures the seeded Beam dogfooding site uses the canonical public product name.

UPDATE sites
SET name = 'Beam'
WHERE id = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03';
