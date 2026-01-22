# BACKLOG-336: Export Text Message Attachments with Message References

## Summary

Include text message attachments (images, GIFs, files) in the audit package export, with proper references to the originating message and optional thumbnail previews in the manifest.

## Problem

Currently TASK-1141 only exports email attachments. Text message attachments are stored in the same `attachments` table but are not included because `exportAttachments()` is only called with email communications, not text messages.

Text message attachments include:
- Photos shared via iMessage/SMS
- GIFs and videos (videos deferred)
- Files and documents
- Voice messages (deferred)

## Requirements

### 1. Include Text Attachments in Export
- Call `exportAttachments()` with both `emails` AND `texts` arrays
- Or pass all linked communications regardless of type
- Use `communication_id` (not `message_id` column name) for unified lookup

### 2. Message Reference in Manifest
- Add `messageType` field to manifest entry: `"email"` or `"text"`
- Add `messagePreview` field: first 100 chars of the message body
- Add `conversationContext` for texts: contact name + thread identifier

### 3. Thumbnail Support (Optional Enhancement)
- For image attachments, generate a small thumbnail
- Store thumbnail path in manifest
- Display thumbnails in summary PDF or HTML manifest viewer

## Implementation Notes

### Current Code (folderExportService.ts)

```typescript
// Line 179 - Only passes emails
await this.exportAttachments(transaction, emails, attachmentsPath);
```

### Proposed Change

```typescript
// Pass all communications (emails + texts)
const allCommunications = [...emails, ...texts];
await this.exportAttachments(transaction, allCommunications, attachmentsPath);
```

### Manifest Enhancement

```typescript
interface AttachmentManifestEntry {
  filename: string;
  originalMessage: string;  // Subject for emails, first line for texts
  date: string;
  size: number;
  sourceEmailIndex?: number;  // Keep for backward compat
  sourceMessageIndex?: number;  // Add for texts
  messageType: "email" | "text";  // NEW
  messagePreview?: string;  // NEW - first 100 chars
  conversationContact?: string;  // NEW - for texts
  status?: "exported" | "file_not_found" | "copy_failed";
}
```

## Files Likely Affected

- `electron/services/folderExportService.ts` - Main export logic
- Manifest interface (same file)

## Priority

MEDIUM - Enhancement to TASK-1141, not critical but improves audit completeness

## Depends On

- TASK-1141 (merged)

## Created

2026-01-19
