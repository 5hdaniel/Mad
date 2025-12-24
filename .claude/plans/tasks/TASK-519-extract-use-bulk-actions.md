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
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

---

## Objective

Extract bulk action logic (selection mode, bulk delete, bulk export, bulk status update) into a dedicated `useBulkActions` hook.

**Target:** Extract ~100 lines from TransactionList.tsx

---

## Acceptance Criteria

- [ ] New file: `src/components/transaction/hooks/useBulkActions.ts`
- [ ] Hook handles: selection mode, select/deselect, bulk operations
- [ ] Returns: selection state, toggle functions, bulk action handlers, loading states
- [ ] Bulk delete with confirmation
- [ ] Bulk export functionality
- [ ] Bulk status update
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

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

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. SR Engineer phase review for Phase 4 (TASK-517, 518, 519)
