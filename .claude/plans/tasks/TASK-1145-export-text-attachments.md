# Task TASK-1145: Export Text Message Attachments

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Export text message attachments (images, GIFs, files) to both:
1. The `attachments/` folder in the audit package
2. Inline thumbnails in the text thread PDFs

## Non-Goals

- Video attachment support (deferred)
- Voice message support (deferred)
- Downloading attachments from cloud (assume local storage)

## Deliverables

1. Update: `electron/services/folderExportService.ts` - Include text attachments in `exportAttachments()`
2. Update: `electron/services/folderExportService.ts` - Show inline images in text thread PDFs

## Acceptance Criteria

- [ ] Text message attachments are copied to `attachments/` folder
- [ ] `manifest.json` includes text attachments with `messageType: "text"`
- [ ] Text thread PDFs show image attachments inline (thumbnail or full)
- [ ] Attachment reference shows which message it came from
- [ ] All CI checks pass

## Implementation Notes

### Part 1: Include Text Attachments in Attachments Folder

Current code (line 179) only passes emails:
```typescript
await this.exportAttachments(transaction, emails, attachmentsPath);
```

**Fix:** Pass all communications:
```typescript
const allCommunications = [...emails, ...texts];
await this.exportAttachments(transaction, allCommunications, attachmentsPath);
```

**Also update manifest entry interface:**
```typescript
interface AttachmentManifestEntry {
  // ... existing fields
  messageType?: "email" | "text";  // NEW
  messagePreview?: string;  // NEW - first 100 chars
}
```

### Part 2: Inline Images in Text Thread PDFs

In `generateTextMessageHTML()`, check for attachments and embed them:

```typescript
private generateTextMessageHTML(
  msg: Communication,
  // ... existing params
): string {
  // Get attachments for this message
  const attachments = this.getAttachmentsForMessage(msg.id);

  // Generate attachment HTML
  let attachmentHtml = '';
  for (const att of attachments) {
    if (att.mime_type?.startsWith('image/') && att.storage_path) {
      // Embed image as base64 for PDF
      const imageData = fs.readFileSync(att.storage_path);
      const base64 = imageData.toString('base64');
      attachmentHtml += `<img src="data:${att.mime_type};base64,${base64}" style="max-width: 200px; margin: 8px 0;" />`;
    } else {
      // Show file reference
      attachmentHtml += `<div class="attachment">[Attachment: ${att.filename}]</div>`;
    }
  }

  return `
    <div class="message">
      <span class="sender">${senderName}</span>
      <span class="time">${time}</span>
      <div class="body">${this.escapeHtml(msg.body_text || '')}</div>
      ${attachmentHtml}
    </div>
  `;
}
```

### Query for Text Attachments

Text messages link to attachments via `message_id` in the attachments table. Query:
```sql
SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
FROM attachments
WHERE message_id IN (SELECT id FROM messages WHERE channel IN ('sms', 'imessage'))
```

## Files Affected

- `electron/services/folderExportService.ts`

## Priority

HIGH - Critical for audit package completeness

## Depends On

- TASK-1141 (merged) - Attachment export infrastructure
- TASK-1142 (merged) - Text thread PDF generation

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K-50K

**Token Cap:** 200K (4x upper estimate)

**Confidence:** Medium (depends on attachment query complexity)

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-01-20*

### Agent ID

```
Engineer Agent ID: Not available (foreground execution)
```

### Checklist

```
Files modified:
- [x] electron/services/folderExportService.ts
- [x] electron/services/__tests__/folderExportService.test.ts

Features implemented:
- [x] Text attachments in attachments/ folder
- [x] Manifest includes text attachment metadata (messageType, messagePreview)
- [x] Inline images in text thread PDFs (base64 encoded)
- [x] Non-image attachments shown as references

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (16/16 tests)
```

### Implementation Details

1. **Part 1: Include text attachments in attachments folder**
   - Updated `exportAttachments()` to receive all communications (emails + texts)
   - Added `messageType` and `messagePreview` fields to `AttachmentManifestEntry`
   - Helper functions to determine message type and get preview text
   - Both email and text attachments now exported with proper metadata

2. **Part 2: Inline images in text thread PDFs**
   - Added `getAttachmentsForMessage()` helper to query attachments table
   - Updated `generateTextMessageHTML()` to embed images as base64
   - Added CSS styles for `.attachment-image` and `.attachment-ref`
   - Non-image attachments show as `[Attachment: filename]` references
   - Images that fail to load show placeholder text

3. **Tests Added**
   - CSS styles verification for attachment classes
   - Text folder creation when exporting texts

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

```
SR Engineer Agent ID: <agent_id>
```
