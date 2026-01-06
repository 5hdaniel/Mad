# Task TASK-804: Fix Flaky appleDriverService Test

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix the flaky test in `appleDriverService.test.ts` that intermittently fails in CI, causing unreliable test runs and blocking PRs.

**Backlog Reference:** BACKLOG-108 - Fix Flaky appleDriverService Test

## Non-Goals

- Do NOT refactor the entire appleDriverService
- Do NOT add new functionality
- Do NOT modify production code unless necessary for the fix

## Deliverables

1. Update: `electron/services/__tests__/appleDriverService.test.ts` - Fix flaky test(s)
2. Optional: Minor fixes to `electron/services/appleDriverService.ts` if test flakiness is caused by race conditions

## Acceptance Criteria

- [x] Identified root cause of flakiness (timing, mocking, async issues)
- [x] Test passes consistently (run 10+ times locally)
- [x] Test passes in CI (verify on PR)
- [x] No reduction in test coverage
- [x] All CI checks pass

## Implementation Notes

### Common Causes of Flaky Tests

1. **Timing/Race Conditions**
   - Use `jest.useFakeTimers()` for time-dependent code
   - Ensure proper `await` on all async operations

2. **Shared State**
   - Reset mocks in `beforeEach`/`afterEach`
   - Don't rely on test execution order

3. **Mock Leakage**
   - Use `jest.resetAllMocks()` or `jest.restoreAllMocks()`
   - Ensure mocks are scoped properly

4. **File System/External Dependencies**
   - Mock all file system operations
   - Don't rely on actual file existence

### Investigation Steps

```typescript
// 1. Identify the flaky test
// 2. Run it in isolation: npm test -- --testPathPattern=appleDriverService
// 3. Run it multiple times: for i in {1..10}; do npm test -- --testPathPattern=appleDriverService; done
// 4. Add console.log to identify where failure occurs
// 5. Check for async operations that aren't awaited
// 6. Check for shared state between tests
```

## Integration Notes

- Part of: SPRINT-011 (Testing Infrastructure)
- Depends on: None
- Blocks: None (but improves CI reliability)

## PR Preparation

- **Title**: `fix(test): resolve flaky appleDriverService test`
- **Labels**: `test`, `bug`, `ci`

---

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2025-12-28 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-804-flaky-apple-driver-test

### Execution Classification
- **Parallel Safe:** YES - no shared files with other SPRINT-011 tasks
- **Depends On:** None
- **Blocks:** None

### Technical Considerations
- Check if test relies on actual file system paths
- Verify mock setup/teardown is complete
- Look for setTimeout/setInterval without fake timers
- Check for process.platform dependencies in tests

---

## PM Estimate

**Category:** `test`

**Estimated Totals:**
- **Turns:** 2-4
- **Tokens:** ~10K-20K
- **Time:** ~30-60m

---

## SR Engineer Review (Post-Implementation)

**Review Date:** 2025-12-30 | **Status:** APPROVED AND MERGED

### PR Details
- **PR:** #256
- **Merge Commit:** 88fc9a47cfa3a0bcc79dfa11e407b738a8b36b6f
- **Merged At:** 2025-12-30T08:11:22Z

### Review Summary
- **Risk Level:** LOW
- **Changes Requested:** None
- **Architecture Impact:** None (test-only change)

### Root Cause Analysis
The flaky test was caused by:
1. Real system calls via `child_process.exec` with 5s timeouts
2. Real file system access via `fs` module
3. Arbitrary `jest.setTimeout(15000)` band-aid instead of proper fix

### Fix Verification
- Proper mocks for `child_process` and `fs` modules
- `beforeEach` with `jest.clearAllMocks()` for test isolation
- `afterAll` with `jest.restoreAllMocks()` for cleanup
- Removed arbitrary timeout hack

### SR Engineer Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Plan Agent | 1 | ~3K | 2 min |
| Code Review | 2 | ~6K | 8 min |
| Feedback Cycles | 0 | 0 | 0 min |
| **SR Total** | 3 | ~9K | 10 min |
