# BACKLOG-205: Fix Flaky useAutoRefresh Timer Tests

## Summary

Fix 4 flaky tests in `useAutoRefresh.test.ts` that have race conditions with Jest fake timers and async operations.

## Problem

These tests intermittently fail in CI due to timing issues between Jest's fake timers and async Promise resolution:

1. `should only trigger once per dashboard entry` (line 217)
2. `should wait for preferences before triggering` (line 652)
3. `should default to enabled when preference not set` (line 688)
4. `should default to enabled on preference load error` (line 708)

The tests are currently skipped with `it.skip()` to unblock CI.

## Root Cause Analysis

The tests use a combination of:
- Jest fake timers (`jest.useFakeTimers()`)
- Async operations (`mockPreferencesGet.mockResolvedValue()`)
- Timer advancement (`jest.advanceTimersByTime()`)

The race condition occurs because:
1. The hook loads preferences asynchronously
2. The test advances timers before the async operation completes
3. The expected callback never fires because the timer was set after advancement

## Proposed Solution

Options (in order of preference):

### Option 1: Use `waitFor` with proper flush
```typescript
import { waitFor } from '@testing-library/react';

it("should only trigger once per dashboard entry", async () => {
  renderHook(() => useAutoRefresh(defaultOptions));

  // Wait for preferences to load AND timer to fire
  await waitFor(() => {
    expect(mockTransactionsScan).toHaveBeenCalledTimes(1);
  }, { timeout: 5000 });
});
```

### Option 2: Use `runAllTimersAsync`
```typescript
await act(async () => {
  await jest.runAllTimersAsync();
});
```

### Option 3: Manual microtask flushing
```typescript
const flushPromises = () => new Promise(setImmediate);

await act(async () => {
  await flushPromises();
  jest.advanceTimersByTime(2500);
  await flushPromises();
});
```

## Acceptance Criteria

- [ ] All 4 tests are re-enabled (remove `it.skip`)
- [ ] Tests pass consistently in CI (run 10x without failure)
- [ ] Tests pass on both macOS and Windows CI runners
- [ ] No timing-dependent assertions

## Priority

**MEDIUM** - Tests are skipped but functionality is covered by other tests

## Estimate

~15K tokens

## Category

test

## Impact

- Restores full test coverage for useAutoRefresh
- Removes technical debt (skipped tests)
- Improves CI reliability

## Related Items

- BACKLOG-195: Add Test Coverage for Large Hooks
- PR #386: Original test fix PR where these were skipped
