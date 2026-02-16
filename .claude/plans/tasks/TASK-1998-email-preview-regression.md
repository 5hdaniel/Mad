# TASK-1998: Fix Email Preview Missing from Attach Emails Modal

**Backlog:** BACKLOG-710
**Sprint:** SPRINT-083
**Status:** Pending
**Priority:** Medium
**Category:** fix (regression)
**Estimated Tokens:** ~10K

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Summary

The body preview text that was previously showing in the "Attach Emails" modal thread cards is no longer visible. This is likely a regression from the `outlookFetchService.ts` changes made during SPRINT-083 (specifically the email search improvements in TASK-1992 or the sent items addition).

---

## Context

### Current Behavior
- Open "Attach Emails" modal on a transaction
- Email thread cards show subject and sender but no body preview text
- The `body_preview` field may not be populated or may not be rendered

### Expected Behavior
- Each email thread card should show a 1-2 line preview of the email body
- This was working before the SPRINT-083 Outlook service changes

### Investigation Needed
1. Check if `body_preview` is being returned from the Outlook API response
2. Check if `body_preview` is being stored/passed through the email processing pipeline
3. Check if the `AttachEmailsModal` component renders `body_preview` and if the field name matches
4. Check if the `searchEmails()` method in `outlookFetchService.ts` includes `bodyPreview` in the `$select` fields

---

## Files to Investigate

| File | What to Check |
|------|---------------|
| `electron/services/outlookFetchService.ts` | Does `$select` include `bodyPreview`? |
| `electron/transaction-handlers.ts` | Is `body_preview` mapped from API response? |
| `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` | Does the component render `body_preview`? |

---

## Acceptance Criteria

- [ ] Email thread cards in "Attach Emails" modal show body preview text
- [ ] Preview text is truncated to 1-2 lines
- [ ] Works for both Gmail and Outlook emails
- [ ] No regressions in email attachment flow
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Testing Requirements

### Manual Testing
- [ ] Open "Attach Emails" modal, verify body preview visible on thread cards
- [ ] Test with both long and short email bodies
- [ ] Test with both Gmail and Outlook emails if available

### CI Gates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Implementation Summary

_To be filled by Engineer after implementation._

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Branch** | |
| **PR** | |
| **Files Changed** | |
| **Tests Added** | |
| **Issues/Blockers** | |
