# Task TASK-1814: Delete State Machine Feature Flag Infrastructure

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

Delete the `isNewStateMachineEnabled` feature flag infrastructure completely. This flag was used for the BACKLOG-142 state machine migration which is now complete and enabled by default.

## IMPORTANT CLARIFICATION

**This task removes MIGRATION flags only, NOT license/subscription feature flags.**

| Flag Type | Example | Action |
|-----------|---------|--------|
| Migration flag (remove) | `isNewStateMachineEnabled`, `useNewStateMachine` | DELETE |
| License feature flag (keep) | `ai_detection_enabled`, `trial_ends_at` | DO NOT TOUCH |
| Subscription guard (keep) | `LicenseContext`, `SubscriptionGuard` | DO NOT TOUCH |

## Non-Goals

- Do NOT touch `LicenseContext.tsx` or any license-related code
- Do NOT modify `SubscriptionGuard` or trial/subscription logic
- Do NOT remove any feature flags related to paid tiers
- Do NOT change how the state machine works internally
- Do NOT modify AppStateContext beyond removing the feature flag check

## Deliverables

1. Delete: `src/appCore/state/machine/utils/featureFlags.ts`
2. Update: `src/appCore/state/machine/utils/index.ts` - Remove featureFlags export
3. Update: `src/appCore/state/machine/AppStateContext.tsx` - Remove conditional, always provide state machine
4. Update: All files that import `isNewStateMachineEnabled` - Remove usage
5. Delete: Any tests for `featureFlags.ts`

## Acceptance Criteria

- [ ] `featureFlags.ts` file deleted
- [ ] No imports of `isNewStateMachineEnabled` anywhere in codebase
- [ ] No imports of `enableNewStateMachine`, `disableNewStateMachine`, `clearStateMachineFlag`
- [ ] No imports of `getFeatureFlagStatus`
- [ ] `AppStateContext` always provides machine state (no conditional)
- [ ] `useOptionalMachineState` replaced with `useMachineState` (always returns state)
- [ ] All existing tests pass
- [ ] TypeScript strict mode compliant
- [ ] All CI checks pass

## Implementation Notes

### Files to Modify

Run this command to find all usages:

```bash
grep -r "isNewStateMachineEnabled\|useNewStateMachine\|featureFlags" --include="*.ts" --include="*.tsx" src/
```

Expected files:
1. `src/appCore/state/machine/utils/featureFlags.ts` - DELETE
2. `src/appCore/state/machine/utils/index.ts` - Remove export
3. `src/appCore/state/machine/AppStateContext.tsx` - Remove conditional
4. `src/appCore/state/machine/index.ts` - Update exports if needed
5. Various flow hooks - Remove feature flag checks
6. Test files - Remove mocks for `isNewStateMachineEnabled`

### Pattern: Remove Feature Flag Check

**Before:**
```typescript
import { isNewStateMachineEnabled } from "../machine/utils/featureFlags";

if (isNewStateMachineEnabled()) {
  // New behavior
} else {
  // Legacy behavior (never runs)
}
```

**After:**
```typescript
// New behavior (always runs)
```

### Pattern: Update Context

**Before (AppStateContext.tsx):**
```typescript
import { isNewStateMachineEnabled } from "./utils/featureFlags";

export function AppStateProvider({ children }: Props) {
  if (!isNewStateMachineEnabled()) {
    return <>{children}</>;
  }
  // ... state machine setup
}
```

**After:**
```typescript
export function AppStateProvider({ children }: Props) {
  // ... state machine setup (always runs)
}
```

### Pattern: Update Optional Hook

**Before:**
```typescript
export function useOptionalMachineState() {
  const context = useContext(AppStateContext);
  if (!isNewStateMachineEnabled()) {
    return null;
  }
  return context;
}
```

**After:**
```typescript
export function useMachineState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useMachineState must be used within AppStateProvider");
  }
  return context;
}
```

### Test File Updates

Test files that mock `isNewStateMachineEnabled` will need the mocks removed:

```typescript
// REMOVE THESE
jest.mock("../../machine/utils/featureFlags", () => ({
  isNewStateMachineEnabled: jest.fn(),
}));

const mockIsNewStateMachineEnabled =
  featureFlags.isNewStateMachineEnabled as jest.Mock;
```

Tests should just test the new behavior directly without the mock.

## Integration Notes

- Imports from: N/A (deleting)
- Exports to: N/A
- Used by: All components that checked feature flag
- Depends on: TASK-1813 (legacy fallback already removed)

## Do / Don't

### Do:
- Delete the entire `featureFlags.ts` file
- Remove ALL usages of `isNewStateMachineEnabled`
- Update tests to remove mocks
- Keep the state machine functionality intact

### Don't:
- Touch any license/subscription feature flags
- Modify `LicenseContext.tsx` or related files
- Change how the state machine reducer works
- Add new feature flags

## When to Stop and Ask

- If you find usages in electron/ directory (main process)
- If any license-related code seems to use this flag
- If removing the flag causes test failures you can't resolve
- If more than 15 files need modification

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing tests
- Tests to modify:
  - Remove `isNewStateMachineEnabled` mocks from all test files
  - Tests should assume state machine is always enabled
- Tests to delete:
  - Any tests for `featureFlags.ts` functions

### Coverage

- Coverage impact: Should not decrease
- May increase slightly (less conditional code)

### Manual Testing

1. Start app as new user - should work identically
2. Check localStorage has no `useNewStateMachine` key
3. Verify no console errors about missing feature flags

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | ~10 files | +5K |
| Files to delete | 1 file | +1K |
| Test updates | ~5 test files | +3K |
| Buffer | Conservative | +1K |

**Confidence:** High - mechanical deletion

**Risk factors:**
- Low - all usages should be straightforward to find and remove

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
Files deleted:
- [ ] src/appCore/state/machine/utils/featureFlags.ts

Files modified:
- [ ] src/appCore/state/machine/utils/index.ts
- [ ] src/appCore/state/machine/AppStateContext.tsx
- [ ] (list others found during implementation)

Test files updated:
- [ ] (list test files with mocks removed)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] grep confirms no remaining usages
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~10K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

**Files found to modify:**
<List all files that had feature flag usages>

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

**Complete Removal Verified:** PASS / FAIL
**No License Flags Touched:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
