# BACKLOG-505: Fix Duplicate Text Messages in Conversation View

## Priority: Critical (Hotfix)

## Category: bug

## Status: COMPLETED

## Summary

Text messages were appearing twice in the conversation view due to multiple root causes in the database architecture.

## Root Causes Identified

1. **Missing UNIQUE constraint on messages.external_id**
   - The import service uses `INSERT OR IGNORE` expecting deduplication
   - Without a unique constraint, duplicates were inserted every import

2. **Dual-storage pattern in communications table**
   - Legacy: content stored directly in `body_plain`
   - New: content in `messages` table, referenced via `message_id`
   - Same message could exist in both patterns with different IDs

3. **Content duplicates in messages table**
   - Same `body_text + sent_at` could have different `external_id` values

## Fix Applied (PR #605)

### Migration 20
- Deletes duplicate messages by `user_id + external_id`
- Adds UNIQUE constraint: `idx_messages_user_external_id ON messages(user_id, external_id)`

### Migration 21
- Deletes content-duplicate messages (same `body_text + sent_at`)
- Catches duplicates that have different `external_id` values

### Migration 19
- Deletes legacy communication records with `body_plain` content but no `message_id`

### Runtime Safety Net
- Content-based deduplication in `getCommunicationsWithMessages()`
- Filters by `body_text + sent_at` to catch any edge cases

## Files Changed

- `electron/services/databaseService.ts` - Migrations 19, 20, 21
- `electron/services/db/communicationDbService.ts` - Runtime deduplication
- `electron/database/schema.sql` - Added unique index

## Testing

- [x] Open transaction with linked text messages
- [x] Verify each message appears exactly once
- [x] Verify message count is accurate
- [x] Verify no messages are missing

## Related

- PR #605
- SR Engineer Architecture Review (see BACKLOG-506)
