# TASK-1160: Fix Transaction Card Label to Say "email threads" Instead of "emails"

**Backlog ID:** BACKLOG-388
**Sprint:** Standalone
**Phase:** N/A
**Branch:** `fix/task-1160-email-threads-label`
**Estimated Turns:** 2-3
**Estimated Tokens:** ~10K

---

## Objective

Change the transaction card communication count label from "X emails" to "X email threads" to accurately reflect that we are counting threads, not individual emails. This ensures consistency with the transaction detail view which correctly displays "Email Threads (X)".

---

## Context

The transaction cards on the Transactions list page display communication counts. Currently, the label says "6 emails" when it should say "6 email threads" because the count represents threads, not individual email messages. The transaction detail view already uses the correct terminology ("Email Threads (6)"), so this is a consistency fix.

---

## Requirements

### Must Do:
1. Update `formatCommunicationCounts()` function in `TransactionCard.tsx` to use "email thread/threads" instead of "email/emails"
2. Update the JSDoc examples to reflect the new format
3. Ensure singular/plural handling is correct ("1 email thread" vs "2 email threads")

### Must NOT Do:
- Change the actual count logic (the count is correct, only the label is wrong)
- Modify any other display labels outside this function
- Change the text message labels (those are correct as-is)

---

## Acceptance Criteria

- [ ] Transaction card shows "X email threads" instead of "X emails"
- [ ] Singular form shows "1 email thread" (not "1 email threads")
- [ ] Plural form shows "N email threads" where N > 1
- [ ] JSDoc examples updated to reflect new output format
- [ ] Tests updated to expect new label format
- [ ] Consistent terminology between card and detail view

---

## Files to Modify

- `src/components/transaction/components/TransactionCard.tsx` - Update `formatCommunicationCounts()` function (line ~27)
- `src/components/transaction/components/__tests__/TransactionCard.test.tsx` - Update test expectations for new label

## Files to Read (for context)

- `src/components/transaction/components/TransactionCard.tsx` - Full context of the function

---

## Implementation Details

The specific change is in the `formatCommunicationCounts` function:

```typescript
// Before (line 27)
parts.push(`${emailCount} ${emailCount === 1 ? "email" : "emails"}`);

// After
parts.push(`${emailCount} ${emailCount === 1 ? "email thread" : "email threads"}`);
```

Also update the JSDoc examples (lines 14-17):
```typescript
// Before
* formatCommunicationCounts(5, 0) // "5 emails"
* formatCommunicationCounts(8, 4) // "8 emails, 4 texts"
* formatCommunicationCounts(1, 1) // "1 email, 1 text"

// After
* formatCommunicationCounts(5, 0) // "5 email threads"
* formatCommunicationCounts(8, 4) // "8 email threads, 4 texts"
* formatCommunicationCounts(1, 1) // "1 email thread, 1 text"
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** None
- **Existing tests to update:** Update `TransactionCard.test.tsx` to expect "email thread(s)" in output

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(ui): change transaction card label from "emails" to "email threads"`
- **Branch:** `fix/task-1160-email-threads-label`
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

- **Before**: Transaction cards display "X emails"
- **After**: Transaction cards display "X email threads"
- **Actual Turns**: _ (Est: 2-3)
- **Actual Tokens**: ~_K (Est: 10K)
- **Actual Time**: _ min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `formatCommunicationCounts` function is used elsewhere and changes might have unintended effects
- You discover the count is not actually threads but individual emails (would require deeper investigation)
- You encounter blockers not covered in the task file
