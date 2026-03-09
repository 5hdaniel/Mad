# TASK-2136: Add Rate Limiting to Impersonation Entry Route

**Backlog ID:** BACKLOG-896
**Sprint:** SPRINT-118
**Phase:** Phase 3 - TTL + UI + Stretch (Sequential after TASK-2135, stretch goal)
**Depends On:** TASK-2135 (TTL changes to route.ts must be landed first)
**Branch:** `feature/task-2136-rate-limit-impersonation`
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

Add rate limiting (5 attempts per IP per minute) to the `/auth/impersonate` route to prevent brute-force token probing and connection pool DoS.

## Non-Goals

- Do NOT add rate limiting to other routes
- Do NOT implement a distributed rate limiter (in-memory is sufficient for single-instance deployment)
- Do NOT change the token validation logic
- Do NOT modify the cookie or session handling

## Deliverables

1. Update: `broker-portal/app/auth/impersonate/route.ts` -- add rate limiting check
2. New: `broker-portal/lib/rate-limiter.ts` -- simple in-memory rate limiter utility

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/app/auth/impersonate/route.ts` -- add rate limit check at top of handler
- `broker-portal/lib/rate-limiter.ts` (new) -- rate limiting utility

### Files this task must NOT modify:

- `broker-portal/lib/impersonation.ts`
- `broker-portal/lib/impersonation-guards.ts`
- `broker-portal/middleware.ts`
- `broker-portal/app/dashboard/` -- any dashboard files
- `supabase/migrations/`

## Acceptance Criteria

- [ ] First 5 requests from same IP within 1 minute succeed (if tokens are valid)
- [ ] 6th request from same IP within 1 minute returns 429 Too Many Requests
- [ ] Different IPs are tracked independently
- [ ] Rate limit resets after 1 minute window
- [ ] Rate limiter does not leak memory (old entries are cleaned up)
- [ ] All CI checks pass

## Implementation Notes

### Simple In-Memory Rate Limiter

```typescript
// broker-portal/lib/rate-limiter.ts
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, limit: number = 5, windowMs: number = 60_000): boolean {
  const now = Date.now();

  // Cleanup old entries periodically
  if (store.size > 1000) {
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  entry.count++;
  if (entry.count > limit) {
    return false; // rate limited
  }

  return true; // allowed
}
```

### Route Handler Update

```typescript
import { checkRateLimit } from '@/lib/rate-limiter';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  // Rate limiting
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headersList.get('x-real-ip')
    || 'unknown';

  if (!checkRateLimit(`impersonate:${ip}`)) {
    return new Response('Too many requests', { status: 429 });
  }

  // ... existing handler logic
}
```

### Key Details

- In-memory store is sufficient because the broker portal runs as a single Vercel serverless function instance (or few instances). Token space is already 256-bit, making brute force impractical -- this is defense-in-depth.
- Note: In Vercel serverless, in-memory state may not persist across cold starts. This is acceptable -- the rate limiter provides best-effort protection.
- For stronger rate limiting in the future, Vercel Edge Config or Upstash Redis could be used, but that is out of scope.

## Integration Notes

- Imports from: `next/headers`
- Exports to: None (self-contained)
- Used by: Only the impersonate route
- Depends on: TASK-2135 (for merge ordering)

## Do / Don't

### Do:

- Use `x-forwarded-for` header for IP detection (standard behind reverse proxies)
- Clean up old entries to prevent memory leaks
- Return proper 429 status code

### Don't:

- Do NOT use a database for rate limiting (unnecessary complexity)
- Do NOT apply rate limiting globally or to other routes
- Do NOT use npm packages for this (simple enough to implement inline)

## When to Stop and Ask

- If the route uses Edge Runtime (in-memory Map may not work -- check the runtime)
- If there is already rate limiting middleware in the project

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests: `rate-limiter.test.ts` -- allows within limit, blocks over limit, resets after window

### CI Requirements

- [ ] Unit tests
- [ ] Type checking
- [ ] Lint

## PR Preparation

- **Title**: `feat(security): add rate limiting to impersonation entry route`
- **Labels**: `security`, `broker-portal`
- **Depends on**: TASK-2135

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

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
Files created:
- [ ] broker-portal/lib/rate-limiter.ts
- [ ] broker-portal/lib/__tests__/rate-limiter.test.ts

Files modified:
- [ ] broker-portal/app/auth/impersonate/route.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~8K vs Actual ~XK

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
