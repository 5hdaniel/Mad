# TASK-1008: Add "Show in Folder" Button After Export

**Backlog ID:** BACKLOG-169
**Sprint:** SPRINT-028
**Phase:** Phase 1 - Quick Fixes (Parallel)
**Branch:** `feature/TASK-1008-show-in-folder`
**Estimated Tokens:** ~5K
**Token Cap:** 20K

---

## Objective

Add a "Show in Folder" button after exporting a transaction that opens Finder (macOS) or File Explorer (Windows) with the exported file selected.

---

## Context

Currently after export:
- Success message shows the file path
- User must manually navigate to the folder

With this change:
- Success message shows file path AND "Show in Folder" button
- Clicking opens the native file browser with file selected

---

## Requirements

### Must Do:
1. Add IPC handler using Electron's `shell.showItemInFolder()`
2. Expose via preload bridge
3. Add button to export success UI
4. Handle cross-platform (macOS + Windows)

### Must NOT Do:
- Change export functionality itself
- Block UI during folder open

---

## Implementation

### Backend (Electron)
```typescript
// In system-handlers.ts
ipcMain.handle("system:show-in-folder", async (event, filePath: string) => {
  const { shell } = require("electron");
  shell.showItemInFolder(filePath);
  return { success: true };
});
```

### Preload Bridge
```typescript
// In systemBridge.ts
showInFolder: (filePath: string) => ipcRenderer.invoke("system:show-in-folder", filePath)
```

### Frontend
```tsx
// In export success component
<button onClick={() => window.api.system.showInFolder(exportPath)}>
  Show in Folder
</button>
```

---

## Acceptance Criteria

- [ ] "Show in Folder" button appears after successful export
- [ ] Button opens Finder on macOS with file selected
- [ ] Button opens File Explorer on Windows with file selected
- [ ] Works for all export formats (PDF, etc.)
- [ ] Handles gracefully if file was moved/deleted

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/system-handlers.ts` | Add `system:show-in-folder` handler |
| `electron/preload/systemBridge.ts` | Expose `showInFolder` method |
| `src/types/electron.d.ts` | Add type definition |
| Export success component | Add "Show in Folder" button |

---

## PR Preparation

- **Title:** `feat(export): add Show in Folder button after export`
- **Branch:** `feature/TASK-1008-show-in-folder`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

| Metric | Value |
|--------|-------|
| Agent ID | `<from Task tool output>` |
| Total Tokens | `<from tokens.jsonl>` |

### Results

- **PR**: [URL]
