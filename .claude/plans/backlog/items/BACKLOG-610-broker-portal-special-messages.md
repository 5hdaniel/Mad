# BACKLOG-610: Broker portal support for special message types

## Summary

Ensure special message types (voice messages, location sharing) are properly displayed in the broker portal web application, including audio playback capability.

## Problem

The broker portal receives transaction data via Supabase sync. Special message types need to:
1. Have `message_type` field synced
2. Display appropriate indicators in the web UI
3. Support audio playback in browser context

## Solution

1. **Data Sync:**
   - Ensure `message_type` field is included in Supabase sync
   - Verify audio attachments are uploaded to Supabase storage

2. **Portal UI:**
   - Update message display components in broker portal
   - Add "[Voice Message]", "[Location Shared]" indicators
   - Include transcript text

3. **Audio Playback:**
   - Use Supabase storage URLs for audio files
   - HTML5 audio with browser-native controls
   - Handle CORS and authentication

## Files to Modify

1. Supabase schema (if `message_type` column missing)
2. Sync service (ensure message_type synced)
3. Broker portal message components (separate repo or Supabase functions)

## Acceptance Criteria

- [ ] message_type field syncs to Supabase
- [ ] Portal displays "[Voice Message]" for voice messages
- [ ] Portal shows transcript below voice message indicator
- [ ] Audio playback works in web browser
- [ ] Portal displays "[Location Shared]" for location messages
- [ ] Location text displays correctly
- [ ] No regression in existing portal functionality

## Priority

**Low** - B2B parity feature (stretch goal)

## Estimated Tokens

~15K

## Notes

- This task spans desktop app (sync) and broker portal (display)
- Audio file storage/retrieval through Supabase Storage
- May require coordination with broker portal team

## Related

- BACKLOG-607: Desktop MessageBubble special types
- BACKLOG-608: Desktop audio playback
- SPRINT-069: Special Message Type Support

## Created

2026-02-02 (SPRINT-069 planning)
