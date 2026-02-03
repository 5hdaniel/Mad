# BACKLOG-605: Parse iOS attributedBody and audio_transcript columns

## Summary

Extend the iOS message parser to query additional columns from sms.db that contain special message content: `attributedBody` (binary plist with message text), `audio_transcript` (voice message transcription), and potentially `associated_message_type` (message type indicator).

## Problem

Currently, the iOS parser (`iosMessagesParser.ts`) only queries basic fields from the `message` table. Special messages like:
- Voice messages with transcripts
- Location sharing messages
- System/service messages

...store their text content in the `attributedBody` blob field rather than the plain `text` field. Additionally, voice message transcripts may be stored in a separate `audio_transcript` column.

## Root Cause

The SELECT query in `iosMessagesParser.ts` does not include:
- `message.attributedBody` - Binary plist containing message text
- `message.audio_transcript` - Voice message transcription (if present)
- `message.associated_message_type` - Message type indicator

## Solution

1. Extend the SELECT query to include these columns
2. Use existing `messageParser.ts` functions to parse `attributedBody`
3. If `text` is null/empty but `attributedBody` is present, extract text from it
4. If `audio_transcript` is present, include it in the message data
5. Update `RawMessageRow` and `iOSMessage` interfaces

## Files to Modify

1. `electron/services/iosMessagesParser.ts` - Add columns to SELECT, parse attributedBody
2. `electron/types/iosMessages.ts` - Extend interfaces with new fields
3. Possibly `electron/services/iPhoneSyncStorageService.ts` - Store additional data

## Reference Files

- `electron/utils/messageParser.ts` - Contains binary plist parsing functions

## Acceptance Criteria

- [ ] iOS parser queries `attributedBody` column
- [ ] iOS parser queries `audio_transcript` column (gracefully handles if not present)
- [ ] Messages with empty `text` but populated `attributedBody` return parsed text
- [ ] Voice message transcripts are available in `iOSMessage`
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass (no regression)

## Priority

**High** - Foundation for special message type support

## Estimated Tokens

~20K

## Related

- BACKLOG-604: iOS attributedBody parsing for location messages (superseded by this)
- SPRINT-069: Special Message Type Support

## Created

2026-02-02 (SPRINT-069 planning)
