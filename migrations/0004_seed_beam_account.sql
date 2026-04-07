-- Migration: 0004_seed_beam_account
-- Seeds the Beam internal analytics account and self-tracking site
-- This enables dogfooding: beam.keylightdigital.dev tracks its own traffic

-- Internal Beam user account (pro plan, used only for the self-tracking site)
INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'beam-analytics@keylightdigital.dev',
  '9fd7e442c4c6bfec2f22d20e98248007:6b74b8390654fff7ed3f03976a30c6a498bbd22e4b40b23409cbc967f3c87302',
  'pro',
  '2026-04-01T00:00:00.000Z',
  '2026-04-01T00:00:00.000Z'
);

-- Self-tracking site: beam.keylightdigital.dev
-- public = 1 enables the public dashboard at /public/dfa32f6b-0775-43df-a2c4-eb23787e5f03
INSERT OR IGNORE INTO sites (id, user_id, domain, name, created_at, public)
VALUES (
  'dfa32f6b-0775-43df-a2c4-eb23787e5f03',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'beam.keylightdigital.dev',
  'Beam',
  '2026-04-01T00:00:00.000Z',
  1
);
