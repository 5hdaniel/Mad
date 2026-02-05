-- TASK-1807: Add provisioning columns to organization_members table
-- Sprint: SPRINT-070

-- Add provisioning tracking columns
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS provisioned_by TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS scim_synced_at TIMESTAMPTZ;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS provisioning_metadata JSONB;

-- Add IdP group mapping columns
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS idp_groups TEXT[];
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS group_sync_enabled BOOLEAN DEFAULT FALSE;

-- Add CHECK constraint for provisioned_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_provisioned_by_check'
  ) THEN
    ALTER TABLE organization_members ADD CONSTRAINT organization_members_provisioned_by_check
      CHECK (provisioned_by IS NULL OR provisioned_by IN ('manual', 'scim', 'jit', 'invite'));
  END IF;
END $$;

-- Index for filtering by provisioning source
CREATE INDEX IF NOT EXISTS idx_organization_members_provisioned_by ON organization_members(provisioned_by) WHERE provisioned_by IS NOT NULL;

-- Index for SCIM sync queries
CREATE INDEX IF NOT EXISTS idx_organization_members_scim_synced ON organization_members(scim_synced_at) WHERE scim_synced_at IS NOT NULL;
