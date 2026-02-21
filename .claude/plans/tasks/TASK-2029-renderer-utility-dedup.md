# TASK-2029: Renderer-Side Utility Deduplication

**Backlog ID:** BACKLOG-757, BACKLOG-762, BACKLOG-763, BACKLOG-764, BACKLOG-765
**Sprint:** SPRINT-090
**Phase:** 2a (Parallel with TASK-2030)
**Branch:** `refactor/task-2029-renderer-dedup`
**Estimated Tokens:** ~60K
**Token Cap:** ~240K (4x estimate)

---

## Objective

Extract 5 groups of duplicated utility functions from renderer components into shared utility modules under `src/utils/`. This is a pure refactoring task -- no logic changes, no new features.

---

## Context

During SPRINT-089 closure, a code duplication audit found multiple utility functions copy-pasted across renderer components. Each group has 2-4 identical or near-identical copies. Extracting them into shared modules improves maintainability and reduces the chance of fixing a bug in one copy but not the others (exactly what happened with `normalizePhone` in SPRINT-089).

---

## Requirements

### Must Do:

1. **Extract `formatFileSize()`** -- 4 identical copies in renderer
2. **Extract `formatDateRangeLabel()` and `formatDateRange()`** -- 2 copies each in renderer
3. **Extract `filterSelfFromParticipants()` and `formatParticipants()`** -- 2 copies each
4. **Extract `isEmptyOrReplacementChar()` and `formatMessageTime()`** -- 2 copies each
5. **Extract `getAvatarInitial()`** -- 3 slightly different versions; pick the most robust
6. **Update all consuming components** to import from the new shared modules
7. **Delete the local copies** from each component

### Must NOT Do:

- Do NOT change any function logic (except `getAvatarInitial` where you must pick one version)
- Do NOT add new features or capabilities
- Do NOT modify any electron/ files (that is TASK-2030)
- Do NOT rename existing functions unless needed for disambiguation
- Do NOT combine unrelated utilities into a single "utils.ts" mega-file

---

## Acceptance Criteria

- [ ] `src/utils/formatUtils.ts` exists with `formatFileSize()`
- [ ] `src/utils/dateRangeUtils.ts` exists with `formatDateRangeLabel()` and `formatDateRange()`
- [ ] `src/utils/emailParticipantUtils.ts` exists with `filterSelfFromParticipants()` and `formatParticipants()`
- [ ] `src/utils/messageFormatUtils.ts` exists with `isEmptyOrReplacementChar()` and `formatMessageTime()`
- [ ] `src/utils/avatarUtils.ts` exists with `getAvatarInitial()`
- [ ] No duplicate copies remain in any component file
- [ ] No visual or behavioral changes (pure refactor)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Create

| File | Functions | Source Pattern |
|------|-----------|--------------|
| `src/utils/formatUtils.ts` | `formatFileSize(bytes: number): string` | AttachmentCard.tsx:15 |
| `src/utils/dateRangeUtils.ts` | `formatDateRangeLabel(start, end)`, `formatDateRange(start, end)` | TransactionMessagesTab.tsx:25, AttachEmailsModal.tsx:46 |
| `src/utils/emailParticipantUtils.ts` | `filterSelfFromParticipants(participants, userEmail)`, `formatParticipants(participants)` | AttachEmailsModal.tsx:59+72 |
| `src/utils/messageFormatUtils.ts` | `isEmptyOrReplacementChar(text)`, `formatMessageTime(dateStr)` | ConversationViewModal.tsx |
| `src/utils/avatarUtils.ts` | `getAvatarInitial(name)` | MessageThreadCard.tsx:38 |

## Files to Modify

### Group 1: formatFileSize (4 files)

| File | Line Ref | Change |
|------|----------|--------|
| `src/components/transactionDetailsModule/components/AttachmentCard.tsx` | ~15 | Remove local `formatFileSize()`, import from `src/utils/formatUtils` |
| `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx` | ~27 | Remove local `formatFileSize()`, import from `src/utils/formatUtils` |
| `src/components/transactionDetailsModule/components/modals/AttachmentPreviewModal.tsx` | ~42 | Remove local `formatFileSize()`, import from `src/utils/formatUtils` |
| `src/components/transactionDetailsModule/components/modals/EmailThreadViewModal.tsx` | ~29 | Remove local `formatFileSize()`, import from `src/utils/formatUtils` |

### Group 2: Date range formatting (4 files)

| File | Line Ref | Change |
|------|----------|--------|
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | ~25 | Remove local `formatDateRangeLabel()`, import from `src/utils/dateRangeUtils` |
| `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` | ~189 | Remove local `formatDateRangeLabel()`, import from `src/utils/dateRangeUtils` |
| `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` | ~46 | Remove local `formatDateRange()`, import from `src/utils/dateRangeUtils` |
| `src/components/transactionDetailsModule/components/EmailThreadCard.tsx` | ~118 | Remove local `formatDateRange()`, import from `src/utils/dateRangeUtils` |

### Group 3: Email participant helpers (2 files)

| File | Line Ref | Change |
|------|----------|--------|
| `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` | ~59, ~72 | Remove local `filterSelfFromParticipants()` and `formatParticipants()`, import from `src/utils/emailParticipantUtils` |
| `src/components/transactionDetailsModule/components/EmailThreadCard.tsx` | ~72, ~86 | Remove local copies, import from `src/utils/emailParticipantUtils` |

### Group 4: Message formatting (2 files)

| File | Line Ref | Change |
|------|----------|--------|
| `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` | varies | Remove local `isEmptyOrReplacementChar()` and `formatMessageTime()`, import from `src/utils/messageFormatUtils` |
| `src/components/transactionDetailsModule/components/MessageBubble.tsx` | varies | Remove local copies, import from `src/utils/messageFormatUtils` |

### Group 5: getAvatarInitial (3-4 files)

| File | Line Ref | Change |
|------|----------|--------|
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | ~38 | Remove local `getAvatarInitial()`, import from `src/utils/avatarUtils` |
| `src/components/transactionDetailsModule/components/EmailThreadCard.tsx` | ~48 | Remove local copy, import from `src/utils/avatarUtils` |
| `src/components/transactionDetailsModule/components/modals/EmailThreadViewModal.tsx` | ~210 | Remove local copy, import from `src/utils/avatarUtils` |
| `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` | check | May also have a copy; remove if found |

---

## Implementation Notes

### Strategy

1. For each group, read ALL copies first to verify they are truly identical
2. If copies differ slightly, pick the most robust version and note the deviation
3. Create the shared module with proper TypeScript types
4. Update each consuming file: add import, delete local function
5. Run type-check after each group to catch issues early

### getAvatarInitial Variations

The 3 copies may differ slightly. Common differences:
- Handling of `null`/`undefined` input
- Fallback character (`?` vs `#` vs empty string)
- Whether it uppercases the result

Pick the version that handles the most edge cases. Document which version was chosen in the Implementation Summary.

---

## Testing Expectations

### Unit Tests
- **Required:** No new test files required (pure refactoring)
- **Existing tests to verify:** All existing component tests still pass
- **Optional:** If time permits, add unit tests for the new utility modules

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `refactor: extract duplicated renderer utilities into shared modules`
- **Branch:** `refactor/task-2029-renderer-dedup`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~60K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Any "duplicate" turns out to have meaningfully different logic (not just formatting)
- A component test fails after extraction (may indicate the function depends on component scope)
- You find additional duplicated utilities not listed in this task
- Any of the utility modules would create a circular dependency
- You encounter blockers not covered in the task file
