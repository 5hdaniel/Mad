# BACKLOG-157: Fix Failing Auth Handler Integration Test

## Summary

The auth-handlers integration test "should restore session on get-current-user" is failing, causing CI to report 748/749 tests passing.

## Problem

```
electron/__tests__/auth-handlers.integration.test.ts

Test: "should restore session on get-current-user"
Expected: result.success === true
Received: result.success === false
```

## Root Cause (Investigation Needed)

Likely related to recent state machine changes:
- SPRINT-022/023 modified session handling
- `handleGetCurrentUser` now checks `databaseService.isInitialized()`
- Test may not be setting up database state correctly

## Files to Investigate

- `electron/__tests__/auth-handlers.integration.test.ts` - The failing test
- `electron/handlers/sessionHandlers.ts` - Handler implementation
- `electron/services/databaseService.ts` - Database init check

## Acceptance Criteria

- [ ] All 749 tests pass
- [ ] No changes that break session restoration in production
- [ ] Test properly mocks database state if needed

## Priority

**HIGH** - Blocking CI, must fix before adding more tests

## Estimate

~15K tokens

## Category

test/fix
