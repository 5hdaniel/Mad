# BACKLOG-187: Display Attachments (Images/GIFs) in Text Messages

**Created**: 2026-01-10
**Priority**: Medium
**Category**: feature
**Status**: Pending

---

## Description

Display image and GIF attachments inline within text message conversations. Currently, messages with attachments only show "[Attachment - Photo/Video/File]" placeholder text.

## Current Behavior

- Messages with attachments show placeholder text: "[Attachment - Photo/Video/File]"
- `has_attachments` flag is stored but actual files are not imported
- No visual preview of images/GIFs

## Desired Behavior

1. Import attachment files from macOS Messages storage
2. Store attachments in app's data directory
3. Display images/GIFs inline in message bubbles
4. Support common formats: JPG, PNG, GIF, HEIC
5. Show thumbnail with option to view full size

## Technical Notes

### macOS Messages Attachment Storage

Attachments are stored in `~/Library/Messages/Attachments/` with references in the `attachment` table.

### Implementation Steps

1. Query `attachment` table during import
2. Copy files to app storage (with deduplication)
3. Store attachment metadata in messages table or new attachments table
4. Update ConversationViewModal to render inline images
5. Handle missing/deleted attachments gracefully

### Storage Considerations

- Attachments can be large (photos, videos)
- Consider thumbnail generation for preview
- May need cleanup/pruning strategy
- Respect user's storage preferences

## Acceptance Criteria

- [ ] Import attachments from macOS Messages database
- [ ] Store attachments in app's data directory
- [ ] Display images inline in message bubbles
- [ ] Display GIFs with animation
- [ ] Show placeholder for unsupported formats
- [ ] Handle missing attachments gracefully
- [ ] Works for both 1:1 and group conversations

## Estimated Tokens

~50,000 (significant feature addition)

## Related Items

- TASK-1008: Show in Folder button (completed)
- Message import service updates needed

---

## Notes

This is an audit-critical feature - real estate agents often share property photos, contracts, and documents via text message. These attachments are important evidence in transaction audits.
