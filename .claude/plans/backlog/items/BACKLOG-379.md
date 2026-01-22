# BACKLOG-379: Continue Setup Button No-Op (goToEmailOnboarding)

**Created**: 2026-01-21
**Priority**: High
**Category**: Bug Fix
**Status**: Pending

---

## Description

The "Continue Setup" button on the Dashboard (which appears when email is not connected) does nothing when clicked. The underlying `goToEmailOnboarding()` function is implemented as a no-op.

## Current Behavior

1. User logs in and reaches Dashboard
2. If email is not connected, "Continue Setup" prompt appears
3. Clicking "Continue Setup" button triggers `goToEmailOnboarding()`
4. Nothing happens - function is a no-op

## Root Cause

In `/Users/daniel/Documents/Mad/src/appCore/state/flows/useNavigationFlow.ts`:
```typescript
const goToEmailOnboarding = useCallback(() => {
  // No-op: state machine drives navigation
}, []);
```

The function was intentionally left as a no-op during the state machine migration, but the Dashboard still uses it expecting actual navigation.

## Expected Behavior

Clicking "Continue Setup" should navigate the user to email onboarding/connection flow.

## Files Affected

| File | Purpose |
|------|---------|
| `src/appCore/state/flows/useNavigationFlow.ts` | Contains the no-op implementation |
| `src/appCore/AppRouter.tsx:151` | Passes `goToEmailOnboarding` to Dashboard |
| `src/components/Dashboard.tsx` | Uses `onContinueSetup` callback |

## Acceptance Criteria

- [ ] "Continue Setup" button navigates user to email connection flow
- [ ] Works for both new users and returning users who haven't connected email
- [ ] Proper state machine transition (if applicable)
- [ ] Button is removed/hidden after email is successfully connected

## Technical Notes

Options:
1. Implement actual navigation in `goToEmailOnboarding()` via state machine dispatch
2. Replace with a direct Settings navigation to email section
3. Open a modal for email connection options

## Related

- BACKLOG-211: Email Onboarding State Mismatch
- BACKLOG-380: hasEmailConnected State Sync Issue
