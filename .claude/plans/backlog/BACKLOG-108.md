# BACKLOG-108: Fix Flaky appleDriverService Test

## Priority: Critical

## Category: test

## Summary

Fix the flaky test in `appleDriverService` that times out at the 5000ms default timeout due to async installation checks taking longer than expected.

## Problem

The `appleDriverService` test suite has a flaky test that intermittently times out. The default Jest timeout of 5000ms is insufficient for the async driver installation verification checks, which can take longer on some systems or under load.

**Symptoms:**
- Test passes most of the time but occasionally times out
- More frequent failures on slower CI runners or under load
- Error message: `Async callback was not invoked within the 5000 ms timeout`

## Solution

Increase the timeout for the specific tests that perform async installation checks.

### Option 1: Test-Level Timeout (Recommended)

```typescript
it('should verify driver installation', async () => {
  // test implementation
}, 15000); // 15-second timeout for this specific test
```

### Option 2: Describe Block Timeout

```typescript
describe('appleDriverService', () => {
  jest.setTimeout(15000); // All tests in this describe block

  // tests...
});
```

### Option 3: Mock Slow Operations

If the async check is testing external system calls, consider mocking them for faster, more reliable tests:

```typescript
jest.mock('../path/to/driver-check', () => ({
  checkDriverInstallation: jest.fn().mockResolvedValue(true)
}));
```

## Implementation Steps

1. Locate the flaky test in `appleDriverService.test.ts`
2. Identify which specific test(s) are timing out
3. Apply appropriate timeout increase
4. Verify fix by running the test multiple times
5. Consider adding a note about why the extended timeout is needed

## Acceptance Criteria

- [ ] Flaky test no longer times out
- [ ] Test passes reliably (10+ consecutive runs)
- [ ] No unnecessary timeouts added to other tests
- [ ] Comment added explaining the extended timeout if applicable
- [ ] `npm test` passes consistently

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 2-4 | Simple fix once located |
| Tokens | ~10K | |
| Time | 1-2 hours | Includes verification |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Hiding actual performance issues | Document expected timing |
| Increasing overall test suite time | Only increase timeout where needed |

## Notes

**This item is SR Engineer sourced from test reliability audit.**

This is a quick win that should be prioritized to improve CI reliability. The fix is straightforward but important for maintaining developer trust in the test suite.

**Files to investigate:**
- `electron/services/__tests__/appleDriverService.test.ts`
- Or wherever `appleDriverService` tests are located
