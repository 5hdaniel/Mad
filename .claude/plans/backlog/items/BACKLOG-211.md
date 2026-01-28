# BACKLOG-211: Email Onboarding State Mismatch Causes Confusing UX

## Problem

When a user has a valid mailbox token but the `email_onboarding_completed` database flag is `false`, the app shows confusing/incorrect UI:

1. **Dashboard shows "All Caught Up"** - AIStatusCard displays this when `pendingCount === 0`, but doesn't account for whether mailbox is actually connected
2. **Settings shows "Connected"** - Because `connectionStatusService` finds the valid mailbox token
3. **Backend says onboarding incomplete** - Because `handleCheckEmailOnboarding` only checks for tokens IF the flag is already true

## Impact

- **User Experience**: Users are confused by contradictory UI states - Settings says connected but Dashboard shows no activity
- **Data Integrity**: No emails are being scanned despite having valid credentials
- **Priority**: High (critical UX bug that leaves users confused about app state)

## Root Cause

In `electron/handlers/sessionHandlers.ts` line ~289:
```typescript
if (onboardingCompleted) {  // <-- Only checks for token IF this flag is true
  const googleToken = await databaseService.getOAuthToken(...);
```

This creates a state where:
1. User connected mailbox and token was saved
2. But `email_onboarding_completed` flag was not set (race condition, error, or flow issue)
3. App thinks onboarding is incomplete, so it doesn't scan for emails
4. User sees "All Caught Up" with no indication they need to reconnect

## Expected Behavior

1. If mailbox token exists, consider email onboarding complete (regardless of flag)
2. Dashboard should show "Connect your email" prompt when no valid mailbox token
3. "All Caught Up" should only show when mailbox IS connected AND no pending transactions

## Affected Files

| File | Purpose |
|------|---------|
| `electron/handlers/sessionHandlers.ts` | `handleCheckEmailOnboarding` logic - needs to check token existence regardless of flag |
| `src/components/dashboard/AIStatusCard.tsx` | Needs mailbox status awareness to show appropriate prompt |
| `src/components/Dashboard.tsx` | May need to pass mailbox status to AIStatusCard |

## Investigation Areas

1. **`handleCheckEmailOnboarding` logic** - Why does it only check token IF flag is true?
2. **When is `email_onboarding_completed` set?** - Find all places that update this flag
3. **Race condition analysis** - Is there a timing issue where token is saved but flag update fails?
4. **AIStatusCard logic** - How can it determine mailbox connection status?

## Proposed Solution

### Option A: Backend-First (Recommended)
1. Modify `handleCheckEmailOnboarding` to check for valid token regardless of flag
2. If token exists and is valid, return `completed: true` and also update the flag for consistency
3. AIStatusCard already shows pending count - if backend reports connected and pending=0, "All Caught Up" is correct

### Option B: Frontend-Aware
1. Add mailbox connection status to Dashboard state
2. Pass to AIStatusCard
3. Show "Connect your email" if not connected, "All Caught Up" only if connected + pending=0

### Option C: Hybrid (Most Robust)
1. Backend fix (Option A)
2. Plus add explicit "no mailbox connected" state to AIStatusCard for defensive UX

## Acceptance Criteria

- [ ] `handleCheckEmailOnboarding` returns `completed: true` if valid mailbox token exists (regardless of flag)
- [ ] If no valid mailbox token exists, Dashboard shows appropriate prompt (not "All Caught Up")
- [ ] "All Caught Up" only displays when mailbox is connected AND no pending items
- [ ] Settings and Dashboard states are consistent
- [ ] Add test coverage for edge cases:
  - Token exists, flag false -> should return completed: true
  - Token expired, flag true -> should handle gracefully
  - No token, flag false -> should return completed: false

## Estimation

- **Category**: service/ui (hybrid)
- **Complexity**: Medium - involves backend logic change + potential UI update
- **Estimated Tokens**: ~35K
- **Files to modify**: 2-3

## Related

- `electron/services/connectionStatusService.ts` - How connection status is determined
- `src/components/settings/SettingsScreen.tsx` - Where "Connected" status is shown
- BACKLOG-139 (Database Init Gate) - Similar state coordination issue pattern

## Notes

- Discovered: 2026-01-12
- Reporter: Testing feedback
- Category: Bug Fix
- Status: Pending
