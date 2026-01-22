# Task TASK-947: Enable Feature Flag Default True

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

Change the state machine feature flag default from `false` to `true`, enabling the new state machine path for all users. This is the final step in Phase 2 migration.

## Non-Goals

- Do NOT remove the feature flag mechanism (needed for rollback)
- Do NOT remove legacy code paths (Phase 3 will do this)
- Do NOT change any hook behavior
- Do NOT modify components

## Deliverables

1. Update: `src/appCore/state/machine/hooks/useOptionalMachineState.ts` - Change default
2. Update: `src/appCore/state/machine/AppStateContext.tsx` - Change default (if also checks there)
3. New file: `src/appCore/state/machine/__tests__/featureFlag.test.ts` - Tests for flag behavior
4. Update: `.claude/docs/shared/state-machine-rollback.md` - Document rollback procedure

## Acceptance Criteria

- [ ] Feature flag defaults to `true` (state machine enabled by default)
- [ ] Setting `useNewStateMachine=false` in localStorage disables it
- [ ] All existing tests pass with new default
- [ ] Manual testing verifies app works with new default
- [ ] Rollback procedure documented
- [ ] All CI checks pass

## Implementation Notes

### Current Flag Check (Phase 1)

```typescript
// Current (TASK-933)
const USE_NEW_STATE_MACHINE = localStorage.getItem('useNewStateMachine') !== 'false';
```

This already defaults to `true` if no localStorage value exists. However, there may be additional flag checks that need updating.

### Verify All Flag Locations

Search for all flag checks:
```bash
grep -r "useNewStateMachine" --include="*.ts" --include="*.tsx" src/
```

### Expected Locations

1. `useOptionalMachineState.ts` - Hook that returns null if flag disabled
2. `AppStateContext.tsx` - Provider that may check flag
3. `TASK-933` output files - Feature flag implementation

### Flag Behavior Matrix

| localStorage value | Behavior |
|-------------------|----------|
| Not set | State machine ENABLED (new default) |
| `'true'` | State machine ENABLED |
| `'false'` | State machine DISABLED (legacy mode) |

### Rollback Procedure Documentation

Create or update `.claude/docs/shared/state-machine-rollback.md`:

```markdown
# State Machine Rollback Procedure

## Quick Rollback (Per User)

In browser DevTools console:
```javascript
localStorage.setItem('useNewStateMachine', 'false');
location.reload();
```

## Full Rollback (Code Change)

1. Revert feature flag default to `false`:
   - `useOptionalMachineState.ts`: Change to `!== 'true'`

2. Deploy updated code

3. Users will automatically use legacy hooks

## Monitoring for Issues

Watch for:
- "Database not initialized" errors (fixed by state machine)
- Onboarding flicker for returning users
- Navigation loops

If these return after enabling state machine, investigate before rollback.
```

### Test File

```typescript
// src/appCore/state/machine/__tests__/featureFlag.test.ts

describe('Feature Flag Behavior', () => {
  afterEach(() => {
    localStorage.removeItem('useNewStateMachine');
  });

  describe('Default Behavior (Phase 2)', () => {
    it('defaults to enabled when no localStorage value', () => {
      // Clear any existing value
      localStorage.removeItem('useNewStateMachine');

      const result = checkFeatureFlag();
      expect(result).toBe(true);
    });
  });

  describe('Explicit Settings', () => {
    it('is enabled when localStorage is "true"', () => {
      localStorage.setItem('useNewStateMachine', 'true');

      const result = checkFeatureFlag();
      expect(result).toBe(true);
    });

    it('is disabled when localStorage is "false"', () => {
      localStorage.setItem('useNewStateMachine', 'false');

      const result = checkFeatureFlag();
      expect(result).toBe(false);
    });
  });

  describe('useOptionalMachineState', () => {
    it('returns context when flag enabled (default)', () => {
      localStorage.removeItem('useNewStateMachine');

      const { result } = renderHook(() => useOptionalMachineState(), {
        wrapper: AppStateProvider,
      });

      expect(result.current).not.toBeNull();
    });

    it('returns null when flag explicitly disabled', () => {
      localStorage.setItem('useNewStateMachine', 'false');

      const { result } = renderHook(() => useOptionalMachineState(), {
        wrapper: AppStateProvider,
      });

      expect(result.current).toBeNull();
    });
  });
});
```

## Integration Notes

- Imports from: Feature flag utilities (TASK-933)
- Affects: All migrated hooks (TASK-941, 942, 943, 945)
- Depends on: TASK-946 (integration tests passing)

## Do / Don't

### Do:

- Verify all flag check locations are updated
- Test with flag enabled (default) and disabled
- Document rollback procedure clearly
- Run full test suite before completing

### Don't:

- Remove the feature flag mechanism
- Remove legacy code paths
- Skip testing rollback procedure
- Change hook logic

## When to Stop and Ask

- If more than 2 flag check locations exist
- If tests fail with new default
- If unsure about rollback documentation
- If existing flag logic is more complex than expected

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Default flag behavior (enabled)
  - Explicit enable behavior
  - Explicit disable behavior
  - Hook returns context when enabled
  - Hook returns null when disabled
- Existing tests to update:
  - Tests that assumed flag was disabled by default

### Coverage

- Coverage impact: Should maintain or improve
- Target: 100% for flag logic

### Integration / Feature Tests

- Required scenarios:
  - App startup with default flag (enabled)
  - App startup with flag disabled

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (TASK-946)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(state): enable state machine feature flag by default`
- **Labels**: `state-machine`, `phase-2`, `config`
- **Branch From**: `project/state-coordination`
- **Branch Into**: `project/state-coordination`
- **Branch Name**: `feature/TASK-947-feature-flag-default`
- **Depends on**: TASK-946

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 files (test + docs) | +7K |
| Files to modify | 1-2 files (flag checks) | +3K |
| Code volume | ~50 lines | +2K |
| Test complexity | Low | +3K |

**Confidence:** High

**Risk factors:**
- May be more flag locations than expected
- Tests may need updates for new default

**Similar past tasks:** TASK-933 (feature flag creation, ~25K actual)

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
- [ ] src/appCore/state/machine/__tests__/featureFlag.test.ts
- [ ] .claude/docs/shared/state-machine-rollback.md

Files modified:
- [ ] src/appCore/state/machine/hooks/useOptionalMachineState.ts
- [ ] (others if needed)

Features implemented:
- [ ] Feature flag defaults to true
- [ ] Explicit disable still works
- [ ] Tests for flag behavior
- [ ] Rollback documentation

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test with default
- [ ] Manual test with flag disabled
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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~15K | ~XK | +/-X% |
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
- **Branch Name:** `feature/TASK-947-feature-flag-default`

### Execution Classification

- **Parallel Safe:** No
- **Depends On:** TASK-946
- **Blocks:** None (final task in sprint)

### Technical Notes

The current flag pattern `localStorage.getItem('useNewStateMachine') !== 'false'` already defaults to true when no value is set. Verify there are no other flag checks that need updating.

Key deliverables:
1. Document rollback procedure
2. Test flag toggle behavior
3. Ensure all integration tests pass with new default

### Shared File Analysis

- **Files modified:** Feature flag utilities, documentation
- **Conflicts with:** None

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
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/state-coordination
