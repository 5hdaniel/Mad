# BACKLOG-060: Fix N+1 Query Pattern in Contact Assignment

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BACKLOG-060 |
| **Priority** | High |
| **Status** | Pending |
| **Category** | Performance |
| **Sprint** | SPRINT-002 |
| **Date Added** | 2024-12-15 |
| **Date Completed** | - |
| **Branch** | - |
| **Assigned To** | - |
| **Estimated Turns** | 15-25 |

---

## Description

`src/components/Transactions.tsx` lines 1972-1998 performs N+1 IPC calls when assigning contacts to transactions.

## Current Pattern (Problem)

```typescript
for (const existing of currentAssignments) {
  await window.api.transactions.removeContact(...);  // N+1!
}
for (const [role, contacts] of Object.entries(contactAssignments)) {
  for (const contact of contacts) {
    await window.api.transactions.assignContact(...);  // N+1!
  }
}
```

## Impact

- Significant slowdown with many contacts
- Each operation is a separate IPC call + database operation
- With 10 contacts = 10+ round trips to main process

## Solution

1. Add batch API endpoint: `transactions:batchUpdateContacts`
2. Accept array of {action, contactId, role} operations
3. Execute in single database transaction
4. Update UI to use batch operation

## Files to Modify

- `electron/services/databaseService.ts` - Add batch method
- `electron/transaction-handlers.ts` - Add batch IPC handler
- `src/components/Transactions.tsx` - Use batch API

## Acceptance Criteria

- [ ] Batch API endpoint exists
- [ ] Single IPC call replaces N+1 calls
- [ ] Operations are atomic (all or nothing)
- [ ] Performance improved (measure before/after)
- [ ] Existing tests pass

## Sprint Tasks

- TASK-205: Add batch contact assignment API
- TASK-206: Update Transactions.tsx to use batch API

## Related Items

- BACKLOG-064: Add Batch Operations (general)
- BACKLOG-061: Refactor Transactions.tsx (larger refactor)
