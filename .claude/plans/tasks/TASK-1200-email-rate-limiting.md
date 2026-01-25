# TASK-1200: Add Email API Rate Limiting

**Backlog ID:** BACKLOG-497
**Sprint:** Unassigned (Overnight Autonomous Work)
**Branch:** `feature/task-1200-email-rate-limiting`
**Estimated Turns:** 15-25
**Estimated Tokens:** ~30K

---

## Objective

Add exponential backoff and request throttling to the Microsoft Graph and Gmail API fetch services to prevent 429 (Too Many Requests) errors at scale.

---

## Context

Email sync currently fetches in tight loops with no throttling. At scale (5,000+ users), this will immediately hit Microsoft Graph and Gmail API rate limits:

| Provider | Limit | Impact |
|----------|-------|--------|
| Microsoft Graph (per-app) | 10,000 requests/10 min | Shared across ALL users |
| Microsoft Graph (per-user) | 10,000 requests/10 min | Per individual |
| Gmail (per-user) | 250 requests/100 seconds | Per individual |
| Gmail (global per project) | 10,000 requests/100 seconds | Shared across all users |

The current code in `gmailFetchService.ts` (lines 255-278) fetches ALL message details synchronously with no delay:

```typescript
const batchSize = 10;
for (let i = 0; i < allMessages.length; i += batchSize) {
  const batchResults = await Promise.all(
    batch.map((msg) => this.getEmailById(msg.id))
  );
}
```

---

## Requirements

### Must Do:

1. **Create a shared rate limiting utility** at `electron/utils/rateLimitedFetch.ts`:
   - Exponential backoff function with configurable parameters
   - Throttle function (minimum delay between requests)
   - Retry-After header parsing

2. **Add exponential backoff to Microsoft Graph** (`outlookFetchService.ts`):
   - Wrap API calls with retry logic
   - Handle 429 responses with exponential backoff
   - Respect `Retry-After` header when present
   - Log rate limit events

3. **Add exponential backoff to Gmail** (`gmailFetchService.ts`):
   - Wrap API calls with retry logic
   - Handle 429 responses with exponential backoff
   - Respect `Retry-After` header when present
   - Log rate limit events

4. **Add request throttling**:
   - Minimum 100ms delay between consecutive API requests
   - Apply to both Microsoft Graph and Gmail services

5. **Add logging**:
   - Log when rate limiting is triggered
   - Log retry attempts with delay duration
   - Log when sync completes after rate limiting

### Must NOT Do:

- Do NOT change the email sync user interface
- Do NOT modify database schema
- Do NOT change the structure of parsed emails
- Do NOT add new npm dependencies (use built-in utilities)
- Do NOT modify email deduplication logic

---

## Acceptance Criteria

- [ ] Exponential backoff on 429 responses (both Microsoft Graph and Gmail)
- [ ] Minimum 100ms delay between API requests (configurable)
- [ ] `Retry-After` headers respected when present
- [ ] Rate limit events logged for monitoring
- [ ] Sync completes successfully even under rate limiting
- [ ] Existing tests pass
- [ ] New tests for rate limiting utility

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/utils/rateLimitedFetch.ts` | **NEW** - Rate limiting utility |
| `electron/services/outlookFetchService.ts` | Wrap API calls with retry/throttle |
| `electron/services/gmailFetchService.ts` | Wrap API calls with retry/throttle |

## Files to Read (for context)

| File | Purpose |
|------|---------|
| `electron/services/logService.ts` | Logging patterns |
| `electron/services/outlookFetchService.ts` | Full implementation to understand call patterns |
| `electron/services/gmailFetchService.ts` | Full implementation to understand call patterns |

---

## Implementation Guidance

### Rate Limiting Utility

```typescript
// electron/utils/rateLimitedFetch.ts

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Wraps an async function with exponential backoff retry logic
 * Handles 429 (Too Many Requests) and respects Retry-After headers
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 5;
  const baseDelay = options?.baseDelayMs ?? 1000;
  const maxDelay = options?.maxDelayMs ?? 60000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } })?.response;

      // Check for rate limit error
      if ((status === 429 || response?.status === 429) && attempt < maxRetries) {
        // Check for Retry-After header (in seconds)
        const retryAfter = response?.headers?.['retry-after'];
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

        // Log the retry
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);

        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  // Should not reach here, but TypeScript needs this
  throw new Error('Max retries exceeded');
}

/**
 * Creates a throttled version of an async function
 * Ensures minimum delay between calls
 */
export function createThrottledFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  minDelayMs: number = 100
): T {
  let lastCallTime = 0;

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < minDelayMs) {
      await sleep(minDelayMs - timeSinceLastCall);
    }

    lastCallTime = Date.now();
    return fn(...args) as ReturnType<T>;
  }) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Microsoft Graph Integration

In `outlookFetchService.ts`, wrap API calls:

```typescript
import { withRetry } from '../utils/rateLimitedFetch';

// Before: Direct call
const response = await axios.get(url, config);

// After: With retry
const response = await withRetry(() => axios.get(url, config));
```

### Gmail Integration

In `gmailFetchService.ts`, add throttling to batch fetches:

```typescript
import { withRetry, createThrottledFunction } from '../utils/rateLimitedFetch';

// Create throttled version of getEmailById
const throttledGetEmail = createThrottledFunction(
  (id: string) => this.getEmailById(id),
  100  // 100ms between calls
);

// In batch processing
for (let i = 0; i < allMessages.length; i += batchSize) {
  const batch = allMessages.slice(i, i + batchSize);
  const batchResults = await Promise.all(
    batch.map((msg) => withRetry(() => throttledGetEmail(msg.id)))
  );
}
```

---

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  - `electron/utils/__tests__/rateLimitedFetch.test.ts`
  - Test exponential backoff timing
  - Test Retry-After header parsing
  - Test max retries limit
  - Test throttling delay
- **Existing tests to update:** None expected

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(email): add rate limiting for Microsoft Graph and Gmail APIs`
- **Branch:** `feature/task-1200-email-rate-limiting`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: 15-25)
- **Actual Tokens**: ~XK (Est: 30K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find the API error handling is more complex than expected (different error shapes)
- You need to add npm dependencies for retry logic
- The existing code structure requires significant refactoring
- You encounter blockers not covered in the task file
