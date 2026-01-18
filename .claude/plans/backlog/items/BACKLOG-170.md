# BACKLOG-170: Messages Not Loading in Attach Modal

**Created**: 2026-01-05
**Priority**: Critical
**Category**: Feature Gap (was Bug Fix)
**Status**: Needs Feature (BACKLOG-172)

---

## Description

When opening the "Attach Messages" modal from a transaction's Messages tab, no messages appear on macOS. The modal shows:
- "No unlinked messages available"
- "All message threads are already linked to transactions"

## Root Cause Analysis (TASK-985)

### Initial Investigation
1. Fixed channel/communication_type field name mismatch in `getUnlinkedMessages()` (PR #342)
2. Added debug logging to verify the fix

### Actual Root Cause
The database only contains **emails** - no text messages. This is because:

1. **macOS Messages Access Gap**: The app can READ from `~/Library/Messages/chat.db` for export/display (via `conversationHandlers.ts`), but there is **no import mechanism** to store those messages in the app's internal `messages` table.

2. **iPhone Sync Only**: Text messages only get imported into the database via iPhone backup sync (`syncOrchestrator.ts` + `iPhoneSyncStorageService.ts`), which is designed for **Windows/Linux** platforms.

3. **Platform Mismatch**: The `platform.ts` config says macOS should have `localMessagesAccess: ["macos"]`, implying direct access. But the Attach Messages modal queries the internal database, not the macOS Messages database.

### Architecture
```
macOS chat.db ──(export only)──> conversationHandlers.ts ──> Text Export
                                (NO import to messages table)

iPhone backup ──(Windows/Linux)──> syncOrchestrator.ts ──> messages table ──> Attach Modal
```

## Resolution

This is not a bug but a **missing feature**. The fix requires implementing:

**BACKLOG-172: macOS Messages Import**
- Read from `~/Library/Messages/chat.db`
- Import messages into the app's `messages` table
- Use Full Disk Access permission (already checked)

## PR #342 (Partial Fix)

The channel name fix in PR #342 is still valid and necessary:
- Fixed filter to check both `channel` and `communication_type` field names
- Fixed filter to accept both `"sms"/"imessage"` and `"text"/"imessage"` values
- This fix will be needed once messages ARE in the database (after BACKLOG-171)

## Files Modified

| File | Change |
|------|--------|
| `electron/services/transactionService.ts` | Fixed channel filter logic |

## Acceptance Criteria

- [x] Channel name mismatch fixed (PR #342)
- [x] Root cause identified and documented
- [ ] macOS Messages import implemented (BACKLOG-172)
- [ ] Unlinked messages appear in attach modal on macOS

## Debug Output (for reference)

```
[DEBUG getUnlinkedMessages] allMessages count: 42
[DEBUG getUnlinkedMessages] unique types: [ 'email' ]
[DEBUG getUnlinkedMessages] filtered messages count: 0
```

The database only has `email` type messages, no `text` or `imessage`.
