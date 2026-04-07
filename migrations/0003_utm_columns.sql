-- Add UTM campaign tracking columns to pageviews table
ALTER TABLE pageviews ADD COLUMN utm_source TEXT;
ALTER TABLE pageviews ADD COLUMN utm_medium TEXT;
ALTER TABLE pageviews ADD COLUMN utm_campaign TEXT;
