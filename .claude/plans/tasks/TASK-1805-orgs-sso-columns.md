# TASK-1805: Add SSO/SCIM columns to organizations table

**Sprint:** SPRINT-070
**Status:** complete
**Type:** migration
**Est. Tokens:** ~10K
**Actual Tokens:** ~3K

## Description

Add columns to the `organizations` table to support SSO settings at the organization level.

## Columns to Add

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `sso_enabled` | BOOLEAN | FALSE | SSO is configured for this org |
| `sso_required` | BOOLEAN | FALSE | Force SSO (no password login) |
| `sso_domain_restriction` | TEXT[] | NULL | Allowed email domains |
| `scim_enabled` | BOOLEAN | FALSE | SCIM provisioning is active |
| `default_member_role` | TEXT | 'member' | Role for SCIM-provisioned users |
| `directory_sync_enabled` | BOOLEAN | FALSE | Sync with directory service |
| `directory_sync_last_at` | TIMESTAMPTZ | NULL | Last successful sync |

## Migration SQL

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_required BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_domain_restriction TEXT[];
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS scim_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_member_role TEXT DEFAULT 'member';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS directory_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS directory_sync_last_at TIMESTAMPTZ;

-- Add CHECK constraint for default_member_role
-- NOTE: it_admin is intentionally excluded - should never be auto-provisioned
ALTER TABLE organizations ADD CONSTRAINT organizations_default_member_role_check
  CHECK (default_member_role IN ('agent', 'broker', 'admin', 'member'));
```

## Acceptance Criteria

- [x] All columns added to organizations table
- [x] Existing organizations unaffected
- [x] Migration is idempotent

## Implementation Summary

**Completed:** 2026-02-03

### Changes Made

1. **Applied migration to Supabase** via MCP `apply_migration` tool
   - Migration name: `add_organizations_sso_columns`

2. **Created local migration file**
   - `supabase/migrations/20260203_add_organizations_sso_columns.sql`

### Verification Results

**Columns Added (7 total):**
- `sso_enabled` (BOOLEAN, default FALSE)
- `sso_required` (BOOLEAN, default FALSE)
- `sso_domain_restriction` (TEXT[])
- `scim_enabled` (BOOLEAN, default FALSE)
- `default_member_role` (TEXT, default 'member')
- `directory_sync_enabled` (BOOLEAN, default FALSE)
- `directory_sync_last_at` (TIMESTAMPTZ)

**CHECK Constraint:**
- `organizations_default_member_role_check` - validates values: 'agent', 'broker', 'admin', 'member'
- Note: 'it_admin' intentionally excluded from auto-provisioning

### Issues/Blockers

None

## Dependencies

- TASK-1804 (users columns - logical ordering)

## Blocks

- TASK-1806 (identity provider tables)
