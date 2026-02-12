# Task TASK-1776: Display Email Attachments in UI

**Sprint:** SPRINT-067
**Phase:** 2
**Priority:** HIGH
**Estimated Tokens:** ~35K
**Token Cap:** 140K
**Depends On:** TASK-1775

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add an attachment section to the EmailViewModal that displays the list of attachments for the email, with filename, size, type icon, and download/open capability.

## Non-Goals

- Do NOT implement inline image preview (that's TASK-1778)
- Do NOT modify the attachment download service (that's TASK-1775)
- Do NOT modify export functionality (that's TASK-1777)
- Do NOT implement drag-and-drop file save
- Do NOT implement attachment search/filtering

## Deliverables

1. **New:** `src/components/transactionDetailsModule/hooks/useEmailAttachments.ts` - Hook to fetch attachment data
2. **New:** `src/components/transactionDetailsModule/components/EmailAttachmentList.tsx` - Attachment list component
3. **Update:** `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx` - Add attachment section
4. **Update:** `electron/preload.ts` - Add IPC for attachment file operations
5. **Update:** `electron/preload/transactionBridge.ts` - Expose attachment methods

## Acceptance Criteria

- [ ] EmailViewModal shows attachment section when email has attachments
- [ ] Attachment list displays filename, file size, and type icon
- [ ] Clicking attachment triggers download/open via system handler
- [ ] Missing attachments (not downloaded) show "Download" button
- [ ] Loading state shown while fetching attachment list
- [ ] Empty state shown when email has no attachments (section hidden)
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Hook: useEmailAttachments

```typescript
// src/components/transactionDetailsModule/hooks/useEmailAttachments.ts
import { useState, useEffect, useCallback } from "react";

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string | null;  // null if not downloaded
}

interface UseEmailAttachmentsResult {
  attachments: EmailAttachment[];
  loading: boolean;
  error: string | null;
  openAttachment: (attachmentId: string) => Promise<void>;
  downloadAttachment: (attachmentId: string) => Promise<void>;
}

export function useEmailAttachments(emailId: string): UseEmailAttachmentsResult {
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAttachments() {
      setLoading(true);
      try {
        const result = await window.api.attachments.getByEmailId(emailId);
        if (result.success) {
          setAttachments(result.attachments);
        } else {
          setError(result.error || "Failed to load attachments");
        }
      } catch (err) {
        setError("Failed to load attachments");
      } finally {
        setLoading(false);
      }
    }

    if (emailId) {
      loadAttachments();
    }
  }, [emailId]);

  const openAttachment = useCallback(async (attachmentId: string) => {
    await window.api.attachments.openFile(attachmentId);
  }, []);

  const downloadAttachment = useCallback(async (attachmentId: string) => {
    await window.api.attachments.downloadAndOpen(attachmentId);
  }, []);

  return { attachments, loading, error, openAttachment, downloadAttachment };
}
```

### Component: EmailAttachmentList

```typescript
// src/components/transactionDetailsModule/components/EmailAttachmentList.tsx
import React from "react";
import { Paperclip, Download, FileText, Image, File } from "lucide-react";
import type { EmailAttachment } from "../hooks/useEmailAttachments";

interface EmailAttachmentListProps {
  attachments: EmailAttachment[];
  onOpen: (attachmentId: string) => void;
  onDownload: (attachmentId: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return File;
};

export function EmailAttachmentList({
  attachments,
  onOpen,
  onDownload,
}: EmailAttachmentListProps): React.ReactElement {
  if (attachments.length === 0) {
    return <></>;
  }

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
        <Paperclip className="w-4 h-4" />
        Attachments ({attachments.length})
      </h4>
      <div className="space-y-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.mimeType);
          const hasFile = att.storagePath !== null;

          return (
            <div
              key={att.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {att.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(att.size)}
                  </p>
                </div>
              </div>
              {hasFile ? (
                <button
                  onClick={() => onOpen(att.id)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  Open
                </button>
              ) : (
                <button
                  onClick={() => onDownload(att.id)}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Update EmailViewModal

Add attachment section to `EmailViewModal.tsx`:

```typescript
// In EmailViewModal.tsx
import { useEmailAttachments } from "../hooks/useEmailAttachments";
import { EmailAttachmentList } from "../EmailAttachmentList";

export function EmailViewModal({
  email,
  onClose,
  onRemoveFromTransaction,
}: EmailViewModalProps): React.ReactElement {
  // Get the email_id from the communication record
  const emailId = email.email_id || email.id;

  const {
    attachments,
    loading: attachmentsLoading,
    openAttachment,
    downloadAttachment,
  } = useEmailAttachments(emailId);

  // ... existing code ...

  return (
    <div className="fixed inset-0 ...">
      {/* ... existing header and metadata ... */}

      {/* Email Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ... existing body content ... */}

        {/* Attachments Section */}
        {email.has_attachments && (
          <>
            {attachmentsLoading ? (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm text-gray-500">Loading attachments...</p>
              </div>
            ) : (
              <EmailAttachmentList
                attachments={attachments}
                onOpen={openAttachment}
                onDownload={downloadAttachment}
              />
            )}
          </>
        )}
      </div>

      {/* ... existing footer ... */}
    </div>
  );
}
```

### IPC Handlers

Add to `electron/preload.ts`:

```typescript
attachments: {
  getByEmailId: (emailId: string) =>
    ipcRenderer.invoke("attachments:getByEmailId", emailId),
  openFile: (attachmentId: string) =>
    ipcRenderer.invoke("attachments:openFile", attachmentId),
  downloadAndOpen: (attachmentId: string) =>
    ipcRenderer.invoke("attachments:downloadAndOpen", attachmentId),
}
```

Add handlers in main process:

```typescript
ipcMain.handle("attachments:getByEmailId", async (event, emailId: string) => {
  const db = databaseService.getRawDatabase();
  const attachments = db.prepare(`
    SELECT id, filename, mime_type as mimeType, file_size_bytes as size, storage_path as storagePath
    FROM attachments
    WHERE message_id = ?
  `).all(emailId);

  return { success: true, attachments };
});

ipcMain.handle("attachments:openFile", async (event, attachmentId: string) => {
  const db = databaseService.getRawDatabase();
  const att = db.prepare("SELECT storage_path FROM attachments WHERE id = ?").get(attachmentId);

  if (att?.storage_path) {
    await shell.openPath(att.storage_path);
    return { success: true };
  }
  return { success: false, error: "File not found" };
});
```

### Type Definitions

Add to `src/window.d.ts`:

```typescript
interface WindowApi {
  // ... existing
  attachments: {
    getByEmailId: (emailId: string) => Promise<{
      success: boolean;
      attachments?: Array<{
        id: string;
        filename: string;
        mimeType: string;
        size: number;
        storagePath: string | null;
      }>;
      error?: string;
    }>;
    openFile: (attachmentId: string) => Promise<{ success: boolean; error?: string }>;
    downloadAndOpen: (attachmentId: string) => Promise<{ success: boolean; error?: string }>;
  };
}
```

## Integration Notes

- **Imports from:** `window.api.attachments` (IPC bridge)
- **Exports to:** EmailViewModal uses the components
- **Used by:** Users viewing emails with attachments
- **Depends on:** TASK-1775 (attachment download service must be complete)

## Do / Don't

### Do:
- Show loading state while fetching attachments
- Use appropriate file type icons (image, PDF, generic)
- Format file sizes in human-readable format
- Handle missing files gracefully (show download option)
- Use Electron's shell.openPath for opening files

### Don't:
- Don't show attachment section if email has no attachments
- Don't block the modal from opening while loading attachments
- Don't implement inline preview (that's TASK-1778)
- Don't hardcode file paths (use database records)

## When to Stop and Ask

- If the attachment query returns unexpected data structure
- If shell.openPath doesn't work on all platforms
- If email_id vs message_id linking is unclear
- If performance issues arise with many attachments

## Testing Expectations

### Unit Tests

**Required:** Yes

**New tests to write:**
- `src/components/transactionDetailsModule/hooks/__tests__/useEmailAttachments.test.ts`
  - Test loading state
  - Test successful fetch
  - Test error handling
  - Test openAttachment callback
- `src/components/transactionDetailsModule/components/__tests__/EmailAttachmentList.test.tsx`
  - Test render with attachments
  - Test render empty (hidden)
  - Test file size formatting
  - Test icon selection by mime type
  - Test click handlers

**Existing tests to update:**
- `EmailViewModal.test.tsx` - Add tests for attachment section

### Coverage
- Coverage impact: Should increase with new components

### CI Requirements
- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title:** `feat(email): display email attachments in EmailViewModal`
- **Labels:** `email`, `attachments`, `ui`
- **Depends on:** TASK-1775

---

## PM Estimate (PM-Owned)

**Category:** `ui` (apply 1.0x multiplier)

**Estimated Tokens:** ~35K

**Token Cap:** 140K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| New hook | useEmailAttachments | +8K |
| New component | EmailAttachmentList | +8K |
| Modal update | EmailViewModal changes | +5K |
| IPC handlers | Preload and main process | +6K |
| Type definitions | window.d.ts | +3K |
| Tests | Component and hook tests | +5K |

**Confidence:** High

---

## Branch Information (Set by SR Engineer during Technical Review)

**Branch From:** develop (after TASK-1775 merges)
**Branch Into:** develop
**Branch Name:** feature/TASK-1776-display-email-attachments

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] src/components/transactionDetailsModule/hooks/useEmailAttachments.ts
- [ ] src/components/transactionDetailsModule/components/EmailAttachmentList.tsx
- [ ] src/components/.../hooks/__tests__/useEmailAttachments.test.ts
- [ ] src/components/.../components/__tests__/EmailAttachmentList.test.tsx

Files modified:
- [ ] src/components/.../modals/EmailViewModal.tsx
- [ ] electron/preload.ts
- [ ] src/window.d.ts
- [ ] Main process handlers

Features implemented:
- [ ] Attachment list display
- [ ] File size formatting
- [ ] Type icons
- [ ] Open file functionality
- [ ] Download button for missing files

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document any>

**Issues encountered:**
<Document any>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

```
SR Engineer Agent ID: <agent_id>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
