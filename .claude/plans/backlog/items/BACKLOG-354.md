# BACKLOG-354: Remove Phone Number Under Each Text in 1:1 Chat Exports

**Created**: 2026-01-21
**Priority**: Low
**Category**: UI
**Status**: Pending

---

## Description

In the PDF export for 1:1 text conversations, the phone number is shown under every message. This is redundant since it's the same person throughout the conversation.

**Before:**
```
GianCarlo Jan 6, 2026, 02:05 PM
+14243335133
```

**After:**
```
GianCarlo Jan 6, 2026, 02:05 PM
```

**Note**: This should ONLY apply to 1:1 chats. Group chats still need the phone number to identify who sent each message.

## Acceptance Criteria

- [ ] 1:1 chat exports don't show phone number under each message
- [ ] Group chat exports still show phone number under each message
- [ ] Contact name still displays for all messages

## Technical Notes

Need to check if this was already completed. The logic should detect if it's a group chat (multiple participants) vs 1:1 chat (single contact) and conditionally show the phone number.

## Related

- folderExportService.ts
- pdfExportService.ts
