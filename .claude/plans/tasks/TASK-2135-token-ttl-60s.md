# TASK-2135: Shorten Impersonation Token TTL to 60 Seconds

**Backlog ID:** BACKLOG-895
**Sprint:** SPRINT-118
**Phase:** Phase 3 - TTL + UI + Stretch (Sequential, first in pair with TASK-2138 parallel)
**Depends On:** TASK-2134 (scoped RLS migration must be landed first for migration ordering)
**Branch:** `fix/task-2135-token-ttl-60s`
**Branch From:** `int/sprint-118-security-hardening`
**Branch Into:** `int/sprint-118-security-hardening`
**Estimated Tokens:** ~4K (security category x 0.4)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-2131 for full workflow reference.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Shorten the impersonation token's `expires_at` from 30 minutes to 60 seconds. The token only needs to survive the redirect from admin portal to broker portal. The session (cookie) still lasts 30 minutes.

## Non-Goals

- Do NOT change the session/cookie duration (still 30 minutes)
- Do NOT change the token validation logic (TASK-2132)
- Do NOT change cookie signing (TASK-2131)
- Do NOT add a separate `token_expires_at` column unless required

## Deliverables

1. New: `supabase/migrations/YYYYMMDD_token_ttl_60s.sql` -- update `admin_start_impersonation` RPC

## File Boundaries

### Files to modify (owned by this task):

- `supabase/migrations/` -- new migration file

### Files this task must NOT modify:

- `broker-portal/` -- no broker-portal changes needed
- `admin-portal/` -- no admin-portal changes needed
- Existing migration files

## Acceptance Criteria

- [ ] `admin_start_impersonation` RPC creates tokens with `expires_at = now() + interval '60 seconds'`
- [ ] Session duration remains 30 minutes (cookie `maxAge` unchanged)
- [ ] Token created > 60 seconds ago is rejected by `admin_validate_impersonation_token`
- [ ] Token created < 60 seconds ago works normally
- [ ] Migration applies cleanly
- [ ] All CI checks pass

## Implementation Notes

### Migration SQL

```sql
-- Update admin_start_impersonation to use 60-second token TTL
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
  -- Generate secure random token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create session with SHORT token expiry (60 seconds)
  -- but the session itself lasts 30 minutes (tracked by cookie)
  INSERT INTO public.impersonation_sessions (
    admin_user_id, target_user_id, target_email, target_name,
    token, status, expires_at
  )
  VALUES (
    p_admin_user_id, p_target_user_id, p_target_email, p_target_name,
    v_token, 'active',
    now() + interval '60 seconds'  -- Changed from 30 minutes
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'token', v_token,
    'expires_at', (now() + interval '60 seconds')::text
  );
END;
$$;
```

### Key Details

- The `expires_at` column currently serves double duty: token expiry AND session expiry. After this change, it only controls token expiry (the 60-second redirect window).
- The session duration is controlled by the cookie's `maxAge` (30 minutes), set in `route.ts` (TASK-2131).
- If the existing schema uses `expires_at` for both purposes, you may need to add a `session_expires_at` column. Check the existing migration and the DB validation query from TASK-2133 to see if `expires_at` is used for session validation.
- **IMPORTANT:** If TASK-2133 checks `expires_at > now()` for session validation on page loads, changing the token TTL to 60 seconds would cause all sessions to expire after 60 seconds. In that case, add a separate `session_expires_at` column set to 30 minutes.

### If Separate Columns Are Needed

```sql
ALTER TABLE public.impersonation_sessions
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

-- Update start RPC to set both
-- token expires_at: 60 seconds
-- session_expires_at: 30 minutes

-- Update validate RPC to check token expires_at
-- Update TASK-2133's DB validation to check session_expires_at instead
```

If you need a separate column, update `broker-portal/lib/impersonation.ts` to check `session_expires_at` instead of `expires_at` for the DB validation query. This is the ONLY broker-portal file change allowed.

## Integration Notes

- Imports from: None (pure SQL)
- Exports to: The shorter token TTL reduces replay window
- Used by: TASK-2136 (rate limiting, runs after this)
- Depends on: TASK-2134 (migration ordering)

## Do / Don't

### Do:

- Read the existing `admin_start_impersonation` function carefully before modifying
- Check whether `expires_at` is used for session validation (TASK-2133 code)
- Add a `session_expires_at` column if needed to separate token TTL from session TTL

### Don't:

- Do NOT change the cookie's `maxAge` (still 30 minutes)
- Do NOT modify `admin_validate_impersonation_token` (it already checks `expires_at > now()`)
- Do NOT modify existing migration files

## When to Stop and Ask

- If `expires_at` is used for session validation (TASK-2133) and cannot be separated from token TTL cleanly
- If the existing function signature differs significantly from what is shown here

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (SQL migration)

### Integration / Feature Tests

- Required scenarios:
  - Token used within 60 seconds works
  - Token used after 60 seconds fails
  - Session remains valid for 30 minutes after successful token validation

### CI Requirements

- [ ] Type checking
- [ ] Lint
- [ ] All existing tests pass

## PR Preparation

- **Title**: `fix(security): shorten impersonation token TTL to 60 seconds`
- **Labels**: `security`, `database`
- **Depends on**: TASK-2134

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~4K

**Token Cap:** 16K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 migration | +2K |
| Files to modify | 0-1 (possibly impersonation.ts if separate column needed) | +1K |
| Code volume | ~30 lines SQL | +1K |
| Test complexity | None | +0K |

**Confidence:** High

**Risk factors:**
- May need separate token/session expiry columns (increases scope slightly)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] supabase/migrations/YYYYMMDD_token_ttl_60s.sql

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~4K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL

### Merge Information

**PR Number:** #XXX
**Merged To:** int/sprint-118-security-hardening

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified
- [ ] Task can now be marked complete
