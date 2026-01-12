# BACKLOG-172: macOS Messages Import

**Created**: 2026-01-05
**Priority**: High
**Category**: Feature
**Status**: Ready

---

## Description

Implement the ability to import text messages from macOS Messages app (`~/Library/Messages/chat.db`) into the app's internal `messages` table, enabling message-to-transaction linking on macOS.

## Background

Currently, text message import only works via iPhone backup sync (Windows/Linux). On macOS:
- The app can read `chat.db` for export/display (conversationHandlers.ts)
- But there's no mechanism to import those messages into the app database
- This prevents the "Attach Messages" feature from working on macOS

See BACKLOG-170 for full root cause analysis.

## Technical Approach

### 1. Create macOS Messages Import Service

```typescript
// electron/services/macOSMessagesImportService.ts

class MacOSMessagesImportService {
  /**
   * Import messages from macOS Messages database
   * Requires Full Disk Access permission
   */
  async importMessages(userId: string, options?: {
    sinceDays?: number;  // Only import messages from last N days
    limit?: number;      // Max messages to import
  }): Promise<ImportResult>
}
```

### 2. Query macOS Messages Database

Read from `~/Library/Messages/chat.db`:
- `message` table: Contains actual message content
- `chat` table: Conversation metadata
- `handle` table: Contact identifiers (phone numbers, emails)
- `chat_handle_join`: Links chats to handles

### 3. Transform and Store

Map macOS Messages schema to app's `messages` table:
- `ROWID` → generate UUID for `id`
- `text` / `attributedBody` → `body_text` (use messageParser.ts)
- `handle.id` → `participants`
- `is_from_me` → `direction`
- `service` → `channel` (iMessage → "imessage", SMS → "sms")

### 4. Deduplication

- Generate stable ID from: `message_guid + user_id`
- Check existing before insert to avoid duplicates
- Track last import timestamp for incremental imports

## Implementation Steps

1. **Create macOSMessagesImportService.ts**
   - Permission check (Full Disk Access)
   - Read from chat.db
   - Parse attributedBody blobs (reuse messageParser.ts)
   - Insert into messages table

2. **Add IPC Handler**
   - `messages:import-macos` - Trigger import
   - `messages:import-macos-status` - Get import status

3. **UI Integration**
   - Add "Import Messages" button in Settings or Dashboard
   - Show import progress
   - macOS only (use platform detection)

4. **Auto-Import Option**
   - Optional: Run import on app startup
   - Optional: Periodic background sync

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/services/macOSMessagesImportService.ts` | **NEW** - Core import logic |
| `electron/handlers/messageImportHandlers.ts` | **NEW** - IPC handlers |
| `src/components/settings/MessagesSettings.tsx` | Import button UI |
| `electron/preload/messagesBridge.ts` | Expose import API |

## Dependencies

- Full Disk Access permission (already implemented in permissionService.ts)
- messageParser.ts (already has attributedBody parsing)
- messages table schema (TASK-975 completed)

## Acceptance Criteria

- [ ] macOS users can import messages from Messages app
- [ ] Imported messages appear in "Attach Messages" modal
- [ ] Duplicate messages are not re-imported
- [ ] Import progress is shown to user
- [ ] Works with Full Disk Access permission

## Estimate

~25,000 tokens

## Notes

- Consider incremental import (only new messages since last import)
- May need to handle encrypted messages (FileVault)
- Watch for permission changes (user can revoke FDA)
- Consider rate limiting / batching for large message histories
