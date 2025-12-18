# Task TASK-414: E2E Failure Scenario Tests

## Goal

Create end-to-end tests for error handling paths: API timeout, invalid key, rate limits, malformed responses, and retry logic.

## Non-Goals

- Do NOT test happy path (TASK-413)
- Do NOT test with real LLM APIs
- Do NOT modify implementation code

## Deliverables

1. New file: `tests/e2e/llmFailures.test.ts`

## Acceptance Criteria

- [ ] Test handles API timeout gracefully
- [ ] Test shows error when API key invalid
- [ ] Test shows rate limit exceeded message
- [ ] Test falls back to pattern on malformed response
- [ ] Test retries on transient failure
- [ ] Test displays fallback notification to user
- [ ] All CI checks pass

## Implementation Notes

```typescript
// tests/e2e/llmFailures.test.ts
import { test, expect } from '@playwright/test';

test.describe('LLM Failure Handling', () => {
  test('handles API timeout gracefully', async ({ page }) => {
    await setupMockLLM(page, { timeout: 5000 });
    await login(page, testUser);
    await importEmails(page, mockRealEstateEmails);

    // Trigger scan
    await page.click('[data-testid="scan-button"]');

    // Should show timeout message but still complete
    await expect(page.locator('.llm-status')).toContainText('Using pattern matching');
    await expect(page.locator('.transaction-card')).toBeVisible();
  });

  test('shows error when API key invalid', async ({ page }) => {
    await setupMockLLM(page, { error: { code: 'invalid_api_key' } });
    await login(page, testUser);

    // Try to validate key
    await page.goto('/settings');
    await page.fill('[name="openaiKey"]', 'invalid-key');
    await page.click('[data-testid="validate-key"]');

    // Should show invalid status
    await expect(page.locator('.validation-status')).toContainText('Invalid');
    await expect(page.locator('[data-testid="settings-link"]')).toBeVisible();
  });

  test('shows rate limit exceeded message', async ({ page }) => {
    await setupMockLLM(page, { error: { code: 'rate_limit_exceeded', retryAfter: 60 } });
    await login(page, testUser);
    await importEmails(page, mockRealEstateEmails);

    await page.click('[data-testid="scan-button"]');

    // Should show rate limit message
    await expect(page.locator('.error-message')).toContainText('Rate limit');
    await expect(page.locator('.retry-timer')).toContainText('60');
  });

  test('falls back to pattern on malformed response', async ({ page }) => {
    await setupMockLLM(page, { response: 'not valid json' });
    await login(page, testUser);
    await importEmails(page, mockRealEstateEmails);

    await page.click('[data-testid="scan-button"]');

    // Should still show results (from pattern matching)
    await expect(page.locator('.llm-status')).toContainText('pattern matching');
    await expect(page.locator('.transaction-card')).toBeVisible();
  });

  test('retries on transient failure', async ({ page }) => {
    let callCount = 0;
    await setupMockLLM(page, {
      handler: () => {
        callCount++;
        if (callCount < 3) throw new Error('503 Service Unavailable');
        return mockLLMResponse;
      },
    });
    await login(page, testUser);
    await importEmails(page, mockRealEstateEmails);

    await page.click('[data-testid="scan-button"]');

    // Should eventually succeed after retries
    await expect(page.locator('.transaction-card')).toBeVisible();
    expect(callCount).toBe(3);
  });

  test('displays fallback notification to user', async ({ page }) => {
    await setupMockLLM(page, { timeout: 100 });
    await login(page, testUser);
    await importEmails(page, mockRealEstateEmails);

    await page.click('[data-testid="scan-button"]');

    // Should show notification explaining fallback
    await expect(page.locator('.notification')).toContainText('AI analysis unavailable');
    await expect(page.locator('.notification')).toContainText('pattern matching');
  });
});

// Mock setup helper
async function setupMockLLM(page, options = {}) {
  await page.route('**/api/llm/**', async (route) => {
    if (options.timeout) {
      await new Promise(resolve => setTimeout(resolve, options.timeout));
      await route.abort('timedout');
    } else if (options.error) {
      await route.fulfill({
        status: options.error.code === 'rate_limit_exceeded' ? 429 : 401,
        body: JSON.stringify({ error: options.error }),
      });
    } else if (options.response) {
      await route.fulfill({
        status: 200,
        body: options.response,
      });
    } else if (options.handler) {
      try {
        const result = options.handler();
        await route.fulfill({ status: 200, body: JSON.stringify(result) });
      } catch (e) {
        await route.fulfill({ status: 503, body: e.message });
      }
    } else {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockLLMResponse),
      });
    }
  });
}
```

## Integration Notes

- Imports from: Playwright test framework
- Used by: CI pipeline
- Depends on: TASK-413

## Testing Expectations (MANDATORY)

### E2E Requirements
- Tests must be deterministic
- Use proper mocks for failure scenarios
- Verify user-facing error messages

### CI Requirements
- [ ] All E2E tests pass
- [ ] Tests complete in <60s

## PR Preparation

- **Title**: `test(e2e): add LLM failure scenario tests [TASK-414]`
- **Labels**: `test`, `e2e`, `ai-mvp`, `phase-3`
- **Depends on**: TASK-413

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `test`
**Estimated Totals:** 2 turns, ~10K tokens, ~15m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-413)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-414-e2e-failure-scenarios

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-413
- **Blocks:** None (final task)

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*
