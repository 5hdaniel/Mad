# TASK-910: Sync Lock UI Component

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-032
**Priority:** CRITICAL
**Category:** ui
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

**Estimated:** 3-4 turns, ~15K tokens, 15-20 min

---

## Goal

Create UI components that detect and display "sync in progress" state, preventing users from triggering concurrent syncs.

## Non-Goals

- Do NOT modify sync logic (that's TASK-904)
- Do NOT add cancel functionality (future enhancement)
- Do NOT change existing sync UI

---

## Prerequisites

**Depends on:** TASK-904 (Sync Status Service) must be merged first.

---

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/sync/SyncLockBanner.tsx` | Banner component for sync-in-progress state |

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useIPhoneSync.ts` | Check sync status before allowing startSync |
| `src/components/sync/IPhoneSyncModal.tsx` | Show lock banner when sync in progress |

---

## Implementation Notes

### SyncLockBanner Component

```tsx
// src/components/sync/SyncLockBanner.tsx
import React from 'react';

interface SyncLockBannerProps {
  operationName: string;
  onRetry?: () => void;
}

export function SyncLockBanner({ operationName, onRetry }: SyncLockBannerProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600" />
        <div>
          <h3 className="text-sm font-medium text-yellow-800">
            Sync In Progress
          </h3>
          <p className="text-sm text-yellow-700 mt-1">
            {operationName}. Please wait for it to complete before starting another sync.
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm text-yellow-700 hover:text-yellow-900 underline"
        >
          Check again
        </button>
      )}
    </div>
  );
}
```

### Hook Integration

```typescript
// In src/hooks/useIPhoneSync.ts

import { useState, useCallback, useEffect } from 'react';

export function useIPhoneSync() {
  const [syncLocked, setSyncLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // Check sync status on mount and periodically
  const checkSyncStatus = useCallback(async () => {
    try {
      const status = await window.api.sync.getStatus();
      setSyncLocked(status.isAnyOperationRunning);
      setLockReason(status.currentOperation);
    } catch (error) {
      console.error('Failed to check sync status:', error);
    }
  }, []);

  useEffect(() => {
    checkSyncStatus();
    // Poll every 5 seconds while component is mounted
    const interval = setInterval(checkSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [checkSyncStatus]);

  const startSync = useCallback(async () => {
    // Check status before starting
    const status = await window.api.sync.getStatus();
    if (status.isAnyOperationRunning) {
      setSyncLocked(true);
      setLockReason(status.currentOperation);
      return { blocked: true, reason: status.currentOperation };
    }

    // ... existing sync logic
  }, []);

  return {
    // ... existing returns
    syncLocked,
    lockReason,
    checkSyncStatus,
  };
}
```

### Modal Integration

```tsx
// In IPhoneSyncModal.tsx - add at the top of the modal content

{syncLocked && (
  <SyncLockBanner
    operationName={lockReason || 'Another sync operation'}
    onRetry={checkSyncStatus}
  />
)}
```

---

## Acceptance Criteria

- [ ] `SyncLockBanner` component created with proper styling
- [ ] `useIPhoneSync` checks sync status on mount
- [ ] `startSync` returns early if sync locked
- [ ] Banner displays when sync in progress
- [ ] "Check again" button refreshes status
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Follow existing Tailwind styling patterns
- Add accessibility attributes (aria-busy, etc.)
- Poll status while modal is open
- Show specific operation name when available

### Don't
- Add cancel functionality (future enhancement)
- Modify sync logic (handled by TASK-904)
- Block UI completely (show banner, not modal)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- `window.api.sync.getStatus()` not available (TASK-904 not merged)
- Design needs to differ from banner approach
- Need to integrate with other sync entry points

---

## Testing Expectations

- Component test for `SyncLockBanner` rendering
- Hook test for status checking logic
- Mock `window.api.sync.getStatus()` responses
- Manual verification: start sync, see banner in another tab

---

## PR Preparation

**Branch:** `feature/TASK-910-sync-lock-ui`
**Title:** `feat(ui): add sync lock banner for concurrent sync prevention`
**Labels:** `feature`, `ui`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop (AFTER TASK-904 merged)
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-909)
- **Depends On:** TASK-904 (sync status service)
- **Blocks:** TASK-912
