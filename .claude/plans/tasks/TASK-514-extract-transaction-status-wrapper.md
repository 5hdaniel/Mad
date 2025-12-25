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
| Planning | 1 | ~4K | 2 min |
| Implementation | 3 | ~12K | 10 min |
| Debugging | 0 | 0 | 0 min |
| **Total** | 4 | ~16K | 12 min |

---

## Objective

Extract `TransactionStatusWrapper`, `getStatusConfig`, `ConfidenceBar`, and `ManualEntryBadge` from `TransactionList.tsx` into a dedicated component file.

**Target:** Extract ~250 lines from TransactionList.tsx

---

## Acceptance Criteria

- [x] New file: `src/components/transaction/TransactionStatusWrapper.tsx`
- [x] Contains: TransactionStatusWrapper, getStatusConfig, ConfidenceBar, ManualEntryBadge
- [x] All types properly exported
- [x] TransactionList.tsx imports from new file
- [x] No functional changes to UI behavior
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (warnings only, no errors)
- [x] `npm test` passes (9/9 TransactionList tests pass)

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

---

## Implementation Summary

### What Was Done

Extracted status-related components and functions from `TransactionList.tsx` into a dedicated file:

**New File Created:** `src/components/transaction/TransactionStatusWrapper.tsx` (239 lines)
- `ManualEntryBadge` - Badge for manually created transactions
- `ConfidenceBar` - Confidence indicator for pending transactions
- `TransactionStatusType` - Type alias for status types
- `StatusConfig` interface - Configuration for status styling
- `getStatusConfig` function - Returns status configuration based on transaction state
- `TransactionStatusWrapperProps` interface - Props for the wrapper component
- `TransactionStatusWrapper` component - Unified wrapper for all transaction statuses

**Modified File:** `src/components/TransactionList.tsx`
- Reduced from 1369 lines to 1134 lines (-235 lines)
- Added import for extracted components
- Removed inline component definitions

### Verification

- **type-check**: Passes
- **lint**: Passes (warnings only, no errors - all warnings are pre-existing in other files)
- **tests**: 9/9 TransactionList tests pass

### Deviations

None. Implementation followed task specification exactly.

### Issues Encountered

None.

### Engineer Checklist

- [x] Branch created from correct base (`feature/transaction-list-ui-refinements`)
- [x] All acceptance criteria met
- [x] Type-check passes
- [x] Lint passes (no new errors)
- [x] Tests pass
- [x] No functional changes to UI behavior
- [x] Metrics recorded

---

## SR Engineer Review

**Review Date:** 2025-12-24
**Status:** APPROVED AND MERGED

### SR Engineer Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | 5 | ~20K | 8 min |
| **SR Total** | 5 | ~20K | 8 min |

### Review Summary

**Architecture:**
- Clean extraction following established patterns
- New file properly organized in `src/components/transaction/`
- Proper TypeScript exports (default + named)
- No duplicate definitions
- Renderer layer only - no IPC or business logic changes

**Security:** No concerns - pure UI refactor

**Test Coverage:** Existing tests (9/9) continue to pass

**Code Quality:**
- type-check passes
- lint passes (warnings only, all pre-existing)
- No behavior changes

### Merge Information

- **PR:** #201
- **Merged At:** 2025-12-25T00:27:19Z
- **Merge Commit:** `3ce356b148163750f869e30c40808a9478564936`
- **Target Branch:** `feature/transaction-list-ui-refinements`
