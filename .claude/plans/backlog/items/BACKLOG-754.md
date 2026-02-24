# BACKLOG-754: Unify channel/communication_type Naming and Add isTextMessage() Helper

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Refactor               |
| **Area**    | Service                |
| **Priority**| Medium                 |
| **Status**  | In Progress            |
| **Created** | 2026-02-20             |
| **Sprint**  | SPRINT-089             |
| **Task**    | TASK-2024              |

---

## Description

The codebase has two competing systems for identifying message channels:

1. **`channel`** (typed): `"email"` | `"sms"` | `"imessage"` -- used on the `Message` type
2. **`communication_type`** (untyped string): `"text"` | `"imessage"` -- used as an API filter parameter

The API filter param uses `"text"` but `Message.channel` uses `"sms"` / `"imessage"`. This caused a bug in `loadCommunications()` where filtering by `c.channel !== "text"` matched nothing because no message has `channel === "text"`.

## Proposed Solution

1. Create a shared `isTextMessage(comm)` helper function that correctly identifies text messages regardless of whether the source uses `channel` or `communication_type`
2. Create a companion `isEmailMessage(comm)` helper for consistency
3. Place helpers in a shared utils file accessible to both `src/` and `electron/` code
4. Update all callers (~10 files across `src/` and `electron/services/`) to use the helpers
5. Deprecate direct `communication_type` string comparisons

## Files Affected

Approximately 10 files across:
- `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts`
- `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts`
- `electron/services/folderExportService.ts`
- `electron/services/enhancedExportService.ts`
- Additional files TBD during implementation

## Acceptance Criteria

- [ ] `isTextMessage()` and `isEmailMessage()` helpers created in a shared utils file
- [ ] All `communication_type === "text"` comparisons replaced with `isTextMessage()`
- [ ] All `channel === "sms" || channel === "imessage"` patterns replaced with `isTextMessage()`
- [ ] No direct `communication_type` string comparisons remain (deprecated)
- [ ] Type-check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] No behavioral changes -- existing functionality preserved

## Estimated Effort

~30K tokens

---

## Related

- TASK-2024: Sprint task for this refactor
- BACKLOG-752 / TASK-2023: Messages tab fix (Phase 4) -- touches some of the same files
- The `loadCommunications()` bug that motivated this cleanup
