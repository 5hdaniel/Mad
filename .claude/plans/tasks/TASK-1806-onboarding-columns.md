# Task TASK-1806: Add Onboarding State Columns to Supabase

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add two columns to the Supabase `users` table to track onboarding progress, enabling the app to resume at the correct step after restart.

## Non-Goals

- Do NOT modify any TypeScript code (that's TASK-1807)
- Do NOT add RLS policies (existing user policies should cover)
- Do NOT add triggers or functions
- Keep it minimal - just the columns

## Deliverables

1. Supabase migration adding `current_onboarding_step` TEXT column
2. Supabase migration adding `onboarding_completed_at` TIMESTAMPTZ column

## Acceptance Criteria

- [ ] `current_onboarding_step` column exists in `users` table
- [ ] `onboarding_completed_at` column exists in `users` table
- [ ] Both columns are nullable (existing users don't have values)
- [ ] Migration applied successfully
- [ ] No breaking changes to existing data

## Implementation Notes

### Migration SQL

```sql
-- Add onboarding state tracking columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS current_onboarding_step TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.users.current_onboarding_step IS 'Current onboarding step the user is on (phone-type, secure-storage, email-connect, permissions, etc.)';
COMMENT ON COLUMN public.users.onboarding_completed_at IS 'Timestamp when user completed full onboarding flow';
```

### Valid Step Values

The `current_onboarding_step` column should accept these values:
- `phone-type` - Selecting iPhone/Android
- `secure-storage` - macOS keychain setup
- `email-connect` - Email OAuth connection
- `permissions` - macOS Full Disk Access
- `apple-driver` - Windows Apple driver setup
- `android-coming-soon` - Android placeholder
- `null` - Not started or completed

### Existing Schema Context

Current `users` table relevant columns:
- `terms_accepted_at` - Already exists for terms tracking
- `email_onboarding_completed_at` - Already exists for email step

The new columns complement these existing fields.

## Integration Notes

- Imports from: N/A (migration only)
- Exports to: N/A
- Used by: TASK-1807 (persist step), TASK-1808 (resume step)
- Depends on: None (can run in parallel with TASK-1809)

## Do / Don't

### Do:
- Use `IF NOT EXISTS` to make migration idempotent
- Add column comments for documentation
- Use appropriate data types (TEXT for step, TIMESTAMPTZ for timestamp)

### Don't:
- Add constraints or enums (keep flexible for future steps)
- Modify existing columns
- Add indexes (not needed for single-user queries)
- Create new tables

## When to Stop and Ask

- If the migration fails to apply
- If RLS policies prevent column addition
- If existing data is affected unexpectedly

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (migration only)
- Verify via SQL query after migration

### Integration Tests

After migration, verify:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('current_onboarding_step', 'onboarding_completed_at');
```

Expected: 2 rows returned with correct types.

### CI Requirements

- [ ] Migration applies without error
- [ ] Existing tests still pass (no schema breaks)

---

## PM Estimate (PM-Owned)

**Category:** `migration`

**Estimated Tokens:** ~3K

**Token Cap:** 12K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | - |
| Files to modify | 0 (Supabase only) | - |
| Migration complexity | Simple (2 columns) | ~3K |
| Test complexity | None (verify via SQL) | - |

**Confidence:** High - simple migration

**Risk factors:**
- Minimal - adding nullable columns is non-breaking

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] N/A (migration via MCP)

Migration applied:
- [ ] current_onboarding_step column added
- [ ] onboarding_completed_at column added
- [ ] Verified via SQL query

Verification:
- [ ] Migration successful
- [ ] Existing data unaffected
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~3K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

**Deviations from plan:**
<None or description>

**Issues encountered:**
<None or description>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Schema Review:** PASS / FAIL
**Data Safety:** PASS / FAIL / N/A

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
