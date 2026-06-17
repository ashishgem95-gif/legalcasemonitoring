-- Migration 001: Add order_uploaded flag to hearing_history
-- Purpose: The previous "Awaiting Orders" check used the emptiness of order_raw_text,
-- which was unreliable because the CAT scraper auto-fills that column with short status
-- strings. This new explicit flag lets staff mark each hearing as having its order
-- uploaded (via a UI toggle in CaseDetail) so the Kanban "Awaiting Orders" column
-- reflects reality.

-- 1. Add the flag column. Default 0 (not yet reviewed).
ALTER TABLE hearing_history ADD COLUMN order_uploaded INTEGER DEFAULT 0;

-- 2. Smart backfill: mark a hearing as uploaded ONLY if it has both a real-looking
-- order_raw_text AND at least one linked case_documents row.
-- "Real-looking" means: not a placeholder like "System-generated reminder." or
-- "Purpose: . | Status: P | Nature: ." (both < 30 chars and contain tell-tale
-- placeholder markers). The scraper emits these when it can't fetch the real order.
UPDATE hearing_history
SET order_uploaded = 1
WHERE COALESCE(TRIM(order_raw_text), '') != ''
  AND LENGTH(order_raw_text) >= 40
  AND order_raw_text NOT LIKE '%System-generated reminder%'
  AND order_raw_text NOT LIKE 'Purpose: .%'
  AND EXISTS (
    SELECT 1 FROM case_documents
    WHERE case_documents.case_id = hearing_history.case_id
  );
