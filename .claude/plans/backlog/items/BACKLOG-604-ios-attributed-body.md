# BACKLOG-604: iOS messages missing text when stored in attributedBody field

## Summary

iOS messages that store text in the `attributedBody` field (like location sharing messages "You started sharing location") display as "[Media not available]" in the app because the iOS parser only extracts the `text` field.

## Problem

When importing iPhone messages on Windows, certain message types store their text content in the `attributedBody` blob field rather than the plain `text` field. These include:

- Location sharing messages ("You started sharing location", "You stopped sharing location")
- Potentially other system/service messages

When the `text` field is empty/null and `attributedBody` is populated, the current parser returns empty text, causing the UI to display "[Media not available]".

## Root Cause

The iOS messages parser (`electron/services/iosMessagesParser.ts`) only queries and extracts the `message.text` column. It does not query or parse the `message.attributedBody` column, which contains a binary plist with the actual message text for certain message types.

## Solution

The fix is straightforward because the parsing logic already exists:

1. **Existing Solution**: `electron/utils/messageParser.ts` already has a `parseAttributedBody()` function used for macOS message parsing
2. **Required Changes**:
   - Add `attributedBody` to the SELECT query in `iosMessagesParser.ts`
   - In `iPhoneSyncStorageService.ts`, parse `attributedBody` when `text` is empty using the existing parser

## Files to Modify

1. `electron/services/iosMessagesParser.ts` - Add `attributedBody` to SELECT query in `parseMessagesDb()`
2. `electron/services/iPhoneSyncStorageService.ts` - Parse `attributedBody` when `text` is empty/null

## Reference Files

- `electron/utils/messageParser.ts` - Contains `parseAttributedBody()` function to reuse

## Acceptance Criteria

- [ ] Messages with empty `text` but populated `attributedBody` display the parsed text
- [ ] Location sharing messages show actual text (e.g., "You started sharing location")
- [ ] No regression for messages that already have `text` populated
- [ ] Reuses existing `parseAttributedBody()` function from messageParser.ts
- [ ] TypeScript compiles without errors

## Priority

**Medium** - Affects message display for certain message types but core functionality works

## Estimated Tokens

~15K

## Created

2026-02-02 (discovered during SPRINT-068 testing)
