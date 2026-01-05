# TASK-970: Fix Failing Auth Handler Integration Test

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-157
**Status:** Ready
**Estimate:** ~15K tokens
**Token Cap:** 60K

---

## Context

The auth-handlers integration test "should restore session on get-current-user" is failing after recent state machine changes.

## Problem

```
electron/__tests__/auth-handlers.integration.test.ts:431

expect(result.success).toBe(true);
Expected: true
Received: false
```

## Likely Cause

Recent changes added `databaseService.isInitialized()` check to `handleGetCurrentUser`. The test may not be properly setting up the database mock state.

## Deliverables

1. **Investigate** - Read the failing test and handler code
2. **Identify** - Determine if issue is in test setup or production code
3. **Fix** - Update test mock or fix handler logic
4. **Verify** - All 749 tests pass

## Files to Modify

- `electron/__tests__/auth-handlers.integration.test.ts`
- `electron/handlers/sessionHandlers.ts` (if needed)

## Branch

```bash
git checkout -b fix/TASK-970-auth-handler-test develop
```

## Testing

```bash
npm test -- --testPathPattern=auth-handlers
```

## Acceptance Criteria

- [x] Test passes
- [x] All 749 tests pass (pre-existing vacuum test failure on develop unrelated to this fix)
- [x] No production behavior changes (unless bug found)

---

## Implementation Summary

### Root Cause
The `handleGetCurrentUser` function in `sessionHandlers.ts` (line 411) checks `databaseService.isInitialized()` before proceeding. The test mock for `mockDatabaseService` did not include this method, causing the mock to return `undefined` (falsy), which triggered an early return with "Database not initialized" error.

### Fix Applied
Added `isInitialized: jest.fn().mockReturnValue(true)` to the `mockDatabaseService` object in `auth-handlers.integration.test.ts`.

### Files Modified
- `electron/__tests__/auth-handlers.integration.test.ts` (line 64)

### Testing Results
- All 66 auth-handler tests pass
- Full test suite: 823 passed, 1 failed (pre-existing vacuum test failure on develop)

### Note on Pre-existing Test Failure
The `databaseService.test.ts` vacuum test failure exists on develop before this change. Verified by stashing changes and running the test on clean develop branch.

## Engineer Metrics

**Agent ID:** engineer-task-970

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 15K) / 15K × 100]_%
