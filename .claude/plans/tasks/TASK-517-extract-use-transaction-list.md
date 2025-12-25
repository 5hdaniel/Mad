# TASK-517: Extract useTransactionList Hook

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-517-use-transaction-list` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-516

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 4-6 | High |
| Tokens | ~20K | High |
| Time | 30-45 min | High |

**Basis:** Follows existing hook patterns (useToast, useSelection), ~80 lines, well-defined scope.

---

## Metrics Tracking (REQUIRED)

### Engineer Metrics

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | 2 | ~14K | 4 min |
| Implementation | 2 | ~12K | 8 min |
| Debugging | 0 | 0 | 0 min |
| **Total** | 4 | ~26K | 12 min |

**Estimate vs Actual:** Est 4-6 turns, Actual 4 turns - within estimate

### SR Engineer Metrics

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| PR Review | 2 | ~30K | 20 min |
| **Total** | 2 | ~30K | 20 min |

---

## Objective

Extract transaction data loading, filtering, and count calculation logic into a dedicated `useTransactionList` hook.

**Target:** Extract ~80 lines from TransactionList.tsx

---

## Acceptance Criteria

- [x] New file: `src/components/transaction/hooks/useTransactionList.ts`
- [x] Hook handles: loading transactions, filtering, search, counts
- [x] Returns: transactions, filteredTransactions, loading, error, filterCounts, refetch
- [x] TransactionList.tsx uses the new hook
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [x] `npm test` passes

---

## Implementation Steps

### Step 1: Create hooks directory

```bash
mkdir -p src/components/transaction/hooks
```

### Step 2: Create useTransactionList.ts

```typescript
// src/components/transaction/hooks/useTransactionList.ts

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Transaction } from "@/types";

interface FilterCounts {
  all: number;
  pendingReview: number;
  active: number;
  closed: number;
  rejected: number;
}

interface UseTransactionListResult {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  loading: boolean;
  error: string | null;
  filterCounts: FilterCounts;
  refetch: () => Promise<void>;
}

export function useTransactionList(
  userId: string,
  filter: string,
  searchQuery: string
): UseTransactionListResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    // ... move from TransactionList
  }, [userId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Filter logic
  const filteredTransactions = useMemo(() => {
    // ... move filter + search logic
  }, [transactions, filter, searchQuery]);

  // Count calculation
  const filterCounts = useMemo(() => {
    // ... move count logic
  }, [transactions]);

  return {
    transactions,
    filteredTransactions,
    loading,
    error,
    filterCounts,
    refetch: loadTransactions,
  };
}

export default useTransactionList;
```

### Step 3: Update TransactionList.tsx

```typescript
import { useTransactionList } from "./transaction/hooks/useTransactionList";

// Replace inline state/effects with hook
const {
  transactions,
  filteredTransactions,
  loading,
  error,
  filterCounts,
  refetch,
} = useTransactionList(userId, filter, searchQuery);
```

---

## State to Extract

| State | Purpose |
|-------|---------|
| `transactions` | Raw transaction list |
| `loading` | Loading state |
| `error` | Error message |

## Logic to Extract

| Logic | Purpose |
|-------|---------|
| `loadTransactions` | Fetch from API |
| Filter by status | Apply filter tab |
| Search by address | Apply search query |
| Count by status | Calculate filter counts |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/hooks/useTransactionList.ts` | Create (~80 lines) |
| `src/components/TransactionList.tsx` | Remove state/logic, add import |

---

## Guardrails

- DO NOT change filtering behavior
- DO NOT modify search logic
- DO NOT change API calls
- Preserve all existing behavior

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. Ready for SR Engineer phase review (after TASK-519)

---

## SR Engineer Review

**Review Date:** 2025-12-24
**Status:** APPROVED AND MERGED

### Review Summary

| Check | Result |
|-------|--------|
| Type-check | PASS (0 errors) |
| Lint | PASS (0 errors, pre-existing warnings only) |
| Tests | PASS (83 transaction tests, 1 unrelated flaky test) |
| Architecture | PASS |
| Memoization | PASS |

### Architecture Notes

- Hook follows established patterns (useSelection, useToast)
- Clean API with exported types (TransactionFilter, FilterCounts)
- Proper memoization with correct dependencies
- setError exposed for parent component control (pragmatic for current architecture)

### Merge Information

- **PR:** #204
- **Merge Commit:** 09fde58880078bbc118d88f1262f9f2b43e8d653
- **Merged At:** 2025-12-25T01:52:59Z
- **Target Branch:** feature/transaction-list-ui-refinements
