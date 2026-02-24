# Task TASK-2042: Rate Limiting on Supabase Edge Functions

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

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add application-level rate limiting to all Supabase Edge Functions (currently `scim` and `validate-address`) to prevent abuse and ensure fair usage. Implement per-user or per-IP limits with configurable thresholds.

## Non-Goals

- Do NOT create new Edge Functions.
- Do NOT modify the core business logic of existing Edge Functions.
- Do NOT implement distributed rate limiting with external stores (Redis, etc.) -- use in-memory or Supabase table-based approach.
- Do NOT add rate limiting to the Supabase client in the Electron app (this is server-side only).

## Deliverables

1. New: `supabase/functions/_shared/rateLimiter.ts` -- shared rate limiting utility
2. Update: `supabase/functions/scim/index.ts` -- add rate limiting middleware
3. Update: `supabase/functions/validate-address/index.ts` -- add rate limiting middleware

## Acceptance Criteria

- [ ] Rate limiting middleware implemented as a shared utility in `_shared/`
- [ ] `scim` Edge Function has rate limiting (per bearer token, 100 req/min)
- [ ] `validate-address` Edge Function has rate limiting (per user, 60 req/min)
- [ ] Rate limit exceeded returns HTTP 429 with `Retry-After` header
- [ ] Rate limit state resets correctly after the window expires
- [ ] Existing Edge Function behavior is unchanged for non-rate-limited requests
- [ ] Edge Function tests pass (if any exist)
- [ ] No regressions in app functionality that calls these Edge Functions

## Implementation Notes

### Current Edge Functions

1. **`scim/index.ts`** -- SCIM 2.0 user provisioning for Azure AD. Auth: Bearer token against `scim_tokens` table. Called by Azure AD for user create/update/deactivate.

2. **`validate-address/index.ts`** -- Google Maps Geocoding proxy. Auth: Supabase user JWT. Called by the Electron app when users enter property addresses.

### Rate Limiting Approach

**In-memory sliding window** is the simplest approach for Edge Functions. Supabase Edge Functions run in Deno and each invocation may or may not share memory (depends on cold starts). For production robustness, consider a Supabase table-based approach.

**Option A: In-memory (simpler, less durable)**
```typescript
// supabase/functions/_shared/rateLimiter.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}
```

**Option B: Supabase table-based (more durable)**
```sql
-- Migration: create rate_limit_entries table
CREATE TABLE IF NOT EXISTS rate_limit_entries (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_ms INTEGER NOT NULL
);
```

**Recommendation:** Start with Option A (in-memory). It covers the majority of abuse cases. If Edge Functions scale to multi-instance, upgrade to Option B later.

### Integration Pattern

```typescript
// In each Edge Function handler:
import { checkRateLimit } from '../_shared/rateLimiter.ts';

// Extract rate limit key (user ID, IP, or bearer token hash)
const rateLimitKey = userId || req.headers.get('x-forwarded-for') || 'anonymous';
const { allowed, retryAfter } = checkRateLimit(rateLimitKey, 100, 60_000);

if (!allowed) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}
```

### Rate Limit Thresholds

| Edge Function | Key | Max Requests | Window |
|---------------|-----|-------------|--------|
| `scim` | Bearer token hash | 100 | 1 minute |
| `validate-address` | User ID (from JWT) | 60 | 1 minute |

These are intentionally generous starting points. They can be tightened based on production monitoring.

### Important: Deno Imports

Edge Functions use Deno-style imports, NOT Node.js-style. Shared code must use relative paths:
```typescript
// CORRECT:
import { checkRateLimit } from '../_shared/rateLimiter.ts';

// INCORRECT:
import { checkRateLimit } from '@/shared/rateLimiter';
```

## Integration Notes

- Imports from: N/A (self-contained Deno functions)
- Exports to: N/A
- Used by: `scim` and `validate-address` Edge Functions
- Depends on: None (Batch 1, parallel)

## Do / Don't

### Do:
- Use Deno-compatible imports and APIs
- Include the `Retry-After` header in 429 responses
- Make rate limits configurable via environment variables if straightforward
- Clean up stale entries from the in-memory map to prevent memory leaks
- Add a periodic cleanup for the rate limit map (e.g., every 1000 requests, prune expired entries)

### Don't:
- Modify the core business logic of either Edge Function
- Use Node.js-specific APIs (these run in Deno)
- Add external dependencies (no Redis, no npm packages) -- keep it self-contained
- Make rate limits too aggressive -- start generous
- Block CORS preflight (OPTIONS) requests with rate limiting

## When to Stop and Ask

- If Edge Functions don't share memory between invocations (making in-memory approach useless)
- If the Deno runtime does not support `Map` persistence across invocations
- If you need to create a Supabase migration for the table-based approach
- If the `_shared/` directory pattern is not supported by Supabase Edge Functions

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (if testable locally)
- New tests to write:
  - Test `checkRateLimit` returns `allowed: true` under limit
  - Test `checkRateLimit` returns `allowed: false` at limit with correct `retryAfter`
  - Test rate limit window resets after expiry
  - Test cleanup of stale entries
- Existing tests to update: None

### Coverage

- Coverage impact: New utility should have high coverage

### Integration / Feature Tests

- Required scenarios:
  - curl the Edge Function endpoint rapidly, verify 429 returned after limit (manual test)
  - Verify normal app usage is not affected by rate limits (manual test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (if Edge Function tests exist in CI)
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(edge-functions): add rate limiting to Supabase Edge Functions`
- **Labels**: `security`, `edge-functions`, `rollout-readiness`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 (shared rate limiter utility) | +10K |
| Files to modify | 2 (scim/index.ts, validate-address/index.ts) | +10K |
| Code volume | ~50-80 lines for utility, ~10 lines per integration | +5K |
| Test complexity | Low-Medium (utility tests) | +5K |

**Confidence:** Medium

**Risk factors:**
- Deno runtime behavior for in-memory state across invocations is unclear
- May need table-based approach if memory is not shared

**Similar past tasks:** Service-category tasks run at x0.5 multiplier.

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
- [ ] supabase/functions/_shared/rateLimiter.ts

Files modified:
- [ ] supabase/functions/scim/index.ts
- [ ] supabase/functions/validate-address/index.ts

Features implemented:
- [ ] Rate limiting utility
- [ ] scim rate limiting
- [ ] validate-address rate limiting
- [ ] 429 response with Retry-After header

Verification:
- [ ] Edge Function tests pass (if applicable)
- [ ] npm run type-check passes (for non-Edge code)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document decisions>

**Issues encountered:**
<Document issues>

**Reviewer notes:**
<Reviewer attention items>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

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
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
