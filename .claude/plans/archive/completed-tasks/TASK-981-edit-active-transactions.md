# TASK-981: Edit Active Transactions

**Sprint**: SPRINT-026
**Priority**: P2
**Estimate**: 4,000 tokens
**Status**: Ready
**Dependencies**: TASK-979, TASK-980

---

## Objective

Add Edit button for Active transactions. Currently only "Pending Review" transactions can be edited.

## Context

Current behavior:
- **Pending Review**: Edit, Reject, Approve buttons
- **Active**: Reject, Export, Delete buttons (NO EDIT)
- **Rejected**: Restore, Delete buttons

Users need to edit active transactions to:
- Update property details
- Change transaction stage/status
- Modify dates

## Scope

### Must Implement

1. **Add Edit button to Active transactions** (`TransactionHeader.tsx`)
   - Add Edit button to `ActiveActions` component
   - Wire up `onShowEditModal` handler

2. **Verify EditTransactionModal works** (`EditTransactionModal.tsx`)
   - Ensure modal handles active transactions
   - No changes needed if modal is status-agnostic

### Out of Scope

- Edit for Rejected transactions
- New fields in edit modal
- Contacts tab editing (separate flow)

## Files to Modify

| File | Action |
|------|--------|
| `src/components/transactionDetailsModule/components/TransactionHeader.tsx` | Add Edit to ActiveActions |
| `src/components/transaction/components/EditTransactionModal.tsx` | Verify compatibility |

## Current Code (TransactionHeader.tsx:227-276)

```tsx
function ActiveActions({
  isRejecting,
  onShowRejectReasonModal,
  onShowExportModal,
  onShowDeleteConfirm,
}: { ... }) {
  return (
    <>
      {/* Reject Button */}
      {/* Export Button */}
      {/* Delete Button */}
      {/* MISSING: Edit Button */}
    </>
  );
}
```

## Solution

Add Edit button to `ActiveActions`:

```tsx
function ActiveActions({
  isRejecting,
  onShowRejectReasonModal,
  onShowEditModal,  // Add prop
  onShowExportModal,
  onShowDeleteConfirm,
}: { ... }) {
  return (
    <>
      {/* Edit Button - NEW */}
      <button
        onClick={onShowEditModal}
        className="px-4 py-2 rounded-lg font-semibold ..."
      >
        <svg ... />
        Edit
      </button>
      {/* Reject Button */}
      {/* Export Button */}
      {/* Delete Button */}
    </>
  );
}
```

## Acceptance Criteria

- [ ] Edit button visible for Active transactions
- [ ] Clicking Edit opens EditTransactionModal
- [ ] Can edit and save changes
- [ ] Changes persist to database
- [ ] Modal closes and UI updates

## Testing

1. **Manual test**: Open Active transaction, click Edit, make changes, save
2. **Manual test**: Verify changes persist after closing modal
3. **Unit test**: ActiveActions renders Edit button

## Branch

```
feature/TASK-981-edit-active-transactions
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (record when Task tool returns) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |
