# Task TASK-955: Skip Onboarding for Returning Users

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

**Priority:** CRITICAL - User-reported bug, blocks sprint completion

---

## Goal

Prevent onboarding screens from rendering at all for returning users who have already completed onboarding. The flow should be:

1. User auth successful
2. Loading screen while determining user state
3. If returning user with completed onboarding → Go directly to main app
4. If new user OR missing required data → Show only relevant onboarding steps

## Problem

Currently, returning users who restart the app see brief flashes of:
- "Full Disk Access Required" (even though permissions are granted)
- "What phone do you use?" (even though already selected)
- Secure Storage Setup (if not explicitly dismissed)

This happens because `OnboardingFlow` renders and cycles through steps before the correct state is determined.

## Root Cause Analysis

The issue is in how we determine whether to show onboarding. Currently:

1. `AppRouter.tsx` decides to render `OnboardingFlow` based on `app.needsOnboarding`
2. `OnboardingFlow` renders and determines which step to show
3. During initial load, state is incomplete → wrong steps briefly appear

**The fix:** Determine onboarding necessity BEFORE rendering, not during.

## Desired Flow

```
Auth Success
    │
    ▼
LoadingScreen (while checking state)
    │
    ├─► Returning User (has phoneType, hasPermissions, hasSecureStorage, hasEmailConnected)
    │       │
    │       ▼
    │   Check Terms → New terms? → Show Terms Only → Main App
    │                     │
    │                     └─► No new terms → Main App
    │
    └─► New User OR Missing Required Data
            │
            ▼
        OnboardingFlow (only missing steps)
```

## Deliverables

1. Update state machine to properly track "onboarding complete" status
2. Ensure `needsOnboarding` is false for returning users with complete data
3. Only render OnboardingFlow when genuinely needed
4. Add proper loading state during user status determination

## Files to Investigate

- `src/AppRouter.tsx` - Where onboarding rendering decision is made
- `src/appCore/state/useAppStateMachine.ts` - Where `needsOnboarding` is determined
- `src/appCore/state/machine/` - State machine logic
- `src/components/onboarding/OnboardingFlow.tsx` - Step filtering logic

## Acceptance Criteria

- [ ] Returning user sees loading screen, then main app (no onboarding flashes)
- [ ] New user sees full onboarding flow correctly
- [ ] User with revoked permissions sees only permissions step
- [ ] User with new terms to accept sees only terms step
- [ ] All existing tests pass

## PR Preparation

- **Title**: `fix(onboarding): skip onboarding for returning users`
- **Branch From**: `develop`
- **Branch Into**: `develop`
- **Branch Name**: `fix/TASK-955-skip-onboarding-returning-user`

---

## PM Estimate (PM-Owned)

**Category:** `fix`

**Estimated Tokens:** ~60K (requires investigation + architectural change)

**Token Cap:** 240K

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED
**Review Date:** 2026-01-04

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `fix/TASK-955-skip-onboarding-returning-user`

### Technical Notes

The key insight is that `needsOnboarding` must be determined from persisted state (database/localStorage) BEFORE rendering, not derived from React state that starts empty.

Check:
1. How `needsOnboarding` is currently computed in `useAppStateMachine.ts`
2. Whether the state machine's initial state correctly reflects persisted user data
3. The timing of when `status: "ready"` vs `status: "onboarding"` is set

---

## Implementation Summary (Engineer-Owned)

### Root Cause

The issue was two-fold:
1. **PermissionsStep** had no `shouldShow` condition, so it would render for ALL macOS users regardless of whether they already had permissions
2. **OnboardingFlow** was rendering its UI before the effect-based navigation could redirect returning users to dashboard

### Changes Made

1. **PermissionsStep.tsx** - Added `shouldShow` condition:
   ```typescript
   shouldShow: (context) => !context.permissionsGranted
   ```
   Now returning users with FDA already granted skip this step entirely.

2. **OnboardingFlow.tsx** - Enhanced the early return guard:
   - Moved the `if (steps.length === 0 || !currentStep)` check AFTER hooks but BEFORE rendering
   - Returns `null` immediately when no visible steps exist
   - The useEffect still handles navigation to dashboard, but now nothing renders during that transition

3. **steps.test.tsx** - Updated tests:
   - Fixed mock context to match actual `OnboardingContext` interface
   - Added tests for `PermissionsStep.meta.shouldShow`
   - Added tests for `PhoneTypeStep.meta.shouldShow` (documenting existing behavior)

### Why This Fixes the Flicker

Previously:
1. OnboardingFlow renders
2. Steps are filtered (returning user has everything complete)
3. Effect runs, navigates to dashboard
4. OnboardingFlow unmounts

**User sees**: Brief flash of onboarding UI

Now:
1. OnboardingFlow checks steps.length === 0
2. Returns null immediately (no UI)
3. Effect runs, navigates to dashboard

**User sees**: Loading screen -> Dashboard (no onboarding flash)

### Files Modified

| File | Change |
|------|--------|
| `src/components/onboarding/steps/PermissionsStep.tsx` | Added `shouldShow` condition |
| `src/components/onboarding/OnboardingFlow.tsx` | Enhanced early return for empty steps |
| `src/components/onboarding/__tests__/steps.test.tsx` | Updated mock context, added shouldShow tests |

### Quality Gates

- [x] TypeScript passes
- [x] ESLint passes
- [x] All tests pass (94 onboarding tests, 562 appCore tests)
