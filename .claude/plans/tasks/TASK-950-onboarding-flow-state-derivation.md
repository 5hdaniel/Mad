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

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `fix/TASK-950-onboarding-state-derivation`

### Priority

**CRITICAL** - Completes the state machine migration (BACKLOG-142 Phase 3)

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
