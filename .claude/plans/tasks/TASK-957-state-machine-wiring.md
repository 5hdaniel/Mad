# TASK-957: Wire State Machine into Main.tsx (Retroactive)

**Backlog ID:** BACKLOG-142 (State Coordination Overhaul)
**Sprint:** SPRINT-022 (State Coordination Cleanup - Phase 3)
**Phase:** Phase 3 - Cleanup and Integration
**Branch:** `fix/state-machine-wiring`
**PR:** #310
**Status:** READY TO MERGE (Retroactive Documentation)

---

## RETROACTIVE TASK NOTICE

This task file was created retroactively to document work already completed during SPRINT-022. The fix was discovered during sprint execution when it was found that the state machine infrastructure was built but never wired into main.tsx.

**Why retroactive documentation matters:**
1. Token estimation analysis - comparing estimated vs actual
2. Sprint velocity tracking
3. Pattern recognition for future estimations
4. Complete audit trail

---

## Objective

Fix the returning user UI flicker by wiring the state machine infrastructure (FeatureFlaggedProvider and LoadingOrchestrator) into main.tsx, and ensuring proper email onboarding detection for returning users.

---

## Context

During Phase 2 (SPRINT-021), the state machine infrastructure was successfully built:
- `LoadingOrchestrator.tsx` - Phases 1-5 loading sequence
- `FeatureFlaggedProvider` - Feature flag wrapper for rollout
- Individual flow hooks migrated to state machine

However, these components were never imported or rendered in `main.tsx`. This meant:
1. The state machine never activated
2. Returning users defaulted to onboarding state
3. Flicker occurred as legacy hooks eventually corrected the state

---

## Problem Identified

**Symptom:** Returning users briefly saw onboarding screens before reaching dashboard.

**Root Cause:**
1. `main.tsx` did not render `FeatureFlaggedProvider` or `LoadingOrchestrator`
2. `LoadingOrchestrator.tsx` hardcoded email onboarding detection to `false`
3. Legacy hooks had default values that implied fresh user state

---

## Requirements Implemented

### Changes Made:

1. **src/main.tsx**
   - Added import for `FeatureFlaggedProvider`
   - Added import for `LoadingOrchestrator`
   - Wrapped app in `FeatureFlaggedProvider`
   - Added `LoadingOrchestrator` to render tree

2. **src/appCore/state/machine/LoadingOrchestrator.tsx**
   - Fixed email onboarding detection for returning users
   - Added proper database lookup for onboarding status

3. **src/appCore/state/flows/useNavigationFlow.ts**
   - Updated default values to prevent flicker assumption

4. **src/appCore/state/flows/usePermissionsFlow.ts**
   - Updated default values to prevent flicker assumption

5. **src/appCore/state/flows/usePhoneTypeApi.ts**
   - Updated default values to prevent flicker assumption

6. **src/appCore/state/__tests__/useAppStateMachine.test.tsx**
   - Updated test expectations to match new default values

---

## Acceptance Criteria

- [x] Returning users see: loading -> dashboard (no onboarding screens)
- [x] New users still see full onboarding flow correctly
- [x] All existing tests pass (393 state machine tests)
- [x] Type-check passes
- [x] Lint passes
- [x] CI passes

---

## Files Modified

| File | Changes |
|------|---------|
| `src/main.tsx` | +10 lines - Import and render state machine providers |
| `src/appCore/state/machine/LoadingOrchestrator.tsx` | +7/-4 lines - Fix email onboarding detection |
| `src/appCore/state/flows/useNavigationFlow.ts` | +7 lines - Update defaults |
| `src/appCore/state/flows/usePermissionsFlow.ts` | +5/-4 lines - Update defaults |
| `src/appCore/state/flows/usePhoneTypeApi.ts` | +3/-1 lines - Update defaults |
| `src/appCore/state/__tests__/useAppStateMachine.test.tsx` | +7/-6 lines - Fix expectations |

**Total:** +38 lines, -16 lines (net +22 lines)

---

## PM Estimate (Retroactive)

**Category:** `fix` (bug fix)

**Estimated Tokens:** ~35K
- Integration fix: ~15K
- Test updates: ~10K
- Debugging/investigation: ~10K

**Token Cap:** 140K (4x estimate)

**Rationale:**
- This is a mid-complexity fix requiring understanding of the state machine architecture
- Multiple files touched but changes are coordinated
- Requires test updates

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-01-04*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: (during sprint work)
- [x] Read task context from sprint plan

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed (retroactive)
- [x] PR created: #310
- [x] CI passes
- [x] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for metrics recording
```

### Results

- **Before**: Returning users saw onboarding screens briefly before dashboard
- **After**: Returning users go directly to dashboard (loading -> dashboard)
- **Actual Tokens**: TBD (to be recorded from metrics after merge)
- **PR**: #310

### Notes

**Discovery context:**
This issue was discovered during SPRINT-022 Phase 3 work when testing the state machine. The infrastructure from Phase 2 (SPRINT-021) was complete but the final wiring step was missed.

**Scope creep avoided:**
- Did NOT refactor the loading orchestrator beyond fixing the immediate issue
- Did NOT change feature flag behavior
- Did NOT touch other state machine components

---

## Guardrails

N/A - Work already completed.

---

## Sprint Tracking

**Add to SPRINT-022 Task List:**

| ID | Title | Category | Est Tokens | Token Cap | Depends On | Priority |
|----|-------|----------|------------|-----------|------------|----------|
| TASK-957 | Wire state machine into main.tsx | fix | ~35K | 140K | None | **CRITICAL** |

**Batch Assignment:** Batch 1 (parallel with TASK-950, TASK-949) - Already completed

---

## Commits

```
6e4d518 fix(state): wire up state machine and fix returning user flicker
5da843f test(state): fix test expectations for new default values
```
