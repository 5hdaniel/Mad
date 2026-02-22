# Task TASK-2044: Login Auth Timeout -- Add Retry on Failure

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

Add retry logic with user-facing feedback when login/OAuth times out or fails. Currently, a login failure shows an error and the user must restart the app. Implement automatic retry with exponential backoff and a visible "Retrying..." / "Try again" mechanism.

## Non-Goals

- Do NOT rewrite the OAuth flow (Google/Microsoft login).
- Do NOT add new auth providers.
- Do NOT implement offline login / cached credentials.
- Do NOT modify the deep link handler logic (that is a separate concern).
- Do NOT change the token refresh mechanism (that is TASK-2040).

## Prerequisites

**Depends on:** TASK-2040 (Supabase token auto-refresh)
- TASK-2040 establishes auth error handling patterns in `supabaseService.ts`
- This task builds on those patterns for the login flow specifically

**Shares files with TASK-2045:** `sessionHandlers.ts`, `authBridge.ts`, `supabaseService.ts`
- TASK-2044 must be completed and merged BEFORE TASK-2045 begins

## Deliverables

1. Update: `electron/handlers/sessionHandlers.ts` -- add retry logic to login handlers
2. Update: `electron/handlers/sharedAuthHandlers.ts` -- add retry wrapper for auth operations
3. Update: `electron/preload/authBridge.ts` -- expose retry-related IPC channels if needed
4. Update: `src/` login components -- add "Retrying..." feedback and "Try again" button
5. Possibly update: `electron/services/googleAuthService.ts`, `electron/services/microsoftAuthService.ts` -- add retry-aware error types

## Acceptance Criteria

- [ ] Login timeout triggers automatic retry (up to 3 attempts with exponential backoff)
- [ ] User sees "Retrying..." feedback during automatic retry attempts
- [ ] After all retries exhausted, user sees a "Try again" button (not just an error message)
- [ ] "Try again" button initiates a fresh login attempt (not a retry of the stale attempt)
- [ ] Previous login attempt is properly cancelled before retry starts (no duplicate sessions)
- [ ] Network-related errors trigger retry; auth-rejected errors (wrong credentials) do NOT retry
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Current Login Flow

The login flow goes through:
1. Renderer calls `authBridge.googleLogin()` or `authBridge.microsoftLogin()` (IPC invoke)
2. IPC handler in `sharedAuthHandlers.ts` or dedicated auth handler starts OAuth flow
3. OAuth opens browser window, user authenticates
4. Deep link callback returns auth code to Electron
5. Auth code is exchanged for tokens via `googleAuthService` or `microsoftAuthService`
6. Session is created via `sessionHandlers.ts`

Failures can happen at steps 3-6. The retry logic should primarily handle:
- Network timeouts during token exchange (step 5)
- Supabase session creation failures (step 6)
- OAuth callback timeout (deep link never received, step 4)

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: number;       // 3
  baseDelayMs: number;      // 1000 (1 second)
  maxDelayMs: number;       // 10000 (10 seconds)
  retryableErrors: string[]; // ['TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR']
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt > config.maxRetries || !isRetryableError(error, config.retryableErrors)) {
        throw lastError;
      }
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt - 1),
        config.maxDelayMs
      );
      onRetry?.(attempt, lastError);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}
```

### Error Classification

| Error Type | Retry? | Reason |
|-----------|--------|--------|
| Network timeout | Yes | Transient network issue |
| Server 5xx | Yes | Transient server issue |
| DNS resolution failure | Yes | Possible transient |
| OAuth callback timeout | Yes (once) | User may have been slow |
| Invalid credentials (401) | No | User error, retry won't help |
| Permission denied (403) | No | Configuration error |
| Rate limited (429) | Yes (with backoff) | Wait and retry |

### UI Feedback

The renderer login component should show:
```
[Retrying (attempt 2/3)...]
```
And after all retries fail:
```
Login failed. Please check your connection and try again.
[Try Again] button
```

This requires an IPC event from main to renderer to communicate retry status. Consider using `webContents.send()` for real-time updates.

### Key Files to Examine

- `electron/handlers/sharedAuthHandlers.ts` -- where auth IPC handlers are registered
- `electron/handlers/sessionHandlers.ts` -- session creation/validation
- `electron/preload/authBridge.ts` -- IPC bridge for auth operations
- `electron/auth-handlers.ts` -- may contain additional auth handling
- `src/` login page component -- where error messages are displayed

## Integration Notes

- Imports from: `electron/services/googleAuthService.ts`, `electron/services/microsoftAuthService.ts`
- Exports to: Used by renderer login flow
- Used by: TASK-2045 (sign out all devices) builds on the error handling patterns
- Depends on: TASK-2040 (token refresh patterns)

## Do / Don't

### Do:
- Cancel the previous attempt before starting a retry (prevent duplicate sessions)
- Distinguish between retryable and non-retryable errors
- Provide real-time feedback to the user during retries
- Include attempt count in log messages for debugging
- Test with both Google and Microsoft OAuth flows

### Don't:
- Retry on authentication rejection (wrong credentials, blocked account)
- Create a new browser window for each retry (reuse the same OAuth window if possible)
- Add infinite retry loops -- max 3 attempts
- Block the UI thread during retry delays
- Modify the OAuth provider configuration (scopes, redirect URIs)

## When to Stop and Ask

- If the OAuth flow is too tightly coupled to attempt retries cleanly (e.g., browser window lifecycle)
- If the deep link callback mechanism makes it hard to distinguish "timeout" from "user cancelled"
- If the login components in `src/` use a state machine that makes adding retry states complex
- If you discover more than 3 different error paths that need retry logic

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `withRetry` utility: succeeds on first attempt
  - Test `withRetry` utility: succeeds on retry after transient failure
  - Test `withRetry` utility: exhausts retries and throws final error
  - Test `withRetry` utility: does not retry non-retryable errors
  - Test `withRetry` utility: exponential backoff delays are correct
  - Test session handler retry integration (mock auth services)
- Existing tests to update:
  - `electron/handlers/__tests__/sessionHandlers.test.ts` -- verify retry behavior

### Coverage

- Coverage impact: Must not decrease; retry utility should have full coverage

### Integration / Feature Tests

- Required scenarios:
  - Kill network during login, verify retry UI appears (manual test)
  - Retry succeeds after network restored (manual test)
  - "Try again" button works after all retries fail (manual test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(auth): add retry logic with user feedback for login timeouts`
- **Labels**: `auth`, `ux`, `rollout-readiness`
- **Depends on**: TASK-2040 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0-1 (retry utility, or inline) | +5K |
| Files to modify | 4-5 files (handlers + login components) | +15K |
| Code volume | ~100-150 lines (retry logic + UI feedback) | +5K |
| Test complexity | Medium (mock auth failures, verify retry count) | +5K |

**Confidence:** Medium

**Risk factors:**
- OAuth flow retry may be more complex than expected (browser window lifecycle)
- Deep link callback timeout detection may not be straightforward
- UI retry feedback requires IPC event plumbing

**Similar past tasks:** Service-category tasks run at x0.5 multiplier.

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-02-22*

### Agent ID

```
Engineer Agent ID: a2355159
```

### Checklist

```
Files created:
- [x] electron/utils/withRetry.ts (generic retry utility)
- [x] electron/utils/__tests__/withRetry.test.ts (38 unit tests)

Files modified:
- [x] src/components/Login.tsx (retry UI state + auto-retry + "Try again" button)

Files NOT modified (deviations from task plan):
- sessionHandlers.ts: No login initiation logic -- retry belongs in renderer
- sharedAuthHandlers.ts: Only handles post-auth completion, not login initiation
- authBridge.ts: Existing IPC channels sufficient, no new channels needed

Features implemented:
- [x] Retry utility with exponential backoff (withRetry, isRetryableError, calculateBackoffDelay)
- [x] Error classification (retryable vs non-retryable)
- [x] "Retrying (attempt X/Y)..." UI feedback during auto-retry
- [x] "Try again" button after all retries fail (starts fresh login)
- [x] Previous attempt cancellation via timer cleanup before retry
- [x] Deep link callback timeout detection (60s, triggers retry)
- [x] AbortSignal support in withRetry utility

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (38 new tests, 0 regressions)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |
| Input Tokens | (auto-captured) |
| Output Tokens | (auto-captured) |
| Cache Read | (auto-captured) |
| Cache Create | (auto-captured) |

**Variance:** PM Est ~30K vs Actual (auto-captured)

### Notes

**Planning notes:**
- Analyzed the full login flow: renderer initiates browser open, main process opens URL, deep link callback returns to renderer. Retry logic belongs in the renderer (Login.tsx) since the main process side is fire-and-forget.
- The withRetry utility is generic and placed in electron/utils/ for TASK-2045 reuse.

**Deviations from plan:**
- Did NOT modify sessionHandlers.ts, sharedAuthHandlers.ts, or authBridge.ts. Analysis showed these files handle post-auth completion (step 6), not login initiation (steps 3-5). The retry logic targets the browser auth flow which is orchestrated entirely by the Login.tsx component.
- No new IPC channels needed -- existing deep link event system provides the error/success callbacks that drive retry decisions.

**Design decisions:**
1. Retry lives in renderer: The browser auth flow is event-driven (open browser -> wait for deep link callback). The renderer is the only place that knows when errors or timeouts occur.
2. Callback timeout (60s): Added a timer that fires if the deep link callback never arrives (user closed browser, network issue, etc.). This triggers the same retry logic as an error callback.
3. Error classification: MISSING_TOKENS, INVALID_TOKENS, INVALID_URL are non-retryable (configuration/auth errors). UNKNOWN_ERROR and timeouts are retryable (transient issues).
4. "Try again" resets retry counter: After all auto-retries exhausted, the "Try again" button starts a completely fresh login flow (not a continuation of the stale attempt).
5. Timer cleanup before each retry: clearRetryTimers() cancels any pending timeouts before starting a new attempt, preventing duplicate sessions.

**Issues encountered:**
- Initial test approach with Jest fake timers + async withRetry caused test failures due to timer/promise interleaving. Resolved by using real timers with 1ms delays for fast, reliable tests.

**Reviewer notes:**
- The withRetry utility in electron/utils/ is designed to be reusable by TASK-2045 (sign out all devices).
- Login.tsx retry logic is self-contained in the browser auth flow section -- Google/Microsoft popup flows (deprecated, behind `{false && ...}` guards) are not affected.
- The 60-second callback timeout is generous to accommodate slow OAuth flows; it can be tuned via LOGIN_RETRY_CONFIG.callbackTimeoutMs.

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | (auto-captured) | (auto-calculated) |
| Duration | - | (auto-captured) | - |

**Root cause of variance:**
(auto-captured -- engineer work was straightforward once login flow architecture was understood)

**Suggestion for similar tasks:**
Auth retry tasks require careful analysis of which process (main vs renderer) orchestrates the flow. The initial task plan assumed main process modifications but the actual architecture placed retry control in the renderer.

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
