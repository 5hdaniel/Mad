# BACKLOG-332: Audit Package Missing Attachments and Text Messages

## Summary

The audit package export is missing actual attachments and text messages. Currently only shows a manifest file.

## Problem

When exporting an audit package:
1. **Attachments folder** - Only contains a manifest, no actual attachment files
2. **Text messages** - Not included at all

## Requirements

### Attachments
- Export actual attachment files to the attachments folder
- Maintain manifest for reference

### Text Messages
- Export text message threads as individual files (one file per thread)
- Format should match the PDF export styling (conversation view)
- Each thread file should include:
  - Contact name and phone number
  - All messages in the thread with timestamps
  - Sender identification (You vs contact name)

## Expected Output Structure

```
audit-package/
├── manifest.json
├── transaction-summary.pdf
├── attachments/
│   ├── manifest.json
│   ├── document1.pdf
│   ├── image1.jpg
│   └── ...
├── emails/
│   └── ... (if applicable)
└── text-messages/
    ├── thread-1-contact-name.pdf (or .txt/.html)
    ├── thread-2-contact-name.pdf
    └── ...
```

## Files Likely Affected

- Audit package export service (needs investigation)
- May need to create new text message export functionality

## Priority

High - Audit package is incomplete without actual content

## Created

2026-01-19
