# TASK-2122: Impersonation Schema & RPCs

**Backlog ID:** BACKLOG-838, BACKLOG-866
**Sprint:** SPRINT-116
**Phase:** Phase 1 - Schema Foundation (Sequential)
**Depends On:** None (foundational)
**Branch:** `feature/task-2122-impersonation-schema`
**Branch From:** `int/sprint-116-impersonation`
**Branch Into:** `int/sprint-116-impersonation`
**Estimated Tokens:** ~25K (schema category x 1.3 = ~33K adjusted)

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Create the `impersonation_sessions` table and Supabase RPCs (`admin_start_impersonation`, `admin_end_impersonation`) that enable time-limited (30 min), audit-logged impersonation sessions for admin support staff.

## Non-Goals

- Do NOT build any UI (admin portal or broker portal) -- that is Phase 2
- Do NOT modify any existing tables (users, organizations, etc.)
- Do NOT add RLS policies for broker portal data access yet -- the RPCs handle authorization
- Do NOT add read-only enforcement at the schema level -- that is handled at the application layer
- Do NOT create the `users.impersonate` permission row -- it already exists in `admin_permissions`

## Deliverables

1. New file: `supabase/migrations/20260307_impersonation_sessions.sql`
2. No other files -- this is a pure database migration

## File Boundaries

N/A -- sequential execution. This is the foundational task; all other Sprint 116 tasks depend on it.

## Acceptance Criteria

- [ ] `impersonation_sessions` table exists with columns listed below
- [ ] `admin_start_impersonation` RPC creates a session with 30-minute expiry
- [ ] `admin_start_impersonation` RPC verifies caller has `users.impersonate` permission
- [ ] `admin_start_impersonation` RPC logs to `admin_audit_logs` with action `user.impersonate.start`
- [ ] `admin_start_impersonation` RPC returns a session token (UUID) and expiry timestamp
- [ ] `admin_start_impersonation` RPC invalidates any existing active session for the same admin
- [ ] `admin_end_impersonation` RPC marks the session as ended
- [ ] `admin_end_impersonation` RPC logs to `admin_audit_logs` with action `user.impersonate.end`
- [ ] RLS on `impersonation_sessions` restricts access to the admin who created the session
- [ ] Migration applies cleanly via `supabase db push` or `supabase migration up`
- [ ] All CI checks pass

## Implementation Notes

### Table: `impersonation_sessions`

```sql
CREATE TABLE public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for token lookups (broker portal will look up by token)
CREATE INDEX idx_impersonation_sessions_token ON public.impersonation_sessions(token) WHERE status = 'active';

-- Index for admin user lookups
CREATE INDEX idx_impersonation_sessions_admin ON public.impersonation_sessions(admin_user_id) WHERE status = 'active';
```

### RPC: `admin_start_impersonation`

```sql
CREATE OR REPLACE FUNCTION public.admin_start_impersonation(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_session_id UUID;
  v_token UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get calling user
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Verify users.impersonate permission
  SELECT public.has_permission(v_admin_id, 'users.impersonate') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Prevent self-impersonation
  IF v_admin_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_impersonate_self');
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- End any existing active sessions for this admin
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE admin_user_id = v_admin_id AND status = 'active';

  -- Create new session (30 min TTL)
  v_expires_at := now() + interval '30 minutes';

  INSERT INTO public.impersonation_sessions (admin_user_id, target_user_id, expires_at)
  VALUES (v_admin_id, p_target_user_id, v_expires_at)
  RETURNING id, token INTO v_session_id, v_token;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'user.impersonate.start',
    'user',
    p_target_user_id::text,
    jsonb_build_object(
      'session_id', v_session_id,
      'target_user_id', p_target_user_id,
      'expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'token', v_token,
    'expires_at', v_expires_at,
    'target_user_id', p_target_user_id
  );
END;
$$;
```

### RPC: `admin_end_impersonation`

```sql
CREATE OR REPLACE FUNCTION public.admin_end_impersonation(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_session RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Find the session (must belong to this admin)
  SELECT * INTO v_session
  FROM public.impersonation_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  -- End the session
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE id = p_session_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'user.impersonate.end',
    'user',
    v_session.target_user_id::text,
    jsonb_build_object(
      'session_id', p_session_id,
      'target_user_id', v_session.target_user_id,
      'duration_seconds', EXTRACT(EPOCH FROM (now() - v_session.started_at))::int
    )
  );

  RETURN jsonb_build_object('success', true, 'session_id', p_session_id);
END;
$$;
```

### RPC: `admin_validate_impersonation_token`

This RPC is called by the broker portal to validate an impersonation token and get the target user details:

```sql
CREATE OR REPLACE FUNCTION public.admin_validate_impersonation_token(
  p_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find active, non-expired session by token
  SELECT s.*, u.email as target_email, u.raw_user_meta_data->>'full_name' as target_name
  INTO v_session
  FROM public.impersonation_sessions s
  JOIN auth.users u ON u.id = s.target_user_id
  WHERE s.token = p_token
    AND s.status = 'active'
    AND s.expires_at > now();

  IF NOT FOUND THEN
    -- Check if token exists but is expired
    IF EXISTS (SELECT 1 FROM public.impersonation_sessions WHERE token = p_token AND status = 'active' AND expires_at <= now()) THEN
      -- Auto-expire it
      UPDATE public.impersonation_sessions SET status = 'expired' WHERE token = p_token AND status = 'active';
      RETURN jsonb_build_object('valid', false, 'error', 'session_expired');
    END IF;
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'session_id', v_session.id,
    'admin_user_id', v_session.admin_user_id,
    'target_user_id', v_session.target_user_id,
    'target_email', v_session.target_email,
    'target_name', v_session.target_name,
    'expires_at', v_session.expires_at,
    'started_at', v_session.started_at
  );
END;
$$;
```

### RLS Policies

```sql
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Admin can read their own sessions
CREATE POLICY impersonation_sessions_admin_read ON public.impersonation_sessions
  FOR SELECT USING (admin_user_id = auth.uid());

-- No direct insert/update/delete -- all through RPCs (SECURITY DEFINER)
```

### Grants

```sql
GRANT EXECUTE ON FUNCTION public.admin_start_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_end_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_impersonation_token(UUID) TO authenticated;
```

### Important Details

- The `has_permission` function already exists (from SPRINT-113 RBAC). Just call it.
- The `admin_audit_logs` table already exists (from SPRINT-112). The RPCs insert directly into it.
- The `users.impersonate` permission key already exists in `admin-portal/lib/permissions.ts`. Verify it exists in the `admin_permissions` table. If not, add an INSERT in the migration.
- Token is a UUID (not a JWT) for simplicity. It's looked up server-side, not decoded client-side.
- Use `SECURITY DEFINER` so the RPCs can access `auth.users` and `admin_audit_logs` regardless of RLS.

## Integration Notes

- **Exports to:** TASK-2123 (admin portal uses `admin_start_impersonation` RPC)
- **Exports to:** TASK-2124 (broker portal uses `admin_validate_impersonation_token` RPC)
- **Uses:** `has_permission` function (existing), `admin_audit_logs` table (existing)
- This is the foundational task -- Phase 2 tasks cannot start until this is merged.

## Do / Don't

### Do:
- Use `SECURITY DEFINER` for all RPCs so they can bypass RLS
- Include proper error handling with descriptive error codes
- Add indexes for the most common query patterns (token lookup, admin lookup)
- Auto-expire sessions that have passed their `expires_at`
- Use `gen_random_uuid()` for tokens (Supabase has this built-in)

### Don't:
- Do NOT use JWTs for tokens -- use plain UUIDs looked up server-side
- Do NOT add columns to existing tables (users, organizations, etc.)
- Do NOT create any edge functions -- all logic is in RPCs
- Do NOT skip the permission check in `admin_start_impersonation`
- Do NOT allow a user to impersonate themselves

## When to Stop and Ask

- If `admin_audit_logs` table does not exist or has a different schema than expected
- If `has_permission` function does not exist
- If the `users.impersonate` permission key is not in the `admin_permissions` table
- If you encounter any RLS issues that prevent the RPCs from working
- If the migration file naming conflicts with an existing migration

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (pure SQL migration -- tested via manual verification)
- The RPCs will be integration-tested in Phase 3

### Coverage

- Coverage impact: N/A (SQL migration, not TypeScript)

### Integration / Feature Tests

- Verify migration applies cleanly
- Verify `admin_start_impersonation` returns token and session_id
- Verify `admin_end_impersonation` marks session ended
- Verify `admin_validate_impersonation_token` returns user data for valid token
- Verify expired tokens return error
- Verify permission check prevents unauthorized users
- These are manual SQL tests; formal integration tests are in TASK-2125

### CI Requirements

This task's PR MUST pass:
- [ ] Migration applies without errors
- [ ] No syntax errors in SQL
- [ ] All existing CI checks pass

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(schema): add impersonation_sessions table and RPCs`
- **Labels**: `schema`, `sprint-116`
- **Depends on**: None (first task in sprint)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~25K-33K

**Token Cap:** 132K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 migration file | +5K |
| SQL complexity | 3 RPCs + table + RLS + indexes | +15K |
| Verification | Manual SQL testing | +5K |
| Schema multiplier | x 1.3 | Applied |

**Confidence:** High

**Risk factors:**
- `admin_audit_logs` schema might differ from expectations
- `has_permission` function signature might need verification

**Similar past tasks:** TASK-2114 (admin audit log schema, actual: ~15K tokens)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] supabase/migrations/20260307_impersonation_sessions.sql

Features implemented:
- [ ] impersonation_sessions table
- [ ] admin_start_impersonation RPC
- [ ] admin_end_impersonation RPC
- [ ] admin_validate_impersonation_token RPC
- [ ] RLS policies
- [ ] Indexes

Verification:
- [ ] Migration applies cleanly
- [ ] npm run type-check passes (no TS changes, but verify)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~33K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~33K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-116-impersonation

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
