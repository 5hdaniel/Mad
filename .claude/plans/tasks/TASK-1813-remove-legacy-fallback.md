# Task TASK-1813: Remove Legacy Fallback from OnboardingFlow.tsx

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

Remove the dead legacy fallback code path in `OnboardingFlow.tsx` (lines 128-144) that never executes because the state machine is now always enabled.

## Non-Goals

- Do NOT remove the state machine feature flag yet (that's TASK-1814)
- Do NOT change the OnboardingFlow component interface
- Do NOT modify other onboarding components
- Do NOT change how appState is constructed when machineState exists

## Deliverables

1. Update: `src/components/onboarding/OnboardingFlow.tsx` - Remove legacy fallback branch

## Acceptance Criteria

- [ ] Lines 128-144 (legacy fallback in useMemo) removed
- [ ] useMemo only has the machineState branch
- [ ] Component still renders correctly for all onboarding steps
- [ ] All existing tests pass
- [ ] TypeScript strict mode compliant
- [ ] All CI checks pass

## Implementation Notes

### Code to Remove

In `OnboardingFlow.tsx`, the `useMemo` for `appState` currently has two branches:

```typescript
const appState: OnboardingAppState = useMemo(() => {
  if (machineState) {
    // State machine enabled - derive from state machine (KEEP THIS)
    const { state } = machineState;
    // ... lines 105-126
    return {
      phoneType: selectPhoneType(state),
      // ... state machine derived values
    };
  }

  // Legacy fallback - use app properties directly (REMOVE THIS)
  // Note: Legacy path doesn't have nullable semantics, but this path is rarely used
  return {
    phoneType: app.selectedPhoneType,
    emailConnected: app.hasEmailConnected,
    // ... legacy values
  };
}, [machineState, app, currentUserInLocalDb]);
```

**After this task, the useMemo should only have the machineState branch.**

Since `machineState` is now always defined (feature flag defaults to true), the legacy fallback is dead code.

### Verification Before Removal

Before removing, verify that `machineState` is always truthy:

1. Check `useOptionalMachineState()` implementation
2. Verify `isNewStateMachineEnabled()` defaults to `true` in `featureFlags.ts`
3. Confirm no production users have explicitly disabled the flag

### Key Files to Read First

1. `src/components/onboarding/OnboardingFlow.tsx` - The file to modify
2. `src/appCore/state/machine/utils/featureFlags.ts` - Verify default is true
3. `src/appCore/state/machine/AppStateContext.tsx` - Verify machineState provision

### What to Keep

- The machineState branch (lines 104-126)
- The useMemo dependencies array
- The OnboardingAppState type
- All other code in the component

## Integration Notes

- Imports from: State machine selectors (unchanged)
- Used by: AppRouter when status is "onboarding"
- Depends on: None (first task in sprint)
- Blocks: TASK-1814 (simpler to remove feature flag after legacy code gone)

## Do / Don't

### Do:
- Keep the machineState branch intact
- Update useMemo to not need the conditional
- Keep the dependency array accurate
- Run tests after removal

### Don't:
- Remove the feature flag check yet (that's TASK-1814)
- Change the component interface
- Modify other components
- Add new functionality

## When to Stop and Ask

- If `useOptionalMachineState()` can return null in any scenario
- If you find code that explicitly disables the feature flag in production
- If removing the fallback causes test failures you can't resolve

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- Existing tests to verify:
  - OnboardingFlow renders all step types
  - Navigation between steps works
  - Action handlers are called correctly

### Coverage

- Coverage impact: Should not decrease (removing dead code)

### Manual Testing

1. Start app as new user
2. Verify phone-type step renders
3. Complete through to dashboard
4. Verify no console errors about undefined state

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 | +2K |
| Lines to remove | ~20 lines | +2K |
| Test verification | Low complexity | +2K |
| Buffer for investigation | Conservative | +2K |

**Confidence:** High - straightforward dead code removal

**Risk factors:**
- Low - code path is verified dead

**Similar past tasks:** SPRINT-022 cleanup tasks averaged 0.5x estimate

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
- [ ] src/components/onboarding/OnboardingFlow.tsx

Features implemented:
- [ ] Legacy fallback removed from useMemo
- [ ] Code simplified to single branch

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual verification: onboarding flow works
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~8K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

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

**Architecture Compliance:** PASS / FAIL
**Dead Code Verification:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
