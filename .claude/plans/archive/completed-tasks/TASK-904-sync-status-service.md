# TASK-904: Sync Status Service & IPC

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-032
**Priority:** CRITICAL
**Category:** service
**Status:** Complete

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | 0K | 0 min |
| Implementation (Impl) | 2 | ~12K | 15 min |
| Debugging (Debug) | 0 | 0K | 0 min |
| **Engineer Total** | 2 | ~12K | 15 min |

**Estimated:** 4-6 turns, ~20K tokens, 20-30 min
**Actual:** 2 turns, ~12K tokens, 15 min

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

- [x] `syncStatusService.getStatus()` returns accurate sync state
- [x] IPC handler `sync:getUnifiedStatus` is registered
- [x] Preload exposes `window.api.sync.getUnifiedStatus()`
- [x] Type declarations updated in `window.d.ts`
- [x] Unit tests for `SyncStatusService` (8 tests)
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (no new errors)

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

---

## Implementation Summary

### Files Created
| File | Lines | Purpose |
|------|-------|---------|
| `electron/services/syncStatusService.ts` | 107 | Unified sync status aggregator |
| `electron/services/__tests__/syncStatusService.test.ts` | 165 | Unit tests (8 tests) |

### Files Modified
| File | Change |
|------|--------|
| `electron/sync-handlers.ts` | Added `sync:getUnifiedStatus` IPC handler, import for service |
| `electron/preload/deviceBridge.ts` | Added `getUnifiedStatus()` method to syncBridge |
| `src/window.d.ts` | Added `UnifiedSyncStatus` interface and `getUnifiedStatus()` method |

### Implementation Notes

1. **Used `syncOrchestrator.getStatus().isRunning`** per SR review note (not `.isRunning?.()`)
2. **Named IPC channel `sync:getUnifiedStatus`** to avoid confusion with existing `sync:status`
3. **Added `syncPhase` to response** for more detailed status information
4. **Phase-specific labels** for user-friendly operation descriptions
5. **Tests cover all sync phases** including edge cases (complete/error states)

### Deviations from Task Spec
- IPC channel named `sync:getUnifiedStatus` instead of `sync:getStatus` to avoid collision with existing handler
- Added `syncPhase` property to status interface for richer status info
- Preload uses `getUnifiedStatus()` not `getSyncStatus()` for naming consistency

### Quality Gates
- [x] Tests pass: 8/8 tests passing
- [x] Tests run 3x without flakiness: Confirmed
- [x] Type-check passes: No errors
- [x] Lint passes: No new warnings/errors
