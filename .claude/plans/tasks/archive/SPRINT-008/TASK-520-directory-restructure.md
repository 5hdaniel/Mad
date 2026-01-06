# TASK-520: Create Directory Structure and Barrel Exports

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** LOW
**Type:** Refactor
**Branch:** `refactor/TASK-520-directory-structure` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-519

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 3-4 | High |
| Tokens | ~14K | High |
| Time | 20-30 min | High |

**Basis:** Simple barrel exports (~15 lines), no logic changes, just import/export restructuring.

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

Create barrel exports (index.ts files) for clean imports and finalize directory structure.

**Target:** Create ~15 lines of index files

---

## Acceptance Criteria

- [ ] `src/components/transaction/index.ts` exports all components
- [ ] `src/components/transaction/hooks/index.ts` exports all hooks
- [ ] TransactionList.tsx uses barrel imports
- [ ] All imports work correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Implementation Steps

### Step 1: Create hooks barrel export

```typescript
// src/components/transaction/hooks/index.ts

export { useTransactionList } from "./useTransactionList";
export { useTransactionScan } from "./useTransactionScan";
export { useBulkActions } from "./useBulkActions";
```

### Step 2: Create components barrel export

```typescript
// src/components/transaction/index.ts

// Components
export { default as TransactionStatusWrapper } from "./TransactionStatusWrapper";
export { default as TransactionCard } from "./TransactionCard";
export { default as TransactionToolbar } from "./TransactionToolbar";

// Hooks
export * from "./hooks";

// Types
export type { StatusConfig } from "./TransactionStatusWrapper";
```

### Step 3: Update TransactionList.tsx imports

```typescript
// Before (multiple imports)
import TransactionStatusWrapper from "./transaction/TransactionStatusWrapper";
import TransactionCard from "./transaction/TransactionCard";
import TransactionToolbar from "./transaction/TransactionToolbar";
import { useTransactionList } from "./transaction/hooks/useTransactionList";
import { useTransactionScan } from "./transaction/hooks/useTransactionScan";
import { useBulkActions } from "./transaction/hooks/useBulkActions";

// After (single barrel import)
import {
  TransactionStatusWrapper,
  TransactionCard,
  TransactionToolbar,
  useTransactionList,
  useTransactionScan,
  useBulkActions,
} from "./transaction";
```

---

## Final Directory Structure

```
src/components/
├── TransactionList.tsx              # ~400 lines (orchestration)
├── TransactionDetails.tsx           # Existing
│
└── transaction/
    ├── index.ts                     # Barrel exports
    ├── TransactionStatusWrapper.tsx # ~250 lines
    ├── TransactionCard.tsx          # ~150 lines
    ├── TransactionToolbar.tsx       # ~380 lines
    │
    └── hooks/
        ├── index.ts                 # Hook exports
        ├── useTransactionList.ts    # ~80 lines
        ├── useTransactionScan.ts    # ~60 lines
        └── useBulkActions.ts        # ~100 lines
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/index.ts` | Create |
| `src/components/transaction/hooks/index.ts` | Create |
| `src/components/TransactionList.tsx` | Update imports |

---

## Guardrails

- DO NOT rename any exports
- DO NOT change component/hook behavior
- Only create barrel exports
- Preserve all type exports

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. SR Engineer final review
5. Merge to develop after approval
