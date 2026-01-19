# BACKLOG-175: Missing Recent Messages in AttachMessagesModal

**Created**: 2026-01-05
**Priority**: High
**Category**: fix
**Status**: Pending

---

## Description

Recent messages are not appearing in the AttachMessagesModal. User reported that messages from today (Jan 5) are not showing, while the modal shows last message was from Dec 29, 2024.

## Problem Statement

When opening the AttachMessagesModal and selecting a contact, recent messages are missing. The date range shown is outdated (e.g., Dec 29 instead of today).

## Potential Causes

1. **Sync Issue**: Recent messages not imported from macOS Messages database
   - The sync process may not be running or completing
   - There could be an issue with the message import timestamp tracking

2. **Query Issue**: Messages exist in database but aren't being returned
   - The `getMessagesByContact` query might have filtering issues
   - Date sorting or limiting could be excluding recent messages
   - The `transaction_id IS NULL` filter might be incorrect if messages were auto-linked

## Investigation Steps

1. Check if recent messages exist in the `messages` table:
   ```sql
   SELECT * FROM messages
   WHERE user_id = ?
   ORDER BY sent_at DESC
   LIMIT 10;
   ```

2. Check when the last sync occurred:
   ```sql
   SELECT * FROM sync_status
   WHERE user_id = ?
   ORDER BY updated_at DESC;
   ```

3. Verify the `getMessagesByContact` query returns expected results

4. Check if messages are being incorrectly linked to transactions during import

## Acceptance Criteria

- [ ] Recent messages appear in AttachMessagesModal
- [ ] Date range shows accurate first/last message dates
- [ ] All unlinked messages for a contact are displayed

## Estimated Tokens

~15,000

## Related Items

- BACKLOG-173: Contact-First AttachMessagesModal Interface (PR #353)
- BACKLOG-170: Messages Not Loading in Attach Modal

---

## Notes

This was discovered during testing of PR #353 (contact-first AttachMessagesModal). The modal now loads and displays contacts correctly, but the message data appears incomplete.
