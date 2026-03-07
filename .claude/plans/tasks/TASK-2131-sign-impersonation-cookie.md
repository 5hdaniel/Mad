# TASK-2131: Sign Impersonation Cookie (HMAC-SHA256)

**Backlog ID:** BACKLOG-891
**Sprint:** SPRINT-118
**Phase:** Phase 1 - Cookie Security (Sequential, first)
**Depends On:** None (first task in sprint)
**Branch:** `fix/task-2131-sign-impersonation-cookie`
**Branch From:** `int/sprint-116-impersonation`
**Branch Into:** `int/sprint-118-security-hardening`
**Estimated Tokens:** ~8K (security category x 0.4)

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

Sign the impersonation session cookie using HMAC-SHA256 with a server-side secret so that cookie contents cannot be tampered with. Reject any cookie with an invalid or missing signature.

## Non-Goals

- Do NOT encrypt the cookie (signing is sufficient -- contents are not secret, just integrity-protected)
- Do NOT change the session data stored in the cookie (same fields: admin_user_id, target_user_id, session_id, target_email, target_name, expires_at)
- Do NOT add DB validation to cookie parsing (that is TASK-2133)
- Do NOT change the token validation RPC (that is TASK-2132)

## Deliverables

1. Update: `broker-portal/app/auth/impersonate/route.ts` -- sign cookie on creation
2. Update: `broker-portal/lib/impersonation.ts` -- verify signature on cookie parsing
3. Update: `broker-portal/lib/impersonation-guards.ts` -- ensure getDataClient() uses verified session
4. New: `broker-portal/lib/cookie-signing.ts` -- HMAC sign/verify utility
5. Update: `.env.example` / `.env.local.example` -- add `IMPERSONATION_COOKIE_SECRET` env var

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/app/auth/impersonate/route.ts` -- cookie creation only (do not add rate limiting)
- `broker-portal/lib/impersonation.ts` -- cookie parsing/verification
- `broker-portal/lib/impersonation-guards.ts` -- use verified session in getDataClient()
- `broker-portal/lib/cookie-signing.ts` (new)
- `.env.example` or `.env.local.example`

### Files this task must NOT modify:

- `broker-portal/middleware.ts` -- owned by TASK-2133
- `broker-portal/app/api/impersonation/end/route.ts` -- owned by TASK-2137
- `broker-portal/app/dashboard/layout.tsx` -- owned by TASK-2138
- `supabase/migrations/` -- owned by TASK-2132, TASK-2134, TASK-2135

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] New `IMPERSONATION_COOKIE_SECRET` env var documented in `.env.example`
- [ ] Cookie creation in `route.ts` produces `value.signature` format
- [ ] `getImpersonationSession()` returns null for unsigned cookies
- [ ] `getImpersonationSession()` returns null for cookies with invalid signature
- [ ] `getImpersonationSession()` returns null for cookies with tampered payload
- [ ] `getImpersonationSession()` returns valid session for correctly signed cookies
- [ ] If `IMPERSONATION_COOKIE_SECRET` is not set, impersonation is disabled (fail closed)
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Cookie Signing Utility

```typescript
// broker-portal/lib/cookie-signing.ts
import crypto from 'crypto';

const COOKIE_SECRET = process.env.IMPERSONATION_COOKIE_SECRET;

export function signCookieValue(payload: string): string {
  if (!COOKIE_SECRET) throw new Error('IMPERSONATION_COOKIE_SECRET not configured');
  const signature = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

export function verifyCookieValue(signedValue: string): string | null {
  if (!COOKIE_SECRET) return null; // fail closed
  const lastDot = signedValue.lastIndexOf('.');
  if (lastDot === -1) return null;

  const payload = signedValue.substring(0, lastDot);
  const signature = signedValue.substring(lastDot + 1);

  const expected = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  return payload;
}
```

### Cookie Creation (route.ts)

In the impersonate route handler, after validating the token:

```typescript
import { signCookieValue } from '@/lib/cookie-signing';

// Existing: create cookie payload JSON
const cookiePayload = JSON.stringify({
  admin_user_id: session.admin_user_id,
  target_user_id: session.target_user_id,
  session_id: session.id,
  target_email: session.target_email,
  target_name: session.target_name,
  expires_at: session.expires_at,
});

// NEW: sign it
const signedValue = signCookieValue(cookiePayload);

// Set the signed cookie
cookies().set('impersonation_session', signedValue, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 60, // 30 minutes
});
```

### Cookie Parsing (impersonation.ts)

In `getImpersonationSession()`:

```typescript
import { verifyCookieValue } from './cookie-signing';

export function getImpersonationSession(): ImpersonationSession | null {
  const cookie = cookies().get('impersonation_session');
  if (!cookie?.value) return null;

  // Verify signature
  const payload = verifyCookieValue(cookie.value);
  if (!payload) return null; // unsigned, tampered, or missing secret

  try {
    const session = JSON.parse(payload);
    // Existing expiry check...
    if (new Date(session.expires_at) < new Date()) return null;
    return session;
  } catch {
    return null;
  }
}
```

### Key Details

- Use `crypto.timingSafeEqual()` for signature comparison to prevent timing attacks
- The secret should be at least 32 characters (256 bits). Document this in the env var example
- Use `.lastIndexOf('.')` to split, since the base64/JSON payload may contain dots
- Fail closed: if `IMPERSONATION_COOKIE_SECRET` is not set, `verifyCookieValue()` returns null

## Integration Notes

- Imports from: Node.js `crypto` module (built-in)
- Exports to: `impersonation.ts`, `route.ts`
- Used by: Every downstream task depends on this signed cookie format
- Depends on: None (first task)

## Do / Don't

### Do:

- Use `crypto.timingSafeEqual()` for constant-time comparison
- Fail closed (reject cookie if secret is missing)
- Keep the cookie value human-readable before the signature (aids debugging)
- Test with both valid and tampered cookies

### Don't:

- Do NOT use `===` for signature comparison (timing attack vulnerability)
- Do NOT use a weak secret or hardcode a default
- Do NOT encrypt -- just sign (encryption adds complexity with no security benefit here since the cookie values are not sensitive secrets)
- Do NOT base64-encode the payload (JSON string is fine -- the signature ensures integrity)

## When to Stop and Ask

- If `getImpersonationSession()` has been significantly refactored since Sprint 116 and the code does not match the backlog description
- If the cookie is already signed (unlikely but check)
- If there are other consumers of the impersonation cookie besides `impersonation.ts`

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `cookie-signing.test.ts`: signCookieValue() produces deterministic output, verifyCookieValue() returns payload for valid signature, returns null for tampered payload, returns null for tampered signature, returns null if secret missing
- Existing tests to update:
  - Any existing impersonation tests that set mock cookies -- must now use signed format

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Impersonate flow end-to-end still works with signed cookie
  - Manually crafted unsigned cookie is rejected

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): sign impersonation cookie with HMAC-SHA256`
- **Labels**: `security`, `broker-portal`
- **Depends on**: None (first task in sprint)

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new file (cookie-signing.ts) | +2K |
| Files to modify | 3 files (route.ts, impersonation.ts, impersonation-guards.ts) | +4K |
| Code volume | ~80 lines new, ~20 lines modified | +2K |
| Test complexity | Low -- utility function tests | +2K |

**Confidence:** High

**Risk factors:**
- Cookie format may need adjustment if payload contains characters that conflict with dot separator
- May need to handle migration from unsigned to signed cookies gracefully

**Similar past tasks:** SPRINT-039 security hardening tasks (actual: ~5-8K tokens)

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
- [ ] broker-portal/lib/cookie-signing.ts
- [ ] broker-portal/lib/__tests__/cookie-signing.test.ts

Files modified:
- [ ] broker-portal/app/auth/impersonate/route.ts
- [ ] broker-portal/lib/impersonation.ts
- [ ] broker-portal/lib/impersonation-guards.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~8K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<Explanation>

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
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-118-security-hardening

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
