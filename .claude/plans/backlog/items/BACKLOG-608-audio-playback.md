# BACKLOG-608: Implement audio playback for voice messages

## Summary

Add audio playback capability to the MessageBubble component so users can listen to voice messages directly in the app.

## Problem

Even after displaying "[Voice Message]" indicators, users cannot actually play the audio content. They would need to manually locate the file in the attachments folder.

## Solution

1. For voice messages with audio attachments:
   - Add HTML5 `<audio>` element with native controls
   - Locate audio file from attachment storage path
   - Support common formats: m4a (iPhone default), mp3, wav
2. Handle edge cases:
   - File not found -> show disabled state with "Audio unavailable"
   - Unsupported format -> show warning
3. Progressive enhancement:
   - Basic: Native audio controls
   - Stretch: Custom waveform visualization (future)

## Files to Modify

1. `src/components/transactionDetailsModule/components/MessageBubble.tsx` - Add audio player
2. Possibly create `src/components/common/AudioPlayer.tsx` reusable component
3. May need IPC handler to get attachment file path

## Implementation Details

```tsx
// Example structure
{message.message_type === 'voice_message' && message.attachments?.length > 0 && (
  <audio
    controls
    src={`file://${attachmentPath}`}
    className="w-full mt-2"
  >
    Your browser does not support audio playback.
  </audio>
)}
```

## Acceptance Criteria

- [ ] Voice messages show play button/audio controls
- [ ] Clicking play starts audio playback
- [ ] Audio stops at end of message
- [ ] Graceful handling if audio file not found
- [ ] Works in Electron (file:// protocol)
- [ ] Volume and seek controls available
- [ ] Component tests for audio player rendering

## Priority

**Medium** - Enhancement over basic display

## Estimated Tokens

~25K

## Related

- BACKLOG-607: MessageBubble special type display
- SPRINT-069: Special Message Type Support

## Created

2026-02-02 (SPRINT-069 planning)
