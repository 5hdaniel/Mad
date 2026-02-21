# TASK-2024: Unify channel/communication_type Naming and Add isTextMessage() Helper

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Sprint**       | SPRINT-089                                 |
| **Backlog Item** | BACKLOG-754                                |
| **Type**         | Refactor                                   |
| **Priority**     | Medium                                     |
| **Status**       | Completed                                  |
| **Phase**        | 5                                          |
| **Estimated Tokens** | ~30K                                  |
| **Actual Tokens**    | -                                      |
| **Execution**    | Sequential (depends on Phase 4 PR merged)  |
| **Risk**         | Low                                        |

---

## Problem Statement

The codebase has two competing systems for identifying message channels:

1. **`channel`** (typed): `"email"` | `"sms"` | `"imessage"` -- used on the `Message` type and stored in the database
2. **`communication_type`** (untyped string): `"text"` | `"imessage"` -- used as an API filter parameter and in some service-layer logic

The mismatch caused a bug in `loadCommunications()` where filtering by `c.channel !== "text"` matched nothing -- no message has `channel === "text"` because the typed `channel` field uses `"sms"` and `"imessage"`, not `"text"`.

This refactor creates shared helper functions to abstract this inconsistency and ensure all channel checks are correct and maintainable.

## Branch Information

**Branch From:** develop (after Phase 4 PR #903 merged)
**Branch Into:** develop
**Branch Name:** fix/task-2024-unify-channel-naming

---

## Implementation Plan

### Step 1: Create Shared Helper Functions

Create a shared utility file (location TBD -- likely `src/utils/channelHelpers.ts` or a shared location accessible to both `src/` and `electron/`):

```typescript
/**
 * Determines if a communication is a text message (SMS or iMessage).
 * Handles both channel ("sms"|"imessage") and communication_type ("text"|"imessage") formats.
 */
export function isTextMessage(comm: { channel?: string; communication_type?: string }): boolean {
  if (comm.channel) {
    return comm.channel === 'sms' || comm.channel === 'imessage';
  }
  if (comm.communication_type) {
    return comm.communication_type === 'text' || comm.communication_type === 'imessage';
  }
  return false;
}

/**
 * Determines if a communication is an email message.
 * Handles both channel ("email") and communication_type ("email") formats.
 */
export function isEmailMessage(comm: { channel?: string; communication_type?: string }): boolean {
  if (comm.channel) {
    return comm.channel === 'email';
  }
  if (comm.communication_type) {
    return comm.communication_type === 'email';
  }
  return false;
}
```

### Step 2: Update All Callers

Replace inline channel/communication_type checks with the helpers in all affected files.

---

## Files to Update

| File | Lines | Current Pattern | Replace With |
|------|-------|-----------------|--------------|
| `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` | 39-42, 69 | `communication_type === "text"` or `channel` checks | `isTextMessage()` / `isEmailMessage()` |
| `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts` | 98-103 | `communication_type` checks | `isTextMessage()` / `isEmailMessage()` |
| `electron/services/folderExportService.ts` | 84, 120, 306, 1941, 2526 | `channel === "sms" \|\| channel === "imessage"` or `communication_type` checks | `isTextMessage()` |
| `electron/services/enhancedExportService.ts` | 179, 492, 613 | `channel` / `communication_type` checks | `isTextMessage()` / `isEmailMessage()` |

**Note:** The engineer should also search for any additional occurrences across the codebase:

```bash
# Find all channel/communication_type comparisons
grep -rn 'communication_type.*===\|communication_type.*!==\|\.channel.*===.*"sms"\|\.channel.*===.*"imessage"\|\.channel.*===.*"text"\|\.channel.*===.*"email"' src/ electron/ --include='*.ts' --include='*.tsx'
```

---

## Acceptance Criteria

- [ ] `isTextMessage()` helper created and correctly handles both `channel` and `communication_type` field names
- [ ] `isEmailMessage()` helper created and correctly handles both field names
- [ ] Helpers placed in a shared location importable from both `src/` and `electron/`
- [ ] `useTransactionMessages.ts` updated (lines 39-42, 69)
- [ ] `useTransactionDetails.ts` updated (lines 98-103)
- [ ] `folderExportService.ts` updated (lines 84, 120, 306, 1941, 2526)
- [ ] `enhancedExportService.ts` updated (lines 179, 492, 613)
- [ ] All remaining `communication_type === "text"` comparisons removed (use grep to verify)
- [ ] No behavioral changes -- existing functionality preserved
- [ ] Type-check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)

## Testing Requirements

| Type | Requirement |
|------|-------------|
| **Unit** | Add tests for `isTextMessage()` and `isEmailMessage()` helpers |
| **Unit** | Verify existing tests in affected files still pass |
| **Regression** | Run full test suite -- no behavioral changes expected |
| **Manual** | Messages tab displays correctly (text messages and emails both render) |
| **Manual** | Export (folder and enhanced) correctly categorizes messages |

---

## Estimated Effort

| Category | Base | Multiplier | Estimate |
|----------|------|------------|----------|
| Helper creation | ~5K | x1.0 | ~5K |
| File updates (~10 files) | ~15K | x1.0 | ~15K |
| Testing | ~5K | x1.0 | ~5K |
| SR Review | ~5K | x1.0 | ~5K |
| **Total** | | | **~30K** |

**Soft Cap:** ~120K (4x estimate -- PM will check at this threshold)

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | agent-a4ab73bc |
| **Files Changed** | 10 (1 new helper, 1 new test, 8 updated) |
| **Tests Added** | 24 unit tests for channelHelpers |
| **PR** | TBD |
| **Branch** | fix/task-2024-unify-channel-naming |
| **Merged** | - |

### Files Changed

**New files:**
- `electron/utils/channelHelpers.ts` - `isTextMessage()` and `isEmailMessage()` helpers
- `electron/utils/__tests__/channelHelpers.test.ts` - 24 unit tests

**Updated files (8):**
- `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` - 2 inline filters replaced
- `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts` - 2 inline filters replaced
- `src/components/transactionDetailsModule/hooks/useTransactionAttachments.ts` - 1 inline filter replaced
- `src/components/transactionDetailsModule/components/EmailThreadCard.tsx` - 2 inline filters replaced
- `src/components/TransactionDetails.tsx` - 1 inline filter replaced
- `electron/services/enhancedExportService.ts` - 6 inline filters replaced
- `electron/services/folderExportService.ts` - 6 inline filters replaced
- `electron/services/pdfExportService.ts` - 2 inline filters replaced (with subject-based fallback preserved)
- `electron/services/db/communicationDbService.ts` - 4 inline checks replaced

### Deviations

1. Helper placed in `electron/utils/channelHelpers.ts` (not `src/utils/`) because electron services cannot import from `src/`. The `src/` files import via relative path to `electron/utils/`.
2. `isTextMessage()` also handles `channel === "text"` (legacy value) discovered during implementation -- this value appears in existing code and test fixtures.
3. Additional files updated beyond the task file list: `TransactionDetails.tsx`, `EmailThreadCard.tsx`, `pdfExportService.ts`, `communicationDbService.ts`.
4. `pdfExportService.ts` preserves its subject-based fallback heuristic for untyped records.
5. `EmailThreadCard.tsx` preserves backward compatibility for untyped records (treats them as emails).
6. `broker-portal/` files NOT updated -- they use the typed `channel` field exclusively and have a separate tsconfig that doesn't include `electron/utils/`.

### Engineer Checklist
- [x] `isTextMessage()` helper created and correctly handles both `channel` and `communication_type`
- [x] `isEmailMessage()` helper created and correctly handles both field names
- [x] Helpers placed in shared location importable from both `src/` and `electron/`
- [x] `useTransactionMessages.ts` updated
- [x] `useTransactionDetails.ts` updated
- [x] `folderExportService.ts` updated
- [x] `enhancedExportService.ts` updated
- [x] All remaining inline `communication_type` comparisons removed from `src/` and `electron/services/`
- [x] No behavioral changes (all 146 existing tests pass)
- [x] Type-check passes
- [x] Lint passes
- [x] Tests pass (146 tests across 6 suites)

### Results
- **Before:** 30+ inline channel/communication_type comparisons scattered across 9 files
- **After:** All comparisons centralized in 2 helper functions with 24 unit tests
- **Test results:** 146 tests pass (24 new + 122 existing)

**Issues/Blockers:** None
