# Task TASK-945: Migrate useNavigationFlow Effects to State Derivation

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## HIGH RISK TASK

This is the highest risk task in SPRINT-021. `useNavigationFlow` at ~360 lines contains complex effect-based navigation logic that has been the source of recurring bugs (navigation loops, race conditions).

**Budget:** 80K tokens (320K cap)
**Approach:** Incremental, test-driven, with fallback preservation

---

## Goal

Migrate `useNavigationFlow` hook to use state machine derivation instead of effect-based navigation logic. Replace complex effects with simple derived values while maintaining identical consumer behavior.

## Non-Goals

- Do NOT remove legacy implementation (keep for fallback)
- Do NOT change the hook's public interface
- Do NOT modify components that consume this hook
- Do NOT break existing onboarding flow

## Deliverables

1. Update: `src/hooks/useNavigationFlow.ts` - Add state machine path
2. New file: `src/hooks/__tests__/useNavigationFlow.machine.test.ts` - Tests for new path
3. Update: `src/hooks/__tests__/useNavigationFlow.test.ts` - Ensure legacy tests pass

## Acceptance Criteria

- [ ] Hook returns same interface regardless of feature flag
- [ ] When flag enabled: navigation derived from state machine
- [ ] When flag disabled: legacy behavior unchanged
- [ ] No navigation loops in new path
- [ ] No race conditions in new path
- [ ] `currentStep` derived correctly for all states
- [ ] `shouldNavigateTo` returns correct screens
- [ ] Effect-based logic replaced with derived values
- [ ] All existing tests pass
- [ ] New comprehensive tests for state machine path
- [ ] All CI checks pass

## Implementation Notes

### Current Hook Complexity

From BACKLOG-142:
> `useNavigationFlow` (360 lines) - tries to coordinate via complex effects
> Effect has 15+ dependencies, runs on every change
> Guards rely on multiple conditions that race against each other

### Current Interface (Verify Against Actual)

```typescript
interface UseNavigationFlowReturn {
  currentStep: OnboardingStep | null;
  shouldNavigateTo: (screen: ScreenName) => boolean;
  isNavigating: boolean;
  navigateToStep: (step: OnboardingStep) => void;
  completeCurrentStep: () => void;
}
```

### Migration Strategy

**Key Insight:** The effect-based approach tried to PUSH navigation. The new approach DERIVES what should be shown.

Instead of:
```typescript
// OLD: Effect-based (problematic)
useEffect(() => {
  if (condition1 && condition2 && !condition3) {
    navigate('/onboarding');
  }
}, [condition1, condition2, condition3, navigate]);
```

Use:
```typescript
// NEW: Derivation-based
const { state } = useOptionalMachineState();
const target = deriveNavigationTarget(state);
// Consumer uses `target.screen` to conditionally render
```

### Migration Pattern

```typescript
// src/hooks/useNavigationFlow.ts
import {
  useOptionalMachineState,
  deriveNavigationTarget,
  deriveCurrentStep,
  deriveNextStep,
  NavigationTarget
} from '../appCore/state/machine';

export function useNavigationFlow(): UseNavigationFlowReturn {
  const machineState = useOptionalMachineState();

  // NEW PATH: State machine derivation
  if (machineState) {
    const { state, dispatch } = machineState;

    // Derive current step from state
    const currentStep = deriveCurrentStep(state);

    // Derive navigation target
    const navigationTarget = deriveNavigationTarget(state);

    // shouldNavigateTo is now a simple comparison
    const shouldNavigateTo = useCallback((screen: ScreenName): boolean => {
      return navigationTarget.screen === screen;
    }, [navigationTarget.screen]);

    // No more "isNavigating" race condition - always derived
    const isNavigating = state.status === 'loading';

    // navigateToStep dispatches action instead of imperative navigation
    const navigateToStep = useCallback((step: OnboardingStep) => {
      // This should rarely be called - state machine handles navigation
      dispatch({ type: 'SET_ONBOARDING_STEP', step });
    }, [dispatch]);

    // completeCurrentStep advances to next step
    const completeCurrentStep = useCallback(() => {
      if (currentStep) {
        dispatch({ type: 'ONBOARDING_COMPLETE', step: currentStep });
      }
    }, [currentStep, dispatch]);

    return {
      currentStep,
      shouldNavigateTo,
      isNavigating,
      navigateToStep,
      completeCurrentStep,
    };
  }

  // LEGACY PATH: Existing implementation (unchanged)
  // Keep all 360 lines of existing logic for fallback
}
```

### Effect Removal Checklist

The new path should NOT have effects for:
- [ ] Navigation decisions (derived instead)
- [ ] Step transitions (dispatch actions)
- [ ] Guard condition checks (derived from state)
- [ ] "Waiting for" conditions (state machine handles)

### Action Additions (If Needed)

If state machine is missing required actions, document and add:

```typescript
// May need to add to reducer
| { type: 'SET_ONBOARDING_STEP'; step: OnboardingStep }
```

## Integration Notes

- Imports from: All utilities from TASK-940, TASK-944
- Depends on: TASK-941, TASK-942, TASK-943 (migrated hooks)
- Exports to: Components that use `useNavigationFlow`
- Used by: `OnboardingFlow.tsx`, `AppRouter.tsx`

## Do / Don't

### Do:

- Keep legacy code intact (wrapped in `else` branch)
- Use derivation functions from TASK-944
- Test navigation scenarios thoroughly
- Document any new actions added

### Don't:

- Remove any existing effects from legacy path
- Add new effects to new path
- Change the return type interface
- Skip testing edge cases

## When to Stop and Ask

- If state machine needs new actions not defined in Phase 1
- If navigation behavior differs between paths
- If existing tests fail after migration
- If you hit the 80K token estimate
- If unsure about effect removal safety

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `shouldNavigateTo` returns correct value for each screen
  - `currentStep` derived correctly for each onboarding state
  - `completeCurrentStep` dispatches correct action
  - `navigateToStep` dispatches correct action
  - No re-renders during navigation (no effect loops)
- Existing tests to update:
  - Ensure all legacy path tests pass

### Coverage

- Coverage impact: Should increase
- Target: >80% for new navigation logic

### Integration / Feature Tests

- Required scenarios:
  - New user full onboarding flow (state machine path)
  - Returning user direct to dashboard (state machine path)
  - Step skip scenarios
  - Error recovery navigation

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (including existing)
- [ ] Integration tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(hooks): migrate useNavigationFlow to state derivation`
- **Labels**: `state-machine`, `phase-2`, `migration`, `high-risk`
- **Branch From**: `project/state-coordination`
- **Branch Into**: `project/state-coordination`
- **Branch Name**: `feature/TASK-945-migrate-navigation-flow`
- **Depends on**: TASK-944, TASK-941, TASK-942, TASK-943

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~80K

**Token Cap:** 320K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 test file | +15K |
| Files to modify | 2 files (hook + existing tests) | +40K |
| Code volume | ~200 lines new (preserving ~360 legacy) | +15K |
| Test complexity | High (navigation scenarios) | +10K |

**Confidence:** Low (HIGH RISK TASK)

**Risk factors:**
- Complex effect logic to understand and preserve
- Navigation edge cases may be hidden
- May need additional state machine actions
- Integration with all prior migrations

**Similar past tasks:** No direct comparison (unique complexity)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] src/hooks/__tests__/useNavigationFlow.machine.test.ts

Files modified:
- [ ] src/hooks/useNavigationFlow.ts
- [ ] src/hooks/__tests__/useNavigationFlow.test.ts (if needed)

Features implemented:
- [ ] State machine path in useNavigationFlow
- [ ] shouldNavigateTo using derivation
- [ ] currentStep from state machine
- [ ] completeCurrentStep dispatch
- [ ] navigateToStep dispatch
- [ ] No effect loops in new path

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Existing tests still pass
- [ ] Manual test: new user onboarding
- [ ] Manual test: returning user
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~80K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~80K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-03
**Status:** APPROVED - HIGH RISK CONFIRMED

### Branch Information (SR Engineer Assigned)

- **Branch From:** `project/state-coordination`
- **Branch Into:** `project/state-coordination`
- **Branch Name:** `feature/TASK-945-migrate-navigation-flow`

### Execution Classification

- **Parallel Safe:** No
- **Depends On:** TASK-941, TASK-942, TASK-943, TASK-944
- **Blocks:** TASK-946

### HIGH RISK ASSESSMENT

**Confirmed Risk Factors:**

1. **Hook Complexity:** 360 lines with 20+ dependencies in main effect
2. **Type Mismatch:** Hook uses `AppStep` type, not `OnboardingStep`
   - `AppStep` includes: `"loading"`, `"login"`, `"keychain-explanation"`, `"phone-type-selection"`, `"email-onboarding"`, etc.
   - These are UI routes, not onboarding step types
3. **Platform Logic:** Complex macOS vs Windows branching
4. **Multiple User Paths:** New users vs returning users have different flows

**Risk Mitigation:**
- 80K token estimate with 320K cap is appropriate
- Legacy path MUST remain intact as fallback
- If token budget is exceeded, STOP and report

### Missing Action Note

The task references `SET_ONBOARDING_STEP` action but Phase 1 does NOT provide this. Options:
1. Use derivation-only approach (no imperative navigation)
2. Add the action during this task (document as DEVIATION)

### Shared File Analysis

- **File modified:** `src/appCore/state/flows/useNavigationFlow.ts`
- **Conflicts with:** None

### Terminology Warning

The hook manages **AppStep** (UI routes) not **OnboardingStep** (state machine steps). The derivation-based approach must translate between these concepts.

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### HIGH RISK REVIEW CHECKLIST

- [ ] No navigation loops in new path
- [ ] No race conditions possible
- [ ] Effect removal is safe
- [ ] Legacy fallback intact
- [ ] All edge cases tested
- [ ] AppStep to OnboardingStep translation correct

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/state-coordination
