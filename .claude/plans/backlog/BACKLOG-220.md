# BACKLOG-220: Unlink Communications UI Not Refreshing

## Status: REOPENED

**Reopened:** 2026-01-17
**Reason:** PR #450 fix (SPRINT-041) was insufficient - addressed surface-level callback issue but underlying architecture requires thread-based schema refactor.

---

## Type
Bug / UI / Architecture

## Priority
High

## Description
When attempting to remove/unlink a communication (email or iMessage) from a transaction, the UI does not update. The backend operation appears to succeed (visible in console logs), but the communication remains visible in the UI until page refresh.

**Root Cause (Updated):** The `communications` table architecture needs to link by `thread_id` rather than `message_id`. Current implementation creates confusion between individual messages and conversation threads.

## Symptoms
- Click to unlink/remove a message from transaction
- Nothing visually changes (or only partial update)
- Backend logs show successful operation
- Manual page refresh shows the communication is removed

## Investigation Findings (2026-01-17)

PR #450 (TASK-1109) attempted to fix this by awaiting the async callback before closing the modal. However, user testing revealed the fix was insufficient because:

1. **Architecture issue:** `communications` table stores individual `message_id` references, but UI operates on conversation threads
2. **Unlink granularity mismatch:** User expects to unlink "the conversation" but backend unlinks individual messages
3. **State complexity:** Multiple messages per thread means multiple unlink operations

### Required Solution

The `communications` table needs to transition from:
- `communications.message_id -> messages.id` (per-message linking)

To:
- `communications.thread_id -> messages.thread_id` (per-thread linking)

This change affects:
- `autoLinkService.ts` - how links are created
- `communicationDbService.ts` - how links are queried/deleted
- Export services - how communications are counted/exported
- `transactionDbService.ts` - how communications are joined

## Stashed Work

Thread-based schema refactor was started but deferred due to scope:
- **Stash:** `stash@{0}: TASK-1109-thread-based-schema-refactor-deferred`
- **Files changed:** 7 files, 502 insertions, 619 deletions
- **Key changes:** schema.sql, communicationDbService.ts, transactionService.ts

## Acceptance Criteria
- [ ] Unlinking communication immediately removes entire thread from UI
- [ ] No page refresh required
- [ ] Works for both emails and iMessages
- [ ] Backend operations complete atomically (all messages in thread)

## Dependencies
- BACKLOG-296: Database Schema Alignment (must complete schema work first)
- Schema audit on `research/database-schema-audit` branch

## Related
- TASK-1037 (Auto-Link) - Found during verification testing
- SPRINT-034, SPRINT-041
- PR #450 (insufficient fix)
- BACKLOG-296 (Database Schema Alignment)

## Created
2025-01-12

## Reopened
2026-01-17
