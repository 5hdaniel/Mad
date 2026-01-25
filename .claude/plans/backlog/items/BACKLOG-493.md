# BACKLOG-493: Cannot Unlink Emails from Transactions

**Category**: bug
**Priority**: P1
**Sprint**: SPRINT-052
**Estimated Tokens**: ~10K
**Status**: Root Cause Identified - Ready for Fix
**QA Investigation**: 2026-01-24
**Test Case**: TEST-BACKLOG-493-email-unlink-bug.md

---

## Summary

User cannot unlink emails from transactions. The unlink operation fails with "Communication not found" error in console.

**ROOT CAUSE IDENTIFIED**: ID mismatch between UI and backend - `getCommunicationsWithMessages()` returns `message.id` as the primary `id` field, but `unlinkCommunication()` expects `communication.id`.

## Bug Report

**Discovered**: SPRINT-052 QA testing
**Severity**: High (P1) - affects core functionality
**Root Cause**: Confirmed - See detailed analysis in `/Users/daniel/Documents/Mad/.claude/qa/test-cases/TEST-BACKLOG-493-email-unlink-bug.md`

### Symptoms

1. User navigates to a transaction with linked emails
2. User attempts to unlink an email from the transaction
3. Console shows error: `Failed to unlink communication: Communication not found`
4. Unlink operation fails silently (or with error toast)
5. Email remains linked to transaction

### Error Location

```
useTransactionCommunications.ts:46 Failed to unlink communication: Communication not found
```

### Expected Behavior

- User clicks unlink on an email
- Email is successfully unlinked from the transaction
- UI updates to reflect the change
- No errors in console

### Actual Behavior

- User clicks unlink on an email
- Console shows "Communication not found" error
- Email remains linked
- UI may show error or silently fail

## Requirements

### Root Cause (IDENTIFIED)

The `getCommunicationsWithMessages()` function in `electron/services/db/communicationDbService.ts` returns:

```sql
COALESCE(m.id, c.id) as id,
c.id as communication_id,
```

This means when a communication has a `message_id`, the returned `id` field contains the **message ID**, not the communication ID.

**The Bug Flow**:
1. Frontend loads emails via `getCommunicationsWithMessages()`
2. Query returns objects where `id = message.id` (from messages table)
3. User clicks "Remove" button
4. Frontend passes `comm.id` to `unlinkCommunication()`
5. Backend tries to find communication with `WHERE id = ?` using the **message ID**
6. No match found in communications table → Error: "Communication not found"

### Fix (Recommended)

**Option 1 - Fix Frontend** (Recommended):
Update `useTransactionCommunications.ts` line 40 to use `communication_id`:

```typescript
const result = await window.api.transactions.unlinkCommunication(comm.communication_id);
```

**Pros**: Minimal change, preserves backend logic, clear separation
**Cons**: Requires type updates

**Option 2 - Fix Backend**:
Make backend handler accept both communication ID and message ID, check both tables.

**Pros**: More resilient
**Cons**: More complex, doesn't fix root confusion

## Acceptance Criteria

- [ ] Can unlink emails from transactions without errors
- [ ] UI updates immediately after unlink
- [ ] No console errors during unlink operation
- [ ] Works for both auto-linked and manually linked emails
- [ ] No regression in email linking functionality

## Files to Investigate

- `src/hooks/useTransactionCommunications.ts` (line 46 - error location)
- Related backend/IPC handlers for unlinking (likely in `electron/handlers/`)
- Database service methods for communication unlinking

## Testing

1. Create a transaction with contacts
2. Sync emails (auto-link some emails)
3. Attempt to unlink an auto-linked email
4. Verify no errors in console
5. Verify email no longer appears in transaction
6. Manually link an email and test unlinking

## Related

- SPRINT-052 Email Sync Production
- BACKLOG-457 (Sync Emails from Provider)
- BACKLOG-458 (Email Connection Status)
