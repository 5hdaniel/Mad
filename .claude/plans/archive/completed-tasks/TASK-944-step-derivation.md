# Task TASK-944: Create Step Derivation Module

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

## Goal

Create a step derivation module with pure functions that derive the current onboarding step and navigation target from state machine state. These functions replace the complex effect-based logic in `useNavigationFlow`.

## Non-Goals

- Do NOT modify `useNavigationFlow` (that's TASK-945)
- Do NOT add React hooks to this module (pure functions only)
- Do NOT add side effects (API calls, navigation)
- Do NOT add state machine actions

## Deliverables

1. New file: `src/appCore/state/machine/derivation/index.ts` - Barrel export
2. New file: `src/appCore/state/machine/derivation/stepDerivation.ts` - Step derivation logic
3. New file: `src/appCore/state/machine/derivation/navigationDerivation.ts` - Navigation target derivation
4. New file: `src/appCore/state/machine/derivation/__tests__/stepDerivation.test.ts` - Tests
5. New file: `src/appCore/state/machine/derivation/__tests__/navigationDerivation.test.ts` - Tests
6. Update: `src/appCore/state/machine/index.ts` - Export derivation functions

## Acceptance Criteria

- [ ] `deriveCurrentStep(state)` returns current onboarding step or null
- [ ] `deriveNextStep(state, currentStep)` returns next step in sequence
- [ ] `deriveNavigationTarget(state)` returns screen and params to navigate to
- [ ] `shouldShowOnboarding(state)` returns boolean
- [ ] All functions are pure (no side effects)
- [ ] All functions are fully typed
- [ ] Comprehensive unit tests for each function
- [ ] All CI checks pass

## Implementation Notes

### Step Derivation

```typescript
// src/appCore/state/machine/derivation/stepDerivation.ts
import { AppState, OnboardingStep } from '../types';

// Step ordering (matches existing OnboardingFlow.tsx)
const STEP_ORDER: OnboardingStep[] = [
  'terms',
  'phone-type',
  'email',
  'apple-driver-setup',  // macOS iPhone only
  'android-coming-soon', // Android selection
  'permissions'
];

/**
 * Derives the current onboarding step from state.
 * Returns null if not in onboarding.
 */
export function deriveCurrentStep(state: AppState): OnboardingStep | null {
  if (state.status !== 'onboarding') {
    return null;
  }
  return state.step;
}

/**
 * Derives the next step after the given step.
 * Platform-aware: skips apple-driver-setup on Windows, etc.
 */
export function deriveNextStep(
  currentStep: OnboardingStep,
  platform: 'darwin' | 'win32',
  phoneType: 'iphone' | 'android' | null
): OnboardingStep | null {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  if (currentIndex === -1) return null;

  for (let i = currentIndex + 1; i < STEP_ORDER.length; i++) {
    const nextStep = STEP_ORDER[i];

    // Skip apple-driver-setup if not macOS + iPhone
    if (nextStep === 'apple-driver-setup') {
      if (platform !== 'darwin' || phoneType !== 'iphone') {
        continue;
      }
    }

    // Skip android-coming-soon if not Android
    if (nextStep === 'android-coming-soon') {
      if (phoneType !== 'android') {
        continue;
      }
    }

    return nextStep;
  }

  return null; // Onboarding complete
}

/**
 * Determines if the given step is complete based on state.
 */
export function isStepComplete(
  step: OnboardingStep,
  state: AppState
): boolean {
  if (state.status === 'ready') {
    return true; // All steps complete if app is ready
  }

  if (state.status !== 'onboarding') {
    return false;
  }

  const stepIndex = STEP_ORDER.indexOf(step);
  const currentIndex = STEP_ORDER.indexOf(state.step);

  return stepIndex < currentIndex;
}
```

### Navigation Derivation

```typescript
// src/appCore/state/machine/derivation/navigationDerivation.ts
import { AppState, OnboardingStep } from '../types';

// Navigation target type
export interface NavigationTarget {
  screen: 'loading' | 'login' | 'onboarding' | 'dashboard' | 'error';
  params?: {
    phase?: string;
    step?: OnboardingStep;
    error?: { code: string; message: string };
  };
}

/**
 * Derives the navigation target from current state.
 * This is a pure function that returns WHAT to show, not HOW to navigate.
 */
export function deriveNavigationTarget(state: AppState): NavigationTarget {
  switch (state.status) {
    case 'loading':
      return {
        screen: 'loading',
        params: { phase: state.phase }
      };

    case 'unauthenticated':
      return { screen: 'login' };

    case 'onboarding':
      return {
        screen: 'onboarding',
        params: { step: state.step }
      };

    case 'ready':
      return { screen: 'dashboard' };

    case 'error':
      return {
        screen: 'error',
        params: { error: state.error }
      };
  }
}

/**
 * Determines if onboarding should be shown.
 */
export function shouldShowOnboarding(state: AppState): boolean {
  return state.status === 'onboarding';
}

/**
 * Determines if the app is ready for normal use.
 */
export function isAppReady(state: AppState): boolean {
  return state.status === 'ready';
}

/**
 * Determines if we're in any loading state.
 */
export function isLoading(state: AppState): boolean {
  return state.status === 'loading';
}
```

### Barrel Export

```typescript
// src/appCore/state/machine/derivation/index.ts
export * from './stepDerivation';
export * from './navigationDerivation';
```

## Integration Notes

- Imports from: `types.ts` (Phase 1)
- Exports to: All components needing navigation logic
- Used by: TASK-945 (useNavigationFlow migration)
- Depends on: SPRINT-020 (Phase 1 complete)

## Do / Don't

### Do:

- Keep all functions pure (no side effects)
- Use TypeScript discriminated union narrowing
- Test all edge cases (each state type)
- Handle platform-specific step skipping

### Don't:

- Add React hooks to this module
- Make API calls from these functions
- Add mutable state
- Navigate imperatively from these functions

## When to Stop and Ask

- If step order doesn't match existing OnboardingFlow.tsx
- If platform detection pattern is unclear
- If new steps need to be added to STEP_ORDER
- If unsure about step skip conditions

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `deriveCurrentStep` with each state type
  - `deriveNextStep` with all step combinations
  - `deriveNextStep` with platform variations
  - `deriveNavigationTarget` with each state type
  - `shouldShowOnboarding` with each state type
  - `isStepComplete` with various state combinations
- Existing tests to update:
  - None (new files only)

### Coverage

- Coverage impact: New code with tests
- Target: 100% for pure functions

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(state): add step and navigation derivation module`
- **Labels**: `state-machine`, `phase-2`, `infrastructure`
- **Branch From**: `project/state-coordination`
- **Branch Into**: `project/state-coordination`
- **Branch Name**: `feature/TASK-944-step-derivation`
- **Depends on**: None (can run parallel with TASK-940)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 5 new files | +20K |
| Files to modify | 1 barrel export | +2K |
| Code volume | ~250 lines | +10K |
| Test complexity | Low (pure functions) | +8K |

**Confidence:** High

**Risk factors:**
- Step ordering may need adjustment from existing code
- Platform-specific logic complexity

**Similar past tasks:** TASK-940 (selectors, ~30K est)

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
- [ ] src/appCore/state/machine/derivation/index.ts
- [ ] src/appCore/state/machine/derivation/stepDerivation.ts
- [ ] src/appCore/state/machine/derivation/navigationDerivation.ts
- [ ] src/appCore/state/machine/derivation/__tests__/stepDerivation.test.ts
- [ ] src/appCore/state/machine/derivation/__tests__/navigationDerivation.test.ts

Features implemented:
- [ ] deriveCurrentStep function
- [ ] deriveNextStep function with platform awareness
- [ ] deriveNavigationTarget function
- [ ] shouldShowOnboarding helper
- [ ] isStepComplete helper
- [ ] All barrel exports

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~40K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-03
**Status:** APPROVED WITH REQUIRED CHANGES

### Branch Information (SR Engineer Assigned)

- **Branch From:** `project/state-coordination` (AFTER TASK-940 merges)
- **Branch Into:** `project/state-coordination`
- **Branch Name:** `feature/TASK-944-step-derivation`

### Execution Classification

- **Parallel Safe:** No (must run AFTER TASK-940 due to barrel export conflict)
- **Depends On:** TASK-940 (barrel export conflict)
- **Blocks:** TASK-945

### CRITICAL: Step Name Corrections Required

**The task file contains incorrect step names. Use Phase 1 types:**

Phase 1 `OnboardingStep` type (`src/appCore/state/machine/types.ts`):
```typescript
export type OnboardingStep =
  | "phone-type"
  | "secure-storage"
  | "email-connect"
  | "permissions"
  | "apple-driver"
  | "android-coming-soon";
```

**Task file incorrectly references:**
- `'terms'` - NOT in OnboardingStep (handled as modal, not step)
- `'apple-driver-setup'` - Should be `'apple-driver'`
- `'email'` - Should be `'email-connect'`

**Correct STEP_ORDER:**
```typescript
const STEP_ORDER: OnboardingStep[] = [
  'phone-type',
  'secure-storage',      // macOS only
  'email-connect',
  'permissions',         // macOS only
  'apple-driver',        // Windows + iPhone only
  'android-coming-soon', // Android only
];
```

### Barrel Export Conflict

This task modifies `src/appCore/state/machine/index.ts`. TASK-940 also modifies this file. **Wait for TASK-940 to merge before starting this task.**

### Shared File Analysis

- **Files created:** derivation module (new)
- **Files modified:** `src/appCore/state/machine/index.ts` (also modified by TASK-940)
- **Conflicts with:** TASK-940 (barrel export)

---

## SR Engineer Review (SR-Owned)

*Review Date: 2026-01-04*

### Metrics

| Phase | Turns | Time |
|-------|-------|------|
| Code Review | 1 | ~3 min |
| CI Wait | - | ~3 min |
| **Total** | **1** | **~6 min** |

### Review Summary

**Architecture Compliance:** PASS
**Security Review:** N/A (pure functions, no data handling)
**Test Coverage:** Adequate (110 tests, comprehensive platform coverage)

**Review Notes:**

1. **Step names correct** - Uses Phase 1 `OnboardingStep` types exactly as defined in `types.ts`
2. **Pure functions verified** - All 15 functions are pure (no hooks, no side effects, no mutations)
3. **STEP_ORDER consistency** - Matches existing `userDataSelectors.ts` definition
4. **Platform logic correct** - Step skipping rules properly implement platform-specific flows
5. **Excellent execution** - 4 turns, ~16K tokens (60% under 40K estimate)

**CI Results:**
- Test & Lint (macOS-latest, 20.x): PASS (1m34s)
- Test & Lint (Windows-latest, 20.x): PASS (2m14s)
- Security Audit: PASS (12s)
- Build Application (macOS/Windows): PASS

### Merge Information

**PR Number:** #296
**Merge Commit:** 98c222e4a35fa1810904d3c91abd8e017c4a0e61
**Merged To:** project/state-coordination
**Merged By:** 5hdaniel
**Merged At:** 2026-01-04T04:42:49Z
