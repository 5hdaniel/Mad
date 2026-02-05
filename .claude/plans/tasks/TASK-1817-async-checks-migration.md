# Task TASK-1817: Move Async Checks into State Machine

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

Move remaining async state checks from UI components into the state machine orchestrator (`LoadingOrchestrator`). This eliminates race conditions where async checks complete after initial render.

## Non-Goals

- Do NOT change the onboarding step order
- Do NOT add new onboarding steps
- Do NOT modify the reducer's core logic
- Do NOT change service implementations

## Deliverables

1. Update: `src/appCore/state/machine/LoadingOrchestrator.tsx` - Consolidate async checks
2. Update: `src/components/onboarding/OnboardingFlow.tsx` - Remove inline async checks
3. Update: `src/appCore/state/machine/reducer.ts` - Add actions for async check results if needed
4. Update: `src/appCore/state/machine/types.ts` - Add action types if needed

## Acceptance Criteria

- [ ] `checkUserInLocalDb` logic moved to LoadingOrchestrator
- [ ] No async state checks in OnboardingFlow render path
- [ ] Async results stored in state machine state
- [ ] No "flash" of wrong steps during loading
- [ ] All existing tests pass
- [ ] TypeScript strict mode compliant
- [ ] All CI checks pass

## Implementation Notes

### Current State (Problem)

In `OnboardingFlow.tsx`:
```typescript
// PROBLEM: Async check in component causes flash/race
const [currentUserInLocalDb, setCurrentUserInLocalDb] = useState<boolean | undefined>(undefined);

useEffect(() => {
  if (!userId) {
    setCurrentUserInLocalDb(false);
    return;
  }
  setCurrentUserInLocalDb(undefined);
  checkUserInLocalDb(userId).then(setCurrentUserInLocalDb);
}, [userId]);

// This causes a flash while waiting for async result
if (userId && currentUserInLocalDb === undefined) {
  return null;  // Shows blank while checking
}
```

### Target State (Solution)

Move check to LoadingOrchestrator during `loading-user-data` phase:

```typescript
// LoadingOrchestrator.tsx
async function loadUserData(dispatch, userId) {
  // Existing user data loading...

  // Add: Check if user exists in local DB
  const userInLocalDb = await checkUserInLocalDb(userId);

  dispatch({
    type: "USER_DATA_LOADED",
    data: {
      ...userData,
      currentUserInLocalDb: userInLocalDb,
    },
  });
}
```

Then OnboardingFlow just reads from state:
```typescript
// OnboardingFlow.tsx - No async, just read from state
const currentUserInLocalDb = machineState?.state.status === "onboarding"
  ? machineState.state.currentUserInLocalDb
  : undefined;

// No flash because data is already loaded before we render
```

### State Machine Updates

**Add to types.ts (if needed):**
```typescript
interface OnboardingState {
  // ... existing fields
  currentUserInLocalDb?: boolean;
}
```

**Update reducer to pass through:**
```typescript
case "USER_DATA_LOADED":
  // Include currentUserInLocalDb in state
```

### Key Files to Read First

1. `src/components/onboarding/OnboardingFlow.tsx` - Current async check
2. `src/appCore/state/machine/LoadingOrchestrator.tsx` - Where to move check
3. `src/appCore/state/machine/reducer.ts` - How state transitions work
4. `src/appCore/state/machine/types.ts` - State shape

### Async Check Function

The `checkUserInLocalDb` function is currently defined in OnboardingFlow.tsx. Consider:
1. Moving it to a service or utility file
2. Importing it into LoadingOrchestrator
3. Or keeping it inline in LoadingOrchestrator

### Edge Cases

1. **User ID not available:** During loading, userId may be null
   - Solution: Skip check if no userId, set false

2. **Check fails:** IPC call to main process may fail
   - Solution: Treat as false (show secure-storage step)

3. **Race with login:** Login may complete while check is in progress
   - Solution: Check runs in sequence, not in parallel with other loads

## Integration Notes

- Imports from: systemService or window.api
- Exports to: State machine state
- Used by: OnboardingFlow (now just reads state)
- Depends on: TASK-1816 (permissions migrated)

## Do / Don't

### Do:
- Move async checks to LoadingOrchestrator
- Store results in state machine state
- Maintain same business logic (just relocate it)
- Handle errors gracefully (default to showing steps)

### Don't:
- Add new async checks
- Change the onboarding step order
- Modify the check logic itself
- Remove error handling

## When to Stop and Ask

- If more than 3 async checks need to be migrated
- If LoadingOrchestrator becomes too complex
- If state machine types need significant restructuring

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update and add tests
- Tests to modify:
  - OnboardingFlow tests - Remove async check mocking
  - LoadingOrchestrator tests - Add async check coverage
- New tests to add:
  - Test USER_DATA_LOADED includes currentUserInLocalDb
  - Test OnboardingFlow reads from state correctly

### Coverage

- Coverage impact: Should remain same or improve

### Manual Testing

1. Fresh install as new user - no flash of wrong steps
2. Login as existing user on new device - secure-storage step shows correctly
3. Login as existing user on same device - skips secure-storage

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 4 files | +8K |
| Async logic migration | Moderate complexity | +6K |
| State type changes | 1-2 new fields | +2K |
| Test updates | 2 test files | +4K |

**Confidence:** Medium - depends on orchestrator complexity

**Risk factors:**
- LoadingOrchestrator may have complex phase sequencing
- Additional async checks may be discovered

**Similar past tasks:** State migration tasks typically come in at 1x estimate

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
Async checks migrated:
- [ ] checkUserInLocalDb moved to LoadingOrchestrator

Files modified:
- [ ] src/appCore/state/machine/LoadingOrchestrator.tsx
- [ ] src/components/onboarding/OnboardingFlow.tsx
- [ ] src/appCore/state/machine/reducer.ts
- [ ] src/appCore/state/machine/types.ts

Changes made:
- [ ] Async check runs during loading-user-data phase
- [ ] Result stored in state machine state
- [ ] OnboardingFlow just reads from state
- [ ] No flash of wrong steps

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test: no flash during loading
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~20K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

**Additional async checks found:**
<List any other async checks that should be migrated>

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

**Async Migration Complete:** PASS / FAIL
**No Race Conditions:** PASS / FAIL
**Flash Eliminated:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
