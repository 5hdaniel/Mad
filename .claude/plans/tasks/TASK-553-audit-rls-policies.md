# Task TASK-553: Audit and Restore RLS Policies

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See workflow in task template.

---

## Goal

Audit Supabase RLS (Row-Level Security) policies that may have been disabled during SPRINT-050 login troubleshooting, and restore them to proper state.

## Non-Goals

- Do NOT modify RLS policies beyond restoring them
- Do NOT change authentication logic
- Do NOT modify the B2B migration files
- Do NOT create new tables or columns

## Deliverables

1. New file: `.claude/plans/security/rls-audit-051.md` - Audit documentation
2. Update: Supabase RLS policies (via Dashboard or migration) if needed

## Acceptance Criteria

- [ ] All required tables audited for RLS status
- [ ] RLS enabled on all tables that require it
- [ ] All required policies exist and are correct
- [ ] Login flow still works after restoration
- [ ] Agent users can only see their own data
- [ ] Broker users can see their organization's data
- [ ] Audit documented in security folder

## Implementation Notes

### Tables to Audit

| Table | Expected RLS | Check Status |
|-------|--------------|--------------|
| `profiles` | ENABLED | |
| `user_email_settings` | ENABLED | |
| `user_preferences` | ENABLED | |
| `organizations` | ENABLED | |
| `organization_members` | ENABLED | |
| `transaction_submissions` | ENABLED | |
| `submission_messages` | ENABLED | |
| `submission_attachments` | ENABLED | |
| `submission_comments` | ENABLED | |

### SQL to Check RLS Status

Run in Supabase SQL Editor:

```sql
-- Check RLS status for all public tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all existing RLS policies
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

### Restoring RLS

If RLS is disabled on a table:

```sql
-- Enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Recreate policies from migration file
-- Reference: supabase/migrations/20260122_b2b_broker_portal.sql
```

### Testing After Restoration

1. **Agent User Test**:
   - Login as agent user
   - Verify can see own transactions
   - Verify cannot see other agents' data

2. **Broker User Test**:
   - Login as broker user
   - Verify can see organization's submissions
   - Verify cannot see other orgs' data

## Integration Notes

- Depends on: None
- Used by: TASK-560 (E2E testing needs correct RLS)

## Do / Don't

### Do:
- Document current state before making changes
- Test login flow after any changes
- Verify with both agent and broker test users
- Keep audit documentation for compliance

### Don't:
- Disable RLS to "fix" access issues
- Create new policies without documentation
- Modify policies beyond restoration
- Skip testing after changes

## When to Stop and Ask

- If RLS policies are significantly different from migration file
- If restoring RLS breaks authentication
- If you discover undocumented policy changes
- If access patterns seem incorrect in migration

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (Supabase policy testing is manual)

### Integration / Feature Tests

- Required scenarios:
  - Agent login and data access
  - Broker login and org data access
  - Cross-org access denied

### CI Requirements

- [ ] No code changes to fail CI (Supabase changes are external)

## PR Preparation

- **Title**: `security(rls): audit and restore RLS policies post-SPRINT-050`
- **Labels**: `security`, `supabase`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~8K-12K (apply 0.4x security multiplier = ~4K-5K effective)

**Token Cap:** 48K (4x upper estimate)

**Confidence:** Medium

**Risk factors:**
- Unknown current state of RLS
- May need Dashboard access

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Audit Results

| Table | RLS Enabled? | Policies Present? | Action Taken |
|-------|--------------|-------------------|--------------|
| `profiles` | | | |
| `user_email_settings` | | | |
| (continue for all tables) | | | |

### Verification

- [ ] Agent login works
- [ ] Broker login works
- [ ] Agent can see own data
- [ ] Agent cannot see other data
- [ ] Broker can see org data

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Security Review:** PASS / FAIL

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
