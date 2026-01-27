# BACKLOG-531: Enable RLS on All Critical Tables

**Created**: 2026-01-27
**Priority**: P1 - High Security
**Category**: Security
**Status**: Pending

---

## Problem Statement

5 tables have RLS disabled despite having RLS policies defined:
- `profiles`
- `organization_members`
- `submission_messages`
- `submission_attachments`
- `submission_comments`

This means the RLS policies are completely ignored - anyone with database access can read/write all data.

## Security Risk

**Severity**: High

- User profile data is accessible without authentication
- Organization membership can be manipulated
- Submission data (messages, attachments, comments) is not protected
- Multi-tenant isolation is broken for these tables

## Root Cause

Tables were likely created without `ENABLE ROW LEVEL SECURITY` or it was disabled during debugging and never re-enabled.

## Solution

Create a migration to enable RLS on all affected tables:

```sql
-- Enable RLS on tables with disabled RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_comments ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners as well (prevents bypass via service role)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submission_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submission_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submission_comments FORCE ROW LEVEL SECURITY;
```

## Pre-Migration Checklist

Before applying:
1. [ ] Verify existing RLS policies are correct and complete
2. [ ] Test with sample user to ensure policies work
3. [ ] Ensure no application code relies on RLS being disabled
4. [ ] Have rollback plan ready

## Acceptance Criteria

- [ ] All 5 tables have RLS enabled
- [ ] FORCE ROW LEVEL SECURITY applied to prevent bypass
- [ ] Existing RLS policies verified to work correctly
- [ ] Application tested - all features work with RLS enabled
- [ ] No data access regressions

## Estimated Effort

~10K tokens (simple migration, but requires careful testing)

## Notes

This should be prioritized before BACKLOG-530 (service key removal) since enabling RLS is pointless if the service key bypasses it anyway.
