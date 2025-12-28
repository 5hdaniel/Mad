# TASK-613: Onboarding Types Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety
**Priority:** MEDIUM
**Status:** Complete

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** 2025-12-27 (session start)
**Task End:** 2025-12-27 (session end)
**Wall-Clock Time:** ~10 min (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | 0 | 0 | 0 min |
| Implementation | 2 | ~8K | ~8 min |
| Debugging | 1 | ~4K | ~2 min |
| **Total** | 3 | ~12K | ~10 min |

**Estimated vs Actual:**
- Est Turns: 1-2 -> Actual: 3 (variance: +50%)
- Est Wall-Clock: 5-10 min -> Actual: ~10 min (variance: 0%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 4-6 | **1-2** | - |
| **Tokens** | ~20K | ~6K | - |
| **Time** | 30-45m | **5-10 min** | **5-10 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Split `src/components/onboarding/types.ts` (629 lines) into domain-specific type files.

---

## Current State

Single types file contains:
- Step type definitions
- Flow type definitions
- State machine types
- Context types
- Action types
- Guard types

---

## Requirements

### Must Do
1. Split into focused type files
2. Maintain all existing exports
3. Update imports across onboarding components
4. Keep barrel export for backwards compatibility

### Must NOT Do
- Change type definitions
- Break existing components
- Remove any types

---

## Proposed Structure

```
src/components/onboarding/types/
  index.ts          (barrel export - maintains backwards compatibility)
  steps.ts          (step definitions)
  flows.ts          (flow types)
  state.ts          (state machine types)
  context.ts        (context types)
  actions.ts        (action types)
  guards.ts         (guard types)
```

---

## Files to Create

| File | Content |
|------|---------|
| `types/index.ts` | Barrel export |
| `types/steps.ts` | Step definitions |
| `types/flows.ts` | Flow types |
| `types/state.ts` | State machine types |
| `types/context.ts` | Context types |
| `types/actions.ts` | Action types |
| `types/guards.ts` | Guard types |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/onboarding/types.ts` | Replace with re-export from types/ |

---

## Testing Requirements

1. **Type Check**
   - All imports resolve
   - No type errors

2. **Existing Tests**
   - All onboarding tests pass

---

## Acceptance Criteria

- [x] Types split into focused files
- [x] Barrel export maintains backwards compatibility
- [x] All existing tests pass
- [x] `npm run type-check` passes

---

## Implementation Summary

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `types/index.ts` | 69 | Barrel export - re-exports all types |
| `types/steps.ts` | 43 | Platform and step ID types |
| `types/context.ts` | 94 | OnboardingContext interface |
| `types/actions.ts` | 169 | All step action types |
| `types/config.ts` | 143 | Step configuration types |
| `types/components.ts` | 57 | Component props and step types |
| `types/flows.ts` | 48 | Flow config and registry types |
| `types/state.ts` | 46 | Persisted state types |
| `types/hooks.ts` | 109 | Hook return types |

### Files Modified

| File | Change |
|------|--------|
| `src/components/onboarding/types.ts` | Replaced 629-line file with re-export from types/ directory (53 lines) |

### Deviations from Proposal

The proposed structure included `guards.ts` but the actual codebase had guard logic embedded in `config.ts` via `isStepComplete`, `shouldShow`, and `canProceed` function types. Instead, the split created:
- `components.ts` - Component-related types
- `config.ts` - Step configuration including guard functions
- `hooks.ts` - Hook types for orchestrator

This better reflects the actual domain boundaries in the codebase.

### Quality Verification

- `npm run type-check`: PASS
- `npm run lint`: PASS (warnings only, pre-existing in other files)
- `npm test`: 113 suites, 2723 tests PASS

---

## Branch

```
feature/TASK-613-onboarding-types-split
```
