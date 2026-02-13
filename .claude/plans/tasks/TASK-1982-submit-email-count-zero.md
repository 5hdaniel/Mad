# TASK-1982: Fix email count showing 0 on submission summary

**Backlog ID:** BACKLOG-690
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1982-submit-email-count`
**Estimated Tokens:** ~15K (service x 0.5 + investigation)

---

## Objective

Fix the email count displaying 0 on the submission summary screen that appears after clicking "Submit for Review" on a transaction.

---

## Context

The `SubmitForReviewModal` (at `src/components/transactionDetailsModule/components/modals/SubmitForReviewModal.tsx`) receives `emailThreadCount` and `textThreadCount` as props.

In `src/components/TransactionDetails.tsx` (line 641), these are passed as:
```typescript
emailThreadCount={transaction.email_count || 0}
textThreadCount={transaction.text_thread_count || 0}
```

The `email_count` field comes from a SQL subquery in `electron/services/db/transactionDbService.ts`:
```sql
(SELECT COUNT(DISTINCT c.email_id)
 FROM communications c
 WHERE c.transaction_id = t.id
 AND c.email_id IS NOT NULL) as email_count
```

Potential causes:
1. The `transaction` object passed to `SubmitForReviewModal` may be stale (loaded before emails were linked)
2. The `email_count` computed column may not be refreshed after auto-linking or manual email attachment
3. The transaction object in state may not include the `email_count` from the subquery (e.g., if it was fetched without the subquery)

The `text_thread_count` is a stored column (updated on link/unlink) while `email_count` is computed at query time, so they follow different update patterns.

---

## Requirements

### Must Do:
1. **Investigate** the data flow: When the submit modal opens, trace where the `transaction` object comes from and whether it has a current `email_count`
2. **Find the root cause**: Is it a stale transaction object? A missing refresh? A query that does not include the subquery?
3. **Fix**: Ensure `transaction.email_count` is current when the submit modal opens. Options:
   - Re-fetch the transaction (with email_count subquery) before showing the modal
   - Ensure the transaction state is refreshed after any email linking operation
   - Count emails directly from the communications state if available
4. Verify the fix also works for `text_thread_count` (may have same issue)

### Must NOT Do:
- Change the SQL subquery for email_count (it is correct)
- Modify the SubmitForReviewModal component layout
- Change the submission logic itself
- Hardcode or fake counts

---

## Acceptance Criteria

- [ ] Email thread count shows the correct number (not 0) in the submission summary
- [ ] Text thread count shows the correct number in the submission summary
- [ ] Counts match what is visible on the transaction's Emails and Messages tabs
- [ ] Counts are correct even if emails were just linked/attached in the same session
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/TransactionDetails.tsx` - May need to refresh transaction before opening submit modal, or compute counts from state
- Possibly `src/components/transactionDetailsModule/hooks/useTransactionCommunications.ts` - If counts should come from loaded communications

## Files to Read (for context)

- `src/components/TransactionDetails.tsx` - Lines 176, 637-642 (submit modal usage)
- `src/components/transactionDetailsModule/components/modals/SubmitForReviewModal.tsx` - How counts are displayed
- `electron/services/db/transactionDbService.ts` - Lines 110-186 (email_count subquery)
- `src/components/transactionDetailsModule/hooks/useSubmitForReview.ts` - Submit flow

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests unless a function is extracted
- **Existing tests to update:** Check `src/components/__tests__/TransactionDetails.test.tsx`

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(submit): show correct email count on submission summary`
- **Branch:** `fix/task-1982-submit-email-count`
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
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-02-13 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1982-submit-email-count

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `TransactionDetails.tsx`, possibly `useTransactionCommunications.ts`
- Conflicts with: None -- submit flow files are exclusive to this task

### Technical Considerations
- Investigation-first: root cause may be stale state, missing refresh, or query without subquery
- 15K estimate should be treated as a floor; could expand if state management is involved
- If `email_count` is always 0 (not just in modal), escalate -- this would indicate a DB-level issue
- The difference between computed `email_count` (subquery at query time) and stored `text_thread_count` (updated on link/unlink) is a key architectural distinction to investigate

---

## Guardrails

**STOP and ask PM if:**
- The email_count is always 0 (not just in the modal) -- this would be a deeper DB issue
- The transaction object does not have email_count at all in its type definition
- Multiple places compute or display email counts with the same bug
- You encounter blockers not covered in the task file
