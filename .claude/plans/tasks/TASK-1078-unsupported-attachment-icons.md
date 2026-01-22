# TASK-1078: Show File Icon for Unsupported Attachments

**Backlog ID:** BACKLOG-298
**Sprint:** TBD (Quick Win - can be added to current sprint)
**Phase:** Single phase
**Branch:** `feature/task-1078-unsupported-attachment-icons`
**Estimated Turns:** 3-5
**Estimated Tokens:** ~15K

---

## Objective

Make non-displayable attachments (HEIC images, videos, PDFs, etc.) visible in ConversationViewModal by showing a file icon with filename, clickable to open the file in the system's default application.

---

## Context

Currently, `ConversationViewModal.tsx` filters attachments to only show displayable images via `isDisplayableImage()`. This function:
- Accepts only `image/*` MIME types
- Explicitly excludes HEIC (common iPhone photo format)

As a result, HEIC photos, videos (`.mov`, `.mp4`), and other file types are completely invisible to users - they have no indication these attachments exist.

The existing `showInFolder` IPC handler uses `shell.showItemInFolder()` which reveals the file in Finder/Explorer. We need a similar handler using `shell.openPath()` to actually open the file in its default application.

---

## Requirements

### Must Do:
1. Modify `displayableAttachments` filter to keep ALL attachments (rename to just `attachments` or similar)
2. For non-displayable attachments, render a file placeholder component instead of the image
3. File placeholder should show:
   - A generic file icon (consider type-specific icons for video/image types)
   - The filename
   - Click handler that opens the file
4. Add `openFile` IPC handler using `shell.openPath()`
5. Add `openFile` method to systemBridge

### Must NOT Do:
- Convert HEIC images (out of scope - just show icon)
- Embed video player (out of scope - just open externally)
- Change how displayable images are rendered (keep existing behavior)
- Add complex thumbnail generation

---

## Acceptance Criteria

- [ ] HEIC attachments show file icon with filename
- [ ] Video attachments (mov, mp4, webm) show file icon with filename
- [ ] Clicking file icon opens file in system default app
- [ ] Displayable images still render inline as before
- [ ] TypeScript compiles without errors
- [ ] No regressions in existing attachment display

---

## Files to Modify

- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx`
  - Remove/modify `displayableAttachments` filter to include all attachments
  - Add `FileAttachment` component for non-displayable files
  - Add click handler to call `window.api.system.openFile()`

- `electron/preload/systemBridge.ts`
  - Add `openFile: (filePath: string) => ipcRenderer.invoke("system:open-file", filePath)`

- `electron/system-handlers.ts`
  - Add `system:open-file` handler using `shell.openPath(filePath)`

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Current attachment rendering logic (lines 82-143, 344-349)
- `electron/preload/systemBridge.ts` - Pattern for IPC methods (see `showInFolder` on line 250)
- `electron/system-handlers.ts` - Pattern for handlers (see `system:show-in-folder` on lines 911-951)

---

## Implementation Guidance

### 1. IPC Handler (system-handlers.ts)

Add near existing `system:show-in-folder` handler:

```typescript
/**
 * Open file in system default application
 */
ipcMain.handle(
  "system:open-file",
  async (
    event: IpcMainInvokeEvent,
    filePath: string,
  ): Promise<SystemResponse> => {
    try {
      const validatedPath = validateString(filePath, "filePath", {
        required: true,
        maxLength: 2000,
      });

      if (!validatedPath) {
        return { success: false, error: "File path is required" };
      }

      const errorMessage = await shell.openPath(validatedPath);
      if (errorMessage) {
        return { success: false, error: errorMessage };
      }
      return { success: true };
    } catch (error) {
      // ... error handling similar to show-in-folder
    }
  },
);
```

### 2. System Bridge (systemBridge.ts)

Add method:

```typescript
/**
 * Opens a file in the system default application
 * @param filePath - Absolute path to the file to open
 * @returns Result indicating success or failure
 */
openFile: (filePath: string) =>
  ipcRenderer.invoke("system:open-file", filePath),
```

### 3. FileAttachment Component (ConversationViewModal.tsx)

Create component:

```typescript
function FileAttachment({
  attachment,
  isOutbound,
}: {
  attachment: MessageAttachmentInfo;
  isOutbound: boolean;
}): React.ReactElement {
  const handleClick = async () => {
    // Attachments have file_path or need to be extracted
    // For now, show the filename - actual path may need API lookup
    if (window.api?.system?.openFile && attachment./* path field */) {
      await window.api.system.openFile(attachment./* path field */);
    }
  };

  // Determine icon based on mime_type
  const isVideo = attachment.mime_type?.startsWith("video/");
  const isHeic = attachment.mime_type?.includes("heic");

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
        isOutbound ? "bg-green-600" : "bg-white border"
      }`}
      onClick={handleClick}
    >
      {/* Icon - could use Heroicons or similar */}
      <svg className="w-8 h-8 text-gray-500" /* file/video icon *//>
      <span className="text-sm truncate max-w-[200px]">
        {attachment.filename || "Attachment"}
      </span>
    </div>
  );
}
```

### 4. Modify Attachment Rendering

Change from:
```typescript
const displayableAttachments = messageAttachments.filter((att) =>
  isDisplayableImage(att.mime_type)
);
```

To render ALL attachments, using `isDisplayableImage()` to choose component:
```typescript
{messageAttachments.map((att) => (
  isDisplayableImage(att.mime_type) ? (
    <AttachmentImage key={att.id} attachment={att} isOutbound={isOutbound} />
  ) : (
    <FileAttachment key={att.id} attachment={att} isOutbound={isOutbound} />
  )
))}
```

---

## Testing Expectations

### Unit Tests
- **Required:** Optional for this task (UI component + IPC handler)
- **New tests to write:** Consider basic test for FileAttachment component render
- **Existing tests to update:** None expected

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(attachments): show file icon for unsupported attachment types`
- **Branch:** `feature/task-1078-unsupported-attachment-icons`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: 3-5)
- **Actual Tokens**: ~XK (Est: ~15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Attachment records don't have file path information (need API lookup?)
- HEIC/video icons are not available in current icon set
- IPC security concerns arise (path validation, sandboxing)
- You encounter blockers not covered in the task file

---

## Investigation Notes

The attachment data structure includes:
- `id`, `message_id`, `filename`, `mime_type`, `file_size_bytes`, `data`

Need to verify: Do attachments have a `file_path` field, or is the file data stored as base64 in `data`? If only base64 data is available, we may need to:
1. Write to temp file before opening, OR
2. Look up original file path from database

Check `MessageAttachmentInfo` interface and database schema for available fields.
