# TASK-2115: Unit tests for ACID rollback logic

**Backlog:** BACKLOG-849
**Sprint:** SPRINT-114
**Status:** Completed
**Priority:** Low
**Type:** test

---

## Problem

The ACID rollback logic added in TASK-2110b has no unit tests. The following critical paths are untested:
- `rollbackSession()` in `iPhoneSyncStorageService.ts`
- `deleteBySessionId()` in `externalContactDbService.ts`
- `deleteMessagesBySessionId()` and `deleteAttachmentsBySessionId()` in `databaseService.ts`
- Cancel signal mid-batch behavior in `storeMessages()`
- Content-addressed file safety (orphaned file detection)

## Scope

Write unit tests for the rollback and cancel logic. Do NOT modify production code.

## Files to Create/Modify

- `electron/services/__tests__/iPhoneSyncStorageService.rollback.test.ts` — new test file

## What to Test

### 1. rollbackSession()
- Deletes attachments by session ID (calls `databaseService.deleteAttachmentsBySessionId`)
- Deletes orphaned files from disk (calls `fs.promises.unlink` for each orphaned path)
- Deletes messages by session ID (calls `databaseService.deleteMessagesBySessionId`)
- Deletes contacts by session ID (calls `externalContactDb.deleteBySessionId`)
- Skips rollback when no sessionId provided
- Handles errors gracefully (logs but doesn't throw)

### 2. Cancel signal in persistSyncResult()
- Returns cancelled result when signal is set before messages phase
- Returns cancelled result when signal is set between messages and contacts phases
- Returns cancelled result when signal is set between contacts and attachments phases
- Calls rollbackSession when cancel happens after partial storage

### 3. Content-addressed file safety
- `deleteAttachmentsBySessionId` returns only files where no other attachment references the same `storage_path`
- Files shared across sessions are NOT deleted

### 4. cancelledResult()
- Returns PersistResult with success=false and correct error message

## Implementation Notes

- Mock `databaseService`, `externalContactDb`, and `fs.promises`
- The `rollbackSession` and `cancelledResult` methods are private — test them indirectly through `persistSyncResult()`
- Use Jest's mock system for database calls
- For cancel signal tests, set `cancelSignal.cancelled = true` at different points using mock side effects

## Acceptance Criteria

- [ ] rollbackSession deletes from all 3 tables + orphaned files
- [ ] Cancel signal at each phase triggers rollback correctly
- [ ] Content-addressed files shared across sessions are not deleted
- [ ] No sessionId gracefully skips rollback
- [ ] All tests pass with `npm test`
