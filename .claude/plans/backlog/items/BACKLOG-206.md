# BACKLOG-206: UI Freezing During iMessage Sync/Import

**Created**: 2026-01-11
**Priority**: High
**Category**: enhancement/performance
**Status**: Pending

---

## Description

The app freezes during iMessage sync/import operations when processing large message databases. Users with large message histories (600K+ messages) experience complete UI unresponsiveness during sync operations.

## Problem Context

Observed with a user's database:
- **677,255 messages**
- **62,844 attachments**
- **1,355 processing batches**

The heavy processing blocks the main thread, causing the UI to become completely unresponsive until sync completes.

## Current Behavior

- Sync operations execute on the main thread
- No progress feedback during import
- UI is completely frozen during processing
- User cannot interact with the app or even close it gracefully
- No indication of how long the process will take

## Expected Behavior

1. **UI remains responsive** during all sync/import operations
2. **Progress indicator** shows current status (e.g., "Processing batch 500 of 1,355")
3. **User can cancel** long-running operations if needed
4. **App remains interactive** - user can navigate other parts of the UI

## Proposed Solutions

### Option 1: Worker Thread (Recommended)

Move heavy processing to a Node.js Worker Thread:

```typescript
// Main thread
import { Worker } from 'worker_threads';

const worker = new Worker('./messageImportWorker.js', {
  workerData: { dbPath, options }
});

worker.on('message', (progress) => {
  // Update UI with progress
  mainWindow.webContents.send('import-progress', progress);
});

worker.on('exit', () => {
  mainWindow.webContents.send('import-complete');
});
```

**Pros:**
- Complete isolation - no main thread blocking
- Can use full CPU core for processing
- Progress updates via message passing

**Cons:**
- Requires Worker Thread setup
- Database connection handling in worker

### Option 2: Async Chunking with UI Yields

Process in chunks with `setImmediate` yields:

```typescript
async function processMessagesInChunks(
  messages: Message[],
  batchSize: number,
  onProgress: (current: number, total: number) => void
) {
  const total = Math.ceil(messages.length / batchSize);

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    await processBatch(batch);

    // Yield to event loop - allows UI to update
    await new Promise(resolve => setImmediate(resolve));

    onProgress(Math.floor(i / batchSize) + 1, total);
  }
}
```

**Pros:**
- Simpler implementation
- No Worker Thread complexity
- Uses existing architecture

**Cons:**
- Still runs on main thread (just yields periodically)
- May still have micro-freezes during batch processing

### Option 3: Hybrid Approach

Use Web Workers for CPU-intensive transformation, main thread for I/O:

```typescript
// Renderer process
const worker = new Worker('transformWorker.js');

// Send raw data to worker for transformation
worker.postMessage({ type: 'transform', data: rawMessages });

// Worker handles parsing/transformation
worker.onmessage = async (e) => {
  if (e.data.type === 'transformed') {
    // Main thread handles database writes
    await window.api.saveMessages(e.data.messages);
  }
};
```

## Technical Implementation

### Files to Modify

1. **src/main/services/macosMessagesService.ts** - Add chunked processing with yields
2. **src/main/ipc/handlers/** - Add progress event emission
3. **src/preload/index.ts** - Expose progress events
4. **src/renderer/components/** - Add progress indicator component
5. **New: src/main/workers/messageImportWorker.ts** - If using Worker Thread approach

### Progress Indicator Design

```
+------------------------------------------+
|  Importing Messages                   X  |
+------------------------------------------+
|                                          |
|  [=========>           ] 45%             |
|                                          |
|  Processing batch 612 of 1,355           |
|  Messages: 305,500 / 677,255             |
|                                          |
|  Elapsed: 2:34  |  Remaining: ~3:15      |
|                                          |
|           [Cancel Import]                |
+------------------------------------------+
```

### IPC Events

```typescript
// Progress event
interface ImportProgress {
  type: 'messages' | 'attachments';
  current: number;
  total: number;
  batchNumber: number;
  totalBatches: number;
  elapsedMs: number;
}

// Main -> Renderer
ipcMain.emit('import-progress', progress: ImportProgress);
ipcMain.emit('import-complete', result: ImportResult);
ipcMain.emit('import-error', error: Error);

// Renderer -> Main (cancellation)
ipcRenderer.send('import-cancel');
```

## Acceptance Criteria

- [ ] UI remains responsive during import of 600K+ messages
- [ ] Progress indicator shows batch progress (X of Y)
- [ ] Progress indicator shows message count progress
- [ ] Estimated time remaining is displayed
- [ ] User can cancel import operation
- [ ] Cancellation is graceful (no data corruption)
- [ ] Progress persists across app restarts (resume capability - stretch goal)
- [ ] No regression in import speed (< 10% slower)

## Estimated Tokens

~25,000 (Worker Thread setup + Progress UI + IPC changes)

If using Option 2 (chunking only): ~15,000

## Testing

- [ ] Test with small database (< 1000 messages) - fast completion
- [ ] Test with medium database (10K-50K messages) - progress visible
- [ ] Test with large database (500K+ messages) - remains responsive
- [ ] Test cancellation mid-import
- [ ] Test cancellation recovery (no corrupt state)
- [ ] Test progress accuracy (actual vs displayed)

## Related Items

- BACKLOG-173: AttachMessagesModal UI freeze (different issue - query optimization)
- BACKLOG-190: Transaction date range filtering (different issue - unbounded linking)
- BACKLOG-156: Background sync (mentions UI responsiveness during sync)

## Notes

This is a distinct issue from BACKLOG-173 (modal query performance) and BACKLOG-190 (message linking scope). Those address specific query bottlenecks; this addresses the fundamental architecture of keeping the UI responsive during heavy I/O operations.

The recommended approach is Option 1 (Worker Thread) for complete isolation, but Option 2 (chunking with yields) is acceptable as a faster-to-implement solution with most of the benefits.
