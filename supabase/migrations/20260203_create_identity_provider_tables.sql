-- TASK-1806: Create identity provider tables
-- Sprint: SPRINT-070

-- =====================================================
-- Table: organization_identity_providers
-- Stores OAuth/OIDC and SAML configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_identity_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- OAuth/OIDC config
  client_id TEXT,
  client_secret_encrypted TEXT,
  issuer_url TEXT,
  authorization_url TEXT,
  token_url TEXT,
  userinfo_url TEXT,
  jwks_url TEXT,

  -- SAML config (for future)
  saml_metadata_url TEXT,
  saml_certificate TEXT,

  -- Attribute mapping
  attribute_mapping JSONB DEFAULT '{"email": "email", "name": "name", "groups": "groups"}',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, provider_type)
);

-- =====================================================
-- Table: scim_tokens
-- Bearer tokens for SCIM API authentication
-- =====================================================
CREATE TABLE IF NOT EXISTS scim_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  description TEXT,

  -- Permissions
  can_create_users BOOLEAN DEFAULT TRUE,
  can_update_users BOOLEAN DEFAULT TRUE,
  can_delete_users BOOLEAN DEFAULT FALSE,
  can_manage_groups BOOLEAN DEFAULT TRUE,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,

  -- Lifecycle
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: scim_sync_log
-- Audit trail for all SCIM operations
-- =====================================================
CREATE TABLE IF NOT EXISTS scim_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  external_id TEXT,

  -- Request details
  request_payload JSONB,
  response_status INTEGER,
  error_message TEXT,

  -- Tracking
  scim_token_id UUID REFERENCES scim_tokens(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHECK Constraints
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_provider_type'
  ) THEN
    ALTER TABLE organization_identity_providers
    ADD CONSTRAINT valid_provider_type
    CHECK (provider_type IN ('google_workspace', 'azure_ad', 'okta', 'generic_saml', 'generic_oidc'));
  END IF;
END $$;

-- =====================================================
-- Indexes for scim_sync_log query performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_scim_sync_log_org_id ON scim_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_sync_log_operation ON scim_sync_log(operation);
CREATE INDEX IF NOT EXISTS idx_scim_sync_log_created_at ON scim_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scim_sync_log_resource ON scim_sync_log(resource_type, resource_id);

-- =====================================================
-- RLS Policies: organization_identity_providers
-- =====================================================
ALTER TABLE organization_identity_providers ENABLE ROW LEVEL SECURITY;

-- Org admins can view identity providers
CREATE POLICY "Org admins can view identity providers"
ON organization_identity_providers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_identity_providers.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('admin', 'it_admin')
    AND om.license_status = 'active'
  )
);

-- IT admins can manage identity providers
CREATE POLICY "IT admins can manage identity providers"
ON organization_identity_providers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_identity_providers.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'it_admin'
    AND om.license_status = 'active'
  )
);

-- =====================================================
-- RLS Policies: scim_tokens
-- =====================================================
ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;

-- IT admins can manage SCIM tokens
CREATE POLICY "IT admins can manage SCIM tokens"
ON scim_tokens FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = scim_tokens.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'it_admin'
    AND om.license_status = 'active'
  )
);

-- =====================================================
-- RLS Policies: scim_sync_log (read-only for admins)
-- =====================================================
ALTER TABLE scim_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can view SCIM sync logs
CREATE POLICY "Admins can view SCIM sync logs"
ON scim_sync_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = scim_sync_log.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('admin', 'it_admin')
    AND om.license_status = 'active'
  )
);
