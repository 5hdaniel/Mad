# BACKLOG-766: sanitizeFilename() duplicated in 2 files

**Type:** refactor
**Area:** service
**Priority:** Low
**Status:** Pending
**Sprint:** SPRINT-090
**Created:** 2026-02-21

---

## Description

`sanitizeFilename()` is duplicated in two electron service files with slightly different names:

| File | Function | Line |
|------|----------|------|
| `electron/services/emailAttachmentService.ts` | `sanitizeFilename()` | ~63 |
| `electron/services/enhancedExportService.ts` | `_sanitizeFileName()` | ~629 |

Both perform the same operation: strip or replace characters that are invalid in filenames.

## Proposed Fix

Extract to a shared utility. Options:
- `electron/utils/exportUtils.ts` (recently created by TASK-2030 for export utility dedup)
- `electron/utils/fileUtils.ts` (new file, more semantically correct)

Update both services to import from the shared location.

## Task

TASK-2031

## Related Items

- BACKLOG-738 (split oversized service files)
- SPRINT-090 Phase 2b (TASK-2030 created `electron/utils/exportUtils.ts`)
