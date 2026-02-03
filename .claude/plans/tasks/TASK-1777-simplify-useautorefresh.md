# Task TASK-1777: Simplify useAutoRefresh Hook

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

Remove duplicate state management from useAutoRefresh by eliminating `useState<SyncStatus>` and relying solely on SyncQueueService for sync state tracking. Keep IPC listeners only for progress percentage display.

## Non-Goals

- Do NOT remove the OS notification logic (already uses SyncQueue correctly)
- Do NOT change the sync execution order (contacts -> emails -> messages)
- Do NOT modify SyncQueueService or useSyncQueue hook
- Do NOT remove the `triggerRefresh` function

## Deliverables

1. Update: `src/hooks/useAutoRefresh.ts`

## Acceptance Criteria

- [ ] Remove `useState<SyncStatus>` and all `setStatus()` calls
- [ ] Keep IPC listeners for progress updates (for UI display only)
- [ ] Continue using `syncQueue.start/complete/error` for state tracking
- [ ] Return interface simplified (no more `syncStatus` in return)
- [ ] `isAnySyncing` derived from SyncQueue state
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current State (Before)

```typescript
// useAutoRefresh.ts currently has:
const [status, setStatus] = useState<SyncStatus>(initialSyncStatus);

// And many setStatus() calls like:
setStatus((prev) => ({
  ...prev,
  contacts: {
    hasStarted: true,
    isSyncing: true,
    progress: null,
    message: "Importing contacts...",
    error: null,
  },
}));
```

### Target State (After)

```typescript
// Remove useState and setStatus calls
// The sync functions should ONLY call syncQueue methods:

const syncContacts = useCallback(async (uid: string): Promise<void> => {
  // syncQueue.start('contacts') is already called in runAutoRefresh
  try {
    const result = await window.api.contacts.syncExternal(uid);
    // No setStatus - syncQueue.complete('contacts') handles state
  } catch (error) {
    console.error("[useAutoRefresh] Contact sync error:", error);
    // No setStatus - syncQueue.error('contacts', ...) handles state
  }
}, []);
```

### Keep IPC Listeners for Progress

The IPC listeners can optionally store progress in a local ref for display purposes, but should NOT update sync state:

```typescript
// Keep for progress display only (optional)
const progressRef = useRef<{
  messages: number | null;
  contacts: number | null;
}>({ messages: null, contacts: null });

useEffect(() => {
  const cleanup = window.api.messages.onImportProgress((progress) => {
    if (!autoRefreshInitiatedMessages || isOnboardingImportActive()) return;
    progressRef.current.messages = progress.percent;
  });
  return cleanup;
}, []);
```

### Simplified Return Interface

```typescript
interface UseAutoRefreshReturn {
  // Remove: syncStatus: SyncStatus;
  isAnySyncing: boolean;  // Derived from syncQueue
  currentSyncMessage: string | null;  // Can be simplified or removed
  triggerRefresh: () => Promise<void>;
}

// In the hook:
const { isRunning } = useSyncQueue();

return {
  isAnySyncing: isRunning,
  currentSyncMessage: null,  // Or derive from syncQueue state if needed
  triggerRefresh,
};
```

### Important Details

- The `syncQueue.start/complete/error` calls are already in place - keep them
- Remove the parallel state tracking with `setStatus`
- The OS notification logic at the bottom of the file already uses `syncQueue.onAllComplete()` - keep it
- The module-level flags (`skipNextMessagesSync`, etc.) will be removed in TASK-1780, not this task

## Integration Notes

- Imports from: `SyncQueueService`, `useSyncQueue`
- Exports to: Dashboard, other sync consumers
- Used by: TASK-1778 (Dashboard will need to adapt to new interface)
- Depends on: TASK-1776 (SyncStatusIndicator no longer needs status prop for state)

## Do / Don't

### Do:

- Remove all `useState<SyncStatus>` and `setStatus()` calls
- Keep `syncQueue.start/complete/error` calls in sync functions
- Keep IPC listeners if needed for progress display
- Use `useSyncQueue` hook to get `isRunning`
- Keep the OS notification subscription

### Don't:

- Remove the sync execution logic (runAutoRefresh)
- Change the sync order
- Remove `triggerRefresh` function
- Remove module-level flags yet (that's TASK-1780)
- Break the OS notification that fires on completion

## When to Stop and Ask

- If removing `syncStatus` from return breaks too many consumers
- If the IPC progress listeners are tightly coupled to state updates
- If there are type errors in Dashboard or other consumers

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (existing tests will be updated in TASK-1781)
- New tests to write: None
- Existing tests to update: None in this task (deferred to TASK-1781)

### Coverage

- Coverage impact: May temporarily decrease until TASK-1781

### Integration / Feature Tests

- Required scenarios:
  - Manual: Start app, verify syncs run correctly
  - Manual: Verify OS notification fires on completion

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(sync): remove duplicate state from useAutoRefresh`
- **Labels**: `refactor`, `sync`
- **Depends on**: TASK-1776

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (useAutoRefresh.ts) | +15K |
| Code volume | ~100-150 lines removed/changed | +5K |
| Test complexity | Low (deferred) | +0K |

**Confidence:** High

**Risk factors:**
- Return interface change may affect consumers (Dashboard)

**Similar past tasks:** Typical refactor task with state removal

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
- [ ] src/hooks/useAutoRefresh.ts

Features implemented:
- [ ] Remove useState<SyncStatus>
- [ ] Remove all setStatus() calls
- [ ] Keep syncQueue.start/complete/error calls
- [ ] Simplify return interface
- [ ] Use useSyncQueue for isAnySyncing

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
**Test Coverage:** Deferred to TASK-1781

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
