-- Migration 003: Per-user read state for case alerts
-- Previously, case_alerts.is_read was a global flag (all users shared the same read state).
-- This migration adds a junction table for per-user read tracking.

CREATE TABLE IF NOT EXISTS case_alert_reads (
  alert_id INTEGER NOT NULL,
  user_id VARCHAR NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_id, user_id),
  FOREIGN KEY (alert_id) REFERENCES case_alerts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
