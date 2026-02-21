# BACKLOG-763: Email Participant Helpers Duplicated in Renderer

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

Two email participant helper functions duplicated in renderer:

**filterSelfFromParticipants():**
- `AttachEmailsModal.tsx:59`
- `EmailThreadCard.tsx:72`

**formatParticipants():**
- `AttachEmailsModal.tsx:72`
- `EmailThreadCard.tsx:86`

Extract into `src/utils/emailParticipantUtils.ts`.

## Acceptance Criteria

- [ ] Single shared implementations in `src/utils/emailParticipantUtils.ts`
- [ ] Both components import from shared module
- [ ] No local copies remain
