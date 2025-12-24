# TASK-515: Extract TransactionCard Component

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-515-transaction-card` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-514

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

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

---

## Objective

Extract the transaction card content (property address, price, dates, selection checkbox, etc.) into a dedicated `TransactionCard` component.

**Target:** Extract ~150 lines from TransactionList.tsx

---

## Acceptance Criteria

- [ ] New file: `src/components/transaction/TransactionCard.tsx`
- [ ] Card displays property address, transaction type, price, dates
- [ ] Selection checkbox works in selection mode
- [ ] Click handler opens transaction details
- [ ] Manual badge displays for manual transactions
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

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
