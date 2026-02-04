# Task TASK-1816: Migrate usePermissionsFlow to State Machine

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Migrate `usePermissionsFlow` hook to derive all state from the state machine instead of managing parallel `useState` for `hasPermissions`. This eliminates race conditions where hook state and machine state diverge.

## Non-Goals

- Do NOT change the hook's public interface (keep return type shape)
- Do NOT modify how permissions are actually checked (system calls)
- Do NOT add new permission types
- Do NOT change the PermissionsStep component

## Deliverables

1. Update: `src/appCore/state/flows/usePermissionsFlow.ts`
2. Update: `src/appCore/state/machine/reducer.ts` - Add PERMISSION_CHECKED action if needed
3. Update: `src/appCore/state/machine/types.ts` - Add action type if needed

## Acceptance Criteria

- [ ] `usePermissionsFlow` no longer uses `useState` for `hasPermissions`
- [ ] Permission state derived from state machine via selector
- [ ] `checkPermissions()` dispatches result to state machine
- [ ] No parallel state management for permissions
- [ ] All existing tests pass
- [ ] TypeScript strict mode compliant
- [ ] All CI checks pass

## Implementation Notes

### Current State (Problem)

```typescript
// usePermissionsFlow.ts
export function usePermissionsFlow({ ... }): UsePermissionsFlowReturn {
  // PROBLEM: Parallel state management
  const [hasPermissions, setHasPermissions] = useState<boolean>(true);

  const checkPermissions = useCallback(async () => {
    const result = await systemService.checkAllPermissions();
    setHasPermissions(result.data?.allGranted ?? false);
    // Machine state NOT updated - divergence possible
  }, []);

  const handlePermissionsGranted = useCallback(() => {
    setHasPermissions(true);  // Updates local state
    stateMachineDispatch?.({ type: "ONBOARDING_STEP_COMPLETE", step: "permissions" });
    // Now machine state is updated, but there was a window of divergence
  }, []);
}
```

### Target State (Solution)

```typescript
// usePermissionsFlow.ts
export function usePermissionsFlow({ ... }): UsePermissionsFlowReturn {
  const machineState = useMachineState();

  // DERIVE from state machine - single source of truth
  const hasPermissions = selectHasPermissions(machineState.state);

  const checkPermissions = useCallback(async () => {
    const result = await systemService.checkAllPermissions();
    const granted = result.success && result.data?.allGranted;

    // Update machine state immediately
    machineState.dispatch({
      type: "PERMISSION_CHECKED",
      hasPermissions: granted,
    });
  }, [machineState]);

  const handlePermissionsGranted = useCallback(() => {
    machineState.dispatch({ type: "ONBOARDING_STEP_COMPLETE", step: "permissions" });
  }, [machineState]);

  return {
    hasPermissions: hasPermissions ?? false,  // Convert undefined to false for interface
    // ... rest
  };
}
```

### New Action Type (if needed)

Add to `types.ts`:
```typescript
interface PermissionCheckedAction {
  type: "PERMISSION_CHECKED";
  hasPermissions: boolean;
}
```

Add to reducer:
```typescript
case "PERMISSION_CHECKED":
  if (state.status === "loading" || state.status === "onboarding") {
    return {
      ...state,
      hasPermissions: action.hasPermissions,
    };
  }
  return state;
```

### Alternative: Use Existing Action

If `ONBOARDING_STEP_COMPLETE` with step "permissions" already updates hasPermissions in state, we may only need to add a `PERMISSION_CHECK_RESULT` action for the async check result. Review the reducer first.

### Key Files to Read First

1. `src/appCore/state/flows/usePermissionsFlow.ts` - Current implementation
2. `src/appCore/state/machine/reducer.ts` - How permission state is tracked
3. `src/appCore/state/machine/types.ts` - Available actions
4. `src/appCore/state/machine/selectors/userDataSelectors.ts` - selectHasPermissions

### Keep Interface Stable

The return type must stay the same for backwards compatibility:

```typescript
export interface UsePermissionsFlowReturn {
  hasPermissions: boolean;  // NOT boolean | undefined
  appPath: string;
  setHasPermissions: (value: boolean) => void;  // Can be no-op now
  handlePermissionsGranted: () => void;
  checkPermissions: () => Promise<void>;
}
```

For `setHasPermissions`, either:
1. Make it dispatch to state machine, or
2. Make it a no-op with a deprecation warning (state is derived)

## Integration Notes

- Imports from: State machine context, selectors
- Exports to: OnboardingFlow, PermissionsStep
- Used by: useAppStateMachine.ts (orchestrator)
- Depends on: TASK-1815 (selectors consolidated)

## Do / Don't

### Do:
- Keep the hook's return type interface stable
- Dispatch to state machine instead of local setState
- Use selectors to derive state
- Handle undefined from selector (convert to false for interface)

### Don't:
- Change the hook's public interface signature
- Add new parameters to the hook
- Modify how system permissions are checked
- Remove the appPath state (that's local UI state, fine to keep)

## When to Stop and Ask

- If reducer changes are more complex than adding one action
- If other hooks depend on usePermissionsFlow's state updates
- If tests require significant rewriting

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing tests
- Tests to modify:
  - `usePermissionsFlow.test.ts` - Mock state machine instead of local state
- New tests to add:
  - Test that checkPermissions dispatches to state machine
  - Test that hasPermissions is derived from machine state

### Coverage

- Coverage impact: Should remain same or improve

### Manual Testing

1. macOS: Start onboarding, reach permissions step
2. Grant Full Disk Access
3. Verify step completes and advances
4. Quit app, reopen - verify permission state persists

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3-4 files | +6K |
| Reducer changes | 1 new action | +3K |
| Hook refactor | Moderate complexity | +4K |
| Test updates | 1 test file | +2K |

**Confidence:** Medium - depends on reducer complexity

**Risk factors:**
- Reducer may need more changes than expected
- Other components may depend on local state updates

**Similar past tasks:** Hook refactors typically come in at 1x estimate

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/appCore/state/flows/usePermissionsFlow.ts
- [ ] src/appCore/state/machine/reducer.ts (if needed)
- [ ] src/appCore/state/machine/types.ts (if needed)

Changes made:
- [ ] useState for hasPermissions removed
- [ ] hasPermissions derived from selector
- [ ] checkPermissions dispatches to state machine
- [ ] Interface remains stable

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test: permissions flow on macOS
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~15K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

**Reducer changes made:**
<Describe action added or none>

**Deviations from plan:**
<None or description>

**Issues encountered:**
<None or description>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**State Machine Integration:** PASS / FAIL
**No Parallel State:** PASS / FAIL
**Interface Stability:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
