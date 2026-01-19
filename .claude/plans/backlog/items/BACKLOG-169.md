# BACKLOG-169: Open Exported Transaction Folder

**Created**: 2026-01-05
**Priority**: Low
**Category**: UX Enhancement
**Status**: Ready

---

## Description

After exporting a transaction, add a button that opens the containing folder in Finder (macOS) or File Explorer (Windows) so users can quickly locate their exported file.

## User Story

As a user, after I export a transaction, I want to be able to click a button to open the folder where the export was saved, so I can easily find and share the exported file.

## Current Behavior

- User exports transaction
- Success message shows the file path
- User must manually navigate to the folder

## Desired Behavior

- User exports transaction
- Success message shows file path AND a "Show in Folder" button
- Clicking the button opens Finder/File Explorer with the file selected

## Technical Approach

### Backend (Electron)

Use Electron's `shell.showItemInFolder(fullPath)` API:

```typescript
// In system-handlers.ts or export-handlers.ts
ipcMain.handle("system:show-in-folder", async (event, filePath: string) => {
  const { shell } = require("electron");
  shell.showItemInFolder(filePath);
  return { success: true };
});
```

### Frontend

Update `ExportSuccessMessage` component or the export modal to include a "Show in Folder" button:

```tsx
<button onClick={() => window.api.system.showInFolder(exportPath)}>
  Show in Folder
</button>
```

## Files to Modify

| File | Change |
|------|--------|
| `electron/system-handlers.ts` | Add `system:show-in-folder` handler |
| `electron/preload/systemBridge.ts` | Expose `showInFolder` method |
| `src/components/ExportModal.tsx` | Add "Show in Folder" button after export |
| `src/components/transactionDetailsModule/components/ExportSuccessMessage.tsx` | Add button (if exists) |

## Acceptance Criteria

- [ ] "Show in Folder" button appears after successful export
- [ ] Button opens Finder on macOS with file selected
- [ ] Button opens File Explorer on Windows with file selected
- [ ] Works for all export formats (PDF, etc.)

## Estimate

~5,000 tokens (simple Electron API usage)

## Notes

- Electron's `shell.showItemInFolder()` is cross-platform and handles both macOS and Windows
- The file must exist for this to work; should handle gracefully if file was moved/deleted
