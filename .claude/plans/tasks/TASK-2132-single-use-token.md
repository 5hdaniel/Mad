# TASK-2132: Make Impersonation Token Single-Use

**Backlog ID:** BACKLOG-892
**Sprint:** SPRINT-118
**Phase:** Phase 1 - Cookie Security (Sequential, second)
**Depends On:** TASK-2131 (cookie signing must be in place)
**Branch:** `fix/task-2132-single-use-token`
**Branch From:** `int/sprint-118-security-hardening`
**Branch Into:** `int/sprint-118-security-hardening`
**Estimated Tokens:** ~6K (security category x 0.4)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-2131 for full workflow reference.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Make the impersonation token single-use by adding a status transition in `admin_validate_impersonation_token` -- after first successful validation, the token status changes from `active` to `validated`, preventing replay.

## Non-Goals

- Do NOT change the cookie format (TASK-2131 handles that)
- Do NOT add DB validation on every page load (that is TASK-2133)
- Do NOT change the token TTL (that is TASK-2135)
- Do NOT modify any broker-portal TypeScript files

## Deliverables

1. New: `supabase/migrations/YYYYMMDD_single_use_impersonation_token.sql` -- ALTER function + status constraint

## File Boundaries

### Files to modify (owned by this task):

- `supabase/migrations/` -- new migration file only

### Files this task must NOT modify:

- `broker-portal/` -- no broker-portal changes needed
- `admin-portal/` -- no admin-portal changes needed
- Existing migration files -- do not alter, create a new one

### If you need to modify a restricted file:

**STOP** and notify PM.

## Acceptance Criteria

- [ ] New migration file adds `validated` to status CHECK constraint on `impersonation_sessions`
- [ ] `admin_validate_impersonation_token` RPC updates status to `validated` after successful SELECT
- [ ] First call to validate token succeeds and returns session data
- [ ] Second call to validate the same token returns error/null (token already consumed)
- [ ] `admin_start_impersonation` still creates tokens with `active` status
- [ ] Migration applies cleanly on top of existing `20260307_impersonation_sessions.sql`
- [ ] All CI checks pass

## Implementation Notes

### Migration SQL

```sql
-- Add 'validated' to status enum/check constraint
ALTER TABLE public.impersonation_sessions
  DROP CONSTRAINT IF EXISTS impersonation_sessions_status_check;

ALTER TABLE public.impersonation_sessions
  ADD CONSTRAINT impersonation_sessions_status_check
  CHECK (status IN ('active', 'validated', 'ended', 'expired'));

-- Update the validate function to consume the token
CREATE OR REPLACE FUNCTION public.admin_validate_impersonation_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session record;
BEGIN
  -- Find active (unconsumed) session by token
  SELECT * INTO v_session
  FROM public.impersonation_sessions
  WHERE token = p_token
    AND status = 'active'
    AND expires_at > now();

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired token');
  END IF;

  -- Consume the token (single-use)
  UPDATE public.impersonation_sessions
  SET status = 'validated'
  WHERE id = v_session.id;

  -- Return session data
  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'admin_user_id', v_session.admin_user_id,
    'target_user_id', v_session.target_user_id,
    'target_email', v_session.target_email,
    'target_name', v_session.target_name,
    'expires_at', v_session.expires_at
  );
END;
$$;
```

### Key Details

- The existing `admin_validate_impersonation_token` does a read-only SELECT. This task adds an UPDATE to set `status = 'validated'` atomically.
- The WHERE clause `status = 'active'` ensures the UPDATE only succeeds on the first call.
- After validation, the cookie (signed by TASK-2131) carries the session forward. The token URL is dead.
- The function must check the EXISTING migration file (`20260307_impersonation_sessions.sql`) to understand the current schema. Use `CREATE OR REPLACE FUNCTION` to override the existing implementation.

## Integration Notes

- Imports from: None (pure SQL)
- Exports to: The broker-portal `route.ts` already calls this RPC -- no TypeScript changes needed
- Used by: TASK-2133 (DB validation) will check `status` in its validation queries
- Depends on: TASK-2131 (for cookie signing to be in place)

## Do / Don't

### Do:

- Read the existing migration file first to understand current schema
- Use `CREATE OR REPLACE FUNCTION` to override cleanly
- Test both the success case (first validation) and failure case (second validation attempt)
- Name the migration file with today's date prefix

### Don't:

- Do NOT modify the existing migration file (`20260307_impersonation_sessions.sql`)
- Do NOT change the `admin_start_impersonation` RPC (it should still create `active` tokens)
- Do NOT add a separate RPC -- modify the existing validate function

## When to Stop and Ask

- If the existing `admin_validate_impersonation_token` function signature differs from what is described in BACKLOG-892
- If there is already a `validated` status in the constraint
- If the function uses a different mechanism than described (e.g., not using a `token` column)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (SQL migration -- tested via Supabase)

### Integration / Feature Tests

- Required scenarios:
  - Token validates successfully on first use
  - Token returns error on second use
  - Expired token returns error on first use
  - End-to-end: impersonate flow still works (token -> cookie -> session)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check`)
- [ ] Lint / format checks (`npm run lint`)
- [ ] All existing tests pass (`npm test`)

## PR Preparation

- **Title**: `fix(security): make impersonation token single-use`
- **Labels**: `security`, `database`
- **Depends on**: TASK-2131

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~6K

**Token Cap:** 24K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 migration file | +3K |
| Files to modify | 0 | +0K |
| Code volume | ~40 lines SQL | +2K |
| Test complexity | None (SQL only) | +0K |

**Confidence:** High

**Risk factors:**
- Existing function signature may differ slightly from documented version
- Status constraint syntax may vary

**Similar past tasks:** SPRINT-116 impersonation schema task (~6K actual)

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
- [ ] supabase/migrations/YYYYMMDD_single_use_impersonation_token.sql

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~6K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <None or explanation>
**Design decisions:** <Decisions made>
**Issues encountered:** <Issues found>
**Reviewer notes:** <For reviewer>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~6K | ~XK | +/-X% |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:** <Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-118-security-hardening

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
