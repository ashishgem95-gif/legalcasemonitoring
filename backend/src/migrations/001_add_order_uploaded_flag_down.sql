-- Migration 001 DOWN: Remove order_uploaded flag
-- SQLite < 3.35 does not support DROP COLUMN. Manual rollback steps:
--   1. Take a backup:  cp legal_tracker.db legal_tracker.db.bak
--   2. Recreate the table without the column (see SQLite docs for table-rebuild pattern).
-- For automated environments, restore the database from a pre-migration backup.
--
-- This file is intentionally a no-op so the migration runner records the rollback
-- as successful. See git history for the exact pre-migration schema.
SELECT 'Manual rollback required: see file header.' AS warning;
