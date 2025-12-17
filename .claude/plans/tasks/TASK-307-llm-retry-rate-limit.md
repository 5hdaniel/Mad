# Task TASK-307: LLM Retry and Rate Limiting

## Goal

Add retry logic with exponential backoff and rate limiting to the base LLM service, ensuring resilient API calls that respect provider limits.

## Non-Goals

- Do NOT implement actual API calls (TASK-309, TASK-310)
- Do NOT implement token counting (TASK-308)
- Do NOT add circuit breaker pattern (can be added later if needed)

## Deliverables

1. Update: `electron/services/llm/baseLLMService.ts` - Add retry wrapper and rate limiter
2. New file: `electron/services/llm/rateLimiter.ts` - Token bucket rate limiter

## Acceptance Criteria

- [ ] Retry wrapper with exponential backoff (max 3 attempts)
- [ ] Rate limiter respects configurable requests/minute
- [ ] Retry-After headers honored when present
- [ ] Non-retryable errors fail immediately
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes

## Implementation Notes

### Rate Limiter

Create `electron/services/llm/rateLimiter.ts`:

```typescript
/**
 * Token bucket rate limiter for LLM API calls.
 * Prevents hitting provider rate limits.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;  // tokens per ms

  /**
   * @param requestsPerMinute - Maximum requests allowed per minute
   */
  constructor(requestsPerMinute: number = 60) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000;  // per ms
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to acquire a token for making a request.
   * Returns true if allowed, false if rate limited.
   */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token is available.
   * Returns the wait time in ms (0 if immediately available).
   */
  async acquire(): Promise<number> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }

    // Calculate wait time
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await this.sleep(waitMs);
    this.refill();
    this.tokens -= 1;
    return waitMs;
  }

  /**
   * Get time until next token available (ms).
   */
  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }

  /**
   * Get current available tokens.
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Retry Logic in Base Service

Update `electron/services/llm/baseLLMService.ts`:

```typescript
import { RateLimiter } from './rateLimiter';
import { LLMConfig, LLMResponse, LLMMessage, LLMError } from './types';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export abstract class BaseLLMService {
  protected readonly rateLimiter: RateLimiter;
  protected readonly retryConfig: RetryConfig;

  constructor(
    provider: LLMProvider,
    requestsPerMinute: number = 60,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.provider = provider;
    this.rateLimiter = new RateLimiter(requestsPerMinute);
    this.retryConfig = retryConfig;
  }

  /**
   * Execute a completion with retry and rate limiting.
   */
  async completeWithRetry(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // Wait for rate limiter
    const waitTime = await this.rateLimiter.acquire();
    if (waitTime > 0) {
      this.log('info', `Rate limited, waited ${waitTime}ms`);
    }

    let lastError: LLMError | undefined;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.complete(messages, config);
      } catch (error) {
        if (error instanceof LLMError) {
          lastError = error;

          // Don't retry non-retryable errors
          if (!error.retryable) {
            throw error;
          }

          // Use Retry-After header if provided
          const retryDelay = error.retryAfterMs ?? delay;

          this.log('warn', `Attempt ${attempt} failed, retrying in ${retryDelay}ms`, {
            type: error.type,
            message: error.message,
          });

          if (attempt < this.retryConfig.maxAttempts) {
            await this.sleep(retryDelay);
            delay = Math.min(
              delay * this.retryConfig.backoffMultiplier,
              this.retryConfig.maxDelayMs
            );
          }
        } else {
          // Unknown error, wrap and throw
          throw this.createError(
            `Unexpected error: ${error}`,
            'unknown',
            undefined,
            false
          );
        }
      }
    }

    // All retries exhausted
    throw lastError ?? this.createError(
      'All retry attempts failed',
      'unknown',
      undefined,
      false
    );
  }

  /**
   * Check if the service is currently rate limited.
   */
  isRateLimited(): boolean {
    return this.rateLimiter.getWaitTime() > 0;
  }

  /**
   * Get estimated wait time until next request allowed.
   */
  getWaitTime(): number {
    return this.rateLimiter.getWaitTime();
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ... existing abstract methods and helpers ...
}
```

### Test Cases

Key scenarios to test:
1. Successful first attempt - no retry
2. Retryable error - retry succeeds on 2nd attempt
3. Non-retryable error - fails immediately
4. All retries exhausted - throws last error
5. Rate limiter blocks until token available
6. Retry-After header honored

## Integration Notes

- Imports from: `./types.ts`
- Exports to: Used by all provider implementations
- Used by: TASK-309 (OpenAI), TASK-310 (Anthropic)
- Depends on: TASK-306

## Do / Don't

### Do:
- Use exponential backoff for retries
- Honor Retry-After headers from API responses
- Log retry attempts for debugging
- Make rate limiter configurable per provider

### Don't:
- Don't retry non-retryable errors (invalid key, quota exceeded)
- Don't retry indefinitely
- Don't block the main thread with synchronous waits
- Don't ignore provider-specific rate limits

## When to Stop and Ask

- If provider rate limits differ significantly from defaults
- If retry behavior should be user-configurable
- If there's existing retry logic to integrate with
- If circuit breaker pattern is needed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `rateLimiter.test.ts` - Token bucket behavior
  - `baseLLMService.test.ts` - Retry logic
- Existing tests to update: None

### Coverage

- Coverage impact: >80% for retry and rate limiter

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-307-llm-retry-rate-limit`
- **Title**: `feat(llm): add retry logic and rate limiting`
- **Labels**: `llm`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-306

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] electron/services/llm/rateLimiter.ts
- [ ] electron/services/llm/__tests__/rateLimiter.test.ts

Files modified:
- [ ] electron/services/llm/baseLLMService.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Reviewer notes:**
