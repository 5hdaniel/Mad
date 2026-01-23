# BACKLOG-444: Email Attachments Not Displayed, Exported, or Uploaded to Broker Review

## Summary

Email attachments are not being displayed in the UI, included in exports, or uploaded when submitting transactions for broker review. Attachments are critical audit evidence and must be handled like message content.

## Category

Bug / Missing Feature

## Priority

P1 - High (Missing audit evidence)

## Description

### Problem

When emails have attachments (PDFs, images, documents):
1. **UI**: Attachments not shown in email/message view
2. **Export**: Attachments not included in PDF/Excel/JSON exports
3. **Broker Review**: Attachments not uploaded with submission

This means critical transaction documents (contracts, disclosures, inspection reports) attached to emails are missing from audits.

### Expected Behavior

#### 1. UI Display
- Show attachment indicator on emails with attachments
- List attachment names, types, sizes
- Allow preview/download of attachments
- Mockup:
```
┌─────────────────────────────────────────────────┐
│ From: seller@email.com                          │
│ Subject: Signed Purchase Agreement              │
│ Date: Jan 15, 2026                              │
├─────────────────────────────────────────────────┤
│ Hi, please find the signed agreement attached.  │
│                                                 │
│ 📎 Attachments (2):                             │
│   📄 Purchase_Agreement_Signed.pdf (2.3 MB)     │
│   🖼️ Property_Photo.jpg (1.1 MB)                │
│   [Preview] [Download]                          │
└─────────────────────────────────────────────────┘
```

#### 2. Export
- PDF Export: Embed or append attachments
- Excel Export: List attachment metadata, link to files
- JSON Export: Include attachment metadata and base64 or file paths

#### 3. Broker Review Upload
- Upload attachments to Supabase Storage with submission
- Link attachments to submission_attachments table
- Broker can view/download attachments in portal

### Implementation Areas

1. **Email Import**: Ensure attachments are downloaded and stored locally
2. **Database**: Store attachment metadata (filename, type, size, path)
3. **UI Components**: Display attachments in message view
4. **Export Service**: Include attachments in exports
5. **Submission Service**: Upload attachments to cloud storage

### Data Model

Check if `attachments` table exists and is being populated:
```sql
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  local_path TEXT,
  -- ...
);
```

## Acceptance Criteria

- [ ] Email import downloads and stores attachments locally
- [ ] Attachments table populated with metadata
- [ ] UI shows attachment indicator on emails
- [ ] UI lists attachments with name, type, size
- [ ] User can preview/download attachments
- [ ] PDF export includes attachments
- [ ] Broker submission uploads attachments
- [ ] Broker portal displays attachments
- [ ] Attachment size limits enforced (25MB per file per spec)

## Estimated Effort

~40K tokens (spans import, storage, UI, export, submission)

## Dependencies

- May need to check if attachment download was ever implemented
- Supabase Storage bucket for broker uploads

## Related Items

- Email import service
- Message display components
- Export service
- Broker submission service (SPRINT-050)
