# BACKLOG-547: Email attachments not included in export package

**Category:** Bug - Export
**Priority:** P2 (functional bug - incomplete export)
**Status:** Pending
**Created:** 2026-01-27

## Problem

When exporting a transaction to a package file, email attachments are not being included in the export. While BACKLOG-545 addressed general attachments export, email attachments from Microsoft Graph/Gmail are not being captured and packaged. Users expect all email attachments to be part of the exported audit package.

### Impact

- Users cannot share complete audit packages when emails contain supporting documents
- Email attachments must be manually re-gathered and attached separately
- Incomplete audit trail when exporting transactions with email communications
- Inconsistency with message attachment export expectations

### Related Issues

- BACKLOG-545: General attachments export (addresses all attachments)
- BACKLOG-451: Export Transaction to Package (initial feature)

## Current Behavior

Export package includes:
- Transaction metadata
- Associated emails (text content and metadata only)
- Message attachments (from text threads)
- Contact information

Export package does NOT include:
- Email attachments from Microsoft Graph API
- Email attachments from Gmail API
- Attachment metadata and references

## Proposed Solution

### Phase 1: Email Attachment Collection

1. Identify email attachment sources:
   - Microsoft Graph: emails with attachments flag
   - Gmail: messages with attachmentData
   - Local cache status (if any)

2. Understand current email sync/caching:
   - How are email attachments currently stored?
   - Are they cached locally or fetched on-demand?
   - Database schema for email-attachment relationships

### Phase 2: Integration with Export Service

1. Modify export flow to:
   - Query for emails linked to transaction
   - For each email with attachments, fetch attachment list
   - Download attachment data (handle API limits)
   - Package in organized structure

2. Define folder structure:
   ```
   export-package/
   └── emails/
       ├── email-1.json
       └── attachments/
           ├── document.pdf
           ├── invoice.xlsx
           └── image.jpg
   ```

### Phase 3: Handle OAuth and Rate Limits

1. Microsoft Graph API considerations:
   - Check token validity before attachment fetch
   - Implement exponential backoff for rate limits
   - Handle attachment size limits

2. Gmail API considerations:
   - Handle attachmentId to binary data mapping
   - Respect API quota

### Phase 4: Edge Cases

1. Missing/inaccessible attachments:
   - Handle deleted emails or revoked attachments
   - Log unavailable attachments
   - Continue export without failing

2. Large attachment handling:
   - Set reasonable export package size limits
   - Warn users if email attachments exceed threshold
   - Option to exclude large attachments

## Acceptance Criteria

- [ ] Email attachments from Microsoft Graph are included in export
- [ ] Email attachments from Gmail are included in export
- [ ] Attachments organized in email-specific subdirectories
- [ ] Original attachment filenames and types preserved
- [ ] Handle unavailable attachments gracefully (log, continue export)
- [ ] OAuth token validation before attachment fetch
- [ ] Export warns if total attachment size exceeds 50MB
- [ ] No regression in export flow for emails without attachments
- [ ] CI/Tests pass (test export with email attachments)

## Technical Considerations

- OAuth token refresh if expired during attachment fetch
- Microsoft Graph batching for multiple attachment requests
- Gmail API attachment data decoding
- Memory management for large email attachment collections
- Filename collision handling (duplicate names across emails)
- Attachment type validation for security
- Concurrent vs sequential attachment downloads

## Estimated Effort

~25K tokens (discovery + implementation + testing)

Note: This is a subset of BACKLOG-545 focused specifically on email attachments. May be smaller scope once general attachment export is completed.

## Notes

- Discovered during SPRINT-062 testing
- Separate from general attachments (BACKLOG-545) because email attachments have API-specific concerns
- Confirm with users which email providers are priority (Gmail vs Exchange)

## Created

2026-01-27
