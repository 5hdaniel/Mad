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
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

---

## Objective

Extract email scanning logic (start scan, stop scan, progress tracking) into a dedicated `useTransactionScan` hook.

**Target:** Extract ~60 lines from TransactionList.tsx

---

## Acceptance Criteria

- [ ] New file: `src/components/transaction/hooks/useTransactionScan.ts`
- [ ] Hook handles: start scan, stop scan, progress subscription
- [ ] Returns: scanning, scanProgress, startScan, stopScan
- [ ] Progress updates via IPC listener
- [ ] Cleanup on unmount
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

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
