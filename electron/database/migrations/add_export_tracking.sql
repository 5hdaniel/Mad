-- ============================================
-- MIGRATION: Enhanced Export Tracking for Transactions
-- ============================================
-- Purpose: Add comprehensive export tracking to transactions table
-- This enables marking transactions as exported with detailed tracking

-- Step 1: Add export status column
-- Tracks the current export state of the transaction
ALTER TABLE transactions ADD COLUMN export_status TEXT DEFAULT 'not_exported' CHECK (export_status IN (
  'not_exported',
  'exported',
  're_export_needed'
));

-- Step 2: Add export format column
-- Tracks the format used for the last export
ALTER TABLE transactions ADD COLUMN export_format TEXT CHECK (export_format IN (
  'pdf',
  'csv',
  'json',
  'txt_eml',
  'excel'
));

-- Step 3: Add export count column
-- Tracks how many times this transaction has been exported
ALTER TABLE transactions ADD COLUMN export_count INTEGER DEFAULT 0;

-- Step 4: Rename export_generated_at to last_exported_on for clarity
-- Note: SQLite doesn't support RENAME COLUMN directly in older versions
-- We'll create a new column and migrate data
ALTER TABLE transactions ADD COLUMN last_exported_on DATETIME;

-- Migrate existing export_generated_at data to last_exported_on
UPDATE transactions SET last_exported_on = export_generated_at WHERE export_generated_at IS NOT NULL;

-- Update export_status for transactions that have been exported
UPDATE transactions SET export_status = 'exported' WHERE last_exported_on IS NOT NULL;

-- Update export_count for transactions that have been exported
UPDATE transactions SET export_count = 1 WHERE last_exported_on IS NOT NULL;

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_export_status ON transactions(export_status);
CREATE INDEX IF NOT EXISTS idx_transactions_last_exported_on ON transactions(last_exported_on);

-- Step 6: Create trigger to update export tracking fields
CREATE TRIGGER IF NOT EXISTS update_transaction_export_timestamp
AFTER UPDATE OF export_status ON transactions
WHEN NEW.export_status = 'exported'
BEGIN
  UPDATE transactions
  SET
    last_exported_on = CURRENT_TIMESTAMP,
    export_count = COALESCE(export_count, 0) + 1
  WHERE id = NEW.id AND (OLD.export_status != 'exported' OR OLD.export_status IS NULL);
END;

-- ============================================
-- EXPORT STATUS DEFINITIONS
-- ============================================
-- This is for documentation purposes

-- EXPORT STATUS VALUES:
-- - not_exported: Transaction has never been exported
-- - exported: Transaction has been successfully exported
-- - re_export_needed: Transaction data has changed and needs re-export

-- EXPORT FORMAT VALUES:
-- - pdf: Exported as PDF document
-- - csv: Exported as CSV file
-- - json: Exported as JSON file
-- - txt_eml: Exported as text with email attachments
-- - excel: Exported as Excel spreadsheet

-- USAGE NOTES:
-- - export_count increments each time export_status changes to 'exported'
-- - last_exported_on automatically updates when export_status becomes 'exported'
-- - export_format should be updated when performing an export
-- - Set export_status to 're_export_needed' when transaction data changes significantly
