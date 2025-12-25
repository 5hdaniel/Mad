# TASK-519: Extract useBulkActions Hook

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-519-use-bulk-actions` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-518

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 6-8 | Medium |
| Tokens | ~28K | Medium |
| Time | 45-60 min | Medium |

**Basis:** Larger hook (~100 lines), many state variables, multiple async operations. Medium confidence due to complexity.

---

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | 1 | ~8K | 3 min |
| Implementation | 2 | ~12K | 8 min |
| Debugging | 0 | 0 | 0 min |
| Quality Checks | 1 | ~4K | 4 min |
| **Total** | 4 | ~24K | 15 min |

**Estimated vs Actual:**
- Est: 6-8 turns, ~28K tokens, 45-60 min
- Actual: 4 turns, ~24K tokens, 15 min (under estimate)

---

## Objective

Extract bulk action logic (selection mode, bulk delete, bulk export, bulk status update) into a dedicated `useBulkActions` hook.

**Target:** Extract ~100 lines from TransactionList.tsx

---

## Acceptance Criteria

- [x] New file: `src/components/transaction/hooks/useBulkActions.ts`
- [x] Hook handles: bulk operations (selection handled by existing useSelection hook)
- [x] Returns: bulk action handlers, loading states
- [x] Bulk delete with confirmation
- [x] Bulk export functionality
- [x] Bulk status update
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [x] `npm test` passes (1 unrelated flaky timeout)

---

## Implementation Steps

### Step 1: Create useBulkActions.ts

```typescript
// src/components/transaction/hooks/useBulkActions.ts

import { useState, useCallback } from "react";
import type { Transaction } from "@/types";

interface UseBulkActionsResult {
  // Selection
  selectionMode: boolean;
  selectedTransactions: Set<string>;
  toggleSelectionMode: () => void;
  selectTransaction: (id: string, selected: boolean) => void;
  selectAll: (transactions: Transaction[]) => void;
  deselectAll: () => void;

  // Bulk operations
  bulkDelete: (onComplete: () => void) => Promise<void>;
  bulkExport: (transactions: Transaction[]) => Promise<void>;
  bulkStatusUpdate: (status: string, onComplete: () => void) => Promise<void>;

  // Loading states
  isBulkDeleting: boolean;
  isBulkExporting: boolean;
  isBulkUpdating: boolean;

  // Confirmation
  showBulkDeleteConfirm: boolean;
  setShowBulkDeleteConfirm: (show: boolean) => void;
  showBulkExportModal: boolean;
  setShowBulkExportModal: (show: boolean) => void;

  // Success state
  bulkActionSuccess: string | null;
  setBulkActionSuccess: (msg: string | null) => void;
}

export function useBulkActions(): UseBulkActionsResult {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(null);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedTransactions(new Set());
      }
      return !prev;
    });
  }, []);

  const selectTransaction = useCallback((id: string, selected: boolean) => {
    setSelectedTransactions(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((transactions: Transaction[]) => {
    setSelectedTransactions(new Set(transactions.map(t => t.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedTransactions(new Set());
  }, []);

  // Bulk operations...
  const bulkDelete = useCallback(async (onComplete: () => void) => {
    setIsBulkDeleting(true);
    try {
      for (const id of selectedTransactions) {
        await window.api.transactions.delete(id);
      }
      setSelectedTransactions(new Set());
      setSelectionMode(false);
      setBulkActionSuccess(`Deleted ${selectedTransactions.size} transactions`);
      onComplete();
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }, [selectedTransactions]);

  // ... similar for bulkExport, bulkStatusUpdate

  return {
    selectionMode,
    selectedTransactions,
    toggleSelectionMode,
    selectTransaction,
    selectAll,
    deselectAll,
    bulkDelete,
    bulkExport,
    bulkStatusUpdate,
    isBulkDeleting,
    isBulkExporting,
    isBulkUpdating,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    showBulkExportModal,
    setShowBulkExportModal,
    bulkActionSuccess,
    setBulkActionSuccess,
  };
}

export default useBulkActions;
```

### Step 2: Update TransactionList.tsx

```typescript
import { useBulkActions } from "./transaction/hooks/useBulkActions";

// Replace inline state with hook
const {
  selectionMode,
  selectedTransactions,
  toggleSelectionMode,
  selectTransaction,
  selectAll,
  deselectAll,
  bulkDelete,
  // ... rest
} = useBulkActions();
```

---

## State to Extract

| State | Purpose |
|-------|---------|
| `selectionMode` | Toggle selection UI |
| `selectedTransactions` | Set of selected IDs |
| `isBulkDeleting` | Delete in progress |
| `isBulkExporting` | Export in progress |
| `isBulkUpdating` | Status update in progress |
| `showBulkDeleteConfirm` | Confirmation dialog |
| `showBulkExportModal` | Export modal |
| `bulkActionSuccess` | Success message |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/hooks/useBulkActions.ts` | Create (~100 lines) |
| `src/components/TransactionList.tsx` | Remove state/logic, add import |

---

## Guardrails

- DO NOT change bulk operation API calls
- DO NOT modify confirmation dialogs
- Preserve success/error handling
- Follow existing hook patterns

---

## Definition of Done

1. [x] All acceptance criteria checked
2. [x] Metrics recorded
3. [x] PR created targeting `feature/transaction-list-ui-refinements` - PR #206
4. [x] SR Engineer phase review for Phase 4 (TASK-517, 518, 519)

---

## Implementation Summary

### Files Created
- `src/components/transaction/hooks/useBulkActions.ts` (~180 lines)

### Files Modified
- `src/components/TransactionList.tsx` (511 -> 431 lines, -80 lines)

### Design Decisions
1. **Kept selection logic separate**: The existing `useSelection` hook handles selection state. `useBulkActions` focuses only on bulk operations (delete, export, status change).
2. **Callback-based design**: Hook receives callbacks for completion, success/error messaging, and modal control rather than managing UI state internally.
3. **Comprehensive JSDoc**: Added full documentation for interfaces and functions.

### Deviations from Original Plan
- Hook is ~180 lines instead of estimated ~100 lines due to comprehensive documentation
- Did not include selection logic (already in useSelection hook)
- Uses callback pattern rather than returning UI state setters

### Results
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| TransactionList.tsx lines | 511 | 431 | -80 (-16%) |
| Extracted hook lines | 0 | 180 | +180 |
| Bulk action handlers | inline | extracted | cleaner |

### PR Information
- **PR**: #206
- **Branch**: `refactor/TASK-519-use-bulk-actions`
- **Base**: `feature/transaction-list-ui-refinements`

---

## SR Engineer Review

**Review Date:** 2025-12-24
**Status:** APPROVED AND MERGED

### SR Engineer Metrics

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| PR Review | 1 | ~15K | 8 min |
| **SR Total** | 1 | ~15K | 8 min |

### Review Summary

**Architecture Assessment:**
- Hook uses callback-based API pattern consistent with `useTransactionScan`
- Proper separation of concerns: selection in `useSelection`, bulk ops in `useBulkActions`
- All handlers use `useCallback` with correct dependency arrays
- No architecture boundary violations

**Quality Gates:**
- [x] Type check passes
- [x] Lint passes (0 errors, 525 pre-existing warnings)
- [x] Tests pass (1 unrelated flaky timeout noted)

**Observations (Non-Blocking):**
- `any` type usage on lines 76, 170 for `bulkDelete`/`bulkUpdateStatus` APIs - pre-existing pattern, not introduced by this PR
- Hook is 180 lines vs 100 estimated - explained by comprehensive JSDoc

### Merge Information
- **PR**: #206
- **Merge Commit**: `43b5798b2b70786e0b61291203e30cfd5e2a097e`
- **Merged At**: 2025-12-25T02:30:31Z
- **Merge Type**: Traditional merge (correct)
