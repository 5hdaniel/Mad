# TASK-1007: Restrict Status Options for Manual Transactions

**Backlog ID:** BACKLOG-167
**Sprint:** SPRINT-028
**Phase:** Phase 1 - Quick Fixes (Parallel)
**Branch:** `fix/TASK-1007-manual-status-options`
**Estimated Tokens:** ~15K
**Token Cap:** 60K

---

## Objective

Restrict status options for manual transactions so they can only be set to "active" or "closed" (not "pending" or "rejected" which are meant for AI-detected transactions).

---

## Context

Manual transactions (created by user) can currently be set to any status via bulk edit:
- **pending**: Meant for AI-detected transactions awaiting review
- **rejected**: Meant for AI-detected transactions marked as false positives

These statuses don't make sense for manual transactions and create UX confusion.

---

## Requirements

### Must Do:
1. Filter status options in UI based on transaction source
2. Add backend validation as safety net
3. Handle mixed selections (manual + AI)

### Must NOT Do:
- Break existing AI-detected transaction workflows
- Remove pending/rejected statuses entirely

---

## Implementation Approach (Option 3: Both UI + Backend)

### UI Filter (BulkActionBar.tsx)
```tsx
const availableStatuses = selectedTransactions.some(t => t.detection_source === 'manual')
  ? ['active', 'closed']  // Manual transactions
  : ['pending', 'active', 'closed', 'rejected'];  // AI-detected only
```

### Backend Validation (transaction-handlers.ts)
```typescript
if (status === 'pending' || status === 'rejected') {
  const manualTransactions = transactions.filter(t => t.detection_source === 'manual');
  if (manualTransactions.length > 0) {
    throw new ValidationError('Manual transactions cannot be set to pending/rejected');
  }
}
```

---

## Acceptance Criteria

- [ ] Manual transactions cannot be set to "pending" via bulk edit
- [ ] Manual transactions cannot be set to "rejected" via bulk edit
- [ ] AI-detected transactions can still use all 4 statuses
- [ ] Mixed selection shows only common valid statuses (active, closed)
- [ ] Backend validates and returns clear error if invalid
- [ ] Tests added for new behavior

---

## Files to Modify

- `src/components/BulkActionBar.tsx` - Status dropdown filter
- `electron/transaction-handlers.ts` - `transactions:bulk-update-status` validation
- `src/components/transaction/hooks/useBulkActions.ts` - If needed

---

## Testing

### Manual Testing
- [ ] Select manual transaction → bulk edit shows only active/closed
- [ ] Select AI transaction → bulk edit shows all 4 statuses
- [ ] Select mix of both → bulk edit shows only active/closed
- [ ] Existing transactions with pending/rejected status still display correctly

### Unit Tests
- [ ] Test status filtering logic
- [ ] Test backend validation rejection

---

## PR Preparation

- **Title:** `fix(transactions): restrict status options for manual transactions`
- **Branch:** `fix/TASK-1007-manual-status-options`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

| Metric | Value |
|--------|-------|
| Agent ID | `<from Task tool output>` |
| Total Tokens | `<from tokens.jsonl>` |

### Results

- **PR**: [URL]
