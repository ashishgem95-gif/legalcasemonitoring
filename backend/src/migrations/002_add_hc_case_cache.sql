-- Migration 002: Add hc_case_cache table for High Court scraper
-- Purpose: Cache results from the 13 High Court portals (Delhi, Mumbai, etc.) with
-- a 24-hour TTL. The scraper checks the cache first to avoid hitting the live site
-- on every resync. On miss/expired, the scraper fetches fresh and writes back.

CREATE TABLE IF NOT EXISTS hc_case_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court_code VARCHAR NOT NULL,
  case_type VARCHAR NOT NULL,
  case_number VARCHAR NOT NULL,
  case_year INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  party_names TEXT,
  case_status VARCHAR,
  next_hearing_date DATE,
  latest_order_link VARCHAR,
  history_link VARCHAR,
  source VARCHAR DEFAULT 'live',
  is_stale INTEGER DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(court_code, case_type, case_number, case_year)
);
CREATE INDEX IF NOT EXISTS idx_hc_cache_expiry ON hc_case_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_hc_cache_lookup ON hc_case_cache(court_code, case_type, case_number, case_year);
