# BACKLOG-648: Onboarding data-sync step stuck for returning users with email connected

## Priority: High
## Category: Bug
## Status: In-Progress

## Summary

Returning users who already have email connected (e.g., agent@izzy on Windows with iPhone) get permanently stuck on the data-sync onboarding step. The screen shows "Ready - Preparing for the next step..." with no way to proceed. The app is effectively unusable for these users.

## Reproduction

1. Set up a user account with email already connected (e.g., agent@izzyrescue.org on Windows with iPhone)
2. Trigger onboarding flow (fresh install or data reset)
3. Reach the data-sync step
4. Observe: screen shows "Ready - Preparing for the next step..." indefinitely
5. No button, no auto-advance, no way to proceed

## Root Cause

SPRINT-070 (PR #744, commit 4e680897) introduced `handleComplete` in `OnboardingFlow.tsx` that calls `app.goToStep("dashboard")`. However, `goToStep` has been a no-op since Jan 3 (commit 2485bc5d) when the state machine was refactored.

The state machine requires `hasCompletedEmailOnboarding` to be true in order to transition from the "onboarding" state to "ready". But for returning users who already have email connected, the email-connect onboarding step is hidden/skipped, so `handleEmailOnboardingComplete()` is never called, and `hasCompletedEmailOnboarding` is never set to true.

This creates a deadlock:
- `handleComplete` calls `goToStep("dashboard")` which is a no-op
- The state machine waits for `hasCompletedEmailOnboarding` which is never set
- The user is permanently stuck

## Fix Plan

1. **Fix 1:** Replace `app.goToStep("dashboard")` in `handleComplete` with a proper state machine dispatch that transitions from onboarding to ready
2. **Fix 2:** Propagate `hasEmailConnected` from `USER_DATA_LOADED` to `OnboardingState` in the reducer, so the state machine knows email is already connected for returning users
3. **Fix 3:** Fix the same no-op `goToStep` bug in the zero-steps effect (another path that calls the dead function)
4. **Fix 4:** Add tests to cover returning-user onboarding scenarios

## Affected Files

- `src/components/onboarding/OnboardingFlow.tsx` - contains the broken `handleComplete` and zero-steps effect
- `src/appCore/state/machine/reducer.ts` - needs to propagate `hasEmailConnected` from user data

## Branch

`fix/onboarding-data-sync-stuck`

## Introduced By

- **Sprint:** SPRINT-070
- **PR:** #744
- **Commit:** 4e680897

## Acceptance Criteria

- [ ] Returning users with email already connected can proceed past the data-sync onboarding step
- [ ] `goToStep` no-op calls are replaced with proper state machine dispatches
- [ ] `hasEmailConnected` from user data is propagated to onboarding state in the reducer
- [ ] Zero-steps effect also uses proper state machine transition (not `goToStep`)
- [ ] Tests cover the returning-user onboarding flow
- [ ] No regression for new users going through full onboarding

## Tags

onboarding, state-machine, returning-users, data-sync, critical-path
