# Task TASK-408: Approve/Reject Actions

## Goal

Add action buttons to pending transactions for approving, rejecting, or editing AI-detected transactions, with feedback recording.

## Non-Goals

- Do NOT implement edit modal (TASK-409)
- Do NOT modify filter tabs (TASK-406)
- Do NOT modify badges (TASK-407)

## Deliverables

1. Update: `src/components/TransactionList.tsx`

## Acceptance Criteria

- [ ] Approve button (✓) updates detection_status='confirmed', records feedback
- [ ] Reject button (✗) shows reason modal, updates status, records feedback
- [ ] Edit button opens AuditTransactionModal in edit mode
- [ ] Actions only show for pending transactions
- [ ] Feedback recorded via window.api.feedback
- [ ] All CI checks pass

## Implementation Notes

```typescript
// Add to transaction card actions:
function TransactionActions({ transaction, onUpdate }: Props) {
  const [showRejectModal, setShowRejectModal] = useState(false);

  const handleApprove = async () => {
    await window.api.transactions.updateStatus(transaction.id, 'confirmed');
    await window.api.feedback.recordTransaction(userId, {
      detectedTransactionId: transaction.id,
      action: 'confirm',
    });
    onUpdate();
  };

  const handleReject = async (reason: string) => {
    await window.api.transactions.updateStatus(transaction.id, 'rejected');
    await window.api.feedback.recordTransaction(userId, {
      detectedTransactionId: transaction.id,
      action: 'reject',
      corrections: { reason },
    });
    setShowRejectModal(false);
    onUpdate();
  };

  if (transaction.detection_status !== 'pending') return null;

  return (
    <div className="transaction-actions">
      <button onClick={handleApprove} className="btn-approve" title="Approve">✓</button>
      <button onClick={() => setShowRejectModal(true)} className="btn-reject" title="Reject">✗</button>
      <button onClick={() => openEditModal(transaction)} className="btn-edit" title="Edit">✎</button>

      {showRejectModal && (
        <RejectReasonModal
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
        />
      )}
    </div>
  );
}
```

## Integration Notes

- Imports from: `window.api.feedback` (TASK-402), `window.api.transactions`
- Used by: User interaction flow
- Depends on: TASK-407 (badges), TASK-401/402 (feedback service)

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes
- Tests: Approve flow, reject modal, feedback recording, button visibility

## PR Preparation

- **Title**: `feat(ui): add approve/reject actions for pending transactions [TASK-408]`
- **Labels**: `ui`, `ai-mvp`, `phase-2`
- **Depends on**: TASK-407

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`
**Estimated Totals:** 2 turns, ~10K tokens, ~15m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-407)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-408-approve-reject-actions

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-407
- **Blocks:** TASK-409

---

## Implementation Summary (Engineer-Owned)

**Implementation Date:** 2025-12-18
**Branch:** feature/TASK-408-approve-reject-actions

### Files Modified
1. `src/components/TransactionList.tsx` - Added TransactionActions and RejectReasonModal components
2. `electron/types/ipc.ts` - Added feedback API types to WindowApi interface
3. `tests/setup.js` - Added feedback API mock for tests
4. `src/components/__tests__/TransactionList.test.tsx` - Created new test file (8 tests)

### Implementation Details
- **TransactionActions Component**: Renders approve/reject buttons for transactions with `detection_status === 'pending'`
- **RejectReasonModal Component**: Modal with textarea for optional rejection reason
- **Approve Flow**: Updates `detection_status` to 'confirmed', sets `reviewed_at`, calls `feedback.recordTransaction` with action='confirm'
- **Reject Flow**: Opens modal, on submit updates `detection_status` to 'rejected', sets `rejection_reason`, calls `feedback.recordTransaction` with action='reject'
- **Button Styling**: Matches existing action buttons (emerald-500 for approve, red-500 for reject)
- **Loading States**: Shows spinner during API calls

### Acceptance Criteria Status
- [x] Approve button updates detection_status='confirmed', records feedback
- [x] Reject button shows reason modal, updates status, records feedback
- [ ] Edit button opens AuditTransactionModal in edit mode (TASK-409 scope)
- [x] Actions only show for pending transactions
- [x] Feedback recorded via window.api.feedback
- [x] All CI checks pass

### Test Results
- 8 new tests created covering:
  - Button visibility for pending vs non-pending transactions
  - Approve API calls and state refresh
  - Reject modal opening/closing
  - Reject with and without reason
  - Detection status badges

### Notes
- Edit button deferred to TASK-409 as specified in Non-Goals
- Pre-existing flaky test in appleDriverService.test.ts unrelated to changes
