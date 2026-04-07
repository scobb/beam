-- Goals table for conversion tracking
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE INDEX IF NOT EXISTS idx_goals_site_id ON goals(site_id);
