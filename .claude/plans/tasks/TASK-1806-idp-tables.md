# TASK-1806: Create identity provider tables

**Sprint:** SPRINT-070
**Status:** complete
**Type:** migration
**Est. Tokens:** ~8K
**Actual Tokens:** ~5K

## Description

Create three new tables to support identity provider configuration and SCIM operations:
1. `organization_identity_providers` - Store IdP configs (Google Workspace, Microsoft Entra)
2. `scim_tokens` - Bearer tokens for SCIM API authentication
3. `scim_sync_log` - Audit trail for provisioning events

## Tables to Create

### organization_identity_providers

Stores OAuth/OIDC and SAML configuration for each organization's identity providers.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `provider_type` | TEXT | 'google_workspace', 'azure_ad', 'okta', 'generic_saml' |
| `display_name` | TEXT | Human-readable name |
| `client_id` | TEXT | OAuth client ID |
| `client_secret_encrypted` | TEXT | Encrypted OAuth secret |
| `issuer_url` | TEXT | OIDC issuer |
| `authorization_url` | TEXT | OAuth authorize endpoint |
| `token_url` | TEXT | OAuth token endpoint |
| `userinfo_url` | TEXT | OIDC userinfo endpoint |
| `jwks_url` | TEXT | OIDC JWKS endpoint |
| `saml_metadata_url` | TEXT | SAML metadata (future) |
| `saml_certificate` | TEXT | SAML certificate (future) |
| `attribute_mapping` | JSONB | Map IdP claims to user fields |
| `is_active` | BOOLEAN | Whether IdP is active |
| `verified_at` | TIMESTAMPTZ | When configuration was verified |

### scim_tokens

Bearer tokens for SCIM API authentication.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `token_hash` | TEXT | SHA-256 hash of bearer token |
| `description` | TEXT | "Primary SCIM token" |
| `can_create_users` | BOOLEAN | Permission flag |
| `can_update_users` | BOOLEAN | Permission flag |
| `can_delete_users` | BOOLEAN | Permission flag (default false - soft delete) |
| `can_manage_groups` | BOOLEAN | Permission flag |
| `last_used_at` | TIMESTAMPTZ | Usage tracking |
| `request_count` | INTEGER | Usage tracking |
| `expires_at` | TIMESTAMPTZ | Token expiry |
| `revoked_at` | TIMESTAMPTZ | When revoked |
| `created_by` | UUID | FK to users |

### scim_sync_log

Audit trail for all SCIM operations.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `operation` | TEXT | 'create', 'update', 'delete', 'restore' |
| `resource_type` | TEXT | 'user', 'group' |
| `resource_id` | UUID | Affected resource |
| `external_id` | TEXT | SCIM external ID |
| `request_payload` | JSONB | Request body |
| `response_status` | INTEGER | HTTP status |
| `error_message` | TEXT | Error details |
| `scim_token_id` | UUID | Token used |

## Client Secret Encryption

**IMPORTANT:** The `client_secret_encrypted` column must use proper encryption:

```sql
-- Option 1: Use pgcrypto extension (already enabled in Supabase)
-- Encrypt on insert:
INSERT INTO organization_identity_providers (client_secret_encrypted, ...)
VALUES (pgp_sym_encrypt('actual_secret', current_setting('app.encryption_key')), ...);

-- Decrypt on read (server-side only):
SELECT pgp_sym_decrypt(client_secret_encrypted::bytea, current_setting('app.encryption_key'))
FROM organization_identity_providers;
```

**Alternative:** Use application-level encryption with a key from Supabase Vault or environment variables. The `_encrypted` suffix indicates the value is encrypted at rest - never store plain text.

## RLS Policies

All three tables require RLS. **Include the following SQL in the migration:**

```sql
-- =====================================================
-- organization_identity_providers RLS
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
-- scim_tokens RLS
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
-- scim_sync_log RLS (read-only for admins)
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
```

## CHECK Constraints and Indexes

**Include these constraints in the migration:**

```sql
-- Provider type validation
ALTER TABLE organization_identity_providers
ADD CONSTRAINT valid_provider_type
CHECK (provider_type IN ('google_workspace', 'azure_ad', 'okta', 'generic_saml', 'generic_oidc'));

-- SCIM sync log indexes for query performance
CREATE INDEX idx_scim_sync_log_org_id ON scim_sync_log(organization_id);
CREATE INDEX idx_scim_sync_log_operation ON scim_sync_log(operation);
CREATE INDEX idx_scim_sync_log_created_at ON scim_sync_log(created_at DESC);
CREATE INDEX idx_scim_sync_log_resource ON scim_sync_log(resource_type, resource_id);
```

## Acceptance Criteria

- [x] All three tables created
- [x] Proper foreign keys and indexes
- [x] RLS policies enabled and configured (see SQL above)
- [x] Unique constraint on (organization_id, provider_type)
- [x] CHECK constraint on provider_type
- [x] Indexes on scim_sync_log for performance

## Implementation Summary

**Completed:** 2026-02-03

### Changes Made

1. **Applied migration to Supabase** via MCP `apply_migration` tool
   - Migration name: `create_identity_provider_tables`

2. **Created local migration file**
   - `supabase/migrations/20260203_create_identity_provider_tables.sql`

### Verification Results

**Tables Created:**
- `organization_identity_providers` - IdP OAuth/OIDC/SAML configs
- `scim_tokens` - Bearer tokens for SCIM API
- `scim_sync_log` - Audit trail for SCIM operations

**RLS Enabled:** All 3 tables have row-level security

**Indexes Created:**
- `idx_scim_sync_log_org_id`
- `idx_scim_sync_log_operation`
- `idx_scim_sync_log_created_at`
- `idx_scim_sync_log_resource`

**Constraints:**
- `valid_provider_type` CHECK on organization_identity_providers
- UNIQUE on (organization_id, provider_type)
- Foreign keys to organizations, users, scim_tokens

### Issues/Blockers

None

## Dependencies

- TASK-1805 (organizations columns)

## Blocks

- TASK-1807 (members provisioning columns)
