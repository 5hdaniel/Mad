-- TASK-1805: Add SSO/SCIM columns to organizations table
-- Sprint: SPRINT-070

-- Add SSO settings columns
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_required BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_domain_restriction TEXT[];

-- Add SCIM settings columns
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS scim_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_member_role TEXT DEFAULT 'member';

-- Add directory sync columns
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS directory_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS directory_sync_last_at TIMESTAMPTZ;

-- Add CHECK constraint for default_member_role
-- NOTE: it_admin is intentionally excluded - should never be auto-provisioned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_default_member_role_check'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_default_member_role_check
      CHECK (default_member_role IN ('agent', 'broker', 'admin', 'member'));
  END IF;
END $$;
