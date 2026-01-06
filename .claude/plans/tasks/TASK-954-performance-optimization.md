# Task TASK-954: Performance Optimization (Memoization Audit)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Audit and optimize memoization in state machine selectors and hooks to prevent unnecessary re-renders.

## Non-Goals

- Do NOT change state machine logic
- Do NOT add new features
- Do NOT refactor beyond memoization fixes

## Deliverables

1. Audit all selectors for proper memoization
2. Fix any memoization issues found
3. Profile re-render frequency before/after
4. Document any findings

## Audit Checklist

### Selectors (`src/appCore/state/machine/selectors/`)

| Selector | Has Memoization | Correct Dependencies | Notes |
|----------|-----------------|---------------------|-------|
| selectIsDatabaseInitialized | Check | Check | |
| selectIsCheckingSecureStorage | Check | Check | |
| selectPhoneType | Check | Check | |
| selectHasSelectedPhoneType | Check | Check | |
| selectHasCompletedEmailOnboarding | Check | Check | |
| selectHasEmailConnected | Check | Check | |
| ... | | | |

### Hooks (`src/appCore/state/flows/`)

| Hook | useMemo Usage | useCallback Usage | Dep Arrays |
|------|---------------|-------------------|------------|
| useSecureStorage | Check | Check | Check |
| usePhoneTypeApi | Check | Check | Check |
| useEmailOnboardingApi | Check | Check | Check |
| useNavigationFlow | Check | Check | Check |

### Derivation Functions (`src/appCore/state/machine/derivation/`)

| Function | Pure | No Side Effects |
|----------|------|-----------------|
| deriveCurrentStep | Check | Check |
| deriveNavigationTarget | Check | Check |
| deriveAppStep | Check | Check |
| ... | | |

## Profiling Approach

1. Add React DevTools Profiler to dev mode
2. Record render frequency during:
   - App startup
   - Navigation between screens
   - Onboarding step transitions
3. Document baseline render counts
4. Apply fixes
5. Re-profile and compare

## Common Issues to Look For

- [ ] Selectors creating new objects on every call
- [ ] Missing `useMemo` for derived values
- [ ] Incorrect dependency arrays (missing or extra deps)
- [ ] Functions recreated on every render (need `useCallback`)
- [ ] Context value not memoized

## Acceptance Criteria

- [ ] All selectors audited
- [ ] All hooks audited
- [ ] No new objects created unnecessarily
- [ ] Profile shows no regression (ideally improvement)
- [ ] All tests pass

## PR Preparation

- **Title**: `perf(state): optimize memoization in state machine`
- **Branch From**: `develop`
- **Branch Into**: `develop`
- **Branch Name**: `feature/TASK-954-performance-optimization`

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~25K × 0.5 (refactor adjustment) = ~12.5K actual

**Token Cap:** 100K

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `feature/TASK-954-performance-optimization`

### Technical Considerations

- React DevTools Profiler is the primary tool
- Focus on selectors first - they're called most frequently
- `useMemo` for objects, `useCallback` for functions
- Be careful not to over-memoize (premature optimization)

---

## Implementation Summary (Engineer-Owned)

*To be filled by engineer agent*
