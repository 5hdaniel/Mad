# BACKLOG-109: Reduce AppRouter.tsx to <300 Lines

## Priority: High

## Category: refactor

## Summary

Reduce `AppRouter.tsx` from 359 lines to under 300 lines by extracting loading state JSX and removing the dead `USE_NEW_ONBOARDING` feature flag.

## Problem

`AppRouter.tsx` at 359 lines exceeds the 300-line trigger threshold defined in `.claude/docs/shared/architecture-guardrails.md`. This makes the router harder to maintain and understand.

**Specific issues:**
1. Loading state JSX is inline and could be extracted
2. `USE_NEW_ONBOARDING` feature flag is always `true` (dead code)
3. Route definitions mixed with presentation logic

## Solution

### 1. Remove USE_NEW_ONBOARDING Feature Flag

The `USE_NEW_ONBOARDING` flag is always `true`, meaning the "old" onboarding path is dead code:

```typescript
// Before
const USE_NEW_ONBOARDING = true;

if (USE_NEW_ONBOARDING) {
  return <NewOnboarding />;
} else {
  return <OldOnboarding />; // Never reached - DELETE
}

// After
return <NewOnboarding />;
```

### 2. Extract Loading State Component

```typescript
// Before (inline in AppRouter)
if (isLoading) {
  return (
    <div className="loading-container">
      <Spinner />
      <p>Loading...</p>
    </div>
  );
}

// After
// src/components/common/AppLoadingState.tsx
export const AppLoadingState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="loading-container">
    <Spinner />
    <p>{message || 'Loading...'}</p>
  </div>
);

// In AppRouter
if (isLoading) {
  return <AppLoadingState />;
}
```

### 3. Consider Route Definition Extraction (Optional)

If still over 300 lines after the above, extract route definitions:

```typescript
// src/routes/index.ts
export const routes = [
  { path: '/', element: <Home /> },
  { path: '/settings', element: <Settings /> },
  // ...
];
```

## Implementation Steps

1. Identify and remove `USE_NEW_ONBOARDING` flag and dead code paths
2. Extract loading state JSX to a reusable component
3. Update imports in AppRouter.tsx
4. Verify all routes still work
5. Run tests

## Acceptance Criteria

- [ ] `AppRouter.tsx` reduced to <300 lines
- [ ] `USE_NEW_ONBOARDING` flag removed
- [ ] All dead code paths removed
- [ ] Loading state extracted to reusable component
- [ ] All routing behavior preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Raw Estimate | Notes |
|--------|--------------|-------|
| Turns | 8-12 | Moderate refactor |
| Tokens | ~40K | |
| Time | 1-1.5 hours | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 4-6 |
| Tokens | ~20K |
| Time | 30-45 minutes |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking routing | Test all routes after changes |
| Missing dead code references | Search for USE_NEW_ONBOARDING references |

## Notes

**This item is SR Engineer sourced from architecture review.**

This is a straightforward cleanup task that should yield quick wins. The feature flag removal is the easiest part and should be done first to understand the scope.

**Files to modify:**
- `src/AppRouter.tsx` - Main changes
- `src/components/common/AppLoadingState.tsx` (new) - Extracted component
