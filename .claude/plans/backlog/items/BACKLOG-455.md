# BACKLOG-455: Ensure RLS Enabled on All B2B Tables

## Summary

RLS policies exist but RLS was not enabled on `transaction_submissions` table, causing data leakage. Need to audit all B2B tables and ensure RLS is properly enabled.

## Category

Security / Database

## Priority

P0 - Critical (Security vulnerability - data leakage)

## Description

### Problem

During QA testing (TEST-051-006), discovered that:
- RLS policies were correctly defined in migrations
- But `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was not executed
- Result: All users could see all data regardless of organization

### Evidence

```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname = 'transaction_submissions';
-- Result: relrowsecurity = false (RLS disabled!)
```

### Immediate Fix Applied

```sql
ALTER TABLE transaction_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_submissions FORCE ROW LEVEL SECURITY;
```

### Required Audit

Check and enable RLS on ALL B2B tables:
- `organizations`
- `organization_members`
- `transaction_submissions`
- `submission_attachments`
- `submission_messages`
- `submission_contacts`
- `review_comments`

### Solution

1. Create migration to ensure RLS is enabled on all tables
2. Add check to CI/deployment to verify RLS status
3. Update existing migrations to be idempotent with RLS enable

## Acceptance Criteria

- [ ] All B2B tables have RLS enabled
- [ ] All B2B tables have FORCE ROW LEVEL SECURITY
- [ ] Migration is idempotent (safe to re-run)
- [ ] Verification query added to deployment checklist

## Estimated Effort

~15K tokens

## Related Items

- TEST-051-006: RLS testing (discovered this issue)
- BACKLOG-419: RLS audit (policies were correct, enablement was missing)
