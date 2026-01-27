# BACKLOG-545: Attachments not exported in package

**Category:** Bug - Export
**Priority:** P2 (functional bug - incomplete export)
**Status:** Pending
**Created:** 2026-01-27

## Problem

When exporting a transaction to a package file, attachments from emails and messages are not included in the export. Users expect all associated attachments (documents, images, etc. from emails and text messages) to be part of the exported audit package, but currently only the message content and metadata are exported.

### Impact

- Users cannot share complete audit packages with stakeholders
- Missing attachments require manual re-gathering of supporting documents
- Reduces perceived completeness of exported audits
- May result in incomplete audit trails when shared externally

### Related Issues

- BACKLOG-451: Export Transaction to Package (completed - initial export feature)
- BACKLOG-452: Export to PDF format enhancements

## Current Behavior

Export package includes:
- Transaction metadata
- Associated emails and messages (text content only)
- Contact information
- Audit notes

Export package does NOT include:
- Email attachments
- Message attachments (photos, files)
- Attachment metadata

## Proposed Solution

### Phase 1: Identify Attachment Sources

1. Map where attachments are stored:
   - Email attachments (via Microsoft Graph API)
   - Message attachments (from iPhone sync)
   - Local file references in database

2. Understand current storage/caching:
   - Are attachments cached locally?
   - How are they referenced in the database?
   - Access patterns in export flow

### Phase 2: Add Attachment Collection to Export

1. Modify export service to:
   - Collect attachment references for all messages/emails
   - Fetch attachment data (from cache or API if needed)
   - Package attachments in export folder structure

2. Define export structure:
   ```
   export-package/
   ├── transaction.json
   ├── messages/
   │   ├── message-1.json
   │   └── attachments/
   │       ├── document.pdf
   │       └── image.jpg
   └── emails/
       ├── email-1.json
       └── attachments/
           └── receipt.pdf
   ```

### Phase 3: Handle Edge Cases

1. Large attachment handling:
   - Set size limits for export package
   - Provide warning if attachments are very large
   - Consider compression options

2. Missing attachments:
   - Handle cases where attachment no longer accessible (API deleted, cache cleared)
   - Log which attachments couldn't be included
   - Continue export without failing

3. Permission/access issues:
   - Handle OAuth token expiration gracefully
   - Verify attachment access before including

## Acceptance Criteria

- [ ] Attachments from emails are included in export package
- [ ] Attachments from messages are included in export package
- [ ] Attachment folder structure is organized and clear
- [ ] Export handles missing/inaccessible attachments gracefully
- [ ] Export size is reasonable (warn if >50MB)
- [ ] Exported attachments maintain original filename/type
- [ ] Documentation updated with new export structure
- [ ] Export flow doesn't block on attachment collection (async/background)
- [ ] No regression in export functionality for non-attachment items

## Technical Considerations

- Attachment API access (Microsoft Graph rate limits, OAuth tokens)
- Local caching strategy for already-downloaded attachments
- Memory management for large exports
- Filename conflicts (multiple attachments with same name)
- File type validation/security (prevent unsafe files in export)

## Estimated Effort

~40K tokens (investigation + implementation + testing)

## Notes

- Discovered during SPRINT-062 new user flow testing
- Should verify with users what attachment types matter most
- Consider if compression is needed for large exports

## Created

2026-01-27
