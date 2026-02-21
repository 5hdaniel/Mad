# BACKLOG-758: escapeHtml() Duplicated in Export Services

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

`escapeHtml(text: string): string` has 2 functionally identical implementations with different coding styles:
- `pdfExportService.ts:587` -- sequential `.replace()` chains
- `folderExportService.ts:2377` -- single regex with lookup map

Both produce identical output. Extract into `electron/utils/exportUtils.ts`.

Note: `sanitizeHtml()` is NOT the same function and is intentionally different between services (one strips cid: image refs). Do not consolidate sanitizeHtml.

## Acceptance Criteria

- [ ] Single shared implementation in `electron/utils/exportUtils.ts`
- [ ] Both export services import from shared module
- [ ] No local copies remain
