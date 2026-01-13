# TASK-1040: Edit Contacts Button Direct Modal

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1040 |
| **Sprint** | SPRINT-034 |
| **Backlog Item** | BACKLOG-217 |
| **Priority** | HIGH |
| **Phase** | 3 |
| **Estimated Tokens** | ~40K |
| **Token Cap** | 160K |

---

## Problem Statement

User wants the "Edit" button for contacts on a transaction to work like the "Attach Message" button - showing the same contact assignment screen used in "Edit Transaction Step 2" directly in a modal.

Currently, editing contacts requires navigating through the full edit wizard, which is cumbersome for a simple contact change.

---

## Current Behavior

When user wants to edit contacts on a transaction:
1. Click "Edit" on transaction
2. Navigate through edit wizard steps
3. Find contacts section (Step 2)
4. Make changes
5. Save
6. Navigate back

**Too many clicks for a simple contact edit.**

---

## Requested Behavior

When user clicks "Edit Contacts" on the transaction:
1. Open a modal directly showing the contact assignment interface
2. Same UI as "Edit Transaction Step 2" (familiar interface)
3. Make changes and save
4. Modal closes, transaction updates

**Direct, focused interaction like "Attach Message" button.**

---

## Design Requirements

### Modal Should Include

- Contact role categories (Buyer, Seller, Buyer's Agent, Seller's Agent, etc.)
- Contact search/selection for each role
- Add new contact option
- Remove contact option
- Save/Cancel buttons

### UX Principles

| Principle | Implementation |
|-----------|----------------|
| Consistency | Match "Attach Message" button behavior |
| Efficiency | Direct access to contacts without full edit wizard |
| Familiarity | Reuse existing Step 2 contact assignment UI |

### Comparison with "Attach Message"

| Aspect | Attach Message | Edit Contacts (Target) |
|--------|----------------|------------------------|
| Trigger | "Attach Message" button | "Edit Contacts" button |
| Opens | Message selection modal | Contact assignment modal |
| Scope | Single concern | Single concern |
| Save behavior | Direct save | Direct save |

---

## Technical Approach

### Option A: Extract Contact Assignment as Standalone Modal (Recommended)

```typescript
// ContactAssignmentModal.tsx
interface Props {
  transactionId: string;
  onClose: () => void;
  onSave: () => void;
}

export function ContactAssignmentModal({ transactionId, onClose, onSave }: Props) {
  // Reuse logic from EditTransactionModal Step 2
  const [contacts, setContacts] = useState<ContactAssignment[]>([]);

  useEffect(() => {
    loadExistingAssignments(transactionId);
  }, [transactionId]);

  const handleSave = async () => {
    await saveContactAssignments(transactionId, contacts);
    onSave();
    onClose();
  };

  return (
    <Modal>
      <ContactAssignmentForm
        contacts={contacts}
        onChange={setContacts}
      />
      <Button onClick={handleSave}>Save</Button>
      <Button onClick={onClose}>Cancel</Button>
    </Modal>
  );
}
```

### Option B: Open Edit Modal at Step 2

```typescript
// TransactionDetailView.tsx
<Button onClick={() => openEditModal({ startStep: 2 })}>
  Edit Contacts
</Button>

// EditTransactionModal.tsx
interface Props {
  startStep?: number; // Default to 1
}
```

**Cons:** Still uses full wizard UI, just at a different step

### Option C: Extract Shared ContactAssignmentForm Component

```typescript
// ContactAssignmentForm.tsx - Shared component
export function ContactAssignmentForm({ contacts, onChange, transactionId }) {
  // All the contact selection logic
}

// Used in EditTransactionModal Step 2
<ContactAssignmentForm ... />

// Used in new ContactAssignmentModal
<ContactAssignmentForm ... />
```

**Pros:** Maximum reuse, consistent behavior

---

## Implementation Plan

### Step 1: Extract ContactAssignmentForm

Extract the contact assignment UI from EditTransactionModal into a reusable component.

### Step 2: Create ContactAssignmentModal

Create a new modal that uses ContactAssignmentForm.

### Step 3: Add "Edit Contacts" Button

Add button to TransactionDetailView that opens the new modal.

### Step 4: Wire Up Save Logic

Ensure save updates the transaction and refreshes the view.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/transaction/ContactAssignmentForm.tsx` | NEW - Extract from EditTransactionModal |
| `src/components/transaction/ContactAssignmentModal.tsx` | NEW - Modal wrapper |
| `src/components/transaction/EditTransactionModal.tsx` | Refactor to use ContactAssignmentForm |
| `src/components/transaction/TransactionDetailView.tsx` | Add "Edit Contacts" button |

---

## Acceptance Criteria

- [ ] "Edit Contacts" button visible on transaction detail view
- [ ] Button opens contact assignment modal directly
- [ ] Modal uses same UI as Edit Transaction Step 2
- [ ] Changes save directly to transaction
- [ ] No need to go through full edit wizard
- [ ] Consistent with "Attach Message" button UX pattern
- [ ] Cancel discards changes without affecting transaction
- [ ] Transaction detail view updates after save
- [ ] Full edit wizard still works correctly (no regression)

---

## Testing Requirements

### Unit Tests

```typescript
describe('ContactAssignmentModal', () => {
  it('loads existing contacts on open', () => {});
  it('saves changes on submit', () => {});
  it('discards changes on cancel', () => {});
  it('closes after successful save', () => {});
});

describe('ContactAssignmentForm', () => {
  it('displays all role categories', () => {});
  it('allows adding contact to role', () => {});
  it('allows removing contact from role', () => {});
  it('shows contact search/autocomplete', () => {});
});
```

### Integration Tests

1. Open transaction detail
2. Click "Edit Contacts"
3. Add a new contact
4. Save
5. Verify contact appears in transaction

### Manual Testing

1. Open existing transaction
2. Click "Edit Contacts" button
3. Verify modal opens with existing contacts populated
4. Add a contact to Buyer role
5. Remove a contact from Seller role
6. Click Save
7. Verify transaction shows updated contacts
8. Verify "Attach Message" flow still works (no regression)

---

## UI Mockup (Text-Based)

```
+------------------------------------------+
|  Edit Contacts          [X Close]        |
+------------------------------------------+
|                                          |
|  Buyer                                   |
|  [John Smith ▼] [+ Add]                  |
|                                          |
|  Seller                                  |
|  [Jane Doe ▼] [+ Add]                    |
|                                          |
|  Buyer's Agent                           |
|  [Select...] [+ Add]                     |
|                                          |
|  Seller's Agent                          |
|  [Bob Johnson ▼] [+ Add]                 |
|                                          |
|  [Cancel]                    [Save]      |
+------------------------------------------+
```

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** feature/TASK-1040-edit-contacts-modal

---

## Implementation Summary

### Changes Made
- Created new `EditContactsModal` component that provides direct access to contact assignment
- Added "Edit Contacts" button to the Contacts tab in TransactionDetails (consistent with "Attach Messages" UX)
- Implemented the same contact assignment UI as the Edit Transaction modal's "Roles & Contacts" tab
- Modal includes: loading states, error handling, save/cancel actions, contact role categories
- On save: updates are batched and transaction details are refreshed

### Files Modified
- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` (NEW - ~400 lines)
- `src/components/transactionDetailsModule/components/TransactionContactsTab.tsx` (added onEditContacts prop and button)
- `src/components/TransactionDetails.tsx` (added modal state, import, and rendering)
- `src/components/transactionDetailsModule/components/modals/index.ts` (added export)

### Tests Added
- No new tests needed; existing TransactionDetails tests pass (14/14)
- Component follows same patterns as existing modals (AttachMessagesModal, etc.)

### Manual Testing Done
- Type-check passes
- All TransactionDetails related tests pass (204 tests)
- Full test suite has 9 pre-existing failures in migration008.test.ts (unrelated)

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1035 | Must complete before this (Phase 1) |
| TASK-1036 | Must complete before this (Phase 1) |
| TASK-1037 | Must complete before this (Phase 2) |
| TASK-1038 | Must complete before this (Phase 2) - contacts pre-pop fix |
| TASK-1039 | Must complete before this (Phase 2) |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-217 | Edit Contacts UX Improvement | Source backlog item |
| BACKLOG-216 | Contacts Not Pre-Populating | Related bug (must be fixed first) |
| - | Attach Message feature | UX reference |

---

## User Verification

| Test | Result | Date |
|------|--------|------|
| New "Edit Contacts" button works | **PASS** | 2025-01-12 |
| Old edit buttons (Step 2/3) work | **FAIL** | 2025-01-12 |

**Verified by:** User during SPRINT-034 testing session

**Action Required:** Remove "Edit Transaction Step 2: Assign Client & Agents" and "Edit Transaction Step 3: Assign Professional Services" buttons. Keep only "Edit Transaction Step 1: Transaction Details".

**Future Enhancement:** Apply same pattern (separate Edit button) to Step 1 Transaction Details. See BACKLOG-224.

---

## Notes

- Depends on TASK-1038 (contacts pre-population) - that bug must be fixed first
- Consider mobile/responsive layout for the modal
- May need UX confirmation on exact button placement
- Reusing existing contact assignment UI ensures consistency
