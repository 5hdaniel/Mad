# TEST-BACKLOG-493: Email Unlink Bug

**Status:** FAILED (Bug Identified)
**Created:** 2026-01-24
**Priority:** P1 (User-blocking functionality)
**Type:** Regression / Bug Fix Validation

---

## Bug Summary

**Error:** `useTransactionCommunications.ts:46 Failed to unlink communication: Communication not found`

**Symptom:** User cannot unlink emails from transactions

**Root Cause:** ID mismatch between UI and backend in the communications query

---

## Root Cause Analysis

### The Problem

The `getCommunicationsWithMessages()` function returns a hybrid ID:

```sql
-- Line 550 in electron/services/db/communicationDbService.ts
COALESCE(m.id, c.id) as id,
c.id as communication_id,
```

This means:
- When a communication has a `message_id` link → `id` = **message ID** (from messages table)
- When a communication has NO `message_id` → `id` = **communication ID** (from communications table)

### The Flow

1. **UI loads emails** via `getCommunicationsWithMessages(transactionId)`
2. **Query returns** objects where `id = message.id` (not communication.id)
3. **User clicks "Remove"** on an email
4. **Frontend passes** `comm.id` to `window.api.transactions.unlinkCommunication(comm.id)`
5. **Backend receives** what it thinks is a `communicationId`
6. **Backend calls** `getCommunicationById(comm.id)`
7. **Query looks for** `SELECT * FROM communications WHERE id = ?` with the **message ID**
8. **No match found** because the communications table has a different ID
9. **Error thrown:** `"Communication not found"`

### Example Scenario

```
messages table:
  id: "msg-abc123"
  subject: "Property Contract"

communications table:
  id: "comm-xyz789"
  message_id: "msg-abc123"
  transaction_id: "txn-123"

getCommunicationsWithMessages returns:
  {
    id: "msg-abc123",           // <- This is the problem!
    communication_id: "comm-xyz789",
    subject: "Property Contract"
  }

Frontend passes: "msg-abc123"
Backend looks for: communications WHERE id = "msg-abc123"
Result: Not found!
```

---

## Test Case

### Preconditions
1. App is running with a logged-in user
2. At least one transaction exists with linked emails
3. The emails were auto-linked (have `message_id` set in communications table)

### Steps to Reproduce

1. Open Magic Audit application
2. Navigate to Dashboard
3. Click on any transaction that has linked emails
4. Go to the "Emails" tab
5. Click the "X" button on any email to unlink it
6. Confirm the unlink action in the modal

### Expected Behavior
- Email is successfully unlinked from the transaction
- Email disappears from the transaction's email list
- Success message is shown
- Email is added to ignored list (won't be re-linked)

### Actual Behavior
- Error in console: `Failed to unlink communication: Communication not found`
- Error toast: "Failed to unlink email. Please try again."
- Email remains linked to the transaction
- No changes made to database

---

## Affected Code Paths

### Frontend
- **File:** `src/components/transactionDetailsModule/hooks/useTransactionCommunications.ts`
- **Line:** 40 - Passes `comm.id` to IPC handler

### IPC Layer
- **File:** `electron/transaction-handlers.ts`
- **Line:** 950 - Receives ID and passes to `transactionService.unlinkCommunication()`

### Service Layer
- **File:** `electron/services/transactionService.ts`
- **Line:** 1418 - Calls `databaseService.getCommunicationById(communicationId)`
- **Line:** 1420 - Throws error if not found

### Database Layer
- **File:** `electron/services/db/communicationDbService.ts`
- **Line:** 99-105 - `getCommunicationById()` queries by communications.id
- **Line:** 542-607 - `getCommunicationsWithMessages()` returns message.id as id

---

## Fix Options

### Option 1: Use communication_id in Frontend (Recommended)
**Change:** Frontend should pass `comm.communication_id` instead of `comm.id`

**Pros:**
- Minimal change
- Preserves current backend logic
- Clear separation of concerns

**Cons:**
- Requires updating Communication type to include communication_id field
- May affect other parts of the UI that use comm.id

### Option 2: Accept Both IDs in Backend
**Change:** Backend handler checks both communications.id and communications.message_id

**Pros:**
- More resilient to ID confusion
- Backward compatible

**Cons:**
- More complex backend logic
- Doesn't fix the underlying confusion about which ID to use

### Option 3: Change Query to Return communication.id as id
**Change:** Modify `getCommunicationsWithMessages()` to return communication ID as primary

**Pros:**
- Consistent ID semantics
- Fixes issue at the source

**Cons:**
- May break other code that expects message.id
- Larger impact across codebase

---

## Recommended Fix

**Use Option 1** - Update frontend to use `communication_id`:

1. Update `useTransactionCommunications.ts` line 40:
```typescript
const result = await window.api.transactions.unlinkCommunication(comm.communication_id);
```

2. Ensure Communication type exports `communication_id` field (already present in query)

3. Update any UI components that display or compare comm.id to be aware of the distinction

---

## Related Files

- `src/components/transactionDetailsModule/hooks/useTransactionCommunications.ts`
- `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx`
- `electron/transaction-handlers.ts`
- `electron/services/transactionService.ts`
- `electron/services/db/communicationDbService.ts`

---

## Test Data Requirements

To reproduce this bug, you need:
1. A user account with OAuth email connected
2. At least one transaction
3. At least one email auto-linked to the transaction (via message matching)
4. The linked email must have a `message_id` in the communications table

Manual test can use:
```sql
-- Check if you have the right test data
SELECT
  c.id as communication_id,
  c.message_id,
  m.id as actual_message_id,
  m.subject
FROM communications c
LEFT JOIN messages m ON c.message_id = m.id
WHERE c.transaction_id = 'YOUR_TRANSACTION_ID'
  AND c.message_id IS NOT NULL
LIMIT 1;
```

If the query returns a row, you have suitable test data.

---

## Success Criteria for Fix

- [ ] User can successfully unlink emails from transactions
- [ ] No console errors when unlinking
- [ ] Email is removed from transaction's email list
- [ ] Email is added to ignored_communications table
- [ ] Transaction's email count is decremented
- [ ] Fix works for both message_id-based and legacy communications
- [ ] No regressions in email viewing or other communication features

---

## Notes

This bug likely affects:
- **All email unlinking operations** in the Transaction Details view
- **Only emails linked via message_id** (newer auto-linking)
- **Does NOT affect** legacy emails that were created directly in communications table

This is a **P1 bug** because it completely blocks a core user workflow (managing linked emails).
