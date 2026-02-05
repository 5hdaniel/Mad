-- ============================================
-- ADD message_type TO submission_messages
-- Migration: 20260203_submission_message_type
-- Purpose: Support special message types in broker portal
-- ============================================

-- Add message_type column to submission_messages table
-- This mirrors the message_type field from the desktop app's messages table
-- Values: text, voice_message, location, attachment_only, system, unknown
ALTER TABLE submission_messages
ADD COLUMN IF NOT EXISTS message_type VARCHAR(50)
DEFAULT 'text'
CHECK (message_type IN ('text', 'voice_message', 'location', 'attachment_only', 'system', 'unknown'));

-- Add index for filtering by message type (optional, for future queries)
CREATE INDEX IF NOT EXISTS idx_submission_messages_type
ON submission_messages(message_type);

-- Comment for documentation
COMMENT ON COLUMN submission_messages.message_type IS
  'Type of message: text (default), voice_message, location, attachment_only, system, or unknown';
