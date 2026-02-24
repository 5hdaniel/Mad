# BACKLOG-764: Message Formatting Helpers Duplicated in Renderer

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

Two message formatting functions duplicated in renderer:

**isEmptyOrReplacementChar():**
- `ConversationViewModal.tsx`
- `MessageBubble.tsx`

**formatMessageTime():**
- `ConversationViewModal.tsx`
- `MessageBubble.tsx`

Extract into `src/utils/messageFormatUtils.ts`.

## Acceptance Criteria

- [ ] Single shared implementations in `src/utils/messageFormatUtils.ts`
- [ ] Both components import from shared module
- [ ] No local copies remain
