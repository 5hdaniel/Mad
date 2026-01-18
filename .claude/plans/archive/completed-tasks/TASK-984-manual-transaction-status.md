# TASK-984: Restrict Status Options for Manual Transactions

**Sprint**: SPRINT-026
**Priority**: Low
**Estimate**: 15,000 tokens
**Status**: Ready
**Dependencies**: TASK-979, TASK-980
**Backlog**: BACKLOG-167

---

## Objective

Prevent manual transactions from being set to "pending" or "rejected" status via bulk edit. These statuses are only meaningful for AI-detected transactions.

## Context

Current status meanings:
- **pending**: AI-detected transaction awaiting user review
- **active**: Confirmed active transaction
- **closed**: Transaction completed
- **rejected**: AI-detected transaction rejected as false positive

Manual transactions (`detection_source === "manual"`) should only use:
- **active**: Transaction is ongoing
- **closed**: Transaction completed

## Scope

### Must Implement

1. **Filter status options in UI** (`BulkActionBar.tsx`)
   - If any selected transaction is manual, only show active/closed
   - If all selected are AI-detected, show all 4 options

2. **Validate in backend** (`transaction-handlers.ts`)
   - Reject status changes to pending/rejected for manual transactions
   - Return clear error message

### Out of Scope

- Individual transaction status changes (only bulk edit affected)
- Changes to transaction creation flow
- Migration of existing manual transactions with invalid statuses

## Files to Modify

| File | Action |
|------|--------|
| `src/components/BulkActionBar.tsx` | Filter available status options |
| `electron/transaction-handlers.ts` | Add validation to `transactions:bulk-update-status` |

## Solution

### UI (BulkActionBar.tsx)

```tsx
// Determine available statuses based on selection
const hasManualTransactions = selectedTransactions.some(
  (t) => t.detection_source === "manual"
);

const availableStatuses = hasManualTransactions
  ? [
      { value: "active", label: "Active" },
      { value: "closed", label: "Closed" },
    ]
  : [
      { value: "pending", label: "Pending Review" },
      { value: "active", label: "Active" },
      { value: "closed", label: "Closed" },
      { value: "rejected", label: "Rejected" },
    ];
```

### Backend Validation (transaction-handlers.ts)

```typescript
// In transactions:bulk-update-status handler
if (status === "pending" || status === "rejected") {
  // Check if any transactions are manual
  const manualIds = transactionIds.filter((id) => {
    const tx = transactionService.getTransaction(id);
    return tx?.detection_source === "manual";
  });

  if (manualIds.length > 0) {
    throw new ValidationError(
      `Cannot set manual transactions to "${status}". ` +
        `Manual transactions can only be "active" or "closed".`
    );
  }
}
```

## Acceptance Criteria

- [x] Manual transactions cannot be set to "pending" via bulk edit UI
- [x] Manual transactions cannot be set to "rejected" via bulk edit UI
- [x] AI-detected transactions can still use all 4 statuses
- [x] Backend rejects invalid status changes with clear error
- [x] Mixed selection (manual + AI) shows only common valid statuses (active, closed)

## Testing

1. **Manual test**: Select manual transaction, verify only active/closed in dropdown
2. **Manual test**: Select AI transaction, verify all 4 options in dropdown
3. **Manual test**: Select mix, verify only active/closed in dropdown
4. **Unit test**: BulkActionBar filters options correctly
5. **Unit test**: Backend validation rejects invalid changes

## Branch

```
feature/TASK-984-manual-transaction-status
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (auto-captured) |
| Total Tokens | (auto-captured) |
| Duration | (auto-captured) |
| Variance | (auto-captured) |

---

## Implementation Summary

### Changes Made

1. **BulkActionBar.tsx** - Added status filtering based on transaction type
   - Added `selectedTransactions` prop to receive transaction objects
   - Added `hasManualTransactions` useMemo to check for manual transactions
   - Conditionally render "Pending" and "Rejected" status options (hidden when manual transactions are selected)

2. **TransactionList.tsx** - Pass selected transactions to BulkActionBar
   - Added `selectedTransactions` prop with filtered transactions based on selectedIds

3. **Transactions.tsx** - Pass selected transactions to BulkActionBar
   - Added `selectedTransactions` prop with filtered transactions based on selectedIds

4. **transaction-handlers.ts** - Backend validation for manual transaction status
   - Added validation in `transactions:bulk-update-status` handler
   - Checks if any transaction has `detection_source === "manual"` when status is "pending" or "rejected"
   - Throws ValidationError with clear message if validation fails

### Engineer Checklist

- [x] Branch created from develop
- [x] UI filters status options based on detection_source
- [x] Backend validates and rejects invalid status changes
- [x] Type-check passes
- [x] Tests pass (63 tests)
- [x] No new lint errors (existing error in unrelated file)
