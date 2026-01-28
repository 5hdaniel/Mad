# TASK-1042: Fix Contact Save When Editing Transaction

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1042 |
| **Sprint** | SPRINT-035 |
| **Backlog Item** | BACKLOG-222 |
| **Priority** | CRITICAL |
| **Phase** | 1 |
| **Estimated Tokens** | ~40K |
| **Token Cap** | 160K |

---

## Problem Statement

When editing a transaction and adding/modifying contacts, the changes do not persist after saving. The contacts pre-populate correctly (TASK-1038 fix works), but any modifications made during editing are lost.

**This is a data persistence bug that completely blocks the user workflow.**

---

## Current Behavior

1. Open existing transaction with 1 contact
2. Click Edit Contacts (using new TASK-1040 modal)
3. Add another contact
4. Click Save
5. **Changes are lost** - still shows only 1 contact

---

## Expected Behavior

1. Open existing transaction with 1 contact
2. Click Edit Contacts
3. Add another contact
4. Click Save
5. **Transaction now shows 2 contacts**
6. Changes persist on page refresh

---

## Root Cause Investigation

Likely causes to investigate:

### 1. Save Handler Not Collecting Updated State
```typescript
// In EditContactsModal or similar
const handleSave = async () => {
  // BUG: May be using stale contacts state
  await saveContactAssignments(transactionId, contacts);
};
```

### 2. State Not Being Passed to Save Function
```typescript
// State may not be updated before save is called
const [contacts, setContacts] = useState(initialContacts);
// If save happens before setState completes...
```

### 3. Database Update Silently Failing
```typescript
// transactionDbService.ts
async function saveContactAssignments(txId, contacts) {
  // Check if this function actually writes to DB
  // Look for error swallowing
}
```

### 4. Incorrect Contact ID References
```typescript
// May be saving with wrong transaction_id or contact_id references
```

---

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | New modal from TASK-1040 - save handler |
| `src/components/transaction/EditTransactionModal.tsx` | Original edit wizard - compare save logic |
| `electron/services/db/transactionDbService.ts` | Database save functions |
| `electron/handlers/transaction-handlers.ts` | IPC handlers for transaction updates |

---

## Technical Approach

### Step 1: Add Diagnostic Logging

Add logging to trace the data flow:
```typescript
// In EditContactsModal.tsx
const handleSave = async () => {
  console.log('[TASK-1042] Saving contacts:', contacts);
  console.log('[TASK-1042] Transaction ID:', transactionId);
  const result = await window.api.transactions.updateContactAssignments(transactionId, contacts);
  console.log('[TASK-1042] Save result:', result);
};
```

### Step 2: Verify State Before Save

Ensure the save function receives current state:
```typescript
// Check if contacts state is current at save time
const contactsRef = useRef(contacts);
contactsRef.current = contacts;

const handleSave = async () => {
  // Use ref to guarantee latest state
  await saveContactAssignments(transactionId, contactsRef.current);
};
```

### Step 3: Verify Database Write

Check if the database function actually writes:
```typescript
// transactionDbService.ts
async saveContactAssignments(transactionId: string, assignments: ContactAssignment[]) {
  console.log('[TASK-1042] DB write:', { transactionId, assignments });
  // Verify write completes
}
```

### Step 4: Fix the Bug

Based on investigation, apply appropriate fix:
- If state issue: Fix state management
- If save timing: Add await or use ref
- If DB issue: Fix database operation
- If IPC issue: Fix handler

---

## Implementation Plan

1. **Reproduce the bug** - Confirm exact failure point
2. **Add logging** - Trace data from UI to DB
3. **Identify root cause** - Pinpoint where data is lost
4. **Apply fix** - Minimal, targeted change
5. **Add regression test** - Prevent recurrence
6. **Remove debug logging** - Clean up before PR

---

## Acceptance Criteria

- [ ] Adding contacts during edit persists after save
- [ ] Removing contacts during edit persists after save
- [ ] Modifying contact roles persists after save
- [ ] Changes persist after page refresh
- [ ] EditContactsModal (TASK-1040) works correctly
- [ ] Original Edit Transaction wizard still works (no regression)
- [ ] Regression test added

---

## Testing Requirements

### Unit Tests

```typescript
describe('Contact Save', () => {
  it('saves new contact assignments to database', async () => {
    // Setup: Create transaction with 1 contact
    // Action: Add new contact, save
    // Assert: Database has 2 contacts for transaction
  });

  it('saves contact removal to database', async () => {
    // Setup: Create transaction with 2 contacts
    // Action: Remove 1 contact, save
    // Assert: Database has 1 contact for transaction
  });

  it('saves role changes to database', async () => {
    // Setup: Create transaction with contact as Buyer
    // Action: Change role to Seller, save
    // Assert: Database shows updated role
  });
});
```

### Integration Tests

1. Edit transaction via EditContactsModal
2. Add contact
3. Save
4. Re-open EditContactsModal
5. Verify contact is there

### Manual Testing

1. Open existing transaction
2. Click "Edit Contacts"
3. Add contact to Buyer role
4. Click Save
5. Refresh page
6. Verify contact still assigned as Buyer
7. Repeat with remove and modify

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1042-contact-save

---

## Implementation Summary

*To be completed by engineer after implementation.*

### Changes Made
-

### Files Modified
-

### Tests Added
-

### Manual Testing Done
-

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1040 | Uses EditContactsModal created in this task |
| TASK-1038 | Pre-population must work (already fixed) |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-222 | Contact Changes Not Saving | Source backlog item |
| TASK-1040 | Edit Contacts Modal | Uses this modal |
| TASK-1038 | Contacts Pre-Population | Related fix (already done) |

---

## Notes

- TASK-1040's EditContactsModal was just created - this may be a bug in that implementation
- Compare with original Edit Transaction wizard save flow
- Add explicit logging to help future debugging
- This is CRITICAL priority - user cannot add contacts to transactions
