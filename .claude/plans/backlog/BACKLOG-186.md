# BACKLOG-186: Continue Button Not Working After Import Complete

## Status: Completed (SPRINT-027)

## Summary

After message import completed successfully, clicking the "Continue" button did nothing. Users were stuck on the permissions step with no way to proceed to the dashboard.

## Root Cause

The `goToStep("dashboard")` function is a no-op when the state machine is enabled. The permissions step was using the legacy navigation pattern which bypasses the state machine. Navigation must happen via the state machine dispatch function.

## Solution

Added `stateMachineDispatch` prop to `usePermissionsFlow` hook and dispatch the `ONBOARDING_STEP_COMPLETE` action with `step: "permissions"` to properly notify the state machine that the permissions step is complete. This triggers the correct state transition to the dashboard.

## Files Changed

- `src/appCore/state/flows/usePermissionsFlow.ts` - Added `stateMachineDispatch` prop and dispatch logic
- `src/appCore/state/useAppStateMachine.ts` - Connected dispatch to permissions flow

## Impact

- **Severity**: Critical - Blocked onboarding completion entirely
- **User Impact**: Users could not proceed past permissions step to dashboard
- **Discovery**: User testing during SPRINT-027

## Category

`fix`

## Priority

Critical

## Sprint

SPRINT-027 (Messages & Contacts Polish)

## PR/Commit

Direct commit to `fix/messages-display-issues` branch

## Estimated Tokens

~5K

## Related Items

- Part of permissions step improvements in SPRINT-027
- Related to BACKLOG-142 (State Coordination Overhaul) - this is a side effect of the state machine migration
