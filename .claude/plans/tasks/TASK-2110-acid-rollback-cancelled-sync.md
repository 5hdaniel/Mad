# TASK-2110: ACID rollback on cancelled iPhone sync - clean up partial data

**Backlog:** BACKLOG-845
**Sprint:** SPRINT-110
**Status:** Completed
**Priority:** High
**Type:** fix

---

## Problem

When a user cancels an iPhone sync mid-operation:
1. `cancelSync()` in `useIPhoneSync.ts` calls `syncApi.cancel()` and resets UI state
2. But the main process may have already stored partial messages/contacts to the database
3. The UI then shows "Last synced: 23 minutes ago" with incomplete data
4. This violates atomicity - the sync should either fully complete or fully roll back

## Phase A: Investigation (Read-Only)

**SR Review finding:** Main process has NO transaction wrapping. `storeMessages` inserts in batches of 500 without a wrapping transaction. Each batch is independently committed.

### Investigation Questions

1. Where does the main process store messages? Find `iPhoneSyncStorageService.ts` or equivalent.
2. Is there already a transaction wrapper around message insertion? (SR says no)
3. Is there a batch ID or sync session ID that can identify which records to roll back?
4. What IPC channel handles the cancel signal? (`sync:cancel` in `sync-handlers.ts` line 152?)
5. Does `deviceSyncOrchestrator.cancel()` propagate to storage phase?
6. What is the performance impact of wrapping 600k+ inserts in a single transaction?
7. Does `storeAttachments` copy files to `message-attachments/` that also need cleanup?

### Investigation Output

Document findings and recommend one of:
- **Option 1:** Sync session ID tagging + cleanup on cancel (safer, works with committed batches)
- **Option 2:** Single transaction wrapping (simpler code, risky with large datasets)
- **Option 3:** Batch transactions with session ID (compromise)

## Phase B: Implementation (after investigation)

### Renderer Side (useIPhoneSync.ts)
- After `syncApi.cancel()`, call a new IPC method like `syncApi.rollbackLastSync()` or similar
- Clear `lastSyncTime` on cancel (don't show stale "Last synced" for a cancelled operation)

### Main Process (based on investigation findings)
- Implement chosen rollback strategy
- Clean up attachment files in `message-attachments/` on rollback

## Files to Modify

- `src/hooks/useIPhoneSync.ts` — clear lastSyncTime on cancel, call rollback
- Main process storage handler (TBD after investigation)
- Possibly `electron/` IPC handlers for new rollback channel

## Acceptance Criteria

- [ ] Investigation document produced with recommended approach
- [ ] Cancelled sync does not leave partial messages in the database
- [ ] Cancelled sync does not leave orphaned attachment files on disk
- [ ] "Last synced" timestamp is not updated for cancelled syncs
- [ ] If cancel happens after storage commit, records from that batch are cleaned up
- [ ] Successful syncs are not affected by rollback logic
