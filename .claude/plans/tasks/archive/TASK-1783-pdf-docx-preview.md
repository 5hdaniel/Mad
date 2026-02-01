# Task TASK-1783: Add PDF and DOCX Preview to Attachment Modal

**Sprint:** SPRINT-067
**Phase:** 5 (added mid-sprint)
**Priority:** MEDIUM
**Estimated Tokens:** ~35K
**Token Cap:** 140K
**Depends On:** TASK-1778 (AttachmentPreviewModal - MERGED)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Extend the AttachmentPreviewModal to support inline preview of PDF and DOCX files, in addition to images.

## Current State

- Images: Preview inline using data: URLs (working)
- PDFs: Shows fallback UI with "Open with System Viewer" button
- DOCX: Shows fallback UI with "Open with System Viewer" button

## Desired State

- Images: Preview inline (unchanged)
- PDFs: Preview inline using PDF.js or similar
- DOCX: Preview inline using mammoth.js or convert to HTML

## Deliverables

1. **Install:** PDF preview library (react-pdf or pdf.js)
2. **Install:** DOCX preview library (mammoth.js)
3. **Update:** AttachmentPreviewModal to render PDF/DOCX inline
4. **Keep:** "Open with System Viewer" as fallback option

## Acceptance Criteria

- [ ] PDF files display inline with page navigation
- [ ] DOCX files display inline (converted to HTML)
- [ ] "Open with System Viewer" button still available for all types
- [ ] Loading states while rendering large files
- [ ] Error handling if preview fails
- [ ] All CI checks pass

## Implementation Notes

### PDF Preview with react-pdf

```bash
npm install react-pdf
```

```typescript
import { Document, Page, pdfjs } from 'react-pdf';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// In component
{isPdf && (
  <Document
    file={dataUrl}
    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    onLoadError={(error) => setPdfError(error)}
    loading={<LoadingSpinner />}
  >
    <Page pageNumber={pageNumber} />
  </Document>
)}
```

### DOCX Preview with mammoth

```bash
npm install mammoth
```

```typescript
import mammoth from 'mammoth';

// Read file as ArrayBuffer and convert to HTML
const arrayBuffer = await readFileAsArrayBuffer(storagePath);
const result = await mammoth.convertToHtml({ arrayBuffer });
setDocxHtml(result.value);

// Render
{isDocx && docxHtml && (
  <div
    className="prose max-w-none"
    dangerouslySetInnerHTML={{ __html: docxHtml }}
  />
)}
```

### IPC Handler for File Buffer

Need to add IPC handler to read file as base64/ArrayBuffer for mammoth:

```typescript
ipcMain.handle("attachments:get-buffer", async (event, storagePath) => {
  const buffer = fs.readFileSync(storagePath);
  return { success: true, data: buffer.toString('base64') };
});
```

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add react-pdf, mammoth dependencies |
| `electron/transaction-handlers.ts` | Add `attachments:get-buffer` handler |
| `electron/preload/transactionBridge.ts` | Add bridge method |
| `src/components/.../AttachmentPreviewModal.tsx` | Add PDF/DOCX rendering |

## Security Considerations

- DOCX HTML rendering uses dangerouslySetInnerHTML - sanitize output
- PDF.js runs in sandbox - should be safe
- Only allow preview for files in app data directory (existing validation)

---

## Branch Information

**Branch From:** `int/SPRINT-067`
**Branch Name:** `feature/TASK-1783-pdf-docx-preview`
