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

*To be completed by engineer*
