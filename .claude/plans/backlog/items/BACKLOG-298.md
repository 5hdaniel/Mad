# BACKLOG-298: Support for Non-Image Attachments (HEIC, Video)

## Type
Feature Enhancement

## Priority
Medium

## Status
Open

## Summary
ConversationViewModal only displays standard image attachments (`image/*` excluding HEIC). Non-image attachments like HEIC photos (`.heic`, `image/heic`), videos (`.mov`, `.mp4`), and other file types are filtered out and not displayed to users.

## Problem
The `isDisplayableImage()` function in `ConversationViewModal.tsx` (line 82-87) only accepts MIME types starting with `image/` and explicitly excludes HEIC:

```typescript
function isDisplayableImage(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("image/") &&
    !mimeType.includes("heic") // HEIC requires conversion
  );
}
```

This causes all of the following to be silently ignored:
- HEIC images (common iPhone photo format)
- Video attachments (`.mov`, `.mp4`, `.webm`)
- Other file types (PDFs, documents, etc.)

Users expect to see these attachments in conversations, at minimum as clickable references that open in their default system application.

## Affected Files
- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx`
- `electron/preload/systemBridge.ts` (add openFile)
- `electron/system-handlers.ts` (add handler)

## Solution Options

### Option A: Full Media Support (Complex)
- Convert HEIC to displayable format on-the-fly
- Add inline video player for video/* MIME types
- Pros: Full native experience
- Cons: Complex implementation, performance concerns, HEIC conversion dependencies

### Option B: Thumbnail with Click-to-Open (Medium)
- Show first frame or placeholder thumbnail
- Click opens file in system default player via shell
- Pros: Visual preview, lower memory than inline video
- Cons: Requires ffmpeg or similar for thumbnails, complex

### Option C: File Icon with Click-to-Open (Simple - RECOMMENDED)
- Show a generic file icon (or type-specific icon for video/HEIC)
- Display the filename
- Click opens file in system default application via `shell.openPath()`
- Pros: **Simple implementation (~15K tokens)**, clear UX, works for ALL file types
- Cons: No preview (acceptable tradeoff for simplicity)

## Recommended Approach
**Option C** - File Icon with Click-to-Open

This provides immediate value with minimal implementation effort. It makes previously invisible attachments visible and accessible. Can be enhanced to Options A/B later if needed.

## Acceptance Criteria
- [ ] All attachments are visible in ConversationViewModal (not just displayable images)
- [ ] Non-image attachments show a file icon with filename
- [ ] Clicking non-image attachment opens file in system default application
- [ ] HEIC images show file icon (no conversion required)
- [ ] Video attachments show file icon (video-specific icon preferred)
- [ ] Tests cover non-image attachment rendering
- [ ] IPC handler for opening files in system app exists

## Dependencies
- Requires `shell.openPath()` IPC handler (similar to existing `shell.showItemInFolder()`)

## Discovered During
SPRINT-041 testing

## Notes
This is a UX gap - users see image attachments but HEIC photos and videos are simply missing with no indication they exist. Option C is a quick win that can be implemented in a single sprint.

## Related Tasks
- TASK-1078: Show File Icon for Unsupported Attachments
