# BACKLOG-419: Audit and Restore RLS Policies

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P1 (High)
**Category**: Security
**Sprint**: SPRINT-051
**Estimate**: ~10K tokens

---

## Problem

During login troubleshooting, RLS (Row-Level Security) policies may have been disabled or modified in the Supabase Dashboard. This needs to be audited and restored.

## Background

- RLS policies were potentially disabled to debug authentication issues
- The B2B migration (`20260122_b2b_broker_portal.sql`) includes RLS policies but may not have been fully applied
- Current state of RLS in production Supabase is unknown

## Tasks

### 1. Audit Current State

Check each table in Supabase Dashboard:

| Table | Expected RLS | Check |
|-------|--------------|-------|
| `profiles` | ENABLED | [ ] |
| `user_email_settings` | ENABLED | [ ] |
| `user_preferences` | ENABLED | [ ] |
| `organizations` | ENABLED | [ ] |
| `organization_members` | ENABLED | [ ] |
| `transaction_submissions` | ENABLED | [ ] |
| `submission_messages` | ENABLED | [ ] |
| `submission_attachments` | ENABLED | [ ] |
| `submission_comments` | ENABLED | [ ] |

### 2. Document What Was Changed

- List any tables with RLS disabled
- List any policies that were dropped
- Document reason for changes (login troubleshooting)

### 3. Restore RLS Policies

Either:
- Re-run the migration SQL for affected tables
- Or manually enable RLS and recreate policies in Dashboard

### 4. Test After Restoration

- Verify login still works with RLS enabled
- Verify agents can only see their own data
- Verify brokers can see their org's data

## SQL to Check RLS Status

```sql
-- Check RLS status for all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Acceptance Criteria

- [ ] All tables audited for RLS status
- [ ] RLS enabled on all tables that need it
- [ ] All required policies exist and are correct
- [ ] Login flow still works
- [ ] Data access properly restricted by user/org

## Related

- BACKLOG-388: RLS Policies + Storage Bucket (B2B tables)
- BACKLOG-405: Profiles RLS fix (may be related)
- Login troubleshooting session where RLS was modified
