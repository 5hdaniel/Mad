# TASK-986: macOS Messages Import

**Sprint**: SPRINT-026
**Backlog**: BACKLOG-172
**Estimated**: ~25K tokens
**Priority**: High

---

## Objective

Implement the ability to import text messages from macOS Messages app (`~/Library/Messages/chat.db`) into the app's internal `messages` table, enabling message-to-transaction linking on macOS.

## Background

Currently, text message import only works via iPhone backup sync (Windows/Linux). On macOS:
- The app can read `chat.db` for export/display (conversationHandlers.ts)
- But there's no mechanism to import those messages into the app database
- This prevents the "Attach Messages" feature from working on macOS

## Implementation Steps

### 1. Create macOSMessagesImportService.ts
- Check Full Disk Access permission
- Read from `~/Library/Messages/chat.db`
- Query: message, chat, handle, chat_handle_join tables
- Parse attributedBody blobs (reuse messageParser.ts)
- Transform to app schema and insert into messages table

### 2. Add IPC Handler
- `messages:import-macos` - Trigger import
- Return import count and status

### 3. Deduplication
- Generate stable ID from: `message_guid + user_id`
- Check existing before insert to avoid duplicates

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/services/macOSMessagesImportService.ts` | **NEW** - Core import logic |
| `electron/handlers/message-import-handlers.ts` | **NEW** - IPC handlers |
| `electron/preload.ts` or bridge | Expose import API |

## Acceptance Criteria

- [ ] macOS users can import messages from Messages app
- [ ] Imported messages appear in "Attach Messages" modal
- [ ] Duplicate messages are not re-imported
- [ ] Works with Full Disk Access permission

## Quality Gates

- [ ] Type-check passes
- [ ] Tests pass
- [ ] No new lint errors

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (auto-captured) |
| Total Tokens | (auto-captured) |
| Duration | (auto-captured) |
| Variance | (auto-captured) |
