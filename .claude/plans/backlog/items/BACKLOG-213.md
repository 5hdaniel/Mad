# BACKLOG-213: Recurring "Check Permissions" Screen Bug - THIRD Occurrence

**Status:** Complete
**Priority:** CRITICAL
**Category:** bug/stability
**Created:** 2026-01-12
**Completed:** 2026-01-12
**Occurrences:** 3+ (recurring regression)
**Impact:** Users stuck on permissions screen, cannot use app

---

## Resolution

**Task:** TASK-1033
**PR:** #409
**Fix:** Added `hasPermissions` field to `OnboardingState` and updated `selectHasPermissions()` to read from it.

**Note:** This fix was implemented directly without following the proper workflow (no task file, no engineer agent, no metrics capture). See TASK-1033 for process violation documentation.

---

## Problem Statement

Users are repeatedly getting stuck on the "Check Permissions" (Full Disk Access) screen on macOS, even when they have already granted permissions. This is the THIRD reported occurrence of this bug, indicating the previous fixes were incomplete or have regressed.

---

## Root Cause Analysis

### The Bug Flow

1. User launches app (returning user with FDA already granted)
2. `LoadingOrchestrator` loads user data including permissions check
3. `selectHasPermissions(state)` returns `false` during `onboarding` status
4. `OnboardingFlow` sees `hasPermissions: false` in appState
5. `PermissionsStep.shouldShow(context)` returns `true` (because `!context.permissionsGranted`)
6. User sees permissions screen despite having already granted FDA

### Technical Root Cause: Selector Returns False During Onboarding

**File:** `src/appCore/state/machine/selectors/userDataSelectors.ts` (lines 186-195)

```typescript
export function selectHasPermissions(state: AppState): boolean {
  if (state.status === "ready") {
    return state.userData.hasPermissions;
  }
  if (state.status === "onboarding") {
    // During onboarding, permissions check happens at the permissions step
    return false;  // <-- BUG: Always returns false during onboarding!
  }
  return false;
}
```

**The problem:** The selector ALWAYS returns `false` during onboarding status, regardless of whether the user actually has FDA granted. This is wrong for returning users who:
- Already completed onboarding previously
- Already have FDA granted
- Are being routed through onboarding due to other incomplete steps (e.g., email not connected)

### Why Previous Fixes Didn't Work

The previous fixes addressed symptoms, not the root cause:

| Fix | What It Did | Why It Didn't Work |
|-----|-------------|-------------------|
| TASK-950 | Derive appState from state machine | Still uses `selectHasPermissions` which returns false |
| TASK-110 | Extract PermissionsStep with `shouldShow` | `shouldShow` relies on `permissionsGranted` which comes from the broken selector |
| Various onboarding fixes | Skip steps for returning users | Only works if state machine says permissions are granted |

### The State Machine Gap

The `OnboardingState` type does NOT track permissions status:

```typescript
interface OnboardingState {
  status: "onboarding";
  step: OnboardingStep;
  user: User;
  platform: PlatformInfo;
  completedSteps: OnboardingStep[];
  hasEmailConnected?: boolean;  // <-- Email status tracked
  // hasPermissions?: boolean;   // <-- Permissions NOT tracked!
}
```

Only `ReadyState` has `userData.hasPermissions`. During onboarding, the actual permissions status is lost.

---

## Evidence from Code

### LoadingOrchestrator does check permissions (lines 302-308):

```typescript
// Check permissions (macOS only)
platform.isMacOS
  ? window.api.system.checkPermissions().catch(() => ({
      hasPermission: false,
      fullDiskAccess: false,
    }))
  : Promise.resolve({ hasPermission: true, fullDiskAccess: true }),
```

### But this data is only used in USER_DATA_LOADED dispatch:

The permissions status goes into `UserData`, which is only accessible in `ready` state, not `onboarding` state.

---

## Regression Pattern

| Date | Issue | "Fix" Applied | Regression Cause |
|------|-------|---------------|------------------|
| ~2025-12 | First occurrence | Various onboarding fixes | Incomplete state handling |
| ~2026-01 | Second occurrence | TASK-950 state derivation | Selector design flaw |
| 2026-01-12 | Third occurrence | (this report) | Same underlying issue |

---

## Proposed Solution

### Option A: Track hasPermissions in OnboardingState (Recommended)

1. Add `hasPermissions` field to `OnboardingState` type
2. Populate it during `USER_DATA_LOADED` action when transitioning to onboarding
3. Update `selectHasPermissions` to read from `OnboardingState.hasPermissions`

**Pros:**
- Clean, type-safe solution
- Follows existing pattern (like `hasEmailConnected`)
- Single source of truth

**Cons:**
- Requires state machine type changes
- Requires reducer changes

### Option B: Skip Permissions Step If User Loaded With FDA

1. Pass the actual permissions result through to onboarding context
2. Bypass the selector for returning users
3. Add `permissionsFromLoad?: boolean` to onboarding context

**Pros:**
- Simpler change
- Doesn't modify state machine types

**Cons:**
- Another special case / workaround
- Not as clean

### Option C: Check Permissions Directly in shouldShow

1. Make `PermissionsStep.shouldShow` call `window.api.system.checkPermissions()` directly
2. Cache the result to avoid repeated API calls

**Pros:**
- Always gets fresh permission status
- No state machine changes

**Cons:**
- Async in a sync predicate (needs redesign)
- Violates current architecture
- Band-aid fix

---

## Recommended Fix: Option A

```typescript
// 1. Update OnboardingState in types.ts
export interface OnboardingState {
  status: "onboarding";
  step: OnboardingStep;
  user: User;
  platform: PlatformInfo;
  completedSteps: OnboardingStep[];
  hasEmailConnected?: boolean;
  hasPermissions: boolean;  // ADD THIS
}

// 2. Update USER_DATA_LOADED in reducer.ts
// When transitioning to onboarding, include hasPermissions

// 3. Update selectHasPermissions in userDataSelectors.ts
export function selectHasPermissions(state: AppState): boolean {
  if (state.status === "ready") {
    return state.userData.hasPermissions;
  }
  if (state.status === "onboarding") {
    return state.hasPermissions;  // READ FROM STATE, not hardcoded false
  }
  return false;
}
```

---

## Acceptance Criteria

- [ ] Returning users with FDA granted do NOT see permissions screen
- [ ] New users without FDA DO see permissions screen
- [ ] Permissions status is correctly tracked through onboarding
- [ ] All existing onboarding tests pass
- [ ] Add regression test: returning user with FDA skips permissions step
- [ ] No regressions in new user onboarding flow

---

## Testing Requirements

### Manual Test Cases

1. **Returning user with FDA**: Login -> should go to dashboard (not permissions)
2. **Returning user without FDA**: Login -> should see permissions screen
3. **New user**: Full onboarding flow including permissions
4. **App restart**: After granting FDA, restart should not show permissions

### Automated Test Cases

1. `selectHasPermissions` returns true when `OnboardingState.hasPermissions` is true
2. `PermissionsStep.shouldShow` returns false when permissions already granted
3. Integration test: Returning user with FDA goes to dashboard

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-142 | State Coordination Overhaul | Root initiative |
| BACKLOG-144 | UI Flicker for Returning Users | Related symptom |
| TASK-950 | Fix OnboardingFlow State Derivation | Previous incomplete fix |
| TASK-110 | Extract PermissionsStep | Created shouldShow but relies on broken selector |

---

## Sprint Recommendation

**This should be the TOP priority for the next sprint.**

Given that this is the THIRD occurrence of this user-facing bug:
1. Create a dedicated stability sprint (SPRINT-034?)
2. Make this the first task
3. Include regression tests to prevent future occurrences
4. Consider adding monitoring/logging for permissions state transitions

---

## Estimated Effort

**Category:** fix
**Estimated Tokens:** ~50K
**Token Cap:** 200K

Breakdown:
- Type changes: ~5K
- Reducer changes: ~15K
- Selector changes: ~5K
- Tests: ~20K
- Integration testing: ~5K

---

## Changelog

- 2026-01-12: Created (third occurrence of this bug)
