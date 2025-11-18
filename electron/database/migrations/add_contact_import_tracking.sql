-- ============================================
-- CONTACT IMPORT TRACKING
-- ============================================
-- Purpose: Track which contacts have been imported to the local database
-- This allows filtering between "available contacts" (from external sources)
-- and "imported contacts" (those the user has chosen to add)

-- Add is_imported column to contacts table
ALTER TABLE contacts ADD COLUMN is_imported INTEGER DEFAULT 1;

-- Update existing contacts to be marked as imported
-- Manual and email contacts are automatically imported
UPDATE contacts SET is_imported = 1 WHERE source IN ('manual', 'email');

-- ============================================
-- INDEXES FOR CONTACT IMPORT TRACKING
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contacts_is_imported ON contacts(is_imported);
CREATE INDEX IF NOT EXISTS idx_contacts_user_imported ON contacts(user_id, is_imported);
