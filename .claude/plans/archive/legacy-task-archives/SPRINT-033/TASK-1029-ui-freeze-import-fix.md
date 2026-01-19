# TASK-1029: Fix UI Freezing During iMessage Import

**Backlog ID:** BACKLOG-206
**Sprint:** SPRINT-033
**Phase:** Phase 2 - Stability & Regression Fixes
**Branch:** `fix/task-1029-ui-freeze-import`
**Estimated Tokens:** ~30K
**Token Cap:** 120K

---

## Objective

Fix the UI freezing that occurs during iMessage sync/import operations when processing large message databases (600K+ messages). Users should be able to interact with the app during imports, see progress, and optionally cancel.

---

## Context

The app freezes during iMessage import operations when processing large message databases. Observed with a user's database of **677,255 messages** and **62,844 attachments**. The UI becomes completely unresponsive for **160+ seconds** during sync.

### Current Behavior

- Sync operations execute on the main thread without yielding
- No progress feedback during import
- UI is completely frozen during processing
- User cannot interact with the app or close it gracefully
- No indication of how long the process will take

### Expected Behavior

1. UI remains responsive during all sync/import operations
2. Progress indicator shows current status (e.g., "Processing batch 500 of 1,355")
3. User can cancel long-running operations
4. App remains interactive - user can navigate other parts of the UI

---

## Requirements

### Must Do:

1. **Implement async chunking with UI yields** - Process in batches with `setImmediate` yields
2. **Add progress indicator** - Show batch progress, message count, estimated time
3. **Add cancellation support** - Allow user to stop long-running imports
4. **Emit IPC progress events** - Main process reports progress to renderer
5. **Ensure graceful cancellation** - No data corruption on cancel

### Must NOT Do:

- Use Worker Threads (out of scope for this task - simpler approach first)
- Significantly slow down imports (< 10% performance impact)
- Break existing import functionality
- Leave partial imports in corrupt state on cancel

---

## Acceptance Criteria

- [ ] UI remains responsive during import of 600K+ messages
- [ ] Progress indicator shows batch progress (X of Y batches)
- [ ] Progress indicator shows message count progress
- [ ] User can cancel import operation
- [ ] Cancellation is graceful (no data corruption)
- [ ] No regression in import speed (< 10% slower)
- [ ] Full test suite passes (`npm test`)

---

## Implementation Approach

### Option 2: Async Chunking with UI Yields (Recommended for this task)

```typescript
async function processMessagesInChunks(
  messages: Message[],
  batchSize: number,
  onProgress: (progress: ImportProgress) => void,
  cancellationToken: { cancelled: boolean }
): Promise<ImportResult> {
  const totalBatches = Math.ceil(messages.length / batchSize);
  const startTime = Date.now();

  for (let i = 0; i < messages.length; i += batchSize) {
    // Check for cancellation
    if (cancellationToken.cancelled) {
      return { status: 'cancelled', processed: i };
    }

    const batch = messages.slice(i, i + batchSize);
    await processBatch(batch);

    // Yield to event loop - allows UI to update
    await new Promise(resolve => setImmediate(resolve));

    // Report progress
    onProgress({
      type: 'messages',
      current: Math.min(i + batchSize, messages.length),
      total: messages.length,
      batchNumber: Math.floor(i / batchSize) + 1,
      totalBatches,
      elapsedMs: Date.now() - startTime
    });
  }

  return { status: 'complete', processed: messages.length };
}
```

### Progress Event Interface

```typescript
interface ImportProgress {
  type: 'messages' | 'attachments';
  current: number;
  total: number;
  batchNumber: number;
  totalBatches: number;
  elapsedMs: number;
}

interface ImportResult {
  status: 'complete' | 'cancelled' | 'error';
  processed: number;
  error?: string;
}
```

### IPC Events

```typescript
// Main -> Renderer
ipcMain.emit('import-progress', progress: ImportProgress);
ipcMain.emit('import-complete', result: ImportResult);
ipcMain.emit('import-error', error: Error);

// Renderer -> Main (cancellation)
ipcRenderer.send('import-cancel');
```

### Progress UI Component

```typescript
// src/renderer/components/ImportProgressModal.tsx
interface ImportProgressModalProps {
  isOpen: boolean;
  progress: ImportProgress | null;
  onCancel: () => void;
}

function ImportProgressModal({ isOpen, progress, onCancel }: ImportProgressModalProps) {
  if (!progress) return null;

  const percentage = Math.round((progress.current / progress.total) * 100);
  const remainingMs = estimateRemainingTime(progress);

  return (
    <Modal isOpen={isOpen}>
      <h2>Importing Messages</h2>
      <ProgressBar value={percentage} />
      <p>Processing batch {progress.batchNumber} of {progress.totalBatches}</p>
      <p>Messages: {progress.current.toLocaleString()} / {progress.total.toLocaleString()}</p>
      <p>Elapsed: {formatDuration(progress.elapsedMs)} | Remaining: ~{formatDuration(remainingMs)}</p>
      <Button onClick={onCancel}>Cancel Import</Button>
    </Modal>
  );
}
```

---

## Files to Modify

- `electron/services/macOSMessagesImportService.ts` - Add chunked processing with yields
- `electron/handlers/` or `electron/ipc/` - Add progress event emission and cancel handler
- `src/preload/index.ts` - Expose progress events to renderer
- `src/renderer/components/` - Add ImportProgressModal component
- `src/renderer/hooks/` - Add useImportProgress hook (if needed)

## Files to Read (for context)

- `electron/services/macOSMessagesImportService.ts` - Current import implementation
- Existing IPC patterns in `electron/handlers/`
- Existing modal patterns in `src/renderer/components/`

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test cases:**
```typescript
describe('processMessagesInChunks', () => {
  it('yields to event loop between batches', async () => {
    // Verify setImmediate is called between batches
  });

  it('reports progress correctly', async () => {
    const onProgress = jest.fn();
    await processMessagesInChunks(mockMessages, 100, onProgress, { cancelled: false });
    expect(onProgress).toHaveBeenCalledTimes(expectedBatches);
  });

  it('respects cancellation token', async () => {
    const token = { cancelled: false };
    const promise = processMessagesInChunks(mockMessages, 100, () => {}, token);

    // Cancel after first batch
    setTimeout(() => { token.cancelled = true; }, 10);

    const result = await promise;
    expect(result.status).toBe('cancelled');
    expect(result.processed).toBeLessThan(mockMessages.length);
  });

  it('handles empty message array', async () => {
    const result = await processMessagesInChunks([], 100, () => {}, { cancelled: false });
    expect(result.status).toBe('complete');
    expect(result.processed).toBe(0);
  });
});
```

### Manual Testing

- [ ] Test with small database (< 1000 messages) - fast completion
- [ ] Test with medium database (10K-50K messages) - progress visible
- [ ] Test with large database (500K+ messages) - remains responsive
- [ ] Test cancellation mid-import
- [ ] Test progress accuracy (actual vs displayed)

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(import): add async chunking to prevent UI freeze during iMessage import`
- **Branch:** `fix/task-1029-ui-freeze-import`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Implementation:
- [ ] Chunked processing with yields implemented
- [ ] Progress IPC events added
- [ ] Cancel handler implemented
- [ ] Progress UI component created
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Chunking approach shows > 20% performance degradation
- Worker Threads appear necessary for true non-blocking behavior
- Existing import architecture makes chunking difficult
- Progress UI requires significant UI framework changes
- You encounter blockers not covered in the task file

---

## SR Engineer Review Notes

**Review Date:** 2026-01-11 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after TASK-1028 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1029-ui-freeze-import

### Execution Classification
- **Parallel Safe:** No - Shares file with TASK-1028
- **Depends On:** TASK-1028
- **Blocks:** TASK-1031, TASK-1032

### Shared File Analysis
- Files modified: `electron/services/macOSMessagesImportService.ts`, IPC handlers, progress UI
- Conflicts with: TASK-1028 (same service file)

### Technical Considerations

**Current Implementation Already Has:**
- `yieldToEventLoop()` helper function (line 83-85)
- `YIELD_INTERVAL = 2` constant (yield every 2 batches)
- `BATCH_SIZE = 500` messages per batch
- Cancellation token pattern (`cancelCurrentImport`)
- Progress callback infrastructure (`ImportProgressCallback`)

**Root Cause Hypothesis:**
The UI freeze occurs BEFORE processing begins. Line 374-391 shows:
```typescript
const messages = await dbAll<RawMacMessage>(`SELECT ...`);
```
This query loads ALL 600K+ messages into memory at once, blocking the event loop.

**Recommended Approach:**
1. Implement cursor-based pagination in the initial query
2. Reduce `YIELD_INTERVAL` from 2 to 1
3. Add progress reporting during query phase (not just processing)
4. Consider streaming results from SQLite instead of loading all at once

**Risk Areas:**
- Query refactoring may be more complex than task estimates
- Need to verify SQLite driver supports streaming/cursors
- If pagination approach is insufficient, Worker Thread may be needed (escalate)

**Performance Target:**
- UI must remain responsive (event loop not blocked > 100ms)
- Total import time should not increase by more than 10%
