CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_filename TEXT,
  coverage_start_date TEXT,
  coverage_end_date TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  inserted_row_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (source IN ('google_analytics', 'plausible', 'fathom')),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CHECK (row_count >= 0),
  CHECK (inserted_row_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_site_status ON import_jobs(site_id, status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_site_source ON import_jobs(site_id, source);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at);

CREATE TABLE IF NOT EXISTS imported_daily_traffic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  import_job_id TEXT NOT NULL,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0,
  pageviews INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
  CHECK (source IN ('google_analytics', 'plausible', 'fathom')),
  CHECK (visitors >= 0),
  CHECK (pageviews >= 0),
  UNIQUE(site_id, source, date)
);

CREATE INDEX IF NOT EXISTS idx_imported_daily_traffic_site_date ON imported_daily_traffic(site_id, date);
CREATE INDEX IF NOT EXISTS idx_imported_daily_traffic_job ON imported_daily_traffic(import_job_id);
