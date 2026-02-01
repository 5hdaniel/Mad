-- ============================================
-- MIGRATION: Add License Type Columns
-- Migration: 20260123_add_license_columns
-- Issue: BACKLOG-426 - License-aware feature gating
-- ============================================
--
-- License Model:
--   license_type: 'individual' | 'team' | 'enterprise' (base license)
--   ai_detection_enabled: boolean (add-on, works with ANY base license)
--
-- Combined Examples:
--   - Individual + No AI: Export, manual transactions only
--   - Individual + AI: Export, manual transactions, AI detection features
--   - Team + No AI: Submit for review, manual transactions only
--   - Team + AI: Submit for review, manual transactions, AI detection features
--
-- This migration adds columns to support license-aware feature gating
-- for both base license tiers and the AI detection add-on.

-- Add license_type column with constraint
-- Default to 'individual' for existing users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'individual'
    CHECK (license_type IN ('individual', 'team', 'enterprise'));

-- Add AI detection add-on flag
-- Default to FALSE - users must explicitly enable/purchase
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_detection_enabled BOOLEAN DEFAULT FALSE;

-- Add team upgrade tracking columns
-- These track when a user upgraded to team tier and who invited them
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_upgraded_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_upgraded_from_profile_id UUID;

-- Add index for license queries (filtering users by tier)
CREATE INDEX IF NOT EXISTS idx_users_license_type ON users(license_type);

-- Add index for AI detection queries (finding users with AI enabled)
CREATE INDEX IF NOT EXISTS idx_users_ai_detection ON users(ai_detection_enabled);

-- Comment on columns for documentation
COMMENT ON COLUMN users.license_type IS 'Base license tier: individual, team, or enterprise';
COMMENT ON COLUMN users.ai_detection_enabled IS 'AI detection add-on enabled (works with any base license)';
COMMENT ON COLUMN users.team_upgraded_at IS 'Timestamp when user upgraded to team tier';
COMMENT ON COLUMN users.team_upgraded_from_profile_id IS 'Reference to user who invited this user to team';
