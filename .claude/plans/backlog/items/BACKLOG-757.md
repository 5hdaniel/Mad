# BACKLOG-757: formatFileSize() Duplicated in 4 Renderer Components

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Refactor               |
| **Area**    | UI                     |
| **Priority**| Low                    |
| **Status**  | Pending                |
| **Created** | 2026-02-21             |
| **Sprint**  | SPRINT-090             |
| **Task**    | TASK-2029              |

## Description

`formatFileSize(bytes: number): string` is duplicated identically in 4 renderer components:
- `AttachmentCard.tsx:15`
- `EmailViewModal.tsx:27`
- `AttachmentPreviewModal.tsx:42`
- `EmailThreadViewModal.tsx:29`

Extract into `src/utils/formatUtils.ts`.

## Acceptance Criteria

- [ ] Single shared implementation in `src/utils/formatUtils.ts`
- [ ] All 4 components import from shared module
- [ ] No local copies remain
