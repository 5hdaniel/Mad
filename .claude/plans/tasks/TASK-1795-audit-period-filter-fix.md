# TASK-1795: Fix Audit Period Filter Checkbox

**Backlog ID:** BACKLOG-601
**Sprint:** SPRINT-068
**Phase:** Bug Fix
**Branch:** `sprint/SPRINT-068-windows-ios-contacts`
**Estimated Turns:** 2-4
**Estimated Tokens:** 8K-12K

---

## Objective

Fix the audit period filter checkbox so it correctly filters messages by the transaction's date range. Currently, the checkbox doesn't work because `new Date(auditStartDate)` returns Invalid Date.

---

## Context

During SPRINT-068 testing, the audit period filter checkbox was found to be non-functional. When enabled, no filtering occurs because date parsing fails silently. The root cause is that `new Date(auditStartDate)` returns Invalid Date (NaN), and comparing with NaN always returns false.

---

## Requirements

### Must Do:
1. Identify why `auditStartDate` produces Invalid Date
2. Add date validation with `isNaN(d.getTime())` check
3. Handle invalid dates gracefully (either skip filtering or show error)
4. Add diagnostic logging to track date parsing issues
5. Ensure messages are correctly filtered when checkbox is enabled

### Must NOT Do:
- Change the UI of the checkbox
- Modify the transaction date format
- Remove the filter feature

---

## Acceptance Criteria

- [ ] Filter checkbox filters messages when enabled
- [ ] Only messages within audit period are shown when filter is ON
- [ ] All messages shown when filter is OFF
- [ ] Invalid dates are handled gracefully with logging
- [ ] No silent failures
- [ ] TypeScript compiles without errors

---

## Files to Modify

- `src/components/transaction/TransactionMessagesTab.tsx` (lines ~151-152) - Add date validation
- `src/components/transaction/ConversationViewModal.tsx` - Same date validation pattern

## Files to Read (for context)

- Transaction type definitions to understand date format
- Any existing date parsing utilities

---

## Testing Expectations

### Unit Tests
- **Required:** No (manual testing sufficient for bug fix)
- **New tests to write:** None
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(BACKLOG-601): validate dates in audit period filter`
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

- **Before**: Filter checkbox has no effect
- **After**: Filter correctly shows only messages within audit period
- **Actual Turns**: X (Est: 2-4)
- **Actual Tokens**: ~XK (Est: 8K-12K)
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
- The date format is complex or varies by source
- Multiple date fields need validation
- You encounter blockers not covered in the task file
