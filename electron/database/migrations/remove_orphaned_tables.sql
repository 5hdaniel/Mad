-- Migration: remove_orphaned_tables.sql
-- Remove unused extraction_metrics and user_feedback tables
-- Task: TASK-204

-- Drop indexes
DROP INDEX IF EXISTS idx_extraction_metrics_user_id;
DROP INDEX IF EXISTS idx_extraction_metrics_field;
DROP INDEX IF EXISTS idx_user_feedback_user_id;
DROP INDEX IF EXISTS idx_user_feedback_transaction_id;
DROP INDEX IF EXISTS idx_user_feedback_field_name;
DROP INDEX IF EXISTS idx_user_feedback_type;

-- Drop trigger
DROP TRIGGER IF EXISTS update_extraction_metrics_timestamp;

-- Drop tables
DROP TABLE IF EXISTS extraction_metrics;
DROP TABLE IF EXISTS user_feedback;
