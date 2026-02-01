# Task TASK-1778: Email Attachment Preview Modal

**Sprint:** SPRINT-067
**Phase:** 3
**Priority:** MEDIUM
**Estimated Tokens:** ~20K
**Token Cap:** 80K
**Depends On:** TASK-1776

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

Create a preview modal that allows users to view image attachments inline without leaving the app, and provides clear download/open options for other file types.

## Non-Goals

- Do NOT implement PDF preview/viewer (too complex, use system viewer)
- Do NOT implement video/audio playback
- Do NOT implement document editing
- Do NOT implement attachment annotations
- Do NOT modify the attachment list component (that's TASK-1776)

## Deliverables

1. **New:** `src/components/transactionDetailsModule/components/modals/AttachmentPreviewModal.tsx` - Preview modal component
2. **Update:** `src/components/transactionDetailsModule/components/EmailAttachmentList.tsx` - Add preview click handler
3. **Update:** `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx` - Integrate preview modal

## Acceptance Criteria

- [ ] Clicking an image attachment opens preview modal with full-size image
- [ ] Preview modal has close button (X) and click-outside-to-close
- [ ] Non-image attachments show file info with "Open with System Viewer" button
- [ ] Modal shows filename and file size
- [ ] Keyboard navigation works (Escape to close)
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Component: AttachmentPreviewModal

```typescript
// src/components/transactionDetailsModule/components/modals/AttachmentPreviewModal.tsx
import React, { useEffect, useState } from "react";
import { X, ExternalLink, Download, Image, FileText, File } from "lucide-react";

interface AttachmentPreviewModalProps {
  attachment: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    storagePath: string | null;
  };
  onClose: () => void;
  onOpenWithSystem: (attachmentId: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function AttachmentPreviewModal({
  attachment,
  onClose,
  onOpenWithSystem,
}: AttachmentPreviewModalProps): React.ReactElement {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const isImage = attachment.mimeType.startsWith("image/");

  // Load image from local path
  useEffect(() => {
    if (isImage && attachment.storagePath) {
      // Convert file path to file:// URL
      setImageUrl(`file://${attachment.storagePath}`);
    }
  }, [isImage, attachment.storagePath]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const getFileIcon = () => {
    if (attachment.mimeType.startsWith("image/")) return Image;
    if (attachment.mimeType === "application/pdf") return FileText;
    return File;
  };

  const Icon = getFileIcon();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {attachment.filename}
              </h3>
              <p className="text-xs text-gray-500">
                {formatFileSize(attachment.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenWithSystem(attachment.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
          {isImage && imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={attachment.filename}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              onError={() => setImageError(true)}
            />
          ) : isImage && imageError ? (
            <div className="text-center py-12">
              <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Failed to load image</p>
              <button
                onClick={() => onOpenWithSystem(attachment.id)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open with System Viewer
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">
                {attachment.filename}
              </p>
              <p className="text-gray-500 mb-4">
                {formatFileSize(attachment.size)}
              </p>
              <button
                onClick={() => onOpenWithSystem(attachment.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <ExternalLink className="w-4 h-4" />
                Open with System Viewer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Update EmailAttachmentList

Add click handler for preview:

```typescript
interface EmailAttachmentListProps {
  attachments: EmailAttachment[];
  onOpen: (attachmentId: string) => void;
  onDownload: (attachmentId: string) => void;
  onPreview: (attachment: EmailAttachment) => void;  // NEW
}

// In the attachment row:
<div
  key={att.id}
  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
  onClick={() => hasFile && onPreview(att)}  // Click row to preview
>
  {/* ... content ... */}
</div>
```

### Update EmailViewModal

Integrate the preview modal:

```typescript
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";

export function EmailViewModal({ ... }): React.ReactElement {
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachment | null>(null);

  // ... existing code ...

  return (
    <>
      <div className="fixed inset-0 ...">
        {/* ... existing modal content ... */}

        <EmailAttachmentList
          attachments={attachments}
          onOpen={openAttachment}
          onDownload={downloadAttachment}
          onPreview={setPreviewAttachment}  // NEW
        />
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onOpenWithSystem={openAttachment}
        />
      )}
    </>
  );
}
```

## Integration Notes

- **Imports from:** `lucide-react` icons
- **Exports to:** Used by EmailViewModal
- **Used by:** Users previewing email attachments
- **Depends on:** TASK-1776 (attachment list must exist)

## Do / Don't

### Do:
- Use file:// URLs for local images (works in Electron)
- Handle image load errors gracefully
- Support keyboard navigation (Escape)
- Show fallback UI for non-previewable files

### Don't:
- Don't try to preview PDFs inline (use system viewer)
- Don't implement video/audio playback
- Don't use base64 encoding for images (use file:// URLs)
- Don't block other modals from rendering

## When to Stop and Ask

- If file:// URLs don't work in the Electron context
- If image loading is blocked by CSP
- If preview causes performance issues with large images
- If z-index conflicts occur with multiple modals

## Testing Expectations

### Unit Tests

**Required:** Yes

**New tests to write:**
- `AttachmentPreviewModal.test.tsx`
  - Test render with image attachment
  - Test render with non-image attachment
  - Test close button click
  - Test escape key handling
  - Test backdrop click to close
  - Test open with system button

**Existing tests to update:**
- `EmailAttachmentList.test.tsx` - Add onPreview prop tests
- `EmailViewModal.test.tsx` - Add preview modal integration tests

### Coverage
- Coverage impact: Should increase with new component

### CI Requirements
- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

## PR Preparation

- **Title:** `feat(email): add attachment preview modal with image support`
- **Labels:** `email`, `attachments`, `ui`
- **Depends on:** TASK-1776

---

## PM Estimate (PM-Owned)

**Category:** `ui` (apply 1.0x multiplier)

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| New modal component | AttachmentPreviewModal | +8K |
| Integration updates | EmailViewModal, AttachmentList | +5K |
| Tests | Modal and integration | +5K |
| Edge cases | Error handling, keyboard | +2K |

**Confidence:** High

---

## Branch Information (Set by SR Engineer during Technical Review)

**Branch From:** develop (after TASK-1776 merges)
**Branch Into:** develop
**Branch Name:** feature/TASK-1778-attachment-preview-modal

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
- [ ] src/.../modals/AttachmentPreviewModal.tsx
- [ ] src/.../modals/__tests__/AttachmentPreviewModal.test.tsx

Files modified:
- [ ] src/.../components/EmailAttachmentList.tsx
- [ ] src/.../modals/EmailViewModal.tsx

Features implemented:
- [ ] Image preview display
- [ ] Non-image fallback UI
- [ ] Close button and escape key
- [ ] Backdrop click to close
- [ ] Open with system button

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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document any>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

```
SR Engineer Agent ID: <agent_id>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
