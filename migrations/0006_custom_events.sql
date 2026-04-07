-- Migration: 0006_custom_events
-- Adds privacy-friendly custom event storage for button clicks, signups, and form submits

CREATE TABLE IF NOT EXISTS custom_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  properties TEXT,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE INDEX IF NOT EXISTS idx_custom_events_site_timestamp ON custom_events(site_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_custom_events_site_name ON custom_events(site_id, event_name);
