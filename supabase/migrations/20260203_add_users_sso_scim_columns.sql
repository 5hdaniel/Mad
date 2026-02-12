-- TASK-1804: Add SSO/SCIM columns to users table
-- Sprint: SPRINT-070

-- Add SSO/SCIM columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provisioning_source TEXT DEFAULT 'manual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_only BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sso_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sso_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jit_provisioned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jit_provisioned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS idp_claims JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_scim_external_id ON users(scim_external_id) WHERE scim_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_provisioning_source ON users(provisioning_source);
CREATE INDEX IF NOT EXISTS idx_users_suspended_at ON users(suspended_at) WHERE suspended_at IS NOT NULL;

-- Add CHECK constraint for data validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_provisioning_source_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_provisioning_source_check
      CHECK (provisioning_source IN ('manual', 'scim', 'jit', 'invite'));
  END IF;
END $$;

-- Composite index for SSO user queries
CREATE INDEX IF NOT EXISTS idx_users_sso_managed ON users(is_managed, sso_only) WHERE is_managed = TRUE OR sso_only = TRUE;
