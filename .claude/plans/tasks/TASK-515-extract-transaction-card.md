# TASK-515: Extract TransactionCard Component

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-515-transaction-card` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-514
**Status:** COMPLETE

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 4-6 | High |
| Tokens | ~20K | High |
| Time | 30-45 min | High |

**Basis:** Straightforward JSX extraction, clear prop boundaries, ~150 lines.

---

## Metrics Tracking (REQUIRED)

### Engineer Metrics
| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | 1 | ~4K | 2 min |
| Implementation | 1 | ~8K | 5 min |
| Debugging | 0 | 0 | 0 min |
| **Engineer Total** | 1 | ~12K | 7 min |

### SR Engineer Metrics
| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| PR Review | 1 | ~15K | 7 min |
| **SR Total** | 1 | ~15K | 7 min |

---

## Objective

Extract the transaction card content (property address, price, dates, selection checkbox, etc.) into a dedicated `TransactionCard` component.

**Target:** Extract ~150 lines from TransactionList.tsx

---

## Acceptance Criteria

- [x] New file: `src/components/transaction/TransactionCard.tsx`
- [x] Card displays property address, transaction type, price, dates
- [x] Selection checkbox works in selection mode
- [x] Click handler opens transaction details
- [x] Manual badge displays for manual transactions
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [x] `npm test` passes (729 tests per PR)

---

## Implementation Steps

### Step 1: Create TransactionCard.tsx

```typescript
// src/components/transaction/TransactionCard.tsx

import React from "react";
import type { Transaction } from "@/types";

interface TransactionCardProps {
  transaction: Transaction;
  isSelected: boolean;
  selectionMode: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onClick: () => void;
}

export function TransactionCard({
  transaction,
  isSelected,
  selectionMode,
  onSelect,
  onClick,
}: TransactionCardProps) {
  // Extract card content JSX from TransactionList.tsx
  // This is the content INSIDE the TransactionStatusWrapper
}

export default TransactionCard;
```

### Step 2: Identify card content in TransactionList.tsx

The card content is the children passed to `TransactionStatusWrapper`:
- Selection checkbox (when selectionMode)
- Property address
- Transaction type badge
- Sale price
- Closing date
- Communications count
- Manual entry badge (for manual transactions)

### Step 3: Update TransactionList.tsx

```typescript
import TransactionCard from "./transaction/TransactionCard";

// In render, replace card content with component:
<TransactionStatusWrapper
  transaction={transaction}
  onActionClick={handleWrapperAction}
>
  <TransactionCard
    transaction={transaction}
    isSelected={selectedTransactions.has(transaction.id)}
    selectionMode={selectionMode}
    onSelect={handleSelectTransaction}
    onClick={() => handleCardClick(transaction)}
  />
</TransactionStatusWrapper>
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/TransactionCard.tsx` | Create (~150 lines) |
| `src/components/TransactionList.tsx` | Remove card JSX, add import |

---

## Props Interface

```typescript
interface TransactionCardProps {
  transaction: Transaction;
  isSelected: boolean;
  selectionMode: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onClick: () => void;
}
```

---

## Guardrails

- DO NOT change card appearance
- DO NOT modify selection logic
- DO NOT change click behavior
- Preserve all data display formatting

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. Ready for SR Engineer phase review (after TASK-516)

---

## SR Engineer Review

**Review Date:** 2025-12-24
**Reviewer:** SR Engineer (Claude)
**PR:** #202
**Merge Commit:** `78bb2dc13e72cfe28a424a2229ccbadb68cee07f`

### Review Summary

**Status:** APPROVED and MERGED

**Architecture Assessment:**
- Clean extraction following established TASK-514 pattern
- New component at 187 lines (under 300 line budget)
- Props interface well-designed with proper TypeScript typing and JSDoc
- No architecture boundary violations
- Correct import of `ManualEntryBadge` from sibling component

**Code Quality:**
- Type check passes cleanly
- No new lint warnings introduced
- All pre-existing functionality preserved

**Line Reduction Verified:**
- TransactionList.tsx: 1135 -> 1002 lines (-133 lines, 11.7% reduction)
- TransactionCard.tsx: 187 lines (new)

**Props Interface (Actual):**
```typescript
interface TransactionCardProps {
  transaction: Transaction;
  selectionMode: boolean;
  isSelected: boolean;
  onTransactionClick: () => void;
  onCheckboxClick: (e: React.MouseEvent) => void;
  formatCurrency: (amount: number | null | undefined) => string;
  formatDate: (dateString: string | Date | null | undefined) => string;
}
```

**Design Decision Notes:**
- Slight deviation from task file's proposed interface justified
- Uses simpler `isSelected` boolean + `onCheckboxClick` handler (cleaner than `onSelect` callback)
- Passes `formatCurrency`/`formatDate` as props for better testability

**Suggestions for Future:**
- Consider `React.memo()` for render optimization
- Format functions could be imported from shared utility in future
