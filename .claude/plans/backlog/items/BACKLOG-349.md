# BACKLOG-349: Share FolderExportProgress Type Across IPC Boundary

**Created**: 2026-01-21
**Priority**: Medium
**Category**: Architecture
**Status**: Pending

---

## Description

The `FolderExportProgress` type is defined inline in `eventBridge.ts` instead of being imported from a shared location. This creates type duplication that can drift over time.

## Source

SR Engineer review (2026-01-21): "New onExportFolderProgress listener added with inline type definition... The type is duplicated from the interface FolderExportProgress in folderExportService.ts."

## Current State

```typescript
// eventBridge.ts (inline definition)
(callback: (progress: { stage: string; current: number; total: number; message: string }) => void)

// folderExportService.ts (proper interface)
interface FolderExportProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}
```

## Expected State

- Export `FolderExportProgress` from `folderExportService.ts` or define in `electron/types/ipc.ts`
- Import and use in `eventBridge.ts`
- Single type definition shared across IPC boundary

## Acceptance Criteria

- [ ] Move/export FolderExportProgress to shared types location
- [ ] Import in eventBridge.ts
- [ ] No inline type definitions for IPC events

## Priority

Medium - Prevents type drift in IPC layer
