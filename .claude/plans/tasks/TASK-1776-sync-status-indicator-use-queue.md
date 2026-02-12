# Task TASK-1776: Update SyncStatusIndicator to use useSyncQueue

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

Update SyncStatusIndicator to derive pill states from `useSyncQueue` hook instead of the `status` prop, making it the single source of truth for sync state visualization.

## Non-Goals

- Do NOT change the visual appearance of pills
- Do NOT modify the completion message logic (AI addon features)
- Do NOT remove the `status` prop entirely (still needed for progress %)
- Do NOT modify SyncQueueService or useSyncQueue hook

## Deliverables

1. Update: `src/components/dashboard/SyncStatusIndicator.tsx`

## Acceptance Criteria

- [ ] SyncStatusIndicator imports and uses `useSyncQueue` hook
- [ ] Pill states (waiting/active/complete) derived from `state.contacts.state`, `state.emails.state`, `state.messages.state`
- [ ] Progress percentage still displayed from `status` prop (optional display)
- [ ] `isAnySyncing` derived from `useSyncQueue` instead of prop
- [ ] Existing visual behavior preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Key Patterns

The SyncQueueService state shape:
```typescript
interface SyncQueueState {
  contacts: SyncItem;  // { type, state: 'idle' | 'queued' | 'running' | 'complete' | 'error', ... }
  emails: SyncItem;
  messages: SyncItem;
  isRunning: boolean;
  isComplete: boolean;
  // ...
}
```

Map SyncQueueService states to pill states:
```typescript
// In SyncStatusIndicator.tsx
import { useSyncQueue } from '../../hooks/useSyncQueue';
import type { SyncItemState } from '../../services/SyncQueueService';

// Inside component:
const { state: queueState, isRunning } = useSyncQueue();

const mapToPillState = (itemState: SyncItemState): 'waiting' | 'active' | 'complete' => {
  switch (itemState) {
    case 'idle':
    case 'queued':
      return 'waiting';
    case 'running':
      return 'active';
    case 'complete':
    case 'error':  // Show as complete (error handling is separate)
      return 'complete';
    default:
      return 'waiting';
  }
};

const contactsState = mapToPillState(queueState.contacts.state);
const emailsState = mapToPillState(queueState.emails.state);
const messagesState = mapToPillState(queueState.messages.state);
```

### Props Changes

Keep existing props for backward compatibility, but derive `isAnySyncing` internally:
```typescript
interface SyncStatusIndicatorProps {
  status: SyncStatus;  // Keep for progress % display
  isAnySyncing: boolean;  // Keep prop but can ignore (use isRunning from hook)
  pendingCount?: number;
  onViewPending?: () => void;
}

// Inside component:
const { state: queueState, isRunning } = useSyncQueue();

// Use isRunning from hook instead of isAnySyncing prop
// This ensures single source of truth
```

### Important Details

- The `getPillState` function currently derives state from `status.contacts.isSyncing` and `status.contacts.progress` - replace with SyncQueue state
- Keep the progress bar logic that uses `status.messages.progress` etc for the percentage display
- The completion state transition logic (showing completion message) can stay based on the hook's transition detection

## Integration Notes

- Imports from: `useSyncQueue` hook, `SyncQueueService` types
- Exports to: Used by Dashboard
- Used by: TASK-1777, TASK-1778
- Depends on: None (SyncQueueService already exists)

## Do / Don't

### Do:

- Import `useSyncQueue` at the top of the component
- Use `isRunning` from hook for determining if syncing
- Keep progress % display from `status` prop
- Test manually that pills transition correctly

### Don't:

- Remove the `status` prop (needed for progress display)
- Change the visual appearance of pills
- Modify the auto-dismiss or completion message logic
- Add new dependencies

## When to Stop and Ask

- If `useSyncQueue` hook doesn't provide expected state shape
- If the mapping from SyncQueue state to pill state is unclear
- If removing debug console.log statements causes issues
- If there are type errors that require changes to SyncQueueService

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (existing tests will be updated in TASK-1781)
- New tests to write: None
- Existing tests to update: None in this task (deferred to TASK-1781)

### Coverage

- Coverage impact: May temporarily decrease until TASK-1781

### Integration / Feature Tests

- Required scenarios:
  - Manual: Start app, watch pills transition during sync
  - Manual: Verify completion message still works

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(sync): use useSyncQueue in SyncStatusIndicator`
- **Labels**: `refactor`, `sync`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (SyncStatusIndicator.tsx) | +10K |
| Code volume | ~30-50 lines changed | +5K |
| Test complexity | Low (deferred) | +0K |

**Confidence:** High

**Risk factors:**
- State mapping may need adjustment based on actual SyncQueue behavior

**Similar past tasks:** Typical refactor task, expect ~15K tokens

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
- [ ] src/components/dashboard/SyncStatusIndicator.tsx

Features implemented:
- [ ] Import useSyncQueue hook
- [ ] Map SyncQueue state to pill states
- [ ] Use isRunning from hook
- [ ] Keep progress % display from props

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
