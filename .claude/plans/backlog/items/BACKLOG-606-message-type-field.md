# BACKLOG-606: Add message_type field to Communication model

## Summary

Add an explicit `message_type` field to the Communication model to differentiate between regular text messages, voice messages, location shares, and other special message types.

## Problem

Currently, the only indicator of message content type is `has_attachments: boolean`. The UI cannot distinguish between:
- Regular text messages
- Voice/audio messages
- Location sharing messages
- System/service messages
- Messages with attachments vs attachment-only messages

This makes it impossible to display appropriate indicators like "[Voice Message]" or "[Location Shared]".

## Solution

1. Define a `MessageType` enum: `'text' | 'voice_message' | 'location' | 'attachment_only' | 'system' | 'unknown'`
2. Add `message_type?: MessageType` to the `Communication` interface
3. Add database column (or derive from existing data at import time)
4. Update `iPhoneSyncStorageService` to set `message_type` based on:
   - `audio_transcript` present -> `voice_message`
   - Location text in `attributedBody` -> `location`
   - System message patterns -> `system`
   - Audio mime_type + no text -> `voice_message`
   - Has attachments + no text -> `attachment_only`
   - Default -> `text`

## Files to Modify

1. `electron/types/models.ts` - Add `MessageType` enum and field to `Communication`/`Message`
2. `electron/database/schema.sql` - Add column (if persisting to DB)
3. `electron/services/iPhoneSyncStorageService.ts` - Set message_type during import
4. `electron/services/macOSMessagesImportService.ts` - Set message_type for macOS messages

## Acceptance Criteria

- [ ] `MessageType` enum defined with all necessary values
- [ ] `Communication` interface includes `message_type?: MessageType`
- [ ] Database column added with migration (or derive at query time)
- [ ] iOS import sets appropriate `message_type` based on content analysis
- [ ] macOS import sets appropriate `message_type`
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass

## Priority

**High** - Required for UI differentiation

## Estimated Tokens

~15K

## Related

- BACKLOG-605: iOS attributedBody parsing (provides data for type detection)
- SPRINT-069: Special Message Type Support

## Created

2026-02-02 (SPRINT-069 planning)
