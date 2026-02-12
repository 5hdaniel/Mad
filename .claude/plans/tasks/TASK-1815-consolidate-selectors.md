# Task TASK-1815: Consolidate Selectors to Nullable Pattern

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

Consolidate duplicate selector patterns in `userDataSelectors.ts`. Currently there are pairs of selectors (e.g., `selectHasEmailConnected` and `selectHasEmailConnectedNullable`) that should be unified into a single nullable pattern.

## Non-Goals

- Do NOT change the state machine reducer
- Do NOT add new selectors
- Do NOT modify the AppState types
- Do NOT change how state is stored

## Deliverables

1. Update: `src/appCore/state/machine/selectors/userDataSelectors.ts`
2. Update: All files that import the affected selectors
3. Update: `src/appCore/state/machine/selectors/index.ts` if exports change

## Acceptance Criteria

- [ ] Only nullable versions of selectors exist (no boolean-only versions)
- [ ] Selector consumers updated to handle `undefined` case
- [ ] No behavior change in UI (undefined treated same as false for showing steps)
- [ ] All existing tests pass
- [ ] TypeScript strict mode compliant
- [ ] All CI checks pass

## Implementation Notes

### Current Selector Pairs

1. `selectHasEmailConnected` (returns `boolean`) + `selectHasEmailConnectedNullable` (returns `boolean | undefined`)
2. `selectHasPermissions` (returns `boolean`) + `selectHasPermissionsNullable` (returns `boolean | undefined`)

### Target: Single Nullable Pattern

**After consolidation:**
```typescript
// Returns undefined during loading states, true/false when known
export function selectHasEmailConnected(state: AppState): boolean | undefined {
  if (state.status === "ready") {
    return state.userData.hasEmailConnected;
  }
  if (state.status === "onboarding") {
    return state.hasEmailConnected ?? false;
  }
  // Loading/unauthenticated/error: state is unknown
  return undefined;
}
```

### Consumer Update Pattern

**Before:**
```typescript
const emailConnected = selectHasEmailConnected(state); // boolean
if (emailConnected) {
  // skip email step
}
```

**After:**
```typescript
const emailConnected = selectHasEmailConnected(state); // boolean | undefined
// undefined means "unknown" - show the step to be safe
if (emailConnected === true) {
  // skip email step only when definitely connected
}
```

Or use a helper:
```typescript
// Helper for "false if unknown" pattern
const emailConnected = selectHasEmailConnected(state) ?? false;
```

### Files to Update

1. `src/appCore/state/machine/selectors/userDataSelectors.ts` - Main changes
2. `src/appCore/state/machine/selectors/index.ts` - Update exports
3. `src/components/onboarding/OnboardingFlow.tsx` - Uses selectors
4. Any other files importing affected selectors

### Find All Usages

```bash
grep -r "selectHasEmailConnected\|selectHasPermissions" --include="*.ts" --include="*.tsx" src/
```

### Key Principle

The nullable pattern is industry best practice: unknown state should be explicit, not assumed. When UI components see `undefined`, they should err on the side of showing the step (user can always skip if not needed).

## Integration Notes

- Imports from: State machine types
- Exports to: OnboardingFlow, other UI components
- Used by: OnboardingFlow.tsx, useOnboardingFlow.ts
- Depends on: TASK-1814 (feature flag removed)

## Do / Don't

### Do:
- Remove duplicate selectors, keep only nullable versions
- Update consumers to handle undefined explicitly
- Keep the same selector names (just change return types)
- Document the nullable semantics in JSDoc

### Don't:
- Change the underlying state structure
- Add new selectors
- Change behavior (undefined should work like false for step visibility)
- Break memoization patterns

## When to Stop and Ask

- If you find more than 10 files using the affected selectors
- If type errors cascade unexpectedly
- If tests require significant rewriting

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing selector tests
- Tests to modify:
  - `userDataSelectors.test.ts` - Update assertions for nullable returns
  - Remove tests for non-nullable versions
- New tests to add:
  - Test undefined return during loading states

### Coverage

- Coverage impact: Should remain the same
- Nullable selectors should have same test coverage as before

### Manual Testing

1. Start app and observe loading states
2. Verify onboarding steps show correctly during loading
3. Verify completed steps are skipped correctly

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~12K

**Token Cap:** 48K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | ~5 files | +4K |
| Selector changes | 4 selectors consolidated to 2 | +3K |
| Consumer updates | ~5 locations | +3K |
| Test updates | 1 test file | +2K |

**Confidence:** Medium - depends on consumer count

**Risk factors:**
- Type cascade effects
- Consumer update complexity

**Similar past tasks:** Refactor tasks typically come in at 0.5x estimate

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
Selectors consolidated:
- [ ] selectHasEmailConnected (now returns boolean | undefined)
- [ ] selectHasPermissions (now returns boolean | undefined)

Files modified:
- [ ] src/appCore/state/machine/selectors/userDataSelectors.ts
- [ ] src/appCore/state/machine/selectors/index.ts
- [ ] (list consumer files updated)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test: onboarding flow works
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~12K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

**Consumer files found:**
<List all files that use the selectors>

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

**Nullable Semantics Correct:** PASS / FAIL
**All Consumers Updated:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
