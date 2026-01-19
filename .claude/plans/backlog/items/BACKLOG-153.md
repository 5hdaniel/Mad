# BACKLOG-153: State Machine Email Connection Gap

## Summary

During SPRINT-023 (Architecture Debt Reduction), a gap was discovered in the state machine migration: the `setHasEmailConnected` setter was converted to a no-op, but no action was added to update the state machine when email connection completes during onboarding.

## Root Cause

The state machine migration (BACKLOG-142) made `setHasEmailConnected` a no-op because the state machine should be the source of truth. However:

1. `selectHasEmailConnected` always returned `false` during onboarding status
2. There was no `EMAIL_CONNECTED` action to update the state
3. OAuth callbacks called `setHasEmailConnected(true)` but nothing happened

This caused the Email Connect page to stay stuck on "Connecting..." after successful OAuth.

## Fix Applied

Commit `bcfae68` on 2026-01-04:

1. Added `hasEmailConnected?: boolean` to `OnboardingState` interface
2. Added `EMAIL_CONNECTED` action type to the state machine
3. Updated reducer to handle `EMAIL_CONNECTED`
4. Updated `selectHasEmailConnected` to read from onboarding state
5. Updated `setHasEmailConnected` to dispatch the action
6. Updated OAuth callbacks to pass email/provider

## Files Changed

- `src/appCore/state/machine/types.ts`
- `src/appCore/state/machine/reducer.ts`
- `src/appCore/state/machine/selectors/userDataSelectors.ts`
- `src/appCore/state/flows/useEmailOnboardingApi.ts`
- `src/appCore/state/flows/useEmailHandlers.ts`
- `src/components/onboarding/steps/EmailConnectStep.tsx`

## Lessons Learned

1. **State machine migrations need integration testing** - Unit tests passed but the actual flow was broken
2. **No-op setters need corresponding actions** - When converting setters to no-ops, ensure there's an action path
3. **Test OAuth flows end-to-end** - The OAuth success case wasn't tested after the migration

## Process Violation

This fix was committed directly to `develop` branch instead of using a feature branch with PR review. See BACKLOG-154 for process enforcement.

## Status

- [x] Bug identified
- [x] Root cause analyzed
- [x] Fix implemented
- [x] Tests passing (567 tests)
- [x] Pushed to develop
- [ ] Documented in retrospective

## Related

- SPRINT-023: Architecture Debt Reduction
- BACKLOG-142: State Machine Migration
- BACKLOG-154: Branch Protection Enforcement
