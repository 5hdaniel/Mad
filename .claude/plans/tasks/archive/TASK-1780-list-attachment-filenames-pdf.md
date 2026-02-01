# TASK-1780: List Attachment Filenames in Export PDF

**Sprint:** SPRINT-067 - Email Attachments for Audits
**Priority:** HIGH
**Estimated Tokens:** ~15K
**Status:** MERGED
**PR:** #701
**Branch:** feature/TASK-1780-list-attachment-filenames-pdf

---

## Goal

Update the PDF export to list actual attachment filenames instead of just showing a count and generic message. Users need to see which files are available in the attachments folder.

## Current Behavior

In the exported PDF, emails with attachments show:
```
Attachments (5)
Attachments are available in the /attachments folder
```

## Desired Behavior

List each attachment filename so users can find them:
```
Attachments (5)
- contract_v2.pdf (1.2 MB)
- property_photo.jpg (256 KB)
- disclosure.pdf (89 KB)
- inspection_report.pdf (2.1 MB)
- addendum.docx (45 KB)
```

## Implementation

**File:** `electron/services/folderExportService.ts`

1. In `generateEmailHtml()` method, when rendering attachments section:
   - Query attachments for the email using `email_id`
   - List each filename with size
   - Format as bulleted list

2. Update the CSS for attachment list styling

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/folderExportService.ts` | Update email HTML generation to list attachment filenames |

## Acceptance Criteria

- [ ] PDF shows list of attachment filenames instead of generic message
- [ ] Each filename shows file size in human-readable format
- [ ] Works for both email and text message attachments
- [ ] Filenames match those in the /attachments folder
- [ ] All CI checks pass

## Dependencies

- TASK-1777 (Include Email Attachments in Export) - MERGED
