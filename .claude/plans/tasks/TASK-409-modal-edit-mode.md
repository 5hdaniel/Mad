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

- [x] Accept `editTransaction?: Transaction` prop
- [x] Pre-fill all fields when editing
- [x] Skip address verification if already verified
- [x] Pre-populate suggested contacts from transaction.suggested_contacts JSON
- [x] Save updates existing transaction instead of creating new
- [x] Record feedback if changes made
- [x] All CI checks pass

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

### Changes Made

**Files Modified:**
1. `src/components/AuditTransactionModal.tsx` - Added edit mode support
2. `src/components/__tests__/AuditTransactionModal.test.tsx` - Added 10 unit tests for edit mode

### Implementation Details

1. **Props Interface Update**
   - Added `editTransaction?: Transaction` optional prop
   - Added `isEditing` boolean derived from prop presence

2. **Pre-fill Logic**
   - Added `useEffect` to initialize form state from `editTransaction`
   - Parses `property_coordinates` JSON safely
   - Parses `suggested_contacts` JSON and converts to `ContactAssignments` format
   - Stores original values in `originalAddressData` for change detection

3. **Save/Update Logic**
   - Created `getAddressChanges()` function to detect field changes
   - Modified `handleCreateTransaction()` to branch on `isEditing`:
     - Edit mode: calls `window.api.transactions.update()`
     - Create mode: calls `window.api.transactions.createAudited()`
   - Records feedback via `window.api.feedback.recordTransaction()` when changes detected

4. **UI Updates**
   - Modal title: "Edit Transaction" vs "Audit New Transaction"
   - Step 1 subtitle: "Review Property Address" vs "Verify Property Address"
   - Submit button: "Save Changes" vs "Create Transaction"
   - Loading text: "Saving..." vs "Creating..."

### Test Coverage (10 new tests)
- Edit mode title display
- Address pre-fill
- Transaction type pre-fill
- Step 1 subtitle in edit mode
- Update API usage
- Save Changes button text
- suggested_contacts JSON parsing
- Invalid JSON graceful handling
- Saving... loading text
- Required API availability

### Engineer Checklist
- [x] TypeScript type-check passes
- [x] ESLint passes (no new errors)
- [x] All tests pass (398 total, 35 in AuditTransactionModal)
- [x] Implementation follows existing patterns
- [x] No business logic in entry files

### Metrics

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | 1 | ~4K | 3 min |
| Implementation | 3 | ~12K | 12 min |
| Testing/CI | 2 | ~8K | 8 min |
| **Total** | 6 | ~24K | 23 min |

**Estimated vs Actual:**
- Estimated: 2 turns, ~10K tokens, ~15m
- Actual: 6 turns, ~24K tokens, ~23 min
- Note: Actual higher due to comprehensive test coverage and TypeScript fixes
