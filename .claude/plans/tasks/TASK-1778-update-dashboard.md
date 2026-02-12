# Task TASK-1778: Update Dashboard Component

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

Update Dashboard component to remove `syncStatus` and `isAnySyncing` props since SyncStatusIndicator now gets its state from useSyncQueue internally.

## Non-Goals

- Do NOT modify SyncStatusIndicator (already updated in TASK-1776)
- Do NOT modify useAutoRefresh (already updated in TASK-1777)
- Do NOT change Dashboard functionality or UI

## Deliverables

1. Update: `src/components/Dashboard.tsx`

## Acceptance Criteria

- [ ] Remove `syncStatus` prop from SyncStatusIndicator usage
- [ ] Remove `isAnySyncing` prop from SyncStatusIndicator usage
- [ ] Keep `pendingCount` and `onViewPending` props (these are dashboard-specific)
- [ ] Dashboard still disables buttons during sync (get `isRunning` from useSyncQueue)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current State (Before)

```typescript
// Dashboard.tsx currently has:
interface DashboardActionProps {
  // ...
  syncStatus?: SyncStatus;
  isAnySyncing?: boolean;
  // ...
}

// And passes to SyncStatusIndicator:
<SyncStatusIndicator
  status={syncStatus}
  isAnySyncing={isAnySyncing}
  pendingCount={pendingCount}
  onViewPending={handleViewPending}
/>
```

### Target State (After)

```typescript
import { useSyncQueue } from '../hooks/useSyncQueue';

interface DashboardActionProps {
  // Remove: syncStatus?: SyncStatus;
  // Remove: isAnySyncing?: boolean;
  // Keep everything else
  onTriggerRefresh?: () => void;
  // ...
}

function Dashboard({ /* ... */ }: DashboardActionProps) {
  // Get sync state directly for button disabling
  const { isRunning: isAnySyncing } = useSyncQueue();

  // ...

  return (
    // ...
    <SyncStatusIndicator
      // Remove: status={syncStatus}
      // Remove: isAnySyncing={isAnySyncing}
      pendingCount={pendingCount}
      onViewPending={handleViewPending}
    />
    // ...
  );
}
```

### Important Details

- Dashboard uses `isAnySyncing` to disable action buttons during sync - this must still work
- Get `isRunning` from `useSyncQueue` to replace the prop
- The `SyncStatus` type import can be removed if no longer used
- Keep `onTriggerRefresh` prop for manual sync trigger

## Integration Notes

- Imports from: `useSyncQueue`
- Exports to: App.tsx or parent component
- Used by: App routing
- Depends on: TASK-1776 (SyncStatusIndicator), TASK-1777 (useAutoRefresh)

## Do / Don't

### Do:

- Import `useSyncQueue` hook
- Use `isRunning` from hook for button disabling
- Remove `syncStatus` and `isAnySyncing` from props interface
- Remove these props from SyncStatusIndicator usage

### Don't:

- Change the visual appearance or behavior of Dashboard
- Remove `pendingCount` or `onViewPending` props from SyncStatusIndicator
- Remove `onTriggerRefresh` prop

## When to Stop and Ask

- If there are other components that pass `syncStatus` to Dashboard
- If removing props causes cascade of type errors in parent components
- If button disabling behavior changes unexpectedly

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- New tests to write: None
- Existing tests to update: None in this task

### Coverage

- Coverage impact: No change expected

### Integration / Feature Tests

- Required scenarios:
  - Manual: Dashboard buttons disabled during sync
  - Manual: SyncStatusIndicator shows progress correctly

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(dashboard): remove sync status props`
- **Labels**: `refactor`, `dashboard`
- **Depends on**: TASK-1776, TASK-1777

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (Dashboard.tsx) | +6K |
| Code volume | ~10-20 lines changed | +2K |
| Test complexity | Low | +0K |

**Confidence:** High

**Risk factors:**
- May need to update parent components that pass props

**Similar past tasks:** Simple prop removal refactor

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
- [ ] src/components/Dashboard.tsx

Features implemented:
- [ ] Import useSyncQueue hook
- [ ] Remove syncStatus prop
- [ ] Remove isAnySyncing prop
- [ ] Use isRunning from hook for button disabling

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

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~8K | ~XK | +/-X% |
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
**Test Coverage:** Adequate

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
