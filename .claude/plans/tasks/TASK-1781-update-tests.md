# Task TASK-1781: Update Tests

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

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Update test files to reflect the new SyncQueue-based architecture, removing tests for deleted functionality and adding tests for new behavior.

## Non-Goals

- Do NOT add new test files (update existing)
- Do NOT change test coverage requirements

## Deliverables

1. Update: `src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx`
2. Update: `src/hooks/__tests__/useAutoRefresh.test.ts`

## Acceptance Criteria

- [ ] SyncStatusIndicator.test.tsx mocks `useSyncQueue` instead of relying on `status` prop
- [ ] useAutoRefresh.test.ts removes tests for deleted functions (`markOnboardingImportComplete`, etc.)
- [ ] All tests pass: `npm test`
- [ ] No coverage regression
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### SyncStatusIndicator.test.tsx Updates

The current tests mock `SyncStatus` prop. Update to mock `useSyncQueue` hook:

```typescript
// BEFORE:
const messagesSyncingStatus: SyncStatus = {
  emails: { hasStarted: true, isSyncing: false, progress: 100, message: "Done", error: null },
  messages: { hasStarted: true, isSyncing: true, progress: 50, message: "Importing...", error: null },
  contacts: { hasStarted: false, isSyncing: false, progress: null, message: "", error: null },
};

render(
  <SyncStatusIndicator
    status={messagesSyncingStatus}
    isAnySyncing={true}
  />
);

// AFTER:
const mockUseSyncQueue = jest.fn();
jest.mock('../../../hooks/useSyncQueue', () => ({
  useSyncQueue: () => mockUseSyncQueue(),
}));

beforeEach(() => {
  mockUseSyncQueue.mockReturnValue({
    state: {
      contacts: { type: 'contacts', state: 'idle' },
      emails: { type: 'emails', state: 'complete' },
      messages: { type: 'messages', state: 'running' },
      isRunning: true,
      isComplete: false,
      runStartedAt: Date.now(),
      runCompletedAt: null,
    },
    isRunning: true,
    isComplete: false,
  });
});

render(
  <SyncStatusIndicator
    pendingCount={5}
    onViewPending={jest.fn()}
  />
);
```

### useAutoRefresh.test.ts Updates

Remove tests for deleted functionality:

```typescript
// REMOVE these test suites/cases:
describe("onboarding import skip", () => {
  // Tests for markOnboardingImportComplete() - REMOVE
  // Tests for shouldSkipMessagesSync() - REMOVE
});

describe("helper functions", () => {
  it("shouldSkipMessagesSync should return correct state", () => {
    // REMOVE this test
  });
});

// UPDATE: The hook no longer returns syncStatus
// Tests checking result.current.syncStatus need to be updated or removed
```

### New Test Pattern for SyncQueue Integration

```typescript
// Mock the syncQueue singleton
jest.mock('../../services/SyncQueueService', () => ({
  syncQueue: {
    reset: jest.fn(),
    queue: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    error: jest.fn(),
    skip: jest.fn(),
    onStateChange: jest.fn(() => jest.fn()),
    onAllComplete: jest.fn(() => jest.fn()),
    getState: jest.fn(() => ({
      contacts: { type: 'contacts', state: 'idle' },
      emails: { type: 'emails', state: 'idle' },
      messages: { type: 'messages', state: 'idle' },
      isRunning: false,
      isComplete: false,
      runStartedAt: null,
      runCompletedAt: null,
    })),
  },
}));

// Test that sync functions call syncQueue methods
it("should call syncQueue.start when contacts sync begins", async () => {
  const { result } = renderHook(() => useAutoRefresh(defaultOptions));

  await act(async () => {
    await result.current.triggerRefresh();
  });

  expect(syncQueue.start).toHaveBeenCalledWith('contacts');
});
```

### Important Details

- Keep tests for behavior that still exists (auto-trigger delay, platform checks)
- Update assertions that check `syncStatus` to use SyncQueue state
- The `resetAutoRefreshTrigger` function may still exist for test cleanup

## Integration Notes

- Imports from: None
- Exports to: None
- Used by: CI pipeline
- Depends on: TASK-1780 (dead code removed)

## Do / Don't

### Do:

- Mock `useSyncQueue` in SyncStatusIndicator tests
- Remove tests for deleted functions
- Update assertions to match new interface
- Keep tests for existing behavior (auto-trigger, platform checks)

### Don't:

- Delete entire test files
- Reduce overall test coverage significantly
- Add tests for unrelated functionality

## When to Stop and Ask

- If test failures indicate actual bugs in the refactored code
- If coverage drops significantly
- If unclear which tests to remove vs update

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing tests
- New tests to write: Tests for SyncQueue integration
- Existing tests to update: All tests in the two test files

### Coverage

- Coverage impact: Should remain stable or improve

### Integration / Feature Tests

- Required scenarios:
  - All unit tests pass
  - Coverage check passes

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `test(sync): update tests for SyncQueue architecture`
- **Labels**: `test`, `refactor`
- **Depends on**: TASK-1780

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 2 test files | +10K |
| Code volume | ~50-100 lines changed | +5K |
| Test complexity | Medium | +0K |

**Confidence:** Medium

**Risk factors:**
- May discover additional tests that need updating
- Mock setup for SyncQueue may be complex

**Similar past tasks:** Test update task, 0.9x multiplier typically accurate

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
- [ ] (none)

Files modified:
- [ ] src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx
- [ ] src/hooks/__tests__/useAutoRefresh.test.ts

Tests updated:
- [ ] Mock useSyncQueue in SyncStatusIndicator tests
- [ ] Remove tests for markOnboardingImportComplete
- [ ] Remove tests for shouldSkipMessagesSync
- [ ] Update tests checking syncStatus return value

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
**Merged To:** feature/dynamic-import-batch-size

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
