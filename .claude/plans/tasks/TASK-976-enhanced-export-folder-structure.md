# TASK-976: Enhanced Export with Folder Structure

**Sprint**: SPRINT-025-communications-architecture
**Priority**: P1
**Estimate**: 5,000 tokens
**Status**: Not Started
**Depends on**: TASK-975 (Communications Reference Table)

---

## Objective

Create an organized export structure that outputs a complete transaction audit package with separate folders for emails, texts, and attachments.

---

## Target Export Structure

```
Transaction_123_Main_St/
├── Summary_Report.pdf        # Transaction overview + simplified email list
├── emails/
│   ├── 001_2024-01-15_RE_Inspection_Report.pdf    # Full rich HTML email as PDF
│   ├── 002_2024-01-16_Offer_Accepted.pdf
│   └── ...
├── texts/
│   ├── conversation_John_Smith.txt    # Text thread with contact
│   └── ...
└── attachments/
    ├── Inspection_Report.pdf
    ├── Purchase_Agreement.pdf
    └── ...
```

---

## Implementation Steps

### Phase 1: Create Folder Export Service

1. **New file**: `electron/services/folderExportService.ts`
2. **Main function**: `exportTransactionToFolder(transactionId: string, outputPath: string)`

```typescript
interface FolderExportOptions {
  transactionId: string;
  outputPath: string;
  includeEmails: boolean;
  includeTexts: boolean;
  includeAttachments: boolean;
}

async function exportTransactionToFolder(options: FolderExportOptions): Promise<string> {
  // 1. Create folder structure
  // 2. Generate Summary_Report.pdf
  // 3. Export individual emails to emails/
  // 4. Export text conversations to texts/
  // 5. Copy attachments to attachments/
  // Return path to created folder
}
```

### Phase 2: Email PDF Generation

1. **Convert each email to standalone PDF**
2. **Include**:
   - Full HTML rendering (preserve formatting)
   - Header info (From, To, CC, Date, Subject)
   - Attachments listed at bottom
3. **Naming convention**: `{index}_{date}_{sanitized_subject}.pdf`
4. **Use**: Electron's `printToPDF` or a PDF library

```typescript
async function emailToPdf(message: Message, index: number): Promise<Buffer> {
  const html = generateEmailHtml(message);
  return await htmlToPdf(html);
}
```

### Phase 3: Text Conversation Export

1. **Group texts by contact**
2. **Format as readable transcript**:
   ```
   === Conversation with John Smith (+1-555-123-4567) ===
   Transaction: 123 Main St

   [2024-01-15 10:30 AM] John Smith:
   Can we schedule the inspection for Thursday?

   [2024-01-15 10:45 AM] You:
   Thursday works! How about 2pm?

   [2024-01-15 10:47 AM] John Smith:
   Perfect, see you then.
   ```
3. **File naming**: `conversation_{contact_name}.txt`

### Phase 4: Attachment Collection

1. **Collect all attachments from linked messages**
2. **Handle duplicates**: Add suffix if filename exists
3. **Maintain original filenames** where possible
4. **Include metadata file**: `attachments/manifest.json`
   ```json
   {
     "attachments": [
       {
         "filename": "Inspection_Report.pdf",
         "originalMessage": "RE: Inspection Results",
         "date": "2024-01-15",
         "size": 245678
       }
     ]
   }
   ```

### Phase 5: Summary Report Update

1. **Modify existing PDF report** to be the summary
2. **Include**:
   - Transaction overview
   - Contact list with roles
   - Simplified communications list (just title, from, to, date)
   - Reference to full emails in `emails/` folder
3. **Remove**: Full email content from summary (it's in `emails/` now)

### Phase 6: IPC Handler & UI Integration

1. **New IPC handler**: `export:transaction-folder`
2. **UI**: Add "Export to Folder" option alongside existing PDF export
3. **Progress reporting**: Track and report progress for large exports

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `electron/services/folderExportService.ts` | Create | Main export logic |
| `electron/services/emailPdfService.ts` | Create | Convert emails to PDF |
| `electron/services/textExportService.ts` | Create | Export text conversations |
| `electron/export-handlers.ts` | Modify | Add new IPC handler |
| `electron/services/pdfExportService.ts` | Modify | Generate summary report |
| `src/components/TransactionDetails.tsx` | Modify | Add UI button |

---

## Acceptance Criteria

- [ ] Export creates folder with correct structure
- [ ] Summary_Report.pdf contains transaction overview
- [ ] Each email exported as individual PDF with full HTML
- [ ] Text conversations grouped by contact
- [ ] Attachments copied with manifest
- [ ] Progress indicator for large exports
- [ ] Handles special characters in filenames
- [ ] Creates unique filenames for duplicates

---

## Testing

1. **Unit Tests**:
   - Filename sanitization
   - Text conversation formatting
   - Manifest generation

2. **Integration Tests**:
   - Export transaction with mixed emails/texts
   - Export with multiple attachments
   - Export with no texts (emails only)
   - Large export (100+ communications)

---

## Dependencies

- **Requires**: TASK-975 (to access texts via communications table)
- **Uses**: Existing `pdfExportService.ts` for summary
- **May use**: `electron-pdf` or `puppeteer` for HTML->PDF

---

## Notes

After TASK-975, all communications (emails and texts) will be accessible through the unified query pattern:
```sql
SELECT m.* FROM communications c
JOIN messages m ON c.message_id = m.id
WHERE c.transaction_id = ?
```

This task builds on that foundation to create comprehensive export packages.
