# BACKLOG-502: Text Messages Not Syncing/Displaying in Transaction Details

## Priority: Critical
## Category: Bug
## Estimate: ~20K tokens

## Problem

Text messages are not appearing in the transaction details "Text" tab after adding a contact and clicking "Sync Comm". This was previously working functionality that has regressed.

### Steps to Reproduce
1. Open a transaction
2. Add a contact that has text messages in Messages app
3. Click "Sync Comm" button
4. Go to the Text tab
5. **Bug:** No text messages appear, even though they exist in Messages database

### Expected Behavior
Text messages from/to the contact's phone numbers should appear in the Text tab.

### Logs Show
Auto-link reports `messagesLinked: 2` but messages don't appear in UI. Possible issues:
1. Messages being linked but not fetched for display
2. UI not refreshing after sync
3. Query issue in getCommunicationsWithMessages
4. Messages database read issue

### Additional Issue: Duplicate Threads
Same contact (Rhonda) with same phone number (+14155167861) appears as 3 separate thread cards:
- `macos-chat-2639` (Aug 27, 2025 - Oct 21, 2025)
- `macos-chat-2188` (Sep 25, 2024 - Oct 18, 2025)
- `macos-chat-2065` (different number)

Expected: 1:1 conversations with same contact should be merged or deduplicated.

### Verified
- Bug exists on `develop` branch (not a regression from overnight PRs)
- Email sync works correctly
- Auto-link service claims to link messages
- PR #593 GROUP BY fix did NOT resolve duplicates

## Files to Investigate

- `electron/services/messagesService.ts` - Messages database reading
- `electron/services/db/communicationDbService.ts` - getCommunicationsWithMessages
- `src/components/transactionDetailsModule/` - Text tab component
- `electron/transaction-handlers.ts` - syncAndFetchEmails handler

## Acceptance Criteria

- [ ] Text messages appear in Text tab after sync
- [ ] Messages from all contact phone numbers are included
- [ ] UI refreshes to show new messages after sync

## Created
2026-01-26
