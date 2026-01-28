# TASK-1513: Fix Onboarding Loop Bug

## Status: Ready

## Summary

Fix the onboarding loop where users get stuck cycling between phone-type and email-connect steps. This was introduced by SPRINT-062 changes.

## Root Cause

The `useOnboardingFlow` hook uses **index-based tracking** (`currentIndex`) which becomes stale when the `steps` array is dynamically filtered:

1. User is at index 1 (email-connect step)
2. Email OAuth completes → `context.emailConnected = true`
3. `steps` array recomputes → email-connect is filtered out (shouldShow returns false)
4. New `steps = [phone-type, secure-storage, ...]`
5. `currentIndex` still = 1, but `steps[1]` is now `secure-storage`
6. Navigation behaves unexpectedly, causing loop

## Solution

Convert from index-based to **ID-based step tracking**:

1. Track `currentStepId` instead of `currentIndex`
2. Derive `currentIndex` from `currentStepId` using `useMemo`
3. Add `useEffect` to advance to next step when current step is filtered out
4. Update `goToNext`, `goToPrevious` to use `setCurrentStepId`

## Files to Modify

| File | Change |
|------|--------|
| `src/components/onboarding/hooks/useOnboardingFlow.ts` | Main fix: ID-based tracking |
| `src/components/onboarding/OnboardingFlow.tsx` | Minor: memoize `initialStepId` |

## Implementation Details

### useOnboardingFlow.ts Changes

Replace lines 188-198:

```typescript
// BEFORE: Index-based (broken)
const [currentIndex, setCurrentIndex] = useState(() => {
  if (initialStepId) {
    const idIndex = steps.findIndex((s) => s.meta.id === initialStepId);
    if (idIndex >= 0) return idIndex;
  }
  return Math.min(Math.max(0, initialStepIndex), Math.max(0, steps.length - 1));
});

// AFTER: ID-based tracking
const [currentStepId, setCurrentStepId] = useState<string | null>(() => {
  if (initialStepId) {
    const step = steps.find(s => s.meta.id === initialStepId);
    if (step) return step.meta.id;
  }
  return steps[0]?.meta.id ?? null;
});
```

Add index derivation:

```typescript
// Derive index from ID - handles array changes automatically
const currentIndex = useMemo(() => {
  if (!currentStepId) return 0;
  const idx = steps.findIndex(s => s.meta.id === currentStepId);
  if (idx >= 0) return idx;

  // Current step was filtered out - find next available step
  const allIdx = allSteps.findIndex(s => s.meta.id === currentStepId);
  for (let i = allIdx + 1; i < allSteps.length; i++) {
    const nextIdx = steps.findIndex(s => s.meta.id === allSteps[i].meta.id);
    if (nextIdx >= 0) return nextIdx;
  }
  return Math.max(0, steps.length - 1);
}, [currentStepId, steps, allSteps]);
```

Add effect for when step is filtered out:

```typescript
// Effect to update currentStepId when current step is filtered out
useEffect(() => {
  if (!currentStepId || steps.length === 0) return;

  const exists = steps.some(s => s.meta.id === currentStepId);
  if (!exists) {
    // Step was filtered - find and set next available step
    const allIdx = allSteps.findIndex(s => s.meta.id === currentStepId);
    for (let i = allIdx + 1; i < allSteps.length; i++) {
      const nextStep = steps.find(s => s.meta.id === allSteps[i].meta.id);
      if (nextStep) {
        setCurrentStepId(nextStep.meta.id);
        return;
      }
    }
    // No next step - go to last available
    setCurrentStepId(steps[steps.length - 1]?.meta.id ?? null);
  }
}, [currentStepId, steps, allSteps]);
```

Update navigation functions:

```typescript
// goToNext - use step ID
const goToNext = useCallback(() => {
  if (currentIndex < steps.length - 1) {
    setCurrentStepId(steps[currentIndex + 1].meta.id);
  } else {
    onComplete?.();
  }
}, [currentIndex, steps, onComplete]);

// goToPrevious - use step ID
const goToPrevious = useCallback(() => {
  if (currentIndex > 0) {
    setCurrentStepId(steps[currentIndex - 1].meta.id);
  }
}, [currentIndex, steps]);

// goToStep - use step ID
const goToStep = useCallback((stepId: OnboardingStepId) => {
  const step = steps.find(s => s.meta.id === stepId);
  if (step) {
    setCurrentStepId(step.meta.id);
  } else {
    console.warn(`[Onboarding] Step "${stepId}" not found in current flow`);
  }
}, [steps]);
```

### OnboardingFlow.tsx Changes (Optional)

Memoize `initialStepId` to only compute once at mount:

```typescript
// BEFORE
const getInitialStepId = (): string | undefined => {
  const stepMap: Record<string, string> = { ... };
  return stepMap[app.currentStep];
};

// AFTER
const initialStepId = useMemo(() => {
  const stepMap: Record<string, string> = {
    "phone-type-selection": "phone-type",
    "keychain-explanation": "secure-storage",
    "email-onboarding": "email-connect",
    "permissions": "permissions",
    "apple-driver-setup": "apple-driver",
    "android-coming-soon": "android-coming-soon",
  };
  return stepMap[app.currentStep];
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Empty deps = mount only
```

## Acceptance Criteria

- [ ] First-time users complete onboarding without loops
- [ ] Returning users complete onboarding without loops
- [ ] Email OAuth completion advances flow (doesn't reset)
- [ ] Phone selection advances flow (doesn't reset)
- [ ] Secure storage step triggers DB init correctly
- [ ] All existing tests pass
- [ ] TypeScript compiles without errors

## Testing

### Manual Tests

1. **First-Time macOS User**
   - Delete `~/Library/Application Support/magic-audit`
   - Delete keychain: `security delete-generic-password -s "magic-audit Safe Storage"`
   - Run `npm run dev`
   - Verify: Phone → Email → Secure Storage → Permissions → Dashboard

2. **Returning User**
   - Have user who logged in but didn't complete email setup
   - Launch app
   - Verify: Resume at correct step, no loop

3. **Email Connection**
   - Start fresh, reach email-connect step
   - Complete OAuth
   - Verify: Advances to next step, no loop

### Automated

```bash
npm run type-check
npm run lint
npm test
```

## Reference

- Pattern documentation: `.claude/docs/shared/list-state-patterns.md`
- Investigation findings: 4 Explore agents + 3 SR Engineers confirmed root cause
