# TASK-1006: Reduce useAppStateMachine.ts Line Count

**Backlog ID:** BACKLOG-150
**Sprint:** SPRINT-028
**Phase:** Phase 1 - Quick Fixes (Parallel)
**Branch:** `refactor/TASK-1006-state-machine-reduce`
**Estimated Tokens:** ~10K
**Token Cap:** 40K

---

## Objective

Reduce `useAppStateMachine.ts` from 451 lines to under 400 lines (the mandatory trigger threshold) by extracting the large return object into helper functions.

---

## Context

Per architecture guardrails (`.claude/docs/shared/architecture-guardrails.md`):
- Target: 300 lines
- Trigger: >400 lines (mandatory extraction)
- Current: 451 lines (51 over trigger)

The file was reduced from 1,130 to 422 lines in SPRINT-013. The remaining issue is the ~180-line return statement.

---

## Requirements

### Must Do:
1. Extract return object construction to helper functions
2. Keep below 400 lines (ideally closer to 300)
3. Maintain full backward compatibility
4. No behavior changes

### Must NOT Do:
- Change the public API of the hook
- Break any consumers
- Add complexity

---

## Recommended Approach (Option A from backlog)

Create helper functions that construct portions of the return object:

```typescript
// Before (inline return ~180 lines)
return {
  isAuthenticated,
  setIsAuthenticated,
  isDatabaseReady,
  // ... 50+ properties
};

// After (composed return)
return useMemo(() => ({
  ...constructAuthFlowReturn(state, actions),
  ...constructStorageFlowReturn(state, actions),
  ...constructOnboardingFlowReturn(state, actions),
}), [state, actions]);
```

---

## Acceptance Criteria

- [ ] `useAppStateMachine.ts` reduced to <400 lines
- [ ] Return object construction in helper functions
- [ ] All functionality preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/appCore/state/useAppStateMachine.ts` - Main refactor
- Possibly create `src/appCore/state/returnHelpers.ts` - Helper functions

---

## PR Preparation

- **Title:** `refactor(state): extract useAppStateMachine return helpers`
- **Branch:** `refactor/TASK-1006-state-machine-reduce`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

| Metric | Value |
|--------|-------|
| Agent ID | `<from Task tool output>` |
| Total Tokens | `<from tokens.jsonl>` |

### Results

- **Lines Before**: 451
- **Lines After**: <target>
- **Approach Used**: [A or B]
- **PR**: [URL]

---

## Guardrails

**STOP and ask PM if:**
- Refactor would change public API
- Type errors are complex to resolve
- Performance concerns arise
