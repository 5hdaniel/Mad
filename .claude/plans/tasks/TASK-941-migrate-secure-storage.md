# Task TASK-941: Migrate useSecureStorage to State Machine

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

Migrate `useSecureStorage` hook to optionally derive its state from the new state machine when the feature flag is enabled. The hook should maintain identical behavior for consumers while using the state machine as the source of truth.

## Non-Goals

- Do NOT remove the legacy implementation code
- Do NOT change the hook's public interface
- Do NOT modify components that consume this hook
- Do NOT add new features to the hook

## Deliverables

1. Update: `src/hooks/useSecureStorage.ts` - Add state machine path
2. New file: `src/hooks/__tests__/useSecureStorage.machine.test.ts` - Tests for new path

## Acceptance Criteria

- [ ] Hook returns same interface regardless of feature flag
- [ ] When flag enabled: state derived from state machine
- [ ] When flag disabled: legacy behavior unchanged
- [ ] `isDatabaseInitialized` reflects state machine status
- [ ] `isCheckingSecureStorage` reflects state machine phase
- [ ] `initializeSecureStorage` dispatches to state machine
- [ ] No regressions in existing tests
- [ ] New tests for state machine path
- [ ] All CI checks pass

## Implementation Notes

### Current Hook Interface

First, examine the current hook to understand its interface:

```typescript
// Current interface (DO NOT CHANGE)
interface UseSecureStorageReturn {
  isDatabaseInitialized: boolean;
  isCheckingSecureStorage: boolean;
  secureStorageError: string | null;
  initializeSecureStorage: () => Promise<void>;
  hasKeyStore: boolean;
}
```

### Migration Pattern

```typescript
// src/hooks/useSecureStorage.ts
import { useOptionalMachineState, selectIsDatabaseInitialized, selectIsCheckingSecureStorage } from '../appCore/state/machine';

export function useSecureStorage(): UseSecureStorageReturn {
  const machineState = useOptionalMachineState();

  // NEW PATH: State machine is source of truth
  if (machineState) {
    const { state, dispatch } = machineState;

    const isDatabaseInitialized = selectIsDatabaseInitialized(state);
    const isCheckingSecureStorage = selectIsCheckingSecureStorage(state);
    const hasKeyStore = state.status !== 'loading' ||
      !['checking-storage'].includes(state.phase);

    // Extract error if in error state
    const secureStorageError = state.status === 'error' &&
      state.error.code === 'DB_INIT_FAILED'
        ? state.error.message
        : null;

    // Initialize dispatches action instead of managing local state
    const initializeSecureStorage = useCallback(async () => {
      // The loading orchestrator handles this via state machine
      // This is now a no-op when using state machine
      // (initialization happens automatically in LoadingOrchestrator)
    }, []);

    return {
      isDatabaseInitialized,
      isCheckingSecureStorage,
      secureStorageError,
      initializeSecureStorage,
      hasKeyStore,
    };
  }

  // LEGACY PATH: Existing implementation (unchanged)
  const [isDatabaseInitialized, setIsDatabaseInitialized] = useState(false);
  const [isCheckingSecureStorage, setIsCheckingSecureStorage] = useState(true);
  const [secureStorageError, setSecureStorageError] = useState<string | null>(null);
  const [hasKeyStore, setHasKeyStore] = useState(false);

  // ... rest of existing implementation unchanged
}
```

### Important Considerations

1. **Initialization Flow Change**: With the state machine, initialization is handled by `LoadingOrchestrator`. The `initializeSecureStorage` function becomes a no-op when state machine is active.

2. **Error Mapping**: Map state machine error states to the hook's error format.

3. **hasKeyStore Derivation**: This can be derived from whether we've passed the storage check phase.

## Integration Notes

- Imports from: `useOptionalMachineState`, selectors from TASK-940
- Exports to: Components that use `useSecureStorage`
- Used by: `useAppStateMachine.ts`, various components
- Depends on: TASK-940 (migration utilities)

## Do / Don't

### Do:

- Keep legacy code intact (wrapped in `else` branch)
- Use selectors from TASK-940 for state derivation
- Add comprehensive tests for new path
- Document behavior differences (if any)

### Don't:

- Remove any existing code
- Change the return type interface
- Add new state machine actions without documenting
- Break existing consumers

## When to Stop and Ask

- If hook interface needs to change for state machine support
- If state machine is missing required state for derivation
- If unsure how to handle `initializeSecureStorage` behavior change
- If existing tests start failing unexpectedly

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Hook with state machine enabled returns correct interface
  - `isDatabaseInitialized` reflects state machine status
  - `isCheckingSecureStorage` reflects loading phase
  - `secureStorageError` maps from state machine errors
  - `initializeSecureStorage` is callable (no-op in new path)
- Existing tests to update:
  - Ensure all existing tests still pass (legacy path)

### Coverage

- Coverage impact: Should increase (new code paths)
- Target: Maintain or improve current coverage

### Integration / Feature Tests

- Required scenarios:
  - Full initialization flow with state machine
  - Error recovery path with state machine

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (including existing)
- [ ] Integration tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(hooks): migrate useSecureStorage to state machine`
- **Labels**: `state-machine`, `phase-2`, `migration`
- **Branch From**: `project/state-coordination`
- **Branch Into**: `project/state-coordination`
- **Branch Name**: `feature/TASK-941-migrate-secure-storage`
- **Depends on**: TASK-940

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~60K

**Token Cap:** 240K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 test file | +10K |
| Files to modify | 1 hook file | +25K |
| Code volume | ~150 lines new, ~50 lines tests | +15K |
| Test complexity | High (mock state machine) | +10K |

**Confidence:** Medium

**Risk factors:**
- Hook interface may have hidden dependencies
- Initialization behavior change may affect consumers
- May need additional state machine actions

**Similar past tasks:** TASK-929 (context work, ~45K actual)

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
- [ ] src/hooks/__tests__/useSecureStorage.machine.test.ts

Files modified:
- [ ] src/hooks/useSecureStorage.ts

Features implemented:
- [ ] State machine path in useSecureStorage
- [ ] Selector usage for state derivation
- [ ] Error mapping
- [ ] Tests for new path

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Existing tests still pass
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

**Variance:** PM Est ~60K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~60K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-03
**Status:** APPROVED

### Branch Information (SR Engineer Assigned)

- **Branch From:** `project/state-coordination`
- **Branch Into:** `project/state-coordination`
- **Branch Name:** `feature/TASK-941-migrate-secure-storage`

### Execution Classification

- **Parallel Safe:** Yes (after TASK-940 merges)
- **Depends On:** TASK-940
- **Blocks:** TASK-945

### Technical Notes

**IMPORTANT: Actual Hook Interface Differs from Task Description**

The actual `useSecureStorage` hook at `src/appCore/state/flows/useSecureStorage.ts` (469 lines) has this interface:

```typescript
interface UseSecureStorageReturn {
  hasSecureStorageSetup: boolean;      // Not in task description
  isCheckingSecureStorage: boolean;
  isDatabaseInitialized: boolean;
  isInitializingDatabase: boolean;     // Not in task description
  skipKeychainExplanation: boolean;    // Not in task description
  initializeSecureStorage: (dontShowAgain: boolean) => Promise<boolean>;
}
```

Engineer must:
1. Verify the actual interface first
2. Map all properties to state machine equivalents
3. Preserve the complex initialization logic in legacy path

### Shared File Analysis

- **File modified:** `src/appCore/state/flows/useSecureStorage.ts`
- **Conflicts with:** None (only this task modifies this file)

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

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/state-coordination
