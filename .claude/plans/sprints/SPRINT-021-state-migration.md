# SPRINT-021: State Coordination Migration (Phase 2)

**Status:** NOT STARTED
**Created:** 2026-01-03
**Target:** project/state-coordination (integration branch)
**Prerequisites:** SPRINT-020 (Phase 1 - Foundation) COMPLETE

---

## Executive Summary

Migrate existing hooks to use the new state machine architecture created in Phase 1. This is Phase 2 of a 3-phase initiative (BACKLOG-142).

### Sprint Goals

1. Create hook migration utilities for gradual adoption
2. Migrate useSecureStorage to use state machine for DB init status
3. Migrate usePhoneTypeApi to use state machine for user data
4. Migrate useEmailOnboardingApi to use state machine for user data
5. Create step derivation module for navigation flow
6. Migrate useNavigationFlow effects to state derivation
7. Add comprehensive integration tests for migrated hooks
8. Enable feature flag default true for testing

### Constraints

- **DO NOT** remove legacy hook implementations (keep as fallback)
- **DO NOT** break existing consumer behavior
- **MUST** use feature flag to toggle between old and new paths
- **MUST** preserve existing onboarding step registry
- **MUST** work on both macOS and Windows

---

## Task List

| ID | Title | Category | Est Tokens | Token Cap | Depends On |
|----|-------|----------|------------|-----------|------------|
| TASK-940 | Create hook migration utilities | service | ~30K | 120K | None |
| TASK-941 | Migrate useSecureStorage | service | ~60K | 240K | TASK-940 |
| TASK-942 | Migrate usePhoneTypeApi | service | ~35K | 140K | TASK-940 |
| TASK-943 | Migrate useEmailOnboardingApi | service | ~30K | 120K | TASK-940 |
| TASK-944 | Create step derivation module | service | ~40K | 160K | None |
| TASK-945 | Migrate useNavigationFlow effects | refactor | ~80K | 320K | TASK-944, TASK-941, TASK-942, TASK-943 |
| TASK-946 | Integration tests for migrated hooks | test | ~50K | 200K | TASK-945 |
| TASK-947 | Enable feature flag default true | config | ~15K | 60K | TASK-946 |
| TASK-948 | Fix returning user UI flicker | fix | ~40K | 160K | TASK-947 |
| TASK-949 | Fix duplicate contact keys | fix | ~15K | 60K | None |

**Total Estimated Tokens:** ~395K
**Sprint Token Budget:** ~450K (includes SR review overhead)

---

## Dependency Graph

```
TASK-940 (utilities) ─────────────────────────────────┐
    |                                                 |
    +─────────────+─────────────+                     |
    |             |             |                     |
    v             v             v                     |
TASK-941      TASK-942      TASK-943                  |
(storage)     (phone)       (email)                   |
    |             |             |                     |
    +─────────────+─────────────+                     |
                  |                                   |
TASK-944 (step derivation) ──────────────────────────┤
                  |                                   |
                  +───────────────+                   |
                                  |                   |
                                  v                   |
                            TASK-945 ←────────────────┘
                            (navigation)
                            ** HIGH RISK **
                                  |
                                  v
                            TASK-946
                            (tests)
                                  |
                                  v
                            TASK-947
                            (flag)
```

**Execution Order (7 Batches):**

| Batch | Tasks | Type | Rationale |
|-------|-------|------|-----------|
| **1** | TASK-940, TASK-944 | **Parallel** | No shared deps, both foundational |
| **2** | TASK-941 | Sequential | Depends on 940, modifies useSecureStorage |
| **3** | TASK-942 | Sequential | Depends on 940, modifies usePhoneTypeApi |
| **4** | TASK-943 | Sequential | Depends on 940, modifies useEmailOnboardingApi |
| **5** | TASK-945 | Sequential | **HIGH RISK** - Complex effects migration |
| **6** | TASK-946 | Sequential | Tests must cover all prior migrations |
| **7** | TASK-947 | Sequential | Final step, enables feature flag |

**Notes:**
- Batch 1 can run in parallel (separate worktrees required)
- Batches 2-4 are sequential because all modify different hooks, but depend on 940
- TASK-945 is the critical path - budget extra tokens for debugging

---

## Branch Strategy

### Continuing on Project Branch

All Phase 2 work continues on `project/state-coordination`:

```bash
# Ensure you have latest from Phase 1
git checkout project/state-coordination
git pull origin project/state-coordination

# Task branches for each task
git checkout -b feature/TASK-940-migration-utilities
```

### Merge Flow

```
develop
    |
    +-- project/state-coordination (Phase 1 complete)
           |
           +-- feature/TASK-940-migration-utilities
           +-- feature/TASK-941-migrate-secure-storage
           +-- feature/TASK-942-migrate-phone-type
           +-- feature/TASK-943-migrate-email-onboarding
           +-- feature/TASK-944-step-derivation
           +-- feature/TASK-945-migrate-navigation-flow
           +-- feature/TASK-946-integration-tests
           +-- feature/TASK-947-feature-flag-default
```

PRs merge to `project/state-coordination` during sprint.
Final merge to `develop` happens at end of Phase 3.

---

## Key Technical Patterns

### Hook Migration Pattern

All migrated hooks follow this pattern:

```typescript
export function useSecureStorage(options): UseSecureStorageReturn {
  const machineState = useOptionalMachineState();

  if (machineState) {
    // New path: derive from state machine
    const { state, dispatch } = machineState;
    return {
      isDatabaseInitialized: selectIsDatabaseInitialized(state),
      isCheckingSecureStorage: state.status === 'loading' && state.phase === 'checking-storage',
      // ... all values derived from state machine
    };
  }

  // Legacy path: existing implementation unchanged
  const [isDatabaseInitialized, setIsDatabaseInitialized] = useState(false);
  // ... existing code
}
```

### Step Derivation (Pure Function)

```typescript
export function deriveCurrentStep(state: OnboardingState): OnboardingStep | null {
  if (state.status !== 'onboarding') return null;
  return state.step;
}

export function deriveNavigationTarget(state: AppState): NavigationTarget {
  switch (state.status) {
    case 'loading': return { screen: 'loading', params: { phase: state.phase } };
    case 'unauthenticated': return { screen: 'login' };
    case 'onboarding': return { screen: 'onboarding', params: { step: state.step } };
    case 'ready': return { screen: 'dashboard' };
    case 'error': return { screen: 'error', params: { error: state.error } };
  }
}
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| useNavigationFlow migration breaks navigation | High | Critical | Extra budget (80K+320K cap), thorough tests |
| Race conditions between old and new paths | Medium | High | Feature flag controls all-or-nothing switch |
| Selector memoization issues | Medium | Medium | Use useMemo with proper deps |
| Missing state machine actions | Low | Medium | Add actions as needed, document in task |
| Platform-specific issues | Low | Medium | Test on both platforms at each task |

---

## Testing Strategy

### Per-Task Testing

| Task | Unit Tests | Integration Tests |
|------|------------|-------------------|
| TASK-940 | Utility function tests | N/A |
| TASK-941 | Selector tests | Hook behavior with/without machine |
| TASK-942 | Selector tests | Hook behavior with/without machine |
| TASK-943 | Selector tests | Hook behavior with/without machine |
| TASK-944 | Derivation function tests | N/A (pure functions) |
| TASK-945 | Effect removal tests | Full navigation flow tests |
| TASK-946 | N/A | Comprehensive hook migration suite |
| TASK-947 | Flag toggle tests | Flag default behavior |

### CI Requirements

All PRs must pass:
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Build on macOS and Windows

### Manual Testing Checklist

Before enabling feature flag default true:
- [ ] macOS new user full onboarding flow
- [ ] macOS returning user (no flicker)
- [ ] Windows new user full onboarding flow
- [ ] Windows returning user (no flicker)
- [ ] Feature flag toggle mid-session
- [ ] No navigation loops
- [ ] No "Database not initialized" errors

---

## End-of-Sprint Validation

- [ ] All 8 tasks merged to project/state-coordination
- [ ] Integration tests pass for all migrated hooks
- [ ] Manual testing on macOS passes
- [ ] Manual testing on Windows passes
- [ ] Feature flag can toggle behavior
- [ ] No regression in existing functionality
- [ ] Documentation updated

---

## Sprint Metrics

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total Tokens | ~340K | TBD |
| Tasks Completed | 8 | TBD |
| Blocked Tasks | 0 | TBD |
| PRs Created | 8 | TBD |

### Task Completion Summary

| Task | PR | Tokens | Status |
|------|-----|--------|--------|
| TASK-940 | - | - | NOT STARTED |
| TASK-941 | - | - | NOT STARTED |
| TASK-942 | - | - | NOT STARTED |
| TASK-943 | - | - | NOT STARTED |
| TASK-944 | - | - | NOT STARTED |
| TASK-945 | - | - | NOT STARTED |
| TASK-946 | - | - | NOT STARTED |
| TASK-947 | - | - | NOT STARTED |

---

## SR Engineer Technical Review

**Review Date:** 2026-01-03
**Reviewer:** SR Engineer
**Status:** APPROVED WITH OBSERVATIONS

### Pre-Review Checklist

- [x] Review Phase 1 implementation in `project/state-coordination`
- [x] Verify all Phase 1 tests passing (TASK-928 merged with tests)
- [x] Confirm state machine types are complete
- [x] Identify any additional actions needed for hook migration
- [x] Review shared file matrix for conflict potential

### Review Summary

Sprint plan is **APPROVED**. All 8 tasks are technically feasible with the Phase 1 foundation. Dependencies are correctly ordered.

### Critical Finding: OnboardingStep Name Mismatch

**MUST FIX in TASK-944:**

Phase 1 types define:
```typescript
export type OnboardingStep =
  | "phone-type" | "secure-storage" | "email-connect"
  | "permissions" | "apple-driver" | "android-coming-soon";
```

Existing onboarding system (`src/components/onboarding/types/steps.ts`) defines:
```typescript
export type OnboardingStepId =
  | "welcome" | "terms" | "phone-type" | "android-coming-soon"
  | "secure-storage" | "driver-setup" | "apple-driver"
  | "email-connect" | "permissions" | "complete";
```

TASK-944 task file incorrectly references steps like `'terms'` and `'apple-driver-setup'`. Engineers must align with actual type definitions.

### Hook Interface Observations

| Hook | Task Assumption | Actual Interface | Delta |
|------|-----------------|------------------|-------|
| `useSecureStorage` | 5 properties | 6 properties (different names) | Update task docs |
| `usePhoneTypeApi` | Matches | 8 properties | OK |
| `useEmailOnboardingApi` | Matches | 6 properties | OK |
| `useNavigationFlow` | 5 properties | 9 properties | Verify compatibility |

### Shared File Conflict Warning

**TASK-940 and TASK-944 conflict on:** `src/appCore/state/machine/index.ts`

Both tasks add exports to this barrel file. Since Batch 1 runs these in parallel:
- **Option A:** Run sequentially (940 first, 944 second)
- **Option B:** Second task to merge must rebase

**Recommendation:** Run TASK-940 first, then TASK-944 to avoid conflict.

### State Machine Actions - SUFFICIENT

Phase 1 provides all needed actions:
- `ONBOARDING_STEP_COMPLETE` - for step completion
- `ONBOARDING_SKIP` - for skip actions
- Loading phase transitions
- Error handling

The `SET_ONBOARDING_STEP` action mentioned in TASK-945 is NOT in Phase 1. If needed, add during TASK-945 (document as deviation).

### Risk Register Updates

| Task | Original Risk | SR Assessment |
|------|---------------|---------------|
| TASK-941 | Medium | Medium - Interface mismatch requires careful mapping |
| TASK-944 | Low | **Medium** - Step name normalization required |
| TASK-945 | High | High CONFIRMED - 360 lines, 20+ effect deps, terminology conflicts |

### Execution Order Recommendation

```
Batch 1a: TASK-940 (utilities) - RUN FIRST
Batch 1b: TASK-944 (derivation) - RUN AFTER 940 MERGES
Batch 2-4: TASK-941, 942, 943 (sequential as planned)
Batch 5-7: TASK-945, 946, 947 (sequential as planned)
```

### Approval

**APPROVED** - Sprint may proceed with the following required actions:
1. Update TASK-944 step names to match actual types
2. Run TASK-940 before TASK-944 (not parallel) to avoid barrel conflict
3. TASK-941 engineers should verify actual hook interface before implementation

---

## Changelog

- 2026-01-03: SR Engineer technical review complete - APPROVED with observations
- 2026-01-03: Sprint created (Phase 2 of BACKLOG-142)
