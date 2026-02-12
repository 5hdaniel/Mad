# TASK-1794: Fix Message Sort Order

**Backlog ID:** BACKLOG-600
**Sprint:** SPRINT-068
**Phase:** Bug Fix
**Branch:** `sprint/SPRINT-068-windows-ios-contacts`
**Estimated Turns:** 1-2
**Estimated Tokens:** 3K-5K

---

## Objective

Fix the message sort order in transaction detail views to show newest messages first instead of oldest first.

---

## Context

During SPRINT-068 testing, it was discovered that messages in the transaction detail view sort oldest-first. Users expect to see the most recent messages at the top without scrolling. This is a simple two-line fix.

---

## Requirements

### Must Do:
1. Change sort order in `MessageThreadCard.tsx` from ascending to descending
2. Change sort order in `ConversationViewModal.tsx` from ascending to descending
3. Verify both components show newest messages first

### Must NOT Do:
- Change any other sorting behavior
- Modify the underlying data structure
- Add new dependencies

---

## Acceptance Criteria

- [ ] `MessageThreadCard.tsx` shows newest messages first
- [ ] `ConversationViewModal.tsx` shows newest messages first
- [ ] No regressions in message display
- [ ] TypeScript compiles without errors

---

## Files to Modify

- `src/components/transaction/MessageThreadCard.tsx` (line ~462) - Change `return dateA - dateB;` to `return dateB - dateA;`
- `src/components/transaction/ConversationViewModal.tsx` (line ~228) - Change `return dateA - dateB;` to `return dateB - dateA;`

## Files to Read (for context)

- None needed - simple fix

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **New tests to write:** None
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(BACKLOG-600): sort messages newest-first in transaction detail`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
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

- **Before**: Messages sorted oldest-first
- **After**: Messages sorted newest-first
- **Actual Turns**: X (Est: 1-2)
- **Actual Tokens**: ~XK (Est: 3K-5K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The sort comparison is more complex than expected
- Other components appear to have the same issue
- You encounter blockers not covered in the task file
