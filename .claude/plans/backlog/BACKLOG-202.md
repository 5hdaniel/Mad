# BACKLOG-202: Fix Test Regressions in contact-handlers and databaseService

## Summary

Fix test regressions in `electron/__tests__/contact-handlers.test.ts` and `electron/services/__tests__/databaseService.test.ts` that are causing CI failures.

## Problem

Test regressions have been introduced, causing CI to fail. These tests cover critical functionality:
- **contact-handlers.test.ts** - Tests for contact IPC handlers
- **databaseService.test.ts** - Tests for core database operations

These regressions may have been introduced during recent sprints (SPRINT-027 through SPRINT-031) involving state machine changes, database initialization gates, or message import features.

## Files to Investigate

- `electron/__tests__/contact-handlers.test.ts` - Contact handler tests
- `electron/services/__tests__/databaseService.test.ts` - Database service tests
- `electron/handlers/contactHandlers.ts` - Contact handler implementation
- `electron/services/databaseService.ts` - Database service implementation

## Root Cause Analysis Needed

1. Identify which tests are failing
2. Determine when regression was introduced (git bisect if needed)
3. Verify if test expectations or implementation changed
4. Fix either the test or the underlying implementation bug

## Acceptance Criteria

- [ ] All contact-handler tests pass
- [ ] All databaseService tests pass
- [ ] No regressions in other tests
- [ ] CI passes completely
- [ ] Root cause documented in task file

## Priority

**CRITICAL** - Test failures block CI and can mask other issues

## Estimate

~20K tokens (investigation + fix)

## Category

test/fix

## Impact

- Unblocks CI pipeline
- Ensures database and contact operations work correctly
- Prevents regressions from going unnoticed

## Dependencies

None - should be fixed immediately

## Related Items

- BACKLOG-157: Fix Failing Auth Handler Integration Test (similar pattern)
- BACKLOG-191: Add Test Coverage for Core Service Layer
