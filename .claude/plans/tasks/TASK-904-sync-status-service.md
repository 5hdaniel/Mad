# TASK-904: Sync Status Service & IPC

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-032
**Priority:** CRITICAL
**Category:** service
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 4-6 turns, ~20K tokens, 20-30 min

---

## Goal

Create a unified sync status service that exposes backup/sync state to the UI, preventing users from triggering multiple concurrent syncs.

## Non-Goals

- Do NOT modify the backup logic itself
- Do NOT change sync behavior (just add status awareness)
- Do NOT implement the UI component (that's TASK-910)

---

## Current State

The `BackupService` has an `isRunning` flag (line 46) but it's private. There's a `getStatus()` method (lines 163-169) but no IPC handler to expose it to the renderer.

```typescript
// electron/services/backupService.ts:46
private isRunning = false;

// electron/services/backupService.ts:163-169
getStatus(): BackupStatus {
  return {
    isRunning: this.isRunning,
    // ...
  };
}
```

---

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `electron/services/syncStatusService.ts` | Unified sync status aggregator |

### Files to Modify

| File | Change |
|------|--------|
| `electron/sync-handlers.ts` | Add IPC handler for sync status query |
| `electron/preload.ts` | Expose `getSyncStatus()` to renderer |
| `src/window.d.ts` | Add type declaration for `getSyncStatus()` |

---

## Implementation Notes

### SyncStatusService

```typescript
// electron/services/syncStatusService.ts
import { backupService } from './backupService';
import { syncOrchestrator } from './syncOrchestrator';

export interface SyncStatus {
  isAnyOperationRunning: boolean;
  backupInProgress: boolean;
  emailSyncInProgress: boolean;
  currentOperation: string | null;
}

class SyncStatusService {
  getStatus(): SyncStatus {
    const backupStatus = backupService.getStatus();
    const orchestratorRunning = syncOrchestrator.isRunning?.() ?? false;

    return {
      isAnyOperationRunning: backupStatus.isRunning || orchestratorRunning,
      backupInProgress: backupStatus.isRunning,
      emailSyncInProgress: orchestratorRunning && !backupStatus.isRunning,
      currentOperation: this.getCurrentOperationLabel(backupStatus, orchestratorRunning),
    };
  }

  private getCurrentOperationLabel(backupStatus: BackupStatus, orchestratorRunning: boolean): string | null {
    if (backupStatus.isRunning) return 'iPhone backup in progress';
    if (orchestratorRunning) return 'Email sync in progress';
    return null;
  }
}

export const syncStatusService = new SyncStatusService();
```

### IPC Handler

```typescript
// In electron/sync-handlers.ts
ipcMain.handle('sync:getStatus', async () => {
  return syncStatusService.getStatus();
});
```

### Preload Exposure

```typescript
// In electron/preload.ts - add to contextBridge.exposeInMainWorld
sync: {
  getStatus: () => ipcRenderer.invoke('sync:getStatus'),
}
```

---

## Acceptance Criteria

- [ ] `syncStatusService.getStatus()` returns accurate sync state
- [ ] IPC handler `sync:getStatus` is registered
- [ ] Preload exposes `window.api.sync.getStatus()`
- [ ] Type declarations updated in `window.d.ts`
- [ ] Unit tests for `SyncStatusService`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use existing `backupService.getStatus()` method
- Follow existing IPC handler patterns in `sync-handlers.ts`
- Add proper TypeScript types for the status object

### Don't
- Modify `BackupService` internals
- Add UI components (that's TASK-910)
- Block on this for email sync (they're independent)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- `backupService.getStatus()` doesn't provide needed info
- Need to add properties to existing interfaces
- Circular dependency issues arise

---

## Testing Expectations

- Unit test `SyncStatusService.getStatus()` with mocked dependencies
- Test IPC handler returns expected structure
- Manual verification: call from DevTools console

---

## PR Preparation

**Branch:** `feature/TASK-904-sync-status-service`
**Title:** `feat(sync): add unified sync status service with IPC`
**Labels:** `feature`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-905)
- **Depends On:** None
- **Blocks:** TASK-910 (Sync Lock UI)
