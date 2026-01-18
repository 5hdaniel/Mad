# BACKLOG-167: Restrict Status Options for Manual Transactions

## Problem
Manual transactions (created by user, not AI-detected) can currently be set to "pending" or "rejected" status via bulk edit. These statuses don't make sense for manual transactions:

- **pending**: Meant for AI-detected transactions awaiting user review
- **rejected**: Meant for AI-detected transactions the user rejected as false positives

Manual transactions should only have "active" or "closed" status.

## Impact
- **User Experience**: Confusing to have irrelevant status options
- **Data Integrity**: Status semantics become unclear
- **Priority**: Low

## Current Behavior
1. User creates manual transaction → status = "active", detection_source = "manual"
2. User selects transaction → bulk edit → can change to any of 4 statuses
3. Setting to "pending" triggers pending review UI (amber styling, Edit button)
4. Setting to "rejected" hides from Active tab

## Expected Behavior
1. Manual transactions (`detection_source === "manual"`) should only allow:
   - `active` → `closed` (transaction completed)
   - `closed` → `active` (reopen if needed)
2. AI-detected transactions (`detection_source === "auto"`) can use all 4 statuses

## Proposed Solution

### Option 1: Filter in BulkActionBar (UI-only)
```tsx
// In BulkActionBar.tsx
const availableStatuses = selectedTransactions.some(t => t.detection_source === 'manual')
  ? ['active', 'closed']  // Manual transactions
  : ['pending', 'active', 'closed', 'rejected'];  // AI-detected
```

### Option 2: Validate in Backend
```typescript
// In transaction-handlers.ts bulk-update-status
if (status === 'pending' || status === 'rejected') {
  // Check if any selected transactions are manual
  const manualTransactions = transactions.filter(t => t.detection_source === 'manual');
  if (manualTransactions.length > 0) {
    throw new ValidationError('Manual transactions cannot be set to pending/rejected');
  }
}
```

### Option 3: Both (Recommended)
- UI filters available options based on selection
- Backend validates as safety net

## Relevant Code
- `src/components/BulkActionBar.tsx` - Status dropdown
- `electron/transaction-handlers.ts` - `transactions:bulk-update-status` handler
- `src/components/transaction/hooks/useBulkActions.ts` - `handleBulkStatusChange`

## Acceptance Criteria
- [ ] Manual transactions cannot be set to "pending" via bulk edit
- [ ] Manual transactions cannot be set to "rejected" via bulk edit
- [ ] AI-detected transactions can still use all 4 statuses
- [ ] Clear error message if user somehow tries invalid status change
- [ ] Mixed selection (manual + AI) shows only common valid statuses

## Notes
- Discovered: 2026-01-05
- Related to BACKLOG-164 (rename Bulk Edit to Edit)
