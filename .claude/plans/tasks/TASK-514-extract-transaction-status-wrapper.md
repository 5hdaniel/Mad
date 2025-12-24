# TASK-514: Extract TransactionStatusWrapper Component

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-514-status-wrapper` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-513

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 6-8 | High |
| Tokens | ~28K | High |
| Time | 45-60 min | High |

**Basis:** Largest extraction (~250 lines), includes multiple sub-components and config function.

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

Extract `TransactionStatusWrapper`, `getStatusConfig`, `ConfidenceBar`, and `ManualEntryBadge` from `TransactionList.tsx` into a dedicated component file.

**Target:** Extract ~250 lines from TransactionList.tsx

---

## Acceptance Criteria

- [ ] New file: `src/components/transaction/TransactionStatusWrapper.tsx`
- [ ] Contains: TransactionStatusWrapper, getStatusConfig, ConfidenceBar, ManualEntryBadge
- [ ] All types properly exported
- [ ] TransactionList.tsx imports from new file
- [ ] No functional changes to UI behavior
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Implementation Steps

### Step 1: Create directory structure

```bash
mkdir -p src/components/transaction
```

### Step 2: Create TransactionStatusWrapper.tsx

```typescript
// src/components/transaction/TransactionStatusWrapper.tsx

import React from "react";
import type { Transaction } from "@/types";

// Move these from TransactionList.tsx:
// - StatusConfig interface
// - getStatusConfig function
// - ConfidenceBar component
// - ManualEntryBadge component
// - TransactionStatusWrapper component

export interface StatusConfig {
  label: string;
  headerBg: string;
  headerBorder: string;
  textColor: string;
  buttonBg: string;
  buttonHover: string;
  buttonText: string;
  icon: React.ReactNode;
  showConfidence: boolean;
}

export function getStatusConfig(transaction: Transaction): StatusConfig {
  // ... move implementation
}

// ... other components

export default TransactionStatusWrapper;
```

### Step 3: Update TransactionList.tsx imports

```typescript
// Replace inline components with import
import TransactionStatusWrapper, {
  getStatusConfig,
  type StatusConfig
} from "./transaction/TransactionStatusWrapper";
```

### Step 4: Remove extracted code from TransactionList.tsx

Delete the following from TransactionList.tsx:
- `ManualEntryBadge` component (lines ~26-41)
- `ConfidenceBar` component (lines ~47-75)
- `StatusConfig` interface
- `getStatusConfig` function
- `TransactionStatusWrapper` component

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/TransactionStatusWrapper.tsx` | Create (~250 lines) |
| `src/components/TransactionList.tsx` | Remove ~250 lines, add import |

---

## Props Interface

```typescript
interface TransactionStatusWrapperProps {
  transaction: Transaction;
  onActionClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}
```

---

## Guardrails

- DO NOT change component behavior
- DO NOT rename functions or interfaces
- DO NOT modify TransactionDetails.tsx
- Preserve all existing styling

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. Ready for SR Engineer phase review (after TASK-516)
