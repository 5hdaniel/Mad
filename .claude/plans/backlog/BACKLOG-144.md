# BACKLOG-144: UI Flicker for Returning Users (State Machine Regression)

## Problem

Returning users briefly see onboarding screens flash before reaching the dashboard. This is a regression introduced by the Phase 2 state machine migration (SPRINT-021).

**Reported:** 2026-01-04 during SPRINT-021 manual testing
**Severity:** High (blocks Phase 2 release)
**Type:** Regression

## Expected Behavior

Returning users should go directly from loading → dashboard with no visible onboarding screens.

## Actual Behavior

UI briefly flips through some onboarding screens before settling on dashboard.

## Root Cause Analysis

In `src/appCore/state/machine/reducer.ts`, the `USER_DATA_LOADED` action:

1. Checks `isOnboardingComplete(data, platform)` (line 277)
2. If ANY condition fails, transitions to `status: 'onboarding'`
3. The `deriveAppStep()` then maps this to an onboarding screen

The `isOnboardingComplete()` function (lines 110-132) checks:
- `userData.hasCompletedEmailOnboarding`
- `userData.phoneType`
- `platform.isMacOS && !userData.hasPermissions`

**Hypothesis:** One of these conditions is briefly false during initial data load, causing a transient onboarding state.

## Investigation Steps

1. Add console logging to `USER_DATA_LOADED` handler to see what data is received
2. Check what `isOnboardingComplete()` returns and which condition fails
3. Verify the orchestrator is providing correct userData
4. Compare with legacy path behavior

## Potential Fixes

### Option A: Add Loading Guard

Keep showing loading screen until ALL user data is confirmed loaded:

```typescript
case "USER_DATA_LOADED": {
  // Don't transition until data is fully validated
  if (!data.phoneType && user.terms_accepted_at) {
    // Returning user but phoneType not loaded yet - stay loading
    return state;
  }
  // ... rest of logic
}
```

### Option B: Separate "Loading User Data" Screen

Instead of transitioning through onboarding, show a dedicated loading state.

### Option C: Fix Data Loading Order

Ensure orchestrator waits for ALL data before dispatching USER_DATA_LOADED.

## Files to Investigate

- `src/appCore/state/machine/reducer.ts` - USER_DATA_LOADED handler
- `src/appCore/state/machine/AppStateContext.tsx` - Orchestrator logic
- `src/appCore/state/flows/useNavigationFlow.ts` - deriveAppStep usage

## Priority

**Critical** - Blocks SPRINT-021 merge to develop

## Related

- SPRINT-021: State Machine Migration Phase 2
- BACKLOG-142: State Coordination Root Cause (original architecture design)
