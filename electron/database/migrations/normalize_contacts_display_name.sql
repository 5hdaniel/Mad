-- Migration: normalize_contacts_display_name.sql
-- Purpose: Ensure display_name is populated for all contacts
-- Copies name -> display_name where display_name is null/empty
-- Task: TASK-202

UPDATE contacts
SET display_name = name
WHERE (display_name IS NULL OR display_name = '')
  AND name IS NOT NULL
  AND name != '';

-- Set default for any remaining nulls
UPDATE contacts
SET display_name = 'Unknown'
WHERE display_name IS NULL OR display_name = '';
