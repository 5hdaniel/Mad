# SPRINT-022: State Coordination Cleanup (Phase 3)

**Status:** NOT STARTED
**Created:** 2026-01-04
**Target:** develop
**Prerequisites:** SPRINT-021 (Phase 2 - Migration) COMPLETE

---

## Executive Summary

Complete the State Coordination Overhaul (BACKLOG-142) by fixing remaining bugs, validating the implementation, and optionally removing legacy code paths. This is Phase 3 of a 3-phase initiative.

### Sprint Goals

1. Fix OnboardingFlow state derivation (TASK-950 - carried over from SPRINT-021)
2. Fix duplicate contact keys warning (TASK-949 - carried over from SPRINT-021)
3. Manual validation on both platforms (macOS, Windows)
4. Remove legacy hook code paths (conditional - after validation passes)
5. Update architecture documentation
6. Performance optimization (memoization audit)

### Constraints

- **MUST** complete TASK-950 before removing any legacy code
- **MUST** validate on both macOS and Windows before legacy removal
- **SHOULD** keep feature flag infrastructure for emergency rollback
- **DO NOT** remove legacy code if any manual testing fails

---

## Task List

| ID | Title | Category | Est Tokens | Token Cap | Depends On | Priority |
|----|-------|----------|------------|-----------|------------|----------|
| TASK-950 | Fix OnboardingFlow state derivation | fix | ~40K | 160K | None | **CRITICAL** |
| TASK-949 | Fix duplicate contact keys | fix | ~15K | 60K | None | Medium |
| TASK-951 | Manual platform validation | test | ~10K | 40K | TASK-950 | High |
| TASK-952 | Remove legacy hook code paths | refactor | ~50K | 200K | TASK-951 | Medium |
| TASK-953 | Update architecture documentation | docs | ~15K | 60K | TASK-952 | Low |
| TASK-954 | Performance optimization (memoization) | refactor | ~25K | 100K | TASK-952 | Low |

**Total Estimated Tokens:** ~155K (adjusted for category factors)
**Sprint Token Budget:** ~200K (includes SR review overhead)

---

## Dependency Graph

```
TASK-950 (OnboardingFlow fix) ─────────────────┐
    |                                           |
    v                                           |
TASK-951 (Platform validation) ────────────────┤
    |                                           |
    v                                           |
TASK-952 (Remove legacy code) ←────────────────┘
    |
    +─────────────+
    |             |
    v             v
TASK-953      TASK-954
(docs)        (perf)

TASK-949 (contact keys) ───────────────────────── (independent)
```

**Execution Order (5 Batches):**

| Batch | Tasks | Type | Rationale |
|-------|-------|------|-----------|
| **1** | TASK-950, TASK-949 | **Parallel** | Independent fixes, different files |
| **2** | TASK-951 | Sequential | Must validate TASK-950 before proceeding |
| **3** | TASK-952 | Sequential | Only after validation passes |
| **4** | TASK-953, TASK-954 | **Parallel** | Independent cleanup, different scopes |

---

## Branch Strategy

### Starting Fresh from Develop

All Phase 3 work starts from `develop` (where Phase 2 was merged):

```bash
git checkout develop
git pull origin develop
git checkout -b feature/TASK-950-onboarding-state-derivation
```

### Merge Flow

```
develop
    |
    +-- fix/TASK-950-onboarding-state-derivation
    +-- fix/TASK-949-duplicate-contact-keys
    +-- feature/TASK-951-platform-validation
    +-- feature/TASK-952-remove-legacy-hooks
    +-- docs/TASK-953-architecture-docs
    +-- feature/TASK-954-performance-optimization
```

PRs merge directly to `develop`.

---

## Task Details

### TASK-950: Fix OnboardingFlow State Derivation (CRITICAL)

**Problem:** OnboardingFlow reads from legacy `useAppStateMachine` properties that have stale data during app restart with pending OAuth. This causes onboarding screens to cycle before landing on correct step.

**Root Cause:** `src/components/onboarding/OnboardingFlow.tsx` lines 39-51 build `appState` from legacy properties instead of deriving from state machine.

**Fix Approach:**
```typescript
const machineState = useOptionalMachineState();

const appState: OnboardingAppState = useMemo(() => {
  if (machineState) {
    return {
      phoneType: selectPhoneType(machineState.state),
      hasPermissions: selectHasPermissions(machineState.state),
      // ... derive all values from state machine
    };
  }
  // Legacy fallback
  return { phoneType: app.selectedPhoneType, ... };
}, [machineState, app]);
```

**Acceptance Criteria:**
- [ ] Returning users go directly to correct onboarding step
- [ ] New users still see full onboarding flow correctly
- [ ] App restart with pending OAuth goes to correct step
- [ ] All existing tests pass

**Estimate:** ~40K tokens (fix category × 1.0)

---

### TASK-949: Fix Duplicate Contact Keys

**Problem:** React key collision warning when importing contacts with duplicate names.

**Root Cause:** `electron/contact-handlers.ts:182` uses contact name for ID.

**Fix:** Replace with unique identifier (UUID or index-based).

**Estimate:** ~15K tokens (fix category × 1.0)

---

### TASK-951: Manual Platform Validation

**Scope:** Document and execute manual testing on both platforms.

**Test Cases:**
- [ ] macOS new user full onboarding flow
- [ ] macOS returning user (no flicker, no cycling)
- [ ] macOS app restart with pending OAuth
- [ ] Windows new user full onboarding flow
- [ ] Windows returning user (no flicker, no cycling)
- [ ] Windows app restart with pending OAuth
- [ ] Feature flag disable/enable mid-session
- [ ] No navigation loops
- [ ] No "Database not initialized" errors

**Deliverable:** Validation report with pass/fail for each case.

**Estimate:** ~10K tokens (manual test coordination)

---

### TASK-952: Remove Legacy Hook Code Paths

**Prerequisite:** TASK-951 validation must pass completely.

**Scope:** Remove the legacy code paths from migrated hooks:
- `useSecureStorage.ts` - Remove else branch (~150 lines)
- `usePhoneTypeApi.ts` - Remove else branch (~100 lines)
- `useEmailOnboardingApi.ts` - Remove else branch (~80 lines)
- `useNavigationFlow.ts` - Remove else branch (~120 lines)

**DO NOT REMOVE:**
- Feature flag infrastructure (keep for emergency rollback)
- `useOptionalMachineState` hook (still needed)
- State machine core files

**Estimate:** ~50K tokens × 0.5 (refactor adjustment) = ~25K actual, but add buffer for testing = ~50K

---

### TASK-953: Update Architecture Documentation

**Scope:**
- Update `.claude/docs/` with new state machine architecture
- Document state machine states and transitions
- Add troubleshooting guide for state machine issues
- Update BACKLOG-142 to mark Phase 3 complete

**Estimate:** ~15K tokens × 5.0 (docs adjustment) = ~75K budget, but scope is small so cap at ~15K with iteration buffer

---

### TASK-954: Performance Optimization

**Scope:**
- Audit memoization in state machine selectors
- Ensure `useMemo` and `useCallback` have correct dependencies
- Profile re-render frequency in dev mode
- Fix any unnecessary re-renders

**Estimate:** ~25K tokens × 0.5 (refactor adjustment) = ~12.5K actual, budget ~25K

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TASK-950 fix doesn't resolve cycling | Medium | High | PR #304 exists as reference; test thoroughly |
| Legacy removal breaks edge case | Low | Critical | Keep feature flag; test extensively first |
| Windows-specific regression | Low | Medium | Explicit Windows testing in TASK-951 |
| Performance regression from removal | Low | Low | Profile before/after |

---

## Testing Strategy

### Per-Task Testing

| Task | Unit Tests | Integration Tests | Manual Tests |
|------|------------|-------------------|--------------|
| TASK-950 | Selector tests | Hook behavior tests | App restart flow |
| TASK-949 | None needed | Contact import tests | Import contacts |
| TASK-951 | N/A | N/A | Full platform matrix |
| TASK-952 | Update existing | Verify all pass | Smoke test |
| TASK-953 | N/A | N/A | Doc review |
| TASK-954 | N/A | Perf benchmarks | Dev mode profiling |

### CI Requirements

All PRs must pass:
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Build on macOS and Windows

---

## End-of-Sprint Validation

- [ ] TASK-950 merged and verified
- [ ] TASK-949 merged and verified
- [ ] Manual testing passed on both platforms
- [ ] Legacy code removed (if validation passed)
- [ ] Documentation updated
- [ ] No performance regressions
- [ ] BACKLOG-142 marked complete

---

## PM Notes

### Carryover Tasks

Two tasks carried over from SPRINT-021:
- **TASK-950**: Already has task file, needs branch update to develop
- **TASK-949**: Already has task file, needs branch update to develop

Update branch info in both task files before engineer assignment.

### Conditional Execution

TASK-952 (legacy removal) is **conditional**:
- Only proceed if TASK-951 validation passes completely
- If any manual test fails, stop and investigate
- Legacy code can remain indefinitely with feature flag

### Sprint Size

This is intentionally a smaller sprint (~155K tokens) to allow thorough validation before removing legacy code. The state machine has been running in production for 1 day at this point.

---

## Sprint Metrics

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total Tokens | ~155K | TBD |
| Tasks Completed | 6 | TBD |
| Blocked Tasks | 0 | TBD |
| PRs Created | 6 | TBD |

### Task Completion Summary

| Task | PR | Tokens | Status |
|------|-----|--------|--------|
| TASK-950 | - | - | NOT STARTED |
| TASK-949 | - | - | NOT STARTED |
| TASK-951 | - | - | NOT STARTED |
| TASK-952 | - | - | NOT STARTED |
| TASK-953 | - | - | NOT STARTED |
| TASK-954 | - | - | NOT STARTED |

---

## Changelog

- 2026-01-04: Sprint created (Phase 3 of BACKLOG-142)
