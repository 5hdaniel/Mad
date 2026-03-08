# TASK-2133: Validate Impersonation Session Against DB on Each Page Load

**Backlog ID:** BACKLOG-893
**Sprint:** SPRINT-118
**Phase:** Phase 2 - DB Validation + Scoped RLS (Sequential, first)
**Depends On:** TASK-2132 (single-use token status flow must be in place)
**Branch:** `fix/task-2133-db-session-validation`
**Branch From:** `int/sprint-118-security-hardening`
**Branch Into:** `int/sprint-118-security-hardening`
**Estimated Tokens:** ~8K (security category x 0.4)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-2131 for full workflow reference.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add server-side validation of the impersonation session against the database on each page load. Instead of trusting the cookie's self-reported expiry and `target_user_id`, verify the session is still active and not ended/expired in the database.

**IMPORTANT (SR Review -- Blocking Issue):** Validate against `session_expires_at` (NOT `expires_at`). TASK-2132 added a separate `session_expires_at` column (30-minute session expiry) to avoid conflict with `expires_at` (which TASK-2135 will shorten to 60 seconds for token-only expiry). If you validate against `expires_at`, all sessions would break after 60 seconds once TASK-2135 lands.

## Non-Goals

- Do NOT replace the service-role client with scoped RLS (that is TASK-2134)
- Do NOT change the cookie signing mechanism (that is TASK-2131)
- Do NOT change the token validation flow (that is TASK-2132)
- Do NOT add rate limiting (that is TASK-2136)

## Deliverables

1. Update: `broker-portal/lib/impersonation.ts` -- add DB validation to `getImpersonationSession()` (PRIMARY approach -- page-level Node.js check)
2. Update: `broker-portal/lib/impersonation-guards.ts` -- `getDataClient()` uses validated session
3. Update: `broker-portal/middleware.ts` -- lightweight cookie-exists check only (NOT full DB validation)

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/lib/impersonation.ts` -- DB validation in session parsing
- `broker-portal/lib/impersonation-guards.ts` -- ensure getDataClient uses validated session
- `broker-portal/middleware.ts` -- DB-backed expiry check

### Files this task must NOT modify:

- `broker-portal/app/auth/impersonate/route.ts` -- owned by TASK-2131 (already merged)
- `broker-portal/lib/cookie-signing.ts` -- owned by TASK-2131
- `broker-portal/app/dashboard/layout.tsx` -- owned by TASK-2138
- `supabase/migrations/` -- no new migration needed

### If you need to modify a restricted file:

**STOP** and notify PM.

## Acceptance Criteria

- [ ] `getImpersonationSession()` queries DB to verify session is still active before returning session data
- [ ] If session status is `ended` or `expired` in DB, returns null and clears the cookie
- [ ] If `target_user_id` in cookie does not match DB record, returns null (tamper detection, defense-in-depth alongside TASK-2131 signature)
- [ ] DB query checks `status IN ('active', 'validated')` AND `session_expires_at > now()` (NOT `expires_at`)
- [ ] Middleware is a lightweight cookie-exists check only (no DB call); page-level `getImpersonationSession()` is the authoritative check
- [ ] Cookie clearing happens automatically when DB says session is invalid
- [ ] All CI checks pass

## Implementation Notes

### Architecture: Page-Level DB Check is PRIMARY (SR Review)

The page-level `getImpersonationSession()` is the **authoritative** security check. Middleware is a **lightweight cookie-exists check only**.

**Why:** Next.js middleware runs in Edge Runtime, which has limited Supabase client support. The page-level function runs in Node.js server components where full DB access is available. Making middleware the primary check would be fragile.

**Two-layer approach:**
1. **Middleware** (Edge Runtime): Lightweight cookie-exists check. If cookie is missing/expired (client-side timestamp check only), redirect to login. No DB call.
2. **`getImpersonationSession()`** (Node.js): Full DB validation. This is the authoritative check. Queries `impersonation_sessions` table, verifies status and `session_expires_at`.

### DB Validation in getImpersonationSession()

```typescript
import { createServiceClient } from './supabase/server';

export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookie = cookies().get('impersonation_session');
  if (!cookie?.value) return null;

  // Step 1: Verify signature (from TASK-2131)
  const payload = verifyCookieValue(cookie.value);
  if (!payload) return null;

  const session = JSON.parse(payload);

  // Step 2: Validate against DB using session_expires_at (NOT expires_at)
  // expires_at is for token expiry only (will become 60s in TASK-2135)
  // session_expires_at is for session expiry (30 minutes, set by TASK-2132)
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('impersonation_sessions')
    .select('status, session_expires_at, target_user_id')
    .eq('id', session.session_id)
    .in('status', ['active', 'validated'])
    .gt('session_expires_at', new Date().toISOString())
    .single();

  if (!data || data.target_user_id !== session.target_user_id) {
    // Session ended, expired, or tampered -- clear the cookie
    cookies().delete('impersonation_session');
    return null;
  }

  return session;
}
```

### Note on async conversion

`getImpersonationSession()` is currently synchronous (cookie-only check). This task makes it `async` because it needs to query the database. All callers must be updated to `await` the result:
- `getDataClient()` in `impersonation-guards.ts`
- Middleware should NOT call this async function -- keep middleware as a lightweight cookie-exists check

Check all call sites and ensure they handle the async conversion.

### Middleware Update

The middleware should be a **lightweight cookie-exists check only**:
- Check if `impersonation_session` cookie exists
- Optionally verify the signature (if `crypto` is available in Edge Runtime)
- Do NOT query the database from middleware
- Redirect to admin portal if cookie is missing for impersonation-guarded routes

The authoritative DB validation happens in `getImpersonationSession()` at the page level.

### Key Details

- The `validated` status (from TASK-2132) is a valid active state -- include it in the status check
- Use `createServiceClient()` for the DB check (we need to read impersonation_sessions which is admin-only)
- This adds one DB query per page load during impersonation (~5ms). This is acceptable for the 30-minute session duration.
- **Use `session_expires_at` NOT `expires_at`** for the expiry check. `expires_at` is token expiry (will become 60s in TASK-2135). `session_expires_at` is session expiry (30 minutes, set by TASK-2132).

## Integration Notes

- Imports from: `lib/cookie-signing.ts` (TASK-2131), `lib/supabase/server.ts`
- Exports to: `impersonation-guards.ts` getDataClient()
- Used by: TASK-2134 (builds on this DB validation path)
- Depends on: TASK-2132 (needs `validated` status to exist)

## Do / Don't

### Do:

- Convert `getImpersonationSession()` to async
- Update ALL callers to await the result
- Clear the cookie when DB says session is invalid
- Keep middleware as a lightweight cookie-exists check (no DB call)
- Use `session_expires_at` (not `expires_at`) for the DB expiry check

### Don't:

- Do NOT cache the DB result across requests (each page load should verify)
- Do NOT add a new RPC for this -- use direct table query
- Do NOT make middleware the primary validation layer -- page-level is primary
- Do NOT use `expires_at` for session validation -- that is token expiry only

## When to Stop and Ask

- If `getImpersonationSession()` has more than 3 callers (scope may be larger than expected)
- If middleware cannot use Supabase client in Edge Runtime and this impacts the security model significantly
- If the `impersonation_sessions` table schema differs from what BACKLOG-893 describes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `getImpersonationSession()` returns null when DB session is ended
  - `getImpersonationSession()` returns null when DB session is expired
  - `getImpersonationSession()` returns null when target_user_id mismatch
  - `getImpersonationSession()` returns session when DB session is active
  - `getImpersonationSession()` clears cookie when session is invalid

### CI Requirements

- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `fix(security): validate impersonation session against DB on each page load`
- **Labels**: `security`, `broker-portal`
- **Depends on**: TASK-2132

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 3 files (impersonation.ts, impersonation-guards.ts, middleware.ts) | +5K |
| Code volume | ~40 lines modified | +2K |
| Test complexity | Medium -- async mocking | +3K |

**Confidence:** Medium

**Risk factors:**
- Async conversion may have more callers than expected
- Edge Runtime limitation in middleware

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] broker-portal/lib/impersonation.ts
- [ ] broker-portal/lib/impersonation-guards.ts
- [ ] broker-portal/middleware.ts

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

**Variance:** PM Est ~8K vs Actual ~XK

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <None or explanation>
**Design decisions:** <Decisions made>
**Issues encountered:** <Issues found>
**Reviewer notes:** <For reviewer>

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

### Merge Information

**PR Number:** #XXX
**Merged To:** int/sprint-118-security-hardening

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
