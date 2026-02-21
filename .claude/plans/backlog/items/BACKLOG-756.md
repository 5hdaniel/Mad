# BACKLOG-756: normalizePhone Email Bug in 4 Remaining Implementations

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Bug                    |
| **Area**    | Service                |
| **Priority**| Critical               |
| **Status**  | Pending                |
| **Created** | 2026-02-21             |
| **Sprint**  | SPRINT-090             |
| **Task**    | TASK-2028              |

## Description

TASK-2027 (SPRINT-089, PR #907) fixed `normalizePhone()` in `contactResolutionService.ts` to preserve email handles. However, 4 other implementations of the same function still have the email-destroying bug where `email.replace(/\D/g, '') -> ""`:

1. `electron/utils/phoneUtils.ts` `normalizePhoneNumber()` -- used by `contactsService.ts`
2. `electron/utils/phoneNormalization.ts` `normalizePhoneNumber()` -- used by `contact-handlers.ts`, `iosContactsParser.ts`
3. `electron/services/messageMatchingService.ts` `normalizePhone()` -- used by `autoLinkService.ts` (**most dangerous**)
4. `src/utils/threadMergeUtils.ts` `normalizePhone()` -- thread merge utility

The `messageMatchingService.ts` version is the most dangerous because it powers auto-linking messages to transactions. When a contact's iMessage handle is an email, the message silently fails to auto-link.

## Expected Behavior

All `normalizePhone` / `normalizePhoneNumber` functions should preserve email handles (return them lowercased) instead of stripping all non-digit characters.

## Actual Behavior

`normalizePhone("user@icloud.com")` returns `""` (empty string) or `null`, causing:
- Auto-linking failures for email-handle contacts
- Thread merge failures in the UI
- Contact lookup failures during import

## Acceptance Criteria

- [ ] All 4 implementations preserve email handles
- [ ] Existing phone normalization behavior unchanged
- [ ] Tests updated with email handle cases
- [ ] CI passes
