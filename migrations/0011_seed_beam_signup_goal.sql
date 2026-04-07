-- Seed a dogfooding conversion goal for Beam's own funnel events.
INSERT INTO goals (id, site_id, name, match_pattern, created_at)
SELECT
  'd8f97cf8-fbe7-4ee1-9b18-69f5a8cf5e92',
  'dfa32f6b-0775-43df-a2c4-eb23787e5f03',
  'Signup Complete',
  'event:signup_complete',
  '2026-04-03T19:10:00.000Z'
WHERE EXISTS (
  SELECT 1 FROM sites WHERE id = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
)
AND NOT EXISTS (
  SELECT 1
  FROM goals
  WHERE site_id = 'dfa32f6b-0775-43df-a2c4-eb23787e5f03'
    AND match_pattern = 'event:signup_complete'
);
