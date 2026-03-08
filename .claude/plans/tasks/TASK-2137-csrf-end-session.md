# TASK-2137: Add CSRF Protection to Impersonation End-Session Route

**Backlog ID:** BACKLOG-897
**Sprint:** SPRINT-118
**Phase:** Phase 3 - TTL + UI + Stretch (Parallel with TASK-2136, stretch goal)
**Depends On:** TASK-2134 (core security work must be done; parallel with TASK-2136)
**Branch:** `feature/task-2137-csrf-end-session`
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

Add CSRF defense-in-depth to `POST /api/impersonation/end` by verifying the `Origin` or `Referer` header matches the app domain. Currently mitigated by `sameSite: 'strict'` on the cookie, but vulnerable if that policy is ever relaxed.

## Non-Goals

- Do NOT add full CSRF token infrastructure (overkill for this single endpoint)
- Do NOT change the SameSite cookie policy
- Do NOT modify any other API routes
- Do NOT change the session ending logic

## Deliverables

1. Update: `broker-portal/app/api/impersonation/end/route.ts` -- add Origin/Referer validation

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/app/api/impersonation/end/route.ts` -- ONLY this file

### Files this task must NOT modify:

- `broker-portal/lib/impersonation.ts`
- `broker-portal/lib/impersonation-guards.ts`
- `broker-portal/middleware.ts`
- `broker-portal/app/auth/impersonate/route.ts`
- Any other files

## Acceptance Criteria

- [ ] POST from same origin succeeds (normal end-session flow works)
- [ ] POST with missing Origin AND missing Referer is rejected with 403
- [ ] POST with Origin from different domain is rejected with 403
- [ ] POST with Referer from different domain is rejected with 403
- [ ] All CI checks pass

## Implementation Notes

### Origin/Referer Validation

```typescript
import { headers } from 'next/headers';

function validateCsrf(): boolean {
  const headersList = headers();
  const origin = headersList.get('origin');
  const referer = headersList.get('referer');

  // Get the expected origin from env or construct from host
  const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL
    || `https://${headersList.get('host')}`;

  if (origin) {
    return origin === expectedOrigin || origin === new URL(expectedOrigin).origin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === new URL(expectedOrigin).origin;
    } catch {
      return false;
    }
  }

  // Neither header present -- reject
  return false;
}

export async function POST(request: Request) {
  if (!validateCsrf()) {
    return new Response('Forbidden', { status: 403 });
  }

  // ... existing end-session logic
}
```

### Key Details

- This is defense-in-depth. The primary protection is `sameSite: 'strict'` on the cookie.
- Check `Origin` first (more reliable), fall back to `Referer`.
- Use `NEXT_PUBLIC_SITE_URL` env var for expected origin (already used elsewhere in the broker portal).

## Integration Notes

- Imports from: `next/headers`
- Exports to: None
- Used by: Only the end-session route
- Depends on: TASK-2134 (for merge ordering, no code dependency)

## Do / Don't

### Do:

- Use `Origin` header as primary check
- Fall back to `Referer` header
- Reject if neither header is present

### Don't:

- Do NOT implement full CSRF token middleware
- Do NOT modify any other route

## When to Stop and Ask

- If the end-session route has been moved or renamed since Sprint 116

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests:
  - POST with matching Origin succeeds
  - POST with non-matching Origin returns 403
  - POST with no Origin but matching Referer succeeds
  - POST with no Origin and no Referer returns 403

### CI Requirements

- [ ] Unit tests
- [ ] Type checking
- [ ] Lint

## PR Preparation

- **Title**: `feat(security): add CSRF protection to impersonation end-session route`
- **Labels**: `security`, `broker-portal`
- **Depends on**: TASK-2134

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~4K

**Token Cap:** 16K (4x upper estimate)

**Confidence:** High

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
- [ ] broker-portal/app/api/impersonation/end/route.ts

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

### Merge Information

**PR Number:** #XXX
**Merged To:** int/sprint-118-security-hardening

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified
- [ ] Task can now be marked complete
