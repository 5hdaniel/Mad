# TASK-1024: Fix Auth Handler Integration Test

**Backlog ID:** BACKLOG-157
**Sprint:** SPRINT-032
**Phase:** Phase 1 - Critical Test Fixes
**Branch:** `fix/task-1024-auth-handler-test`
**Estimated Tokens:** ~15K
**Token Cap:** 60K

---

## Objective

Fix the failing auth-handlers integration test "should restore session on get-current-user" to achieve 749/749 tests passing.

---

## Context

The auth-handlers integration test has been failing since state machine changes in SPRINT-022/023. The test verifies session restoration functionality which is critical for user experience.

### Current Error

```
electron/__tests__/auth-handlers.integration.test.ts

Test: "should restore session on get-current-user"
Expected: result.success === true
Received: result.success === false
```

### Likely Root Cause

- `handleGetCurrentUser` now checks `databaseService.isInitialized()`
- Test may not be setting up database state correctly
- Session handling was modified during state machine work

---

## Requirements

### Must Do:
1. Run the specific test to confirm current failure state
2. Investigate the test setup and handler implementation
3. Identify what changed that caused the regression
4. Fix the test setup OR the handler (whichever is wrong)
5. Verify session restoration still works in production scenario

### Must NOT Do:
- Skip or mock away the core session restoration logic
- Break session restoration in production
- Change the test to pass without fixing the underlying issue

---

## Acceptance Criteria

- [x] "should restore session on get-current-user" test passes (fixed in TASK-970)
- [x] All auth-handlers tests pass (14/14)
- [x] Session restoration works correctly in dev mode
- [x] No changes that break session restoration in production
- [x] Root cause documented in Implementation Summary

**Note:** This task is a duplicate. All criteria were met by TASK-970/PR #321.

---

## Files to Investigate

- `electron/__tests__/auth-handlers.integration.test.ts` - The failing test
- `electron/handlers/sessionHandlers.ts` - Handler implementation
- `electron/services/databaseService.ts` - Database init check

## Files to Read (for context)

- `electron/handlers/authHandlers.ts` - Related auth handlers
- Recent SPRINT-022/023 PRs that modified session handling

---

## Testing Expectations

### Unit Tests
- **Required:** Fix existing integration test
- **New tests to write:** None expected
- **Existing tests to update:** Fix test setup if needed

### CI Requirements
- [ ] `npm test` passes (749/749)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(tests): resolve auth-handlers integration test failure`
- **Branch:** `fix/task-1024-auth-handler-test`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**Status: DUPLICATE - Already Fixed in TASK-970**

*Completed: 2026-01-11*

### Resolution

This task is a duplicate of TASK-970 which was already completed and merged in PR #321.

**Evidence:**
- Commit `25f1f81`: "fix(test): add isInitialized mock to auth handler integration test"
- PR #321: Merged to develop
- Test is currently passing: 14/14 tests pass in auth-handlers.integration.test.ts

### Root Cause Analysis (from TASK-970)

**What caused the failure:**
The `handleGetCurrentUser` function in `sessionHandlers.ts` checks `databaseService.isInitialized()` before proceeding (line 411). The test mock was missing this method, causing the mock to return undefined (falsy) and trigger an early return with "Database not initialized" error.

**What was changed to fix it:**
Added `isInitialized: jest.fn().mockReturnValue(true)` to the `mockDatabaseService` object in the test file (line 64 of auth-handlers.integration.test.ts).

### Verification

```
npm test -- --testPathPattern="auth-handlers.integration"
# Result: 14/14 tests pass
```

### No PR Required

No new changes needed - the fix was already applied in TASK-970/PR #321.

---

## Guardrails

**STOP and ask PM if:**
- The fix would require removing the database init check entirely
- Session restoration appears broken in production scenario
- You discover the test was testing wrong behavior
- Fix requires changes to state machine logic
- You encounter blockers not covered in the task file
