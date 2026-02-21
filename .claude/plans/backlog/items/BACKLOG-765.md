# BACKLOG-765: getAvatarInitial() -- 3 Slightly Different Versions in Renderer

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

`getAvatarInitial()` has 3 slightly different implementations in renderer components:
- `MessageThreadCard.tsx:38`
- `EmailThreadCard.tsx:48`
- `EmailThreadViewModal.tsx:210`

Differences may include null handling, fallback character, and case normalization. Pick the most robust version and extract into `src/utils/avatarUtils.ts`.

## Acceptance Criteria

- [ ] Single shared implementation in `src/utils/avatarUtils.ts`
- [ ] All 3 components import from shared module
- [ ] No local copies remain
- [ ] Most robust version chosen (handles null, empty string, special chars)
