# BACKLOG-150: Reduce useAppStateMachine.ts Return Object Size

## Priority: Low

## Category: refactor

## Summary

Reduce `useAppStateMachine.ts` (432 lines, 32 over 400-line trigger) by refactoring the ~180-line return object.

## Problem

`src/appCore/state/useAppStateMachine.ts` at 432 lines is slightly over the 400-line trigger threshold from `.claude/docs/shared/architecture-guardrails.md`.

**Note:** BACKLOG-107 / SPRINT-013 already addressed the major issues, reducing the file from 1,130 to 422 lines. The current issue is maintenance-level.

The primary remaining issue is the return statement which spans approximately 180 lines. This is because the hook returns many grouped properties.

## Solution

Consider one of these approaches:

### Option A: Auto-Construct Return Object
Create a utility function that constructs the return object from the state machine context:

```typescript
// Before
return {
  // Auth flow
  isAuthenticated,
  setIsAuthenticated,
  // ... 50+ properties
};

// After
return useMemo(() => ({
  ...constructAuthFlowReturn(state),
  ...constructStorageFlowReturn(state),
  ...constructOnboardingFlowReturn(state),
}), [state]);
```

### Option B: Group Related Properties into Sub-Objects
```typescript
// Before
return {
  isAuthenticated,
  setIsAuthenticated,
  isDatabaseReady,
  // ... many flat properties
};

// After
return {
  auth: { isAuthenticated, setIsAuthenticated },
  storage: { isDatabaseReady, ... },
  onboarding: { ... },
  // Grouped by concern
};
```

**Recommendation:** Option A maintains backward compatibility while reducing line count.

## Implementation Steps

### Step 1: Analysis (~20 min)
1. Catalog all return properties
2. Group by flow/concern
3. Identify dependencies

### Step 2: Create Helper Functions (~30 min)
1. Create `constructAuthFlowReturn(state)`
2. Create `constructStorageFlowReturn(state)`
3. Create `constructOnboardingFlowReturn(state)`
4. Each returns a typed partial object

### Step 3: Refactor Return (~15 min)
1. Replace inline return with composed object
2. Ensure memoization for performance
3. Verify type safety

### Step 4: Verification (~15 min)
1. `npm run type-check` passes
2. `npm run lint` passes
3. `npm test` passes

## Acceptance Criteria

- [ ] `useAppStateMachine.ts` reduced to <400 lines
- [ ] Return object construction moved to helper functions
- [ ] All functionality preserved (no behavior changes)
- [ ] No performance regressions
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Tokens | ~20K | Simple refactor, well-understood code |
| Duration | ~1-2 hours | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Tokens | ~10K |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking hook consumers | Type checking will catch API changes |
| Performance regression | Careful memoization |
| Complexity increase | Keep helper functions simple |

## Notes

**This item is SR Engineer sourced from architecture review (2026-01-04).**

This is a LOW priority maintenance task. The architecture is correct (BACKLOG-107 addressed the major issues). This is purely line-count reduction for maintainability.

Priority should be given to HIGH/CRITICAL items before addressing this.
