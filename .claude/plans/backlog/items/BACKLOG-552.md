# BACKLOG-552: Show Loading Screen During Return User Session Restore

## Status
- **Priority**: P2
- **Type**: UX Bug
- **Status**: open
- **Created**: 2026-01-27
- **Sprint**: -

## Problem

When a returning user opens the app, there's a brief moment where onboarding screens flash before the app realizes the user is already authenticated. This creates a jarring UX.

**Current flow:**
1. App launches → Loading screen
2. Session restore starts
3. Onboarding screens briefly flash (confusing!)
4. App realizes user is authenticated
5. Redirects to dashboard

**Expected flow:**
1. App launches → Loading screen
2. Session restore (keep loading screen visible)
3. Once session confirmed → Dashboard

## Root Cause

The state machine transitions to showing UI before session validation completes. The onboarding step visibility check happens before the session is fully restored.

## Proposed Fix

Keep the loading screen visible until session validation completes:
1. Add a "validating-session" loading phase
2. Only transition to authenticated/onboarding state after session check completes
3. Show consistent loading spinner during this time

## Files Likely Involved

- `src/appCore/state/machine/reducer.ts`
- `src/appCore/state/machine/LoadingOrchestrator.tsx`
- `src/appCore/state/machine/types.ts`

## Acceptance Criteria

- [ ] Returning users see consistent loading screen until dashboard
- [ ] No onboarding screen flash for authenticated users
- [ ] Loading screen matches pre-login loading design
