# BACKLOG-761: formatDate/formatDateTime Duplicated in Export Services

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

`formatDate()` and `formatDateTime()` are defined as closures inside class methods in both export services:
- `pdfExportService.ts:184` (`formatDate`), `pdfExportService.ts:195` (`formatDateTime`)
- `folderExportService.ts:290` (`formatDate`)

This is despite `electron/utils/dateUtils.ts` already existing (though it only has `formatDateForFilename`). Extract into `electron/utils/exportUtils.ts` or extend `dateUtils.ts`.

## Acceptance Criteria

- [ ] `formatDate()` and `formatDateTime()` exist in a single shared module
- [ ] Both export services import from shared module
- [ ] No duplicate closures remain
