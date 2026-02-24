# BACKLOG-762: Date Range Formatting Duplicated in Renderer Components

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

Two date range formatting functions duplicated in renderer:

**formatDateRangeLabel():**
- `TransactionMessagesTab.tsx:25`
- `ConversationViewModal.tsx:189`

**formatDateRange():**
- `AttachEmailsModal.tsx:46`
- `EmailThreadCard.tsx:118`

Extract into `src/utils/dateRangeUtils.ts`.

## Acceptance Criteria

- [ ] Single shared implementations in `src/utils/dateRangeUtils.ts`
- [ ] All 4 components import from shared module
- [ ] No local copies remain
