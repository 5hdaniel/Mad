# BACKLOG-550: FDA Onboarding Step Loops When App Loses/Regains Focus

## Status
- **Priority**: P2
- **Type**: Bug
- **Status**: open
- **Created**: 2026-01-27
- **Sprint**: -

## Problem

When going through the FDA (Full Disk Access) permission step in onboarding, clicking in and out of the app (losing and regaining focus) causes the step to loop back to the beginning.

**Symptoms:**
- User completes instruction steps 1-5 (Open System Settings, Find Privacy & Security, etc.)
- User clicks outside the app, then clicks back
- Step resets to "Grant Full Disk Access" intro screen (step 0)
- User has to redo all instruction steps

## Root Cause

The `PermissionsStep` component stores instruction progress in local React state (`currentInstructionStep`, `completedSteps`). When the app loses/regains focus:

1. `usePermissionsFlow` hook re-checks permissions via `window.api.system.checkAllPermissions()`
2. If the check momentarily returns false, `hasPermissions` flips
3. The `shouldShow` check on the permissions step (`!context.permissionsGranted`) changes
4. This may cause the step to unmount/remount, resetting local state

**Key files:**
- `src/components/onboarding/steps/PermissionsStep.tsx` (lines 181-183 - local state)
- `src/appCore/state/flows/usePermissionsFlow.ts` (lines 43-54 - permission check)
- `src/components/onboarding/hooks/useOnboardingFlow.ts` (lines 177-185 - step filtering)

## Proposed Fix

Options (in order of preference):

1. **Debounce/sticky permissions state**: Don't flip `hasPermissions` to false if it was recently true (e.g., within 5 seconds). Prevents flapping during focus changes.

2. **Persist instruction step state**: Store `currentInstructionStep` and `completedSteps` in a higher-level context or localStorage instead of local component state.

3. **Don't re-filter steps on context change**: Once a step is shown, don't hide it based on `shouldShow` until explicitly completed.

## Acceptance Criteria

- [ ] User can complete FDA onboarding without loop when clicking in/out of app
- [ ] Instruction step progress is preserved across focus changes
- [ ] Works for both first-time and returning users

## Related

- BACKLOG-549: Simplify database encryption key storage architecture
- TASK-1506B: Fix keychain timing for first-time macOS users
