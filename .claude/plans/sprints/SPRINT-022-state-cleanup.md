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

---

## SR Engineer Technical Review

**Review Date:** 2026-01-04
**Reviewer:** SR Engineer Agent
**Status:** APPROVED

### Executive Summary

All 6 tasks are technically feasible with well-defined scope. The dependency graph is correct. I identified one minor issue in TASK-950 that needs attention during implementation (missing selector), but this is an implementation detail, not a blocker.

### Shared File Analysis

| File | Tasks | Conflict Risk | Notes |
|------|-------|---------------|-------|
| `OnboardingFlow.tsx` | TASK-950 | None | Isolated change |
| `contact-handlers.ts:182` | TASK-949 | None | Isolated change |
| `useSecureStorage.ts` | TASK-952 | None | Sequential dep on TASK-951 |
| `usePhoneTypeApi.ts` | TASK-952 | None | Sequential dep on TASK-951 |
| `useEmailOnboardingApi.ts` | TASK-952 | None | Sequential dep on TASK-951 |
| `useNavigationFlow.ts` | TASK-952 | None | Sequential dep on TASK-951 |
| `selectors/userDataSelectors.ts` | TASK-950 (implicit) | Low | May need new selector |
| `.claude/docs/` | TASK-953 | None | Docs only |
| State machine selectors | TASK-954 | None | Performance audit only |

**Conflict Assessment:** LOW RISK - Tasks are well-isolated.

### Execution Order Validation

**Proposed Order (from sprint plan):**

| Batch | Tasks | Validation |
|-------|-------|------------|
| **1** | TASK-950, TASK-949 | CORRECT - Independent, different files |
| **2** | TASK-951 | CORRECT - Manual validation gates TASK-952 |
| **3** | TASK-952 | CORRECT - Must wait for TASK-951 GO decision |
| **4** | TASK-953, TASK-954 | CORRECT - Independent cleanup tasks |

**Recommendation:** The proposed execution order is sound. Proceed as planned.

### Task-by-Task Technical Assessment

#### TASK-950: Fix OnboardingFlow State Derivation (CRITICAL)

**Feasibility:** HIGH

**Verification:**
- `OnboardingFlow.tsx` (228 lines) - Current implementation builds `appState` directly from legacy `app` props (lines 39-51)
- `useOptionalMachineState` hook exists in `src/appCore/state/machine/hooks/useOptionalMachineState.ts`
- Required selectors exist:
  - `selectPhoneType` - EXISTS in `userDataSelectors.ts`
  - `selectHasEmailConnected` - EXISTS in `userDataSelectors.ts`
  - `selectHasCompletedEmailOnboarding` - EXISTS in `userDataSelectors.ts`
  - `selectHasPermissions` - MISSING (referenced in task notes but not implemented)

**Technical Issue Identified:**
The task notes reference `selectHasPermissions` which does not exist. The `UserData` interface has `hasPermissions: boolean`, but no selector function exists.

**Resolution:** Engineer should create `selectHasPermissions` in `userDataSelectors.ts` as part of implementation. This is a trivial addition:
```typescript
export function selectHasPermissions(state: AppState): boolean {
  if (state.status === "ready") {
    return state.userData.hasPermissions;
  }
  return false;
}
```

**Risk Level:** MEDIUM (due to critical bug fix nature)
**Estimate Accuracy:** 40K tokens appears reasonable

---

#### TASK-949: Fix Duplicate Contact Keys

**Feasibility:** HIGH

**Verification:**
- Bug location confirmed at `electron/contact-handlers.ts:182`:
  ```typescript
  id: `contacts-app-${contactInfo.name}`, // Temporary ID for UI
  ```
- This clearly uses name which is not unique
- Fix is straightforward: use index or UUID

**Recommended Fix:**
```typescript
id: `contacts-app-${Date.now()}-${index}`,
```
Using index + timestamp is simpler than UUID and avoids crypto import in Electron main process.

**Risk Level:** LOW
**Estimate Accuracy:** 15K tokens is appropriate for this simple fix

---

#### TASK-951: Manual Platform Validation

**Feasibility:** HIGH (but requires human tester)

**Verification:**
- This is a manual testing task, not a code task
- Test cases are comprehensive and cover all critical paths
- Correct that this gates TASK-952

**Technical Consideration:**
This task cannot be completed by an engineer agent. It requires:
1. Access to physical macOS device
2. Access to physical Windows device (or VM)
3. Ability to install fresh app builds
4. OAuth accounts for testing

**Risk Level:** LOW (risk is in finding bugs, not in the task itself)
**Estimate Accuracy:** 10K tokens for coordination is reasonable

---

#### TASK-952: Remove Legacy Hook Code Paths

**Feasibility:** HIGH (conditional on TASK-951 GO)

**Verification:**
Confirmed legacy code sizes by examining files:
- `useSecureStorage.ts`: Lines 141-536 (legacy path ~395 lines, not ~150 as estimated)
- `usePhoneTypeApi.ts`: Lines 147-265 (legacy path ~118 lines, close to ~100 estimate)
- `useEmailOnboardingApi.ts`: Lines 118-202 (legacy path ~84 lines, close to ~80 estimate)
- `useNavigationFlow.ts`: Lines 171-444 (legacy path ~273 lines, not ~120 as estimated)

**Estimate Correction:**
Legacy code is larger than task estimates suggest:
- Total estimated: ~450 lines
- Total actual: ~870 lines

This doesn't change feasibility but may increase tokens needed. The 200K cap should absorb this.

**Recommendation:** Keep feature flag infrastructure as specified. The error throwing pattern for disabled flag is correct.

**Risk Level:** MEDIUM (large code removal)
**Estimate Accuracy:** May need up to 75K tokens due to larger legacy codebase, but within cap

---

#### TASK-953: Architecture Documentation

**Feasibility:** HIGH

**Verification:**
- Target paths exist:
  - `.claude/docs/` - EXISTS
  - `.claude/docs/shared/` - EXISTS (for new state-machine-architecture.md)
  - `.claude/plans/backlog/` - EXISTS

**Scope Check:**
Documentation scope is well-defined. No code changes required.

**Risk Level:** LOW
**Estimate Accuracy:** 15K tokens is appropriate

---

#### TASK-954: Performance Optimization

**Feasibility:** HIGH

**Verification:**
Audit targets exist:
- `src/appCore/state/machine/selectors/` - 2 selector files, ~180 lines each
- `src/appCore/state/flows/` - 4 hook files, ~250-550 lines each
- `src/appCore/state/machine/derivation/` - 2 derivation files

**Technical Consideration:**
React DevTools Profiler integration may require npm package addition for production profiling. Dev mode profiling is built-in.

Current selector functions are NOT memoized (they're pure functions called directly). Memoization would require:
1. Converting to `reselect` or similar library, OR
2. Using `useMemo` in the hooks that call selectors

**Recommendation:** Focus on hook-level memoization (`useMemo`/`useCallback`) rather than adding a selector library. This keeps changes minimal.

**Risk Level:** LOW (optimization, not bug fix)
**Estimate Accuracy:** 25K tokens is appropriate

---

### Risk Assessment Summary

| Task | Risk | Mitigation |
|------|------|------------|
| TASK-950 | Medium - Missing selector | Add `selectHasPermissions` during impl |
| TASK-949 | Low | Straightforward fix |
| TASK-951 | Low | Manual testing is gating |
| TASK-952 | Medium - Large removal | Comprehensive testing, keep flag |
| TASK-953 | Low | Docs only |
| TASK-954 | Low | Non-breaking optimization |

### Branch Strategy Validation

All tasks correctly target `develop`:
- TASK-950: `fix/TASK-950-onboarding-state-derivation` -> `develop`
- TASK-949: `fix/TASK-949-duplicate-contact-keys` -> `develop`
- TASK-951: No PR (manual validation report)
- TASK-952: `feature/TASK-952-remove-legacy-hooks` -> `develop`
- TASK-953: `docs/TASK-953-architecture-docs` -> `develop`
- TASK-954: `feature/TASK-954-performance-optimization` -> `develop`

Branch naming follows conventions. All use traditional merge to develop.

### Recommendations

1. **TASK-950 Implementation Note:** Engineer must create `selectHasPermissions` selector. Add this to task file.

2. **TASK-952 Scope Note:** Legacy code is ~870 lines, not ~450 lines. Estimate buffer is sufficient but engineer should be aware.

3. **TASK-951 Ownership:** Clarify who performs manual testing (PM, developer, QA). Agent cannot complete this task.

4. **Sprint Size:** With actual legacy code sizes, total estimated tokens may reach ~200K. This is within budget but leaves minimal buffer.

### Final Decision

**STATUS: APPROVED**

The sprint plan is technically sound. All tasks are feasible. Dependencies are correctly ordered. Shared file conflicts are minimal due to sequential batching.

Proceed with engineer assignment following the batch order specified.

---

## Changelog

- 2026-01-04: Sprint created (Phase 3 of BACKLOG-142)
- 2026-01-04: SR Engineer technical review completed (APPROVED)
