# BACKLOG-118: Fix OnboardingFlow React Hooks Order Bug

## Priority: High

## Category: ui

## Summary

The `OnboardingFlow.tsx` component has a React hooks order violation that causes a "Rendered fewer hooks than expected" error after connecting a mailbox during onboarding.

## Problem

### Root Cause

In `OnboardingFlow.tsx`, the `useCallback(handleStepAction)` hook is placed AFTER an early return guard:

```typescript
// Line 178-181: Early return BEFORE the useCallback hook
if (!currentStep) {
  return null;
}

// ... more code ...

// Line 190-196: This useCallback hook is AFTER the conditional return
const handleStepAction = useCallback(
  (action: StepAction) => {
    flowHandleAction(action);
  },
  [flowHandleAction]
);
```

### Why This Causes the Error

1. On initial render (before mailbox connect): All hooks run, including `handleStepAction`
2. After mailbox connects: `appState.emailConnected` becomes `true`
3. Steps are filtered, and `currentStep` becomes `undefined`
4. Early return triggers BEFORE `handleStepAction` useCallback
5. React detects fewer hooks than previous render = ERROR

### When This Occurs

- After connecting a Google or Microsoft mailbox during onboarding
- When all remaining onboarding steps are filtered out (user already complete)
- Any scenario where `currentStep` becomes undefined mid-session

## Solution

Move the `handleStepAction` useCallback BEFORE the early return guard:

```typescript
// Action handler - MUST be before any early return
const handleStepAction = useCallback(
  (action: StepAction) => {
    flowHandleAction(action);
  },
  [flowHandleAction]
);

// NOW the guard is safe - all hooks have been called
if (!currentStep) {
  return null;
}
```

## Implementation Status

**Fixed in:** `src/components/onboarding/OnboardingFlow.tsx`

The fix moved `handleStepAction` useCallback from line 190-196 to line 178-186, placing it before the `if (!currentStep)` guard.

## Acceptance Criteria

- [x] `handleStepAction` useCallback moved before early return
- [x] `npm run type-check` passes
- [x] No lint errors introduced
- [ ] Manual test: Connect mailbox during onboarding without crash
- [ ] Manual test: Return as existing user with email connected

## Estimated Effort

| Metric | Estimate | Actual | Notes |
|--------|----------|--------|-------|
| Turns | 1-2 | 1 | Simple hook reorder |
| Tokens | ~10K | ~8K | |
| Time | 15m | 10m | |

**Variance:** -50%

## Dependencies

- None (standalone fix)

## Related Items

| ID | Title | Relationship |
|----|-------|--------------|
| PR #242 | hotfix/preload-sandbox-and-login-flow | Discovered during testing |

## Technical Notes

### React Rules of Hooks

React requires hooks to be called in the same order on every render. This rule exists because React tracks hooks by their call order, not by name.

**Rule:** Never place hooks after conditional returns.

### Pattern to Follow

```typescript
// CORRECT: All hooks before any conditional return
const [state, setState] = useState();
const memoizedValue = useMemo(() => compute(), []);
const callback = useCallback(() => {}, []);

// Now guards are safe
if (!data) return null;

// Render logic
return <div>{data}</div>;
```

## Notes

This bug was discovered during testing of BACKLOG-117 (Sprint 009 Auth Regressions). After fixing the Google login flow, the OnboardingFlow component started crashing when the mailbox connection completed.

**Files changed:**
- `src/components/onboarding/OnboardingFlow.tsx` - Moved useCallback before early return
