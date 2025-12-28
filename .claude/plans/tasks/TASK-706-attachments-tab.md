# Task TASK-706: Add Attachments/Items Tab to Transaction Details

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Add a new "Attachments" or "Items" tab to the Transaction Details view that displays all attachments from emails associated with the transaction, allowing users to view, download, and manage documents related to their real estate transactions.

## Non-Goals

- Do NOT implement attachment preview (just list and download)
- Do NOT modify the email fetching logic
- Do NOT add attachment upload functionality
- Do NOT create OCR or document parsing

## Deliverables

1. New file: `src/components/transactionDetailsModule/components/TransactionAttachmentsTab.tsx`
2. New file: `src/components/transactionDetailsModule/hooks/useTransactionAttachments.ts`
3. New file: `src/components/transactionDetailsModule/components/AttachmentCard.tsx`
4. Update: `src/components/transactionDetailsModule/types.ts` - Add "attachments" to TransactionTab
5. Update: `src/components/transactionDetailsModule/components/TransactionTabs.tsx` - Add tab
6. Update: `src/components/transactionDetailsModule/TransactionDetails.tsx` - Add tab case

## Acceptance Criteria

- [ ] New "Attachments" tab appears in transaction details view
- [ ] Tab displays all attachments from emails linked to the transaction
- [ ] Each attachment shows: filename, file type icon, size, source email subject
- [ ] Attachments can be downloaded/opened
- [ ] Empty state shown when no attachments exist
- [ ] Attachments grouped by email or shown in chronological order
- [ ] File type icons for common types (PDF, DOC, XLS, images)
- [ ] Loading state while fetching attachments
- [ ] All CI checks pass

## Implementation Notes

### Tab Type Update

```typescript
// types.ts
export type TransactionTab = "details" | "contacts" | "messages" | "attachments";
```

### Attachment Data Structure

```typescript
interface TransactionAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  emailId: string;
  emailSubject: string;
  emailDate: string;
  downloadUrl?: string;  // or local path
}
```

### Data Fetching Approach

Use `transactions.getDetails` which returns communications with attachments:

```typescript
const details = await window.api.transactions.getDetails(transaction.id);
const attachments = details.transaction.communications
  .filter(c => c.channel === 'email')
  .flatMap(email => email.attachments || [])
  .map(att => ({
    ...att,
    emailSubject: email.subject,
    emailDate: email.sent_at
  }));
```

### File Type Icons

| Type | Icon |
|------|------|
| PDF | DocumentIcon (red) |
| DOC/DOCX | DocumentIcon (blue) |
| XLS/XLSX | TableIcon (green) |
| Images | PhotoIcon |
| Other | PaperClipIcon |

## Integration Notes

- Imports from: Existing transaction types, communication types
- Similar to: TASK-702 (Messages Tab) - follows same pattern
- Depends on: None (can run parallel with TASK-702 if different files)
- **Shared files with TASK-702:** types.ts, TransactionTabs.tsx, TransactionDetails.tsx

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2025-12-28 | **Status:** APPROVED WITH NOTES

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after TASK-702 merges)
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-706-attachments-tab

### Execution Classification
- **Parallel Safe:** NO - shares files with TASK-702
- **Depends On:** TASK-702 (must merge first - TransactionTab type conflict)
- **Blocks:** None

### Shared File Analysis

| File | Tasks | Risk |
|------|-------|------|
| `types.ts` | TASK-702, TASK-706 | HIGH - TransactionTab union type |
| `TransactionTabs.tsx` | TASK-702, TASK-706 | HIGH - Tab button additions |
| `TransactionDetails.tsx` | TASK-702, TASK-706 | MEDIUM - Tab content switch |

### CRITICAL Technical Corrections

1. **Attachment Data Location:**
   - Attachments are in `Communication.attachment_metadata` (JSON string)
   - `Communication.has_attachments` indicates presence
   - `Communication.attachment_count` provides count
   - **NOT** in a separate `attachments` array on the response

2. **Data Fetching Approach - CORRECTED:**
   ```typescript
   interface EmailAttachment {
     id: string;
     filename: string;
     mimeType: string;
     size: number;
   }

   const details = await window.api.transactions.getDetails(transaction.id);
   const attachments = (details.transaction.communications || [])
     .filter(c => c.channel === 'email' && c.has_attachments)
     .flatMap(email => {
       const metadata = email.attachment_metadata
         ? JSON.parse(email.attachment_metadata) as EmailAttachment[]
         : [];
       return metadata.map(att => ({
         ...att,
         emailId: email.id,
         emailSubject: email.subject || 'No Subject',
         emailDate: email.sent_at
       }));
     });
   ```

3. **MISSING: Attachment Download IPC Handler**
   - `window.api.attachments.download()` does NOT exist
   - Email attachments are stored as API references, not local files
   - **Options for engineer:**
     - A) Display metadata only (filename, size) - no download (simplest)
     - B) Create new IPC handlers to fetch from Gmail/Outlook APIs (complex, scope creep)
   - **RECOMMENDATION:** Start with Option A, defer download to future task

4. **Scope Clarification:**
   - This task should focus on **email attachments only**
   - iOS message attachments are handled separately by iOSMessagesParser
   - Filter by `channel === 'email'`

### Technical Considerations
- Parse `attachment_metadata` JSON carefully (may be null/undefined)
- Handle emails with many attachments (pagination/lazy load if >50)
- File icons should use mimeType, not filename extension
- Consider grouping by email rather than flat list

### Risk Assessment
- **LOW:** UI work follows established patterns
- **MEDIUM:** attachment_metadata JSON parsing edge cases
- **HIGH if download attempted:** Would require new IPC handlers + OAuth token management

## Do / Don't

### Do:
- Follow the same pattern as Messages tab (TASK-702)
- Use consistent styling with other tabs
- Show file sizes in human-readable format (KB, MB)
- Handle missing/broken attachments gracefully

### Don't:
- Implement inline preview (scope creep)
- Fetch attachments separately if already in transaction details
- Block UI while downloading large files

## PR Preparation

- **Title**: `feat(ui): add attachments tab to transaction details`
- **Labels**: `ui`, `enhancement`
- **Depends on**: TASK-702 (to avoid TransactionTab type conflicts)

---

## PM Estimate

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 6-10
- **Tokens:** ~30K-50K
- **Time:** ~1-1.5h

**Similar to:** TASK-702 (Messages Tab Infrastructure)
