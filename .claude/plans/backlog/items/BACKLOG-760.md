# BACKLOG-760: formatCurrency() Duplicated in Export Services

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

`formatCurrency(amount?: number | null): string` is duplicated identically in:
- `pdfExportService.ts:175`
- `folderExportService.ts:281`

Both use `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`. Extract into `electron/utils/exportUtils.ts`.

Note: `enhancedExportService.ts` does NOT have this function (verified via grep).

## Acceptance Criteria

- [ ] Single shared implementation in `electron/utils/exportUtils.ts`
- [ ] Both export services import from shared module
- [ ] No local copies remain
