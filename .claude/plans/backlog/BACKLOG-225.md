# BACKLOG-225: Video Attachment Support for iMessage Import

## Problem Statement

Video attachments (`.mov`, `.mp4`) from iMessages are not imported, even though the message shows `[Attachment]` placeholder. Currently only images are supported.

## Current Behavior

- Only image extensions supported: `.jpg`, `.jpeg`, `.png`, `.gif`, `.heic`
- Videos are skipped during import
- Message still shows `[Attachment]` placeholder (confusing UX)
- User sees placeholder but no content

## Expected Behavior

1. Import video attachments (`.mov`, `.mp4`, `.m4v`)
2. Display video with player controls in conversation view
3. OR: Don't show `[Attachment]` placeholder for unsupported types

## Technical Details

- File: `electron/services/macOSMessagesImportService.ts`
- Line 77: `SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".heic"]`
- Would need to add video extensions and create video player component

## Considerations

- Video files are larger - storage impact
- Need video player component in UI
- May need to handle different codecs
- Could thumbnail videos instead of storing full file

## Priority

Low - Enhancement

## Acceptance Criteria

- [ ] Video files (`.mov`, `.mp4`, `.m4v`) are imported
- [ ] Video player displays in conversation view
- [ ] Playback controls work (play/pause, scrub)
- [ ] OR: `[Attachment]` placeholder hidden for unsupported types

## Related

- TASK-1012: Original attachment import implementation (images only)
- BACKLOG-225: URL preview formatting (nice to have)

## Notes

- Discovered during SPRINT-034 verification
- Example: IMG_2753.MOV (1.1MB) not imported despite being small enough
