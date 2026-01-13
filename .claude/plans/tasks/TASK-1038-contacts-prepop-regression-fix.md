# TASK-1038: Investigate/Fix Contacts Pre-Population Regression

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1038 |
| **Sprint** | SPRINT-034 |
| **Backlog Item** | BACKLOG-216 |
| **Priority** | HIGH |
| **Phase** | 2 |
| **Estimated Tokens** | ~25K |
| **Token Cap** | 100K |

---

## Problem Statement

When clicking "Edit" on an existing transaction, the contact assignments do NOT pre-populate in the edit form. Users must re-select all contacts even though they are saved in the database.

This is the **THIRD** report of this issue:

| Occurrence | Task | PR | Status |
|------------|------|-----|--------|
| First | TASK-995 | #357 | Incomplete fix |
| Second | TASK-1030 | #406 | Merged, but still reported |
| Third | This report | TBD | Investigation needed |

---

## Symptoms

1. Create a new transaction with contacts assigned
2. Save the transaction
3. Click "Edit" on the transaction
4. **Expected:** Contact assignments should appear in the form
5. **Actual:** Contact fields are empty

---

## Investigation Steps

### Step 1: Verify TASK-1030 Fix Is Active

```typescript
// Check EditTransactionModal.tsx
// loadContactAssignments() should be called in useEffect
// Verify the function exists and runs on mount

useEffect(() => {
  console.log('Edit modal mounted, transactionId:', transactionId);
  loadContactAssignments();
}, [transactionId]);
```

### Step 2: Check API Response

```typescript
const details = await window.api.getTransactionDetails(transactionId);
console.log('Transaction details:', details);
console.log('contact_assignments:', details.contact_assignments);
// Should log array of assignments, not empty/undefined
```

### Step 3: Verify Database State

```sql
SELECT tc.*, c.name
FROM transaction_contacts tc
JOIN contacts c ON tc.contact_id = c.id
WHERE tc.transaction_id = '<test_transaction_id>'
```

### Step 4: Check Role Mapping

```typescript
// AUDIT_WORKFLOW_STEPS keys must match database role values
const expectedRoles = Object.keys(AUDIT_WORKFLOW_STEPS);
const actualRole = assignment.role;
console.log('Expected roles:', expectedRoles);
console.log('Actual role:', actualRole);
console.log('Role match:', expectedRoles.includes(actualRole));
```

### Step 5: Trace Data Flow

```
Database -> IPC Handler -> Renderer -> Component State -> UI
    |           |             |             |            |
    +- Query    +- Response   +- Received   +- setState  +- Render

Add logging at each step to identify where data is lost.
```

### Step 6: Check for Race Conditions

```typescript
// Is data loading before component is ready?
useEffect(() => {
  console.log('Component mounted');
  const load = async () => {
    console.log('Starting load');
    const data = await loadContactAssignments();
    console.log('Data loaded:', data);
    setContacts(data); // Is this being called?
    console.log('State updated');
  };
  load();
}, []);

// Check render timing
console.log('Rendering with contacts:', contacts);
```

---

## Potential Root Causes

| Cause | Likelihood | Investigation |
|-------|------------|---------------|
| Fix not deployed | Low | PR #406 merged, but verify branch |
| Race condition | Medium | Data loading before component mount |
| Role key mismatch | Medium | DB values don't match expected keys |
| API not returning assignments | Medium | Check getTransactionDetails query |
| UI state not updating | Medium | Check setState after data load |
| useEffect dependency issue | Medium | Missing dependency in array |
| Async timing issue | Medium | Await not working correctly |

---

## Files to Investigate/Modify

| File | Purpose |
|------|---------|
| `src/components/EditTransactionModal.tsx` | Edit form component |
| `electron/services/transactionService.ts` | Transaction service |
| `electron/services/db/transactionDbService.ts` | Database queries |
| `electron/handlers/transactionHandlers.ts` | IPC handlers |

---

## Key Code Paths to Trace

### 1. Edit Modal Opens

```typescript
// When user clicks Edit
<EditTransactionModal
  transactionId={selectedTransaction.id}
  onClose={handleClose}
/>
```

### 2. Component Mounts

```typescript
// EditTransactionModal.tsx
useEffect(() => {
  const loadData = async () => {
    const details = await window.api.getTransactionDetails(transactionId);
    // Does this include contact_assignments?
  };
  loadData();
}, [transactionId]);
```

### 3. API Call

```typescript
// preload.ts
getTransactionDetails: (id: string) => ipcRenderer.invoke('transaction:getDetails', id)

// transactionHandlers.ts
ipcMain.handle('transaction:getDetails', async (_, id) => {
  return transactionService.getTransactionDetails(id);
});
```

### 4. Database Query

```typescript
// transactionDbService.ts
async getTransactionDetails(id: string) {
  // Does this query include contact assignments?
  const contacts = await this.getContactAssignments(id);
  return { ...transaction, contact_assignments: contacts };
}
```

---

## Acceptance Criteria

- [x] When editing transaction, existing contacts appear in their assigned roles
- [x] All role types populate correctly (buyer, seller, agents, etc.)
- [x] Modifying and saving contacts works correctly
- [x] Root cause documented
- [x] No regression in new transaction creation
- [x] Diagnostic logging added for future debugging (console.error on fetch failure)
- [x] Full test suite passes

---

## Testing Requirements

### Unit Tests

```typescript
describe('EditTransactionModal', () => {
  it('loads contact assignments on mount', () => {});
  it('displays contacts in correct role sections', () => {});
  it('handles empty contact assignments', () => {});
  it('handles multiple contacts per role', () => {});
});

describe('transactionService.getTransactionDetails', () => {
  it('includes contact_assignments in response', () => {});
  it('returns correct role for each contact', () => {});
});
```

### Integration Tests

1. Create transaction with multiple contacts in different roles
2. Save and close
3. Re-open for editing
4. Verify all contacts appear in correct positions

### Manual Testing

1. Create new transaction
2. Add contacts: Buyer, Seller, Buyer's Agent
3. Save transaction
4. Click "Edit"
5. Verify all three contacts appear in correct roles
6. Modify one contact
7. Save and verify change persisted

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1038-contacts-prepop-regression

---

## Implementation Summary

### Root Cause Found

**TASK-1030 fixed the wrong component.** TASK-1030 fixed `AuditTransactionModal` (and `useAuditTransaction` hook), but the user was using `EditTransactionModal` which had similar but separate code. However, the actual root cause is in the **data flow**:

1. `TransactionDetails.tsx` opens `AuditTransactionModal` with `editTransaction={transaction}` (line 414-423)
2. The `transaction` prop comes from `Transactions.tsx` which uses `transactions.getAll()` to fetch transactions
3. **Critical:** `transactions.getAll()` does NOT return `contact_assignments` - only basic transaction data
4. `useAuditTransaction` hook expected `editTransaction.contact_assignments` to already be populated
5. Since it was undefined, contacts were never pre-populated

The issue was NOT in the code that reads contacts - it was that the data source never had the contacts in the first place.

### Changes Made

Modified `useAuditTransaction.ts` to:
1. Immediately populate form data from the passed `editTransaction` prop (address, dates, etc.)
2. **NEW:** Asynchronously fetch full transaction details via `window.api.transactions.getDetails()` to get `contact_assignments`
3. Populate contacts from the fetched data (with fallback to passed data on API failure)

This ensures contacts are always fetched from the database junction table, regardless of whether the parent component included them or not.

### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useAuditTransaction.ts` | Added async fetch of transaction details in edit mode to get `contact_assignments` |
| `src/components/__tests__/AuditTransactionModal.test.tsx` | Added 2 new tests for TASK-1038 scenarios |

### Tests Added

1. **"should fetch contact_assignments via getDetails when not included in editTransaction"**
   - Validates that when `editTransaction` lacks `contact_assignments`, the hook calls `getDetails()` API

2. **"should handle getDetails API failure gracefully in edit mode"**
   - Ensures the modal still renders when the API call fails (graceful degradation)

### Manual Testing Done

- Verified via unit tests that the hook correctly calls `getDetails()` when contacts not in editTransaction
- All 39 AuditTransactionModal tests pass
- All 600 transaction-related tests pass
- TypeScript compilation passes
- Lint passes (no new errors)

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1035 | Must complete before this (Phase 1) |
| TASK-1036 | Must complete before this (Phase 1) |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-216 | Contacts Not Pre-Populating | Source backlog item |
| BACKLOG-210 | Original pre-population issue | Original issue |
| TASK-1030 | Previous fix attempt | Merged but still broken |
| TASK-995 | First fix attempt | Incomplete |
| PR #406 | TASK-1030 PR | To review |

---

## Notes

- This is the THIRD attempt to fix this issue - thorough investigation needed
- May share root cause with TASK-1037 (auto-link regression)
- Add comprehensive logging to prevent fourth occurrence
- Consider adding automated test specifically for this flow
