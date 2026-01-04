# Task TASK-950: Fix OnboardingFlow to Derive State from State Machine

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix `OnboardingFlow` component to derive `appState` from the state machine when enabled, instead of reading from legacy `useAppStateMachine` properties that have stale/incomplete data.

## Problem

When app restarts with pending OAuth (returning user), `OnboardingFlow` builds `appState` from legacy app properties which are initially empty/default. This causes the steps filter to briefly show wrong steps (phone-type, permissions, etc.) before the correct step (email-connect) is displayed.

**Symptoms:**
- Returning users see onboarding screens rapidly cycle through before landing on correct step
- Fresh logout → login works fine (no pending OAuth path)
- App restart with existing session shows the cycling

## Root Cause

In `src/components/onboarding/OnboardingFlow.tsx` lines 39-51:

```typescript
const appState: OnboardingAppState = {
  phoneType: app.selectedPhoneType,        // Legacy - stale initially
  hasPermissions: app.hasPermissions,      // Legacy - stale initially
  hasSecureStorage: app.hasSecureStorageSetup,
  // ...
};
```

The state machine correctly determines `step: 'email-connect'`, but the steps filter uses `appState` which has `phoneType: null`, so it includes `phone-type` step in the list.

## Deliverables

1. Update `src/components/onboarding/OnboardingFlow.tsx` to derive `appState` from state machine
2. Add tests verifying correct step derivation

## Implementation Notes

See PR #304 for initial implementation attempt: https://github.com/5hdaniel/Mad/pull/304

Key approach:
```typescript
const machineState = useOptionalMachineState();

const appState: OnboardingAppState = useMemo(() => {
  if (machineState) {
    const { state } = machineState;
    return {
      phoneType: selectPhoneType(state),
      hasPermissions: selectHasPermissions(state),
      // ... derive from state machine
    };
  }
  // Legacy fallback
  return { phoneType: app.selectedPhoneType, ... };
}, [machineState, app]);
```

## Acceptance Criteria

- [ ] Returning users go directly to correct onboarding step (no cycling)
- [ ] New users still see full onboarding flow correctly
- [ ] All existing tests pass
- [ ] Feature flag toggle still works

## PR Preparation

- **Title**: `fix(onboarding): derive appState from state machine`
- **Branch From**: `develop`
- **Branch Into**: `develop`
- **Branch Name**: `fix/TASK-950-onboarding-state-derivation`

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED
**Review Date:** 2026-01-04

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `fix/TASK-950-onboarding-state-derivation`

### Priority

**CRITICAL** - Completes the state machine migration (BACKLOG-142 Phase 3)

### Technical Notes (SPRINT-022 Review)

**IMPORTANT: Missing Selector**

The `selectHasPermissions` selector referenced in the implementation notes does not exist yet. You must create it as part of this task.

Add to `src/appCore/state/machine/selectors/userDataSelectors.ts`:

```typescript
/**
 * Returns true if user has macOS Full Disk Access permissions.
 * Only relevant for macOS; always false for other platforms or during loading.
 *
 * @param state - Current application state
 * @returns true if user has granted permissions
 */
export function selectHasPermissions(state: AppState): boolean {
  if (state.status === "ready") {
    return state.userData.hasPermissions;
  }
  if (state.status === "onboarding") {
    // During onboarding, permissions check happens at the permissions step
    return false;
  }
  return false;
}
```

Also export from `src/appCore/state/machine/selectors/index.ts`.

**Other Required Selectors (already exist):**
- `selectPhoneType` - EXISTS
- `selectHasEmailConnected` - EXISTS
- `selectHasCompletedEmailOnboarding` - EXISTS

---

## PM Estimate

**Category:** `fix`
**Estimated Tokens:** ~40K
**Token Cap:** 160K

---

## Related

- BACKLOG-144: UI Flicker for Returning Users
- TASK-948: Fix Returning User UI Flicker (partial fix - LoadingOrchestrator)
- PR #304: Initial implementation (may need rebasing)

---

## Implementation Summary

**Status:** COMPLETED
**Date:** 2026-01-04

### Changes Made

1. **Created `selectHasPermissions` selector** (`src/appCore/state/machine/selectors/userDataSelectors.ts`)
   - Returns `true` when ready state has `userData.hasPermissions` true
   - Returns `false` during onboarding, loading, or error states
   - Follows existing selector patterns

2. **Updated `OnboardingFlow.tsx`** to derive `appState` from state machine
   - Added `useOptionalMachineState()` hook to access state machine state
   - Wrapped `appState` construction in `useMemo` for performance
   - When state machine is enabled: derives `phoneType`, `emailConnected`, `hasPermissions`, `isDatabaseInitialized` from state machine selectors
   - When state machine is disabled: falls back to legacy `app` properties

3. **Added comprehensive tests** for `selectHasPermissions` and `selectHasEmailConnected`
   - Tests all state types: ready, loading, onboarding, error, unauthenticated
   - Verifies correct behavior in each scenario

### Files Modified

- `src/appCore/state/machine/selectors/userDataSelectors.ts` - Added `selectHasPermissions`
- `src/components/onboarding/OnboardingFlow.tsx` - State machine derivation
- `src/appCore/state/machine/selectors/userDataSelectors.test.ts` - Added tests

### Quality Gates

- [x] TypeScript check passes
- [x] ESLint passes
- [x] All onboarding and selector tests pass (140 tests)
- [x] Selector exports verified (via barrel export)

### Deviations

None. Implementation follows the approach outlined in the task file and PR #304.

### Engineer Checklist

- [x] Created branch from develop
- [x] Implemented all deliverables
- [x] Added tests for new selector
- [x] All quality gates pass
- [x] Task file updated with implementation summary
- [x] PR created: #307
- [x] Ready for SR Engineer review
