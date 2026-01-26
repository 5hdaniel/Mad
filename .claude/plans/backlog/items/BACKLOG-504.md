# BACKLOG-504: Attach Emails Modal Should Show Threads Not Individual Emails

## Priority: Medium
## Category: Enhancement
## Estimate: ~15K tokens

## Problem

The "Attach Emails - Select emails to link to" modal shows individual emails instead of grouping them by thread/conversation like the Emails tab does.

### Current Behavior
- Attach Emails modal shows each email as a separate item
- User has to select individual emails one by one

### Expected Behavior
- Attach Emails modal should group emails by thread/conversation
- Match the same display pattern used in the Emails tab
- Selecting a thread attaches all emails in that thread

## Solution

Reuse the thread grouping logic from the Emails tab component in the Attach Emails modal.

## Files to Investigate

- `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` - Current modal (needs update)
- `src/components/transactionDetailsModule/` - Emails tab implementation (has thread grouping)
- Look for thread grouping/conversation logic to reuse

## Acceptance Criteria

- [ ] Attach Emails modal shows emails grouped by thread
- [ ] Same visual style as Emails tab
- [ ] Selecting a thread selects all emails in it
- [ ] Reuses existing thread grouping code

## Additional Issues Found During Testing

### Issue 1: Wrong Thread Grouping
Emails with same subject but no `email_thread_id` are grouped together incorrectly.
- Example: Monthly Microsoft invoices grouped as one "thread"
- Fix: Only group by `email_thread_id`, NOT by subject fallback
- File: `src/components/transactionDetailsModule/components/EmailThreadCard.tsx` line 312-314

### Issue 2: No Email Content in View Modal
The unlinked emails API doesn't return `body_text` or `body_html`, so View modal shows "No content".
- Fix: Either fetch full email on demand, or include body in unlinked emails query
- Files: Backend `getUnlinkedEmails` handler

## Created
2026-01-26
