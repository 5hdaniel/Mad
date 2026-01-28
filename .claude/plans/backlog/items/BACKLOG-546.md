# BACKLOG-546: Returning Users Incorrectly See T&C Acceptance Screen

**Category**: bug
**Priority**: P1 (High - blocks returning user experience)
**Sprint**: SPRINT-062
**Estimated Tokens**: ~15K
**Status**: Pending
**Created**: 2026-01-27
**Source**: User Report

---

## Summary

Returning users are incorrectly shown the Terms & Conditions acceptance screen on session restore. The `isNewUser` flag is being set to `true` for returning users during the `auth:get-current-user` IPC handler response.

## User Report

> "As a returning user I still see 'Welcome, Magicauditwa! Before we get started, please review and accept our terms...' - we need to make sure this is fixed. A returning user should only see it if there are new T&C to approve."

## Root Cause Analysis

The `auth:get-current-user` IPC handler is returning `isNewUser: true` for returning users during session restore. This causes the app state machine to route returning users to the T&C acceptance screen inappropriately.

## Expected Behavior

T&C acceptance screen should ONLY be shown when:
1. User is genuinely new (first login ever), OR
2. There is a new T&C version that the user has not yet accepted

## Current (Buggy) Behavior

T&C screen is shown on every session restore because `isNewUser` is incorrectly `true`.

## Requirements

### Investigation Points

1. Check `auth:get-current-user` handler logic for `isNewUser` determination
2. Verify how session restore vs fresh login is detected
3. Check if T&C version comparison logic exists

### Fix Implementation

1. Fix `isNewUser` flag logic in `auth:get-current-user` handler
   - `isNewUser` should be `false` for session restores
   - `isNewUser` should only be `true` on initial account creation

2. Implement T&C version checking (if not already present)
   - Store accepted T&C version in user profile
   - Compare against current app T&C version
   - Show T&C screen only when versions differ

3. Update app state machine routing logic if needed
   - Route based on: `isNewUser || hasNewTCVersion`

## Acceptance Criteria

- [ ] Returning users do NOT see T&C screen on normal session restore
- [ ] Returning users DO see T&C screen when there is a new T&C version
- [ ] New users still see T&C screen on first login
- [ ] `isNewUser` flag accurately reflects user status
- [ ] Unit tests cover session restore vs new user scenarios

## Related Files (Likely)

- `electron/auth-handlers.ts` - `auth:get-current-user` handler
- `src/appCore/state/machine/` - App state machine routing
- User profile / settings storage for T&C version tracking

## Dependencies

None - standalone bug fix

## Notes

This is a P1 bug affecting all returning users. Should be prioritized for immediate fix in SPRINT-062.
