-- ============================================
-- MIGRATION: Add License Type Columns (SQLite)
-- Issue: BACKLOG-426 - License-aware feature gating
-- ============================================
--
-- License Model:
--   license_type: 'individual' | 'team' | 'enterprise' (base license)
--   ai_detection_enabled: boolean (add-on, works with ANY base license)
--
-- This migration adds columns to the local users_local table to support
-- license-aware feature gating. Values are synced from Supabase cloud.

-- Add license_type column
-- SQLite uses TEXT instead of VARCHAR
-- Default to 'individual' for existing users
ALTER TABLE users_local ADD COLUMN license_type TEXT DEFAULT 'individual'
  CHECK (license_type IN ('individual', 'team', 'enterprise'));

-- Add AI detection add-on flag
-- SQLite uses INTEGER (0/1) for boolean
ALTER TABLE users_local ADD COLUMN ai_detection_enabled INTEGER DEFAULT 0;

-- Add organization_id for team/enterprise users
-- Links local user to their organization (synced from cloud)
ALTER TABLE users_local ADD COLUMN organization_id TEXT;

-- Create index for license type queries
CREATE INDEX IF NOT EXISTS idx_users_local_license_type ON users_local(license_type);

-- Create index for organization queries
CREATE INDEX IF NOT EXISTS idx_users_local_organization ON users_local(organization_id);
