# TASK-1807: Update organization_members for provisioning

**Sprint:** SPRINT-070
**Status:** complete
**Type:** migration
**Est. Tokens:** ~5K
**Actual Tokens:** ~3K

## Description

Add columns to `organization_members` to track how members were provisioned and sync state with identity providers.

## Columns to Add

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `provisioned_by` | TEXT | NULL | How member was added: 'manual', 'scim', 'jit', 'invite' |
| `provisioned_at` | TIMESTAMPTZ | NULL | When member was provisioned |
| `scim_synced_at` | TIMESTAMPTZ | NULL | Last sync from IdP |
| `provisioning_metadata` | JSONB | NULL | Extra data from IdP |
| `idp_groups` | TEXT[] | NULL | Groups from identity provider |
| `group_sync_enabled` | BOOLEAN | FALSE | Whether to sync role from IdP groups |

## Migration SQL

```sql
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS provisioned_by TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS scim_synced_at TIMESTAMPTZ;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS provisioning_metadata JSONB;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS idp_groups TEXT[];
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS group_sync_enabled BOOLEAN DEFAULT FALSE;
```

## Use Cases

### Manual Invite
```json
{
  "provisioned_by": "invite",
  "provisioned_at": "2026-02-02T...",
  "provisioning_metadata": {
    "invited_by": "user-uuid",
    "invitation_email": "agent@example.com"
  }
}
```

### SCIM Provisioning
```json
{
  "provisioned_by": "scim",
  "provisioned_at": "2026-02-02T...",
  "scim_synced_at": "2026-02-02T...",
  "idp_groups": ["Sales Team", "Region A"],
  "provisioning_metadata": {
    "scim_request_id": "...",
    "source_idp": "azure_ad"
  }
}
```

### JIT (Just-In-Time)
```json
{
  "provisioned_by": "jit",
  "provisioned_at": "2026-02-02T...",
  "provisioning_metadata": {
    "triggered_by_login": true,
    "source_idp": "google_workspace"
  }
}
```

## Acceptance Criteria

- [x] All columns added to organization_members table
- [x] Existing members unaffected
- [x] Migration is idempotent

## Implementation Summary

**Completed:** 2026-02-03

### Changes Made

1. **Applied migration to Supabase** via MCP `apply_migration` tool
   - Migration name: `add_organization_members_provisioning_columns`

2. **Created local migration file**
   - `supabase/migrations/20260203_add_organization_members_provisioning_columns.sql`

### Verification Results

**Columns Added (6 total):**
- `provisioned_by` (TEXT) - manual, scim, jit, invite
- `provisioned_at` (TIMESTAMPTZ)
- `scim_synced_at` (TIMESTAMPTZ)
- `provisioning_metadata` (JSONB)
- `idp_groups` (TEXT[])
- `group_sync_enabled` (BOOLEAN, default FALSE)

**CHECK Constraint:**
- `organization_members_provisioned_by_check` - validates values

**Indexes:**
- `idx_organization_members_provisioned_by` (partial)
- `idx_organization_members_scim_synced` (partial)

### Issues/Blockers

None

## Dependencies

- TASK-1806 (IdP tables)

## Blocks

None - this is the last task in the sprint.
