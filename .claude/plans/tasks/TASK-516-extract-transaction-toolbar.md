# TASK-516: Extract TransactionToolbar Component

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** MEDIUM
**Type:** Refactor
**Branch:** `refactor/TASK-516-transaction-toolbar` from `feature/transaction-list-ui-refinements`
**Depends On:** TASK-515

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 8-10 | Medium |
| Tokens | ~36K | Medium |
| Time | 60-90 min | Medium |

**Basis:** Largest component (~380 lines), many props, complex conditional rendering. Medium confidence due to complexity.

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

Extract the toolbar (header, filter tabs, search, scan controls, bulk action bar) into a dedicated `TransactionToolbar` component.

**Target:** Extract ~380 lines from TransactionList.tsx

---

## Acceptance Criteria

- [ ] New file: `src/components/transaction/TransactionToolbar.tsx`
- [ ] Header with title and close button
- [ ] Filter tabs (All, Pending Review, Active, Closed, Rejected)
- [ ] Search input with clear button
- [ ] Scan controls (start/stop scan, progress bar)
- [ ] Selection mode toggle
- [ ] Bulk action bar (when in selection mode)
- [ ] Status info tooltip
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Implementation Steps

### Step 1: Create TransactionToolbar.tsx

```typescript
// src/components/transaction/TransactionToolbar.tsx

import React from "react";

interface FilterCounts {
  all: number;
  pendingReview: number;
  active: number;
  closed: number;
  rejected: number;
}

interface TransactionToolbarProps {
  // Header
  onClose: () => void;

  // Filter
  filter: string;
  onFilterChange: (filter: string) => void;
  filterCounts: FilterCounts;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Scan
  scanning: boolean;
  scanProgress: { current: number; total: number } | null;
  onStartScan: () => void;
  onStopScan: () => void;

  // Selection
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;

  // Bulk actions
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onBulkStatusUpdate: (status: string) => void;
  isBulkDeleting: boolean;
  isBulkExporting: boolean;
  isBulkUpdating: boolean;

  // Status info
  showStatusInfo: boolean;
  onToggleStatusInfo: () => void;
}

export function TransactionToolbar(props: TransactionToolbarProps) {
  // Extract toolbar JSX from TransactionList.tsx
}

export default TransactionToolbar;
```

### Step 2: Identify toolbar sections in TransactionList.tsx

The toolbar includes:
1. Header row (title, close button)
2. Filter tabs row
3. Search + scan controls row
4. Bulk action bar (conditional)
5. Status info tooltip

### Step 3: Update TransactionList.tsx

```typescript
import TransactionToolbar from "./transaction/TransactionToolbar";

// In render, replace toolbar with component
<TransactionToolbar
  onClose={onClose}
  filter={filter}
  onFilterChange={setFilter}
  // ... all other props
/>
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/transaction/TransactionToolbar.tsx` | Create (~380 lines) |
| `src/components/TransactionList.tsx` | Remove toolbar JSX, add import |

---

## Guardrails

- DO NOT change toolbar appearance
- DO NOT modify filter/search logic
- DO NOT change scan behavior
- DO NOT modify bulk action logic
- Preserve all conditional rendering

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. SR Engineer phase review for Phase 3 (TASK-514, 515, 516)

---

## SR Engineer Review

**Review Date:** 2025-12-24
**Reviewer:** SR Engineer (Claude)
**Status:** APPROVED AND MERGED

### SR Engineer Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 1 | ~4K | 5 min |
| PR Review (PR) | 1 | ~12K | 10 min |
| **SR Total** | 2 | ~16K | 15 min |

### Review Summary

**Architecture:**
- Clean component extraction following established patterns
- Props interface well-designed with logical grouping (18 props acceptable for toolbar complexity)
- No architecture boundary violations
- No direct `window.api` calls in new component

**Quality Gates:**
- Type-check: PASS
- Lint: PASS (all warnings pre-existing)
- Tests: PASS (9 TransactionList tests)

**Code Reduction:**
- TransactionList.tsx: ~1000 -> 625 lines (38% reduction)
- TransactionToolbar.tsx: 501 lines (new file)

### Merge Information

- **PR:** #203
- **Merge Commit:** 1e3e2754075a5f114c6e717327c21f42fe406912
- **Merged At:** 2025-12-25T01:32:34Z
- **Merge Type:** Traditional merge
