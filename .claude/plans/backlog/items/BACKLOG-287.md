# BACKLOG-287: Dashboard Visible After Logout (Security Issue)

## Category
Security, Authentication

## Priority
**CRITICAL**

## Status
Completed (PR #437 merged 2026-01-16)

## Description

After logging out, the user can still see the dashboard. This is a security vulnerability - authenticated content should not be visible after logout.

## Steps to Reproduce

1. Log in to the application
2. Navigate to dashboard
3. Log out
4. Dashboard is still visible (should redirect to login or show unauthenticated state)

## Expected Behavior

After logout:
- User should be redirected to login screen
- All authenticated routes should be inaccessible
- Session data should be cleared
- Cached data should not be displayed

## Actual Behavior

Dashboard remains visible after logout, BUT:
- "Browse Transactions" button doesn't work
- "Manage Contacts" button doesn't work
- "Start New Audit" button doesn't work

This suggests the **session IS cleared** (API calls fail), but the **UI state is stale** (React state not reset, or route guard not triggering).

## Potential Root Causes

1. **State machine not transitioning** - App state machine may not be updating to `unauthenticated` state
2. **Route protection failing** - Protected routes may not be checking auth state correctly
3. **Session not cleared** - Token/session may still be in memory or storage
4. **React state caching** - Component state may persist across auth transitions
5. **OAuth session not revoked** - External provider session may still be active

## Investigation Steps

1. Check `useAppStateMachine.ts` - verify logout transitions state correctly
2. Check route guards in `AppRouter.tsx` - verify auth checks
3. Check logout handler in `authBridge.ts` / `auth-handlers.ts`
4. Check if `system:initialize-secure-storage` clears sessions properly
5. Check for cached React Query data that persists

## Files Likely Involved

- `src/hooks/useAppStateMachine.ts` - State machine transitions
- `src/components/AppRouter.tsx` - Route protection
- `electron/auth-handlers.ts` - Logout handler
- `electron/preload/authBridge.ts` - Auth bridge
- `src/services/authService.ts` - Client-side auth

## Acceptance Criteria

- [ ] Logout clears all session data
- [ ] User is redirected to login after logout
- [ ] Dashboard is not accessible without authentication
- [ ] Refreshing page after logout shows login screen
- [ ] No cached data visible after logout

## Security Impact

**HIGH** - Unauthorized access to user data if device is shared or stolen after logout.

## Related

- Authentication flow
- Session management
- Route protection

## Created
2026-01-15

## Reported By
User (manual testing)
