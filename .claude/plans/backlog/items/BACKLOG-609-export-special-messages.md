# BACKLOG-609: Update PDF/folder export for special message types

## Summary

Update the folder export service to properly handle special message types in PDF output, ensuring voice message transcripts and location information are included in audit packages.

## Problem

Currently, the export service may show "[Attachment]" for voice messages without the transcript, losing valuable audit information. Location messages may also not display properly.

## Solution

1. Check `message_type` when rendering messages in PDF
2. For `voice_message`:
   - Show "[Voice Message]" header
   - Include transcript text below
   - Reference audio attachment file
3. For `location`:
   - Show "[Location Shared]" header
   - Include location description
4. For `attachment_only`:
   - Show "[Media Attachment]" with file reference
5. Include summary of special message counts in report

## Files to Modify

1. `electron/services/folderExportService.ts` - Update message rendering logic

## Example PDF Output

```
[Voice Message - Transcript:]
"Hey, just calling to confirm the inspection is
scheduled for tomorrow at 2pm. Let me know if
that works."
[Audio file: voice_001.m4a]

---

[Location Shared]
You started sharing location with John Smith

---
```

## Acceptance Criteria

- [ ] Voice messages in PDF show "[Voice Message]" indicator
- [ ] Voice message transcripts included in PDF
- [ ] Audio file referenced in PDF
- [ ] Location messages show location text
- [ ] System messages handled appropriately
- [ ] Summary report includes count of special message types
- [ ] Audit package complete and accurate

## Priority

**Medium** - Audit package completeness

## Estimated Tokens

~15K

## Related

- BACKLOG-606: message_type field
- SPRINT-069: Special Message Type Support

## Created

2026-02-02 (SPRINT-069 planning)
