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

1. New: `supabase/migrations/YYYYMMDD_single_use_impersonation_token.sql` -- ALTER token column type (UUID->TEXT), add `session_expires_at` column, ALTER function + status constraint

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

- [ ] Migration ALTERs `token` column from UUID to TEXT with default `encode(gen_random_bytes(32), 'hex')::text`
- [ ] Migration adds `session_expires_at` column (timestamptz, NOT NULL) to `impersonation_sessions`
- [ ] `admin_start_impersonation` sets both `expires_at` (token expiry) and `session_expires_at = now() + interval '30 minutes'` (session expiry)
- [ ] `admin_validate_impersonation_token` returns `session_expires_at` in its response JSON
- [ ] New migration file adds `validated` to status CHECK constraint on `impersonation_sessions`
- [ ] `admin_validate_impersonation_token` RPC updates status to `validated` after successful SELECT
- [ ] First call to validate token succeeds and returns session data
- [ ] Second call to validate the same token returns error/null (token already consumed)
- [ ] `admin_start_impersonation` still creates tokens with `active` status
- [ ] Migration applies cleanly on top of existing `20260307_impersonation_sessions.sql`
- [ ] All CI checks pass

## Implementation Notes

### CRITICAL: Token Column Type Mismatch (SR Blocking Issue #1)

The existing migration (`20260307_impersonation_sessions.sql`) defines the `token` column as `UUID DEFAULT gen_random_uuid()`. However, the route handler validates 64-char hex tokens, and the `admin_start_impersonation` RPC was created with a `TEXT` parameter and generates hex tokens via `encode(gen_random_bytes(32), 'hex')`.

**You MUST include an ALTER COLUMN in this migration:**
- Change `token` from `UUID` to `TEXT`
- Change the default from `gen_random_uuid()` to `encode(gen_random_bytes(32), 'hex')::text`

### CRITICAL: Add session_expires_at Column (SR Blocking Issue #2)

TASK-2135 will shorten `expires_at` to 60 seconds (token-only expiry). TASK-2133 validates session expiry on every page load. If both use `expires_at`, all sessions would break after 60 seconds once TASK-2135 lands.

**Solution:** This migration MUST add a `session_expires_at` column to separate token expiry from session expiry:
- `expires_at` = token expiry (currently 30 min, TASK-2135 will shorten to 60s)
- `session_expires_at` = session expiry (always 30 minutes)

The `admin_start_impersonation` RPC must set `session_expires_at = now() + interval '30 minutes'` when creating a session.

### Migration SQL

```sql
-- 1. Fix token column type: UUID -> TEXT with hex default
ALTER TABLE public.impersonation_sessions
  ALTER COLUMN token TYPE text USING token::text;

ALTER TABLE public.impersonation_sessions
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex')::text;

-- 2. Add session_expires_at column (separate from token expires_at)
ALTER TABLE public.impersonation_sessions
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

-- Backfill existing rows: set session_expires_at = expires_at for any existing sessions
UPDATE public.impersonation_sessions
  SET session_expires_at = expires_at
  WHERE session_expires_at IS NULL;

-- Make session_expires_at NOT NULL going forward
ALTER TABLE public.impersonation_sessions
  ALTER COLUMN session_expires_at SET NOT NULL;

-- 3. Add 'validated' to status enum/check constraint
ALTER TABLE public.impersonation_sessions
  DROP CONSTRAINT IF EXISTS impersonation_sessions_status_check;

ALTER TABLE public.impersonation_sessions
  ADD CONSTRAINT impersonation_sessions_status_check
  CHECK (status IN ('active', 'validated', 'ended', 'expired'));

-- 4. Update admin_start_impersonation to set session_expires_at
CREATE OR REPLACE FUNCTION public.admin_start_impersonation(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_target_email text DEFAULT NULL,
  p_target_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_session_id uuid;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.impersonation_sessions (
    admin_user_id, target_user_id, target_email, target_name,
    token, status, expires_at, session_expires_at
  )
  VALUES (
    p_admin_user_id, p_target_user_id, p_target_email, p_target_name,
    v_token, 'active',
    now() + interval '30 minutes',       -- token expiry (TASK-2135 will shorten to 60s)
    now() + interval '30 minutes'        -- session expiry (always 30 min)
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'token', v_token,
    'expires_at', (now() + interval '30 minutes')::text,
    'session_expires_at', (now() + interval '30 minutes')::text
  );
END;
$$;

-- 5. Update the validate function to consume the token (single-use)
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

  -- Return session data (include session_expires_at for cookie creation)
  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'admin_user_id', v_session.admin_user_id,
    'target_user_id', v_session.target_user_id,
    'target_email', v_session.target_email,
    'target_name', v_session.target_name,
    'expires_at', v_session.expires_at,
    'session_expires_at', v_session.session_expires_at
  );
END;
$$;
```

### Key Details

- The existing `admin_validate_impersonation_token` does a read-only SELECT. This task adds an UPDATE to set `status = 'validated'` atomically.
- The WHERE clause `status = 'active'` ensures the UPDATE only succeeds on the first call.
- After validation, the cookie (signed by TASK-2131) carries the session forward. The token URL is dead.
- The function must check the EXISTING migration file (`20260307_impersonation_sessions.sql`) to understand the current schema. Use `CREATE OR REPLACE FUNCTION` to override the existing implementation.
- The `session_expires_at` column is set to 30 minutes at session creation and never changes. This is what TASK-2133 will validate against on each page load.
- The `expires_at` column is for token expiry only. TASK-2135 will shorten this to 60 seconds.
- The token column ALTER from UUID to TEXT is safe because the RPC already generates hex tokens via `encode(gen_random_bytes(32), 'hex')` -- the column type just needs to match.

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
- Do NOT add a separate RPC -- modify the existing functions via CREATE OR REPLACE
- Do NOT change the token generation logic (still `encode(gen_random_bytes(32), 'hex')`)

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

Migration includes:
- [ ] ALTER token column from UUID to TEXT
- [ ] ADD session_expires_at column (timestamptz, NOT NULL)
- [ ] ADD 'validated' to status CHECK constraint
- [ ] CREATE OR REPLACE admin_start_impersonation (sets session_expires_at)
- [ ] CREATE OR REPLACE admin_validate_impersonation_token (returns session_expires_at, single-use)

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
