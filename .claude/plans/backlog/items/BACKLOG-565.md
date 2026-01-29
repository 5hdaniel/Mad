# BACKLOG-565: macOS Import Source Selector

**Created**: 2026-01-28
**Updated**: 2026-01-29
**Source**: User request
**Priority**: Medium
**Status**: Backlog (moved from SPRINT-065)

---

## Description

Add a Settings option for macOS users to choose their import source for messages and contacts:

- **Option A (Default):** Import from macOS Messages database + Contacts app (current behavior)
- **Option B:** Sync from connected iPhone (same experience as Windows users)

## Problem Statement

Currently, macOS users can only import messages from the local macOS Messages database. Some users prefer the iPhone sync method because:
1. They don't use Messages on Mac (only on iPhone)
2. Their Mac's Messages database may be out of sync
3. They want consistency with their Windows workflow

Windows users already have iPhone sync. This feature gives macOS users the same flexibility.

## Acceptance Criteria

- [ ] macOS Settings shows "Import Source" option under Messages section
- [ ] Two radio options: "macOS Messages + Contacts" and "iPhone Sync"
- [ ] Default is "macOS Messages + Contacts" (current behavior preserved)
- [ ] iPhone Sync option shows connection instructions
- [ ] Preference persists across app restarts
- [ ] Auto-import respects the selected source
- [ ] Manual import respects the selected source
- [ ] Setting only appears on macOS platform

## Technical Notes

- iPhone backup sync infrastructure exists for Windows
- Need to expose existing iPhone sync to macOS users
- May require investigation into whether iPhone backup reading works on macOS
- New component: ImportSourceSettings.tsx
- Updates to: useMacOSMessagesImport hook

## Estimated Effort

~35-50K tokens

## Related

- TASK-1742 (implementation task - moved back to backlog from SPRINT-065)
- SPRINT-065 (original sprint - completed without this task)
- TASK-1710 (MacOSMessagesImportSettings - related component)

## History

| Date | Event |
|------|-------|
| 2026-01-28 | Created and added to SPRINT-065 |
| 2026-01-29 | Moved back to backlog - SPRINT-065 completed with only TASK-1740 |
