# Task TASK-409: AuditTransactionModal Edit Mode

## Goal

Modify AuditTransactionModal to support editing existing transactions, pre-filling fields from the transaction data and suggested contacts.

## Non-Goals

- Do NOT create new modal
- Do NOT modify approve/reject flow (TASK-408)
- Do NOT implement suggested contacts display (TASK-410)

## Deliverables

1. Update: `src/components/AuditTransactionModal.tsx`

## Acceptance Criteria

- [ ] Accept `editTransaction?: Transaction` prop
- [ ] Pre-fill all fields when editing
- [ ] Skip address verification if already verified
- [ ] Pre-populate suggested contacts from transaction.suggested_contacts JSON
- [ ] Save updates existing transaction instead of creating new
- [ ] Record feedback if changes made
- [ ] All CI checks pass

## Implementation Notes

```typescript
// Update AuditTransactionModal props:
interface AuditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  editTransaction?: Transaction; // NEW
}

// In component:
const isEditing = !!editTransaction;

// Initialize state from editTransaction if present:
useEffect(() => {
  if (editTransaction) {
    setPropertyAddress(editTransaction.property_address);
    setTransactionType(editTransaction.transaction_type);
    // ... other fields
    if (editTransaction.suggested_contacts) {
      setSuggestedContacts(JSON.parse(editTransaction.suggested_contacts));
    }
  }
}, [editTransaction]);

// On save:
const handleSave = async () => {
  if (isEditing) {
    await window.api.transactions.update(editTransaction.id, formData);
    // Record feedback if changes were made
    if (hasChanges) {
      await window.api.feedback.recordTransaction(userId, {
        detectedTransactionId: editTransaction.id,
        action: 'confirm',
        corrections: getChanges(),
      });
    }
  } else {
    await window.api.transactions.create(formData);
  }
  onSave(formData);
};
```

## Integration Notes

- Imports from: `window.api.transactions`, `window.api.feedback`
- Used by: TASK-408 (edit button), TASK-410 (suggested contacts)
- Depends on: TASK-408

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes
- Tests: Edit mode pre-fill, save updates vs creates, feedback on changes

## PR Preparation

- **Title**: `feat(ui): add edit mode to AuditTransactionModal [TASK-409]`
- **Labels**: `ui`, `ai-mvp`, `phase-2`
- **Depends on**: TASK-408

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`
**Estimated Totals:** 2 turns, ~10K tokens, ~15m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-408)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-409-modal-edit-mode

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-408
- **Blocks:** TASK-410

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*
