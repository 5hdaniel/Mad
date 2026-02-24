# BACKLOG-759: getContactNamesByPhones() Duplicated in Export Services with Inline SQL

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Refactor               |
| **Area**    | Service                |
| **Priority**| Low                    |
| **Status**  | Pending                |
| **Created** | 2026-02-21             |
| **Sprint**  | SPRINT-090             |
| **Task**    | TASK-2030              |

## Description

`getContactNamesByPhones()` is duplicated in both `pdfExportService.ts` and `folderExportService.ts` with inline SQL queries. Both use the safe normalizer (fixed in TASK-2027) but the duplication means any future SQL changes must be applied twice.

Should be consolidated into a single location (either `contactResolutionService.ts` or `electron/utils/exportUtils.ts`).

## Acceptance Criteria

- [ ] SQL logic exists in exactly one place
- [ ] Both export services use the shared version
- [ ] Export output unchanged
