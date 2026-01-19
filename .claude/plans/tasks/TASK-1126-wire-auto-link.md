# TASK-1126: Wire Up Auto-Link on Contact Add

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1126 |
| **Backlog Item** | BACKLOG-207 |
| **Sprint** | SPRINT-045 |
| **Priority** | MEDIUM |
| **Estimated Tokens** | ~40K |
| **Category** | service/integration |

---

## Problem Statement

The `autoLinkService.ts` was implemented (TASK-1031) but is NOT being called when contacts are added to transactions. Users expect that adding a contact will automatically link their emails and messages, but this doesn't happen.

**Current State:**
- `autoLinkCommunicationsForContact()` exists and works in isolation
- No code calls this function when a contact is added to a transaction
- Users must manually attach messages after adding contacts

**Expected State:**
- When a contact is added to a transaction, auto-link is triggered
- User sees notification: "Linked X emails and Y messages with [contact name]"
- Messages tab shows newly linked communications

---

## Objective

Wire up the auto-link service to trigger when a contact is added to a transaction, and show the user a notification with the results.

---

## Branch Information

**Branch From:** develop (after Phase 1 tasks merge)
**Branch Name:** feature/TASK-1126-wire-auto-link

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/transaction-handlers.ts` | Call autoLinkService in `transactions:batchUpdateContacts` handler (lines 752-853) after successful batch update |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | Show toast notification with auto-link results |

**Note:** No changes needed to `transactionService.ts` or `transactionBridge.ts` - the IPC handler return type just needs to include `autoLinkResults`.

---

## Technical Approach

### Where to Trigger Auto-Link

**Integration Point: `transactions:batchUpdateContacts` handler (lines 752-853)**

There is NO separate `transactions:add-contact` handler. All contact additions go through `batchUpdateContacts`.

**Required Import:**
```typescript
import { autoLinkCommunicationsForContact } from "./services/autoLinkService";
```

**Implementation in `transactions:batchUpdateContacts` handler:**

```typescript
// After successful batch update (around line 817), add auto-link:
await transactionService.batchUpdateContactAssignments(
  validatedTransactionId as string,
  validatedOperations,
);

// NEW: Auto-link for each added contact
const autoLinkResults: Array<{
  contactId: string;
  emailsLinked: number;
  messagesLinked: number;
  alreadyLinked: number;
  errors: number;
}> = [];

for (const op of validatedOperations.filter(o => o.action === 'add')) {
  try {
    const result = await autoLinkCommunicationsForContact({
      contactId: op.contactId,
      transactionId: validatedTransactionId as string,
    });

    autoLinkResults.push({
      contactId: op.contactId,
      ...result,
    });
  } catch (error) {
    // Log but don't fail the entire operation
    logService.warn(`Auto-link failed for contact ${op.contactId}`, "Transactions", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

return {
  success: true,
  autoLinkResults: autoLinkResults.length > 0 ? autoLinkResults : undefined,
};
```

### Showing Results to User

After the backend returns auto-link results, show a toast notification:

```typescript
// In EditContactsModal.tsx (handleSave)
const result = await window.api.transactions.batchUpdateContacts(
  transaction.id,
  operations
);

if (result.success && result.autoLinkResults) {
  // Sum up all auto-linked items
  const totalEmails = result.autoLinkResults.reduce((sum, r) => sum + r.emailsLinked, 0);
  const totalMessages = result.autoLinkResults.reduce((sum, r) => sum + r.messagesLinked, 0);

  if (totalEmails > 0 || totalMessages > 0) {
    // Show toast (assuming toast system exists)
    showToast({
      type: 'success',
      message: `Linked ${totalEmails} emails and ${totalMessages} message threads`,
    });
  }
}
```

### IPC Contract Update

The return type needs to include auto-link results:

```typescript
interface BatchUpdateContactsResult {
  success: boolean;
  error?: string;
  autoLinkResults?: Array<{
    contactId: string;
    emailsLinked: number;
    messagesLinked: number;
    alreadyLinked: number;
    errors: number;
  }>;
}
```

---

## Acceptance Criteria

- [ ] When a contact is added to a transaction, auto-link is called
- [ ] Emails matching the contact's email addresses are linked
- [ ] Messages matching the contact's phone numbers are linked (thread-level)
- [ ] User sees notification with counts of linked items
- [ ] Auto-link respects date range filtering (transaction dates or 6-month default)
- [ ] Duplicate links are prevented (idempotent)
- [ ] Performance acceptable (< 2 seconds for typical contact)
- [ ] Works for single contact add AND batch operations

---

## Testing Requirements

### Unit Tests
- [ ] Handler calls auto-link service on contact add
- [ ] Auto-link results are returned in response
- [ ] Error in auto-link doesn't break contact add

### Integration Tests
- [ ] Full flow: add contact -> auto-link triggers -> results returned
- [ ] Batch update with multiple contacts

### Manual Testing
1. Add a contact to a transaction (one with known emails/messages)
2. **Verify:** Toast shows "Linked X emails and Y messages"
3. Go to Messages tab > **Verify:** Messages from that contact are linked
4. Go to transaction emails (if applicable) > **Verify:** Emails are linked
5. Add same contact again > **Verify:** "Already linked" or no duplicates

### Edge Cases
- [ ] Contact with no email/phone (should not error)
- [ ] Contact with no matching communications (0 linked, no error)
- [ ] Transaction with no dates (uses 6-month default)
- [ ] Auto-link service error (contact add should still succeed)

---

## Implementation Summary

**Status:** COMPLETED

### Agent ID

```
Engineer Agent ID: TASK-1126-engineer-2026-01-19
```

### Work Done

1. **Backend Handler (electron/transaction-handlers.ts)**:
   - Added import for `autoLinkCommunicationsForContact` from autoLinkService
   - Modified `transactions:batchUpdateContacts` handler to call auto-link for each added contact
   - Returns `autoLinkResults` array with counts of linked emails/messages for each contact

2. **IPC Types (electron/types/ipc.ts)**:
   - Updated `batchUpdateContacts` return type to include `autoLinkResults` array

3. **EditContactsModal Component (src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx)**:
   - Added `AutoLinkResult` interface export
   - Updated `onSave` callback signature to accept optional auto-link results
   - Passes auto-link results from batch update response to parent

4. **TransactionDetails Component (src/components/TransactionDetails.tsx)**:
   - Imported `AutoLinkResult` type
   - Updated `onSave` handler to show informative toast with linked counts
   - Shows "Contacts updated. Linked X emails and Y message threads." when items are linked
   - Falls back to "Contacts updated successfully" when no items linked

### Files Modified

| File | Change |
|------|--------|
| `electron/transaction-handlers.ts` | Added auto-link call after contact add |
| `electron/types/ipc.ts` | Added autoLinkResults to response type |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | Added AutoLinkResult type, pass results to onSave |
| `src/components/TransactionDetails.tsx` | Show detailed toast with link counts |

### Quality Gates

- [x] TypeScript type-check passes
- [x] ESLint passes (no warnings)
- [x] 220 relevant tests pass
- [x] No flaky tests

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | ~20K |
| Duration | ~15 min |
| API Calls | ~25 |

**Variance:** PM Est ~40K vs Actual ~20K (50% under estimate - task was straightforward)

---

## Notes

- `autoLinkService.ts` is fully implemented - just needs to be wired up
- The service handles threading (TASK-1115) - messages are linked at thread level
- Check if toast/notification system exists or needs to be added
- BACKLOG-207 specifies NOT to auto-link during bulk import (performance) - this task handles single/batch contact additions only
- Phase 2 task - depends on Phase 1 completing first

---

## References

- **autoLinkService.ts:** `/Users/daniel/Documents/Mad/electron/services/autoLinkService.ts`
- **TASK-1031:** Original implementation of auto-link service
- **TASK-1115:** Thread-level linking update

## SR Engineer Review Notes

**Review Date:** 2026-01-19 | **Status:** APPROVED WITH CORRECTIONS

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after Phase 1 tasks merge)
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-1126-wire-auto-link

### Execution Classification
- **Parallel Safe:** No - Phase 2 task
- **Depends On:** TASK-1124, TASK-1125, TASK-1127 (Phase 1)
- **Blocks:** None

### Technical Considerations
- Original task incorrectly referenced `transactions:add-contact` handler (does not exist)
- Corrected to use `transactions:batchUpdateContacts` handler (lines 752-853)
- Need to add import for `autoLinkCommunicationsForContact`
- Toast system exists at `src/hooks/useToast.ts` - no additional infrastructure needed
- Estimate is accurate at ~40K
