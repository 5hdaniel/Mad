# Task TASK-2055: Fix Sync Progress Bar Auto-Dismiss

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

Fix the sync progress bar so it auto-dismisses after sync completes instead of staying permanently visible in the "syncing" blue state.

## Non-Goals

- Do NOT redesign the sync status indicator layout or styling beyond what is needed for the fix.
- Do NOT change the AI-specific completion message behavior (pending count, "Review Now" button).
- Do NOT add sync retry functionality.
- Do NOT modify the SyncOrchestrator's sync execution order or timing.

## Prerequisites

**Sprint:** SPRINT-095
**Parallel with:** TASK-2056 (offline blocking), TASK-2057 (migration restore) -- no shared files.
**Blocks:** Nothing.

## Context

The `SyncStatusIndicator` component already has completion state handling (green "Sync Complete" card with dismiss X button -- lines 117-251 of the component). However, users report the blue progress bar with green checkmarks stays permanently visible. The root cause is likely that `isRunning` from `SyncOrchestratorService` either:

1. Never transitions to `false` after all items complete, OR
2. Transitions correctly but the UI component's `useEffect` tracking the transition (lines 92-104) has a race condition

The component's completion transition relies on detecting `isRunning` going from `true` to `false` via `wasSyncingRef`. The current code at line 100 says: "No auto-dismiss -- user must click the X to dismiss." This was an intentional choice for when modals cover the dashboard, but the user request is to ADD auto-dismiss WITH a delay so it stays visible long enough for the user to see it.

## Requirements

### Must Do:

1. **Investigate `isRunning` state** -- Confirm whether `SyncOrchestratorService.isRunning` correctly transitions to `false` when all sync items complete. Check the `executeSyncQueue` method's completion path.

2. **Fix auto-dismiss behavior** -- After sync completes:
   - Wait 3 seconds showing the green "Sync Complete" state (already exists)
   - Auto-dismiss after the 3-second display
   - If a modal was covering the dashboard, the completion message should still appear briefly when the modal closes (use the existing `wasSyncingRef` pattern)

3. **Keep manual dismiss (X) button** -- The X button already exists in the completion state (lines 205-229). Ensure it still works for immediate dismiss during the 3-second window.

4. **Handle edge case: new sync starts during auto-dismiss timeout** -- If a new sync starts during the 3-second completion window, cancel the auto-dismiss timer and show the new sync progress.

### Must NOT Do:

- Remove the manual dismiss X button
- Change the sync execution logic in `SyncOrchestratorService`
- Modify the message cap warning display
- Change the sync pill colors or progress bar styling

## Acceptance Criteria

- [ ] Sync progress bar transitions from blue "syncing" state to green "Sync Complete" state when all items finish
- [ ] Green "Sync Complete" state auto-dismisses after 3 seconds
- [ ] Manual dismiss (X) button immediately dismisses during completion display
- [ ] If new sync starts during 3-second window, completion clears and progress shows
- [ ] Auto-dismiss timer is cleaned up on component unmount (no memory leaks)
- [ ] `npm test` passes (including existing `SyncStatusIndicator.test.tsx`)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/SyncStatusIndicator.tsx` | Add auto-dismiss timer in completion `useEffect`, clean up on unmount |
| `src/services/SyncOrchestratorService.ts` | Only if investigation reveals `isRunning` does not transition correctly |

### Files to Read (for context)

| File | Why |
|------|-----|
| `src/hooks/useSyncOrchestrator.ts` | Understand how component subscribes to orchestrator state |
| `src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx` | Understand existing test coverage |

## Implementation Notes

### Auto-dismiss timer pattern

```typescript
// In the useEffect that tracks sync completion (lines 92-104):
useEffect(() => {
  if (isAnySyncing) {
    wasSyncingRef.current = true;
    setDismissed(false);
  } else if (wasSyncingRef.current && !isAnySyncing) {
    setShowCompletion(true);
    wasSyncingRef.current = false;

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setShowCompletion(false);
      setDismissed(true);
    }, 3000);

    return () => clearTimeout(timer); // cleanup if re-render or unmount
  }
}, [isAnySyncing]);
```

### If `isRunning` never transitions

Check `SyncOrchestratorService.executeSyncQueue()` -- the method should set `isRunning: false` when the queue is exhausted. Look for error paths that might skip the completion state update.

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **Update existing:** `src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx`
- **New tests to add:**
  1. Test that completion state auto-dismisses after timeout (use `jest.advanceTimersByTime`)
  2. Test that manual dismiss works during auto-dismiss window
  3. Test that new sync cancels auto-dismiss timer
  4. Test that timer is cleaned up on unmount

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** ui
- **Multiplier:** x 1.0
- **Base estimate:** ~25K tokens
- **Final estimate:** ~25K tokens
- **Token Cap:** 100K (4x)

## PR Preparation

- **Title:** `fix(sync): auto-dismiss sync progress bar after completion`
- **Branch:** `fix/task-2055-sync-auto-dismiss`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: 25K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- `isRunning` never transitions to `false` and the fix requires significant SyncOrchestratorService changes
- The component architecture needs restructuring beyond adding a timer
- Existing tests fail in ways unrelated to this change
- You encounter blockers not covered in the task file
