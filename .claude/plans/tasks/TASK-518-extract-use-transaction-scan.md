# TASK-518: Extract useTransactionScan Hook

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-518-use-transaction-scan` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-517

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 4-6 | High |
| Tokens | ~20K | High |
| Time | 30-45 min | High |

**Basis:** Small hook (~60 lines), follows existing patterns, clear IPC subscription pattern.

---

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | 2 | ~12K | 5 min |
| Implementation | 3 | ~12K | 15 min |
| Debugging | 0 | 0 | 0 min |
| **Total** | 5 | ~24K | 20 min |

---

## Objective

Extract email scanning logic (start scan, stop scan, progress tracking) into a dedicated `useTransactionScan` hook.

**Target:** Extract ~60 lines from TransactionList.tsx

---

## Acceptance Criteria

- [x] New file: `src/components/transaction/hooks/useTransactionScan.ts`
- [x] Hook handles: start scan, stop scan, progress subscription
- [x] Returns: scanning, scanProgress, startScan, stopScan
- [x] Progress updates via IPC listener
- [x] Cleanup on unmount
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (warnings only, no errors)
- [x] `npm test` passes (all Transaction-related tests pass)

---

## Implementation Steps

### Step 1: Create useTransactionScan.ts

```typescript
// src/components/transaction/hooks/useTransactionScan.ts

import { useState, useEffect, useCallback, useRef } from "react";

interface ScanProgress {
  current: number;
  total: number;
}

interface UseTransactionScanResult {
  scanning: boolean;
  scanProgress: ScanProgress | null;
  startScan: () => Promise<void>;
  stopScan: () => void;
}

export function useTransactionScan(
  userId: string,
  provider: string,
  onScanComplete: () => void
): UseTransactionScanResult {
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to progress updates
  useEffect(() => {
    unsubscribeRef.current = window.api.onTransactionScanProgress((progress) => {
      setScanProgress(progress);
      if (progress.current === progress.total) {
        setScanning(false);
        onScanComplete();
      }
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, [onScanComplete]);

  const startScan = useCallback(async () => {
    setScanning(true);
    setScanProgress({ current: 0, total: 0 });
    await window.api.transactions.scanEmails(userId, provider);
  }, [userId, provider]);

  const stopScan = useCallback(() => {
    // Stop scan logic
    setScanning(false);
    setScanProgress(null);
  }, []);

  return { scanning, scanProgress, startScan, stopScan };
}

export default useTransactionScan;
```

### Step 2: Update TransactionList.tsx

```typescript
import { useTransactionScan } from "./transaction/hooks/useTransactionScan";

// Replace inline state/effects with hook
const { scanning, scanProgress, startScan, stopScan } = useTransactionScan(
  userId,
  provider,
  refetch // callback when scan completes
);
```

---

## State to Extract

| State | Purpose |
|-------|---------|
| `scanning` | Is scan in progress |
| `scanProgress` | Current/total progress |

## Logic to Extract

| Logic | Purpose |
|-------|---------|
| Progress subscription | Listen to IPC events |
| Start scan | Trigger email scan |
| Stop scan | Cancel scan |
| Cleanup | Unsubscribe on unmount |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/hooks/useTransactionScan.ts` | Create (~60 lines) |
| `src/components/TransactionList.tsx` | Remove state/logic, add import |

---

## Guardrails

- DO NOT change scan API calls
- DO NOT modify progress event structure
- Preserve cleanup behavior
- Follow existing hook patterns (see useToast, useSelection)

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. Ready for SR Engineer phase review (after TASK-519)

---

## Implementation Summary

### What Was Done

1. **Created `useTransactionScan.ts`** (120 lines including docs):
   - `ScanProgress` interface with step/message structure
   - `UseTransactionScanResult` interface
   - `useTransactionScan(userId, onScanComplete, onError)` hook
   - State: `scanning`, `scanProgress`
   - Functions: `startScan`, `stopScan`, `handleScanProgress`
   - IPC listener setup/cleanup via `useEffect`

2. **Updated `TransactionList.tsx`**:
   - Added import for `useTransactionScan`
   - Removed inline `ScanProgress` interface (moved to hook)
   - Removed inline state: `scanning`, `scanProgress`
   - Removed inline functions: `handleScanProgress`, `startScan`, `stopScan`
   - Removed scan progress `useEffect` listener
   - Added hook call with proper callbacks

### Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| TransactionList.tsx | 573 lines | 511 lines | -62 lines |
| New hook file | 0 lines | 120 lines | +120 lines |
| Total Transaction test suites | 11 | 11 | No change |
| Tests passing | 229 | 229 | No change |

### Files Modified

| File | Change |
|------|--------|
| `src/components/transaction/hooks/useTransactionScan.ts` | Created (120 lines) |
| `src/components/TransactionList.tsx` | Modified (-62 lines) |

### Deviations

- Hook is 120 lines vs estimated 60 lines. The additional lines are comprehensive JSDoc comments and proper TypeScript interfaces. Code logic is equivalent.
- Removed `provider` param from hook (backend auto-detects connected mailboxes)
- Added `onError` callback param for error reporting to parent component

### Engineer Checklist

- [x] Branch created from correct base
- [x] Implementation follows existing patterns (useTransactionList, useToast)
- [x] TypeScript strict mode compliance
- [x] No business logic in entry files
- [x] IPC listener cleanup on unmount
- [x] All quality checks pass
