# TASK-1785: Update SyncStatusIndicator for Queue-Order Pills

**Backlog ID:** N/A (Sprint scope)
**Sprint:** SPRINT-068
**Phase:** 2c - UI Update
**Branch:** `feature/dynamic-import-batch-size` (direct commit)
**Estimated Turns:** 2
**Estimated Tokens:** 8K-12K
**Dependencies:** TASK-1783, TASK-1784

---

## Objective

Update SyncStatusIndicator to display sync pills based on the orchestrator's queue order, showing only the syncs that are queued/running/complete in the current sync run.

---

## Context

Currently SyncStatusIndicator:
- Uses `useSyncQueue()` to get state from SyncQueueService
- Always shows all three pills (Contacts, Emails, Messages)
- Pills are gray (idle), blue (running), or green (complete)

After migration:
- Uses `useSyncOrchestrator()` to get state
- Only shows pills for syncs in the queue (if user doesn't have AI addon, no email pill)
- Pills display in queue order (contacts -> emails -> messages as queued)
- Shows pending (gray), running (blue), complete (green), error (red)

---

## Requirements

### Must Do:
1. Replace `useSyncQueue()` with `useSyncOrchestrator()`
2. Only render pills for syncs in `orchestratorState.queue`
3. Render pills in queue order (first-in-queue = first-pill)
4. Map orchestrator status to pill colors:
   - `pending` -> gray
   - `running` -> blue
   - `complete` -> green
   - `error` -> red
5. Show progress percentage for running syncs (from orchestrator state)

### Must NOT Do:
- Do NOT show pills for sync types not in the queue
- Do NOT hardcode the order (Contacts, Emails, Messages) - use queue order
- Do NOT remove the component if queue is empty (just render nothing)

---

## Acceptance Criteria

- [ ] SyncStatusIndicator uses `useSyncOrchestrator()` hook
- [ ] Only pills for queued syncs are rendered
- [ ] Pills render in queue order
- [ ] Status colors correct: pending=gray, running=blue, complete=green, error=red
- [ ] Progress percentage shows for running syncs
- [ ] No pills shown when orchestrator queue is empty
- [ ] Type-check passes: `npm run type-check`
- [ ] Tests pass: `npm test`
- [ ] Manual test: Pills show correct order and colors during sync

### Error UX (SR Requirement)

**CRITICAL:** Error state must be user-visible and logged.

- [ ] Pill turns RED on error (not gray)
- [ ] Error message displayed (tooltip on hover OR inline text near pill)
- [ ] Error is logged using the software logger (console + persistent log)
- [ ] Error state clears automatically on next sync run
- [ ] **NO retry button in MVP** - user can manually trigger refresh

Example error display:
```
[Contacts ✓] [Emails ✓] [Messages ✗]
                         └─ "Database connection failed"
```

Or tooltip approach:
```
[Messages] (red pill, hover shows: "Import failed: Database connection failed")
```

---

## Files to Modify

- `src/components/dashboard/SyncStatusIndicator.tsx` - Use orchestrator, queue-order rendering

## Files to Read (for context)

- `src/services/SyncOrchestratorService.ts` - State shape
- `src/hooks/useSyncOrchestrator.ts` - Hook API

---

## Implementation Notes

### State Shape

```typescript
interface SyncOrchestratorState {
  isRunning: boolean;
  queue: SyncItem[];  // Ordered array
  currentSync: SyncType | null;
  overallProgress: number;
}

interface SyncItem {
  type: SyncType;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;  // 0-100
  error?: string;
}
```

### Rendering Logic

```typescript
const { queue } = useSyncOrchestrator();

return (
  <div className="flex gap-2">
    {queue.map((item) => (
      <SyncPill
        key={item.type}
        label={getLabelForType(item.type)}  // "Contacts", "Emails", "Messages"
        status={item.status}
        progress={item.progress}
      />
    ))}
  </div>
);
```

### Status to Color

```typescript
const statusColors = {
  pending: 'bg-gray-200 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** None
- **Existing tests to update:** `SyncStatusIndicator.test.tsx` - mock orchestrator instead of SyncQueue

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `refactor(ui): update SyncStatusIndicator for queue-order pills`
- **Branch:** `feature/dynamic-import-batch-size` (direct commit)
- **Target:** N/A (working on feature branch)

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

- **Before**: Shows all 3 pills always, uses SyncQueueService
- **After**: Shows only queued syncs in queue order, uses orchestrator
- **Actual Turns**: X (Est: 2)
- **Actual Tokens**: ~XK (Est: 8K-12K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Queue is empty but syncs are expected to show
- Error state display needs additional UX (retry button?)
- Overall progress bar needed in addition to per-sync pills
