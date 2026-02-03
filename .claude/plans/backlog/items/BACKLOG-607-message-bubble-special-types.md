# BACKLOG-607: Update MessageBubble for special message type display

## Summary

Update the MessageBubble component to display special message types appropriately with indicators, transcripts, and styling.

## Problem

Currently, MessageBubble shows:
- "[Attachment]" for attachment-only messages
- "[Message content unavailable]" for messages with no displayable content

For special message types, we should show:
- "[Voice Message]" with transcript below (if available)
- "[Location Shared]" with location description
- Appropriate icons/styling for each type

## Solution

1. Read `message_type` from Communication object
2. For `voice_message`:
   - Show "[Voice Message]" indicator with microphone icon
   - Display transcript text below if available
   - Add play button (separate task for actual playback)
3. For `location`:
   - Show "[Location Shared]" indicator with location pin icon
   - Display location description from parsed text
4. For `system`:
   - Show system message with distinct styling (centered, gray, smaller)
5. Maintain existing behavior for regular `text` type

## Files to Modify

1. `src/components/transactionDetailsModule/components/MessageBubble.tsx`
2. Possibly add icon components or use existing icon library

## Acceptance Criteria

- [ ] Voice messages display "[Voice Message]" indicator
- [ ] Voice message transcript shows below indicator (if present)
- [ ] Location messages display "[Location Shared]" indicator
- [ ] Location description text shows below indicator
- [ ] System messages styled distinctly
- [ ] Regular text messages unchanged
- [ ] Component tests cover all message types
- [ ] Accessible (screen reader announces message type)

## UI Mockup

```
Voice Message (inbound):
+----------------------------------+
|  [mic icon] Voice Message        |
|  "Hey, calling to discuss the    |
|   inspection results..."         |
|                     2:30 PM      |
+----------------------------------+

Location Message:
+----------------------------------+
|  [pin icon] Location Shared      |
|  "You started sharing location"  |
|                     3:15 PM      |
+----------------------------------+
```

## Priority

**High** - User-visible improvement

## Estimated Tokens

~20K

## Related

- BACKLOG-605: iOS attributedBody parsing
- BACKLOG-606: message_type field
- BACKLOG-608: Audio playback (enhancement)
- SPRINT-069: Special Message Type Support

## Created

2026-02-02 (SPRINT-069 planning)
