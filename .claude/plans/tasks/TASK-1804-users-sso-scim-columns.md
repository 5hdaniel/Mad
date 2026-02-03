# TASK-1804: Add SSO/SCIM columns to users table

**Sprint:** SPRINT-070
**Status:** complete
**Type:** migration
**Est. Tokens:** ~15K
**Actual Tokens:** ~5K

## Description

Add columns to the `users` table to support SSO authentication and SCIM provisioning.

## Columns to Add

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `scim_external_id` | TEXT | NULL | External ID from identity provider |
| `provisioning_source` | TEXT | 'manual' | How user was created: 'manual', 'scim', 'jit', 'invite' |
| `is_managed` | BOOLEAN | FALSE | True if managed by external IdP |
| `suspended_at` | TIMESTAMPTZ | NULL | Soft-delete timestamp for SCIM deprovisioning |
| `suspension_reason` | TEXT | NULL | Why user was suspended |
| `sso_only` | BOOLEAN | FALSE | Block password login when true |
| `last_sso_login_at` | TIMESTAMPTZ | NULL | Track last SSO usage |
| `last_sso_provider` | TEXT | NULL | Last IdP used (google, azure, etc.) |
| `jit_provisioned` | BOOLEAN | FALSE | Created via Just-In-Time provisioning |
| `jit_provisioned_at` | TIMESTAMPTZ | NULL | When JIT provisioning occurred |
| `idp_claims` | JSONB | NULL | Store raw claims from IdP |

## Indexes to Create

- `idx_users_scim_external_id` - For SCIM lookups (partial: WHERE NOT NULL)
- `idx_users_provisioning_source` - For filtering by source
- `idx_users_suspended_at` - For finding suspended users (partial: WHERE NOT NULL)

## Migration SQL

```sql
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

-- Add CHECK constraints for data validation
ALTER TABLE users ADD CONSTRAINT users_provisioning_source_check
  CHECK (provisioning_source IN ('manual', 'scim', 'jit', 'invite'));

-- Optional: Composite index for SSO user queries
CREATE INDEX IF NOT EXISTS idx_users_sso_managed ON users(is_managed, sso_only) WHERE is_managed = TRUE OR sso_only = TRUE;
```

## Acceptance Criteria

- [x] All columns added to users table
- [x] Indexes created
- [x] Existing users unaffected (defaults applied)
- [x] Migration is idempotent (can run multiple times)

## Implementation Summary

**Completed:** 2026-02-03

### Changes Made

1. **Applied migration to Supabase** via MCP `apply_migration` tool
   - Migration version: `20260203092302`
   - Migration name: `add_users_sso_scim_columns`

2. **Created local migration file**
   - `supabase/migrations/20260203_add_users_sso_scim_columns.sql`

### Verification Results

**Columns Added (11 total):**
- `scim_external_id` (TEXT)
- `provisioning_source` (TEXT, default 'manual')
- `is_managed` (BOOLEAN, default FALSE)
- `suspended_at` (TIMESTAMPTZ)
- `suspension_reason` (TEXT)
- `sso_only` (BOOLEAN, default FALSE)
- `last_sso_login_at` (TIMESTAMPTZ)
- `last_sso_provider` (TEXT)
- `jit_provisioned` (BOOLEAN, default FALSE)
- `jit_provisioned_at` (TIMESTAMPTZ)
- `idp_claims` (JSONB)

**Indexes Created (4 total):**
- `idx_users_scim_external_id` (partial: WHERE scim_external_id IS NOT NULL)
- `idx_users_provisioning_source`
- `idx_users_suspended_at` (partial: WHERE suspended_at IS NOT NULL)
- `idx_users_sso_managed` (composite partial: WHERE is_managed = TRUE OR sso_only = TRUE)

**CHECK Constraint:**
- `users_provisioning_source_check` - validates values: 'manual', 'scim', 'jit', 'invite'

### Issues/Blockers

None - migration applied cleanly with all verification queries passing.

## Dependencies

None - this is the first task in the sprint.

## Blocks

- TASK-1805 (organizations columns)
