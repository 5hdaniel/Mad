# TASK-1996: Email Sync and Contact Data Fixes (Grouped)

**Backlog:** BACKLOG-706, BACKLOG-707, BACKLOG-708, BACKLOG-709
**Sprint:** SPRINT-083
**Status:** In Progress
**Priority:** High
**Category:** fix
**Estimated Tokens:** ~15K (code already written, needs testing + PR)

---

## Summary

This task groups four related fixes that were discovered and coded during user testing on 2026-02-15. All changes are on the `feature/task-1993-email-search-wiring` branch (or the sprint branch). They should be submitted as a single PR since they are interconnected email sync and contact data fixes.

---

## Fix 1: Auto-link creates wrong communication records (BACKLOG-706)

**Problem:** `linkExistingCommunication()` in `autoLinkService.ts` was looking up by `communications.id` instead of `email_id`, so emails were never properly linked to transactions. The function created communication records that referenced the wrong data.

**Fix Applied:** Rewrote the function to `linkEmailToTransaction()` which creates proper communication records by looking up emails via `email_id` and creating correct transaction-communication links.

**Files Changed:**
- `electron/services/autoLinkService.ts`

---

## Fix 2: Sync only searched inbox, not sent items (BACKLOG-707)

**Problem:** The sync handler only fetched emails FROM contacts (inbox messages), missing emails TO contacts (sent items). This meant outgoing emails to transaction contacts were never captured during sync.

**Fix Applied:** Added `searchSentEmailsToContacts()` method to `outlookFetchService.ts` using `$search="to:email"` on the sentItems folder. Updated `transaction-handlers.ts` to call this during sync.

**Files Changed:**
- `electron/services/outlookFetchService.ts`
- `electron/transaction-handlers.ts`

---

## Fix 3: Contact email edit UNIQUE constraint error (BACKLOG-708)

**Problem:** Editing a contact's email to a value that already exists in the `contact_emails` table caused a UNIQUE constraint failure crash. This happened because the update logic did not check for existing emails case-insensitively before attempting the insert/update.

**Fix Applied:** Added case-insensitive lookup before update and proper error handling for the constraint.

**Files Changed:**
- `electron/contact-handlers.ts`

---

## Fix 4: getContactById only returns primary email (BACKLOG-709)

**Problem:** The `getContactById` function in `contactDbService.ts` only returned one email via a subquery with `LIMIT 1`, while the Contacts list component shows all emails via `json_group_array`. This inconsistency meant that when viewing a contact's details, only the primary email was shown even if the contact had multiple emails.

**Fix Applied:** Updated the query to include `allEmails` and `allPhones` arrays using `json_group_array`, consistent with how the contacts list query works.

**Files Changed:**
- `electron/services/db/contactDbService.ts`

---

## Acceptance Criteria

- [ ] Auto-link correctly creates communication records with proper `email_id` references
- [ ] Sync captures both inbox (from contacts) and sent (to contacts) emails
- [ ] Editing a contact's email to an existing value does not crash with UNIQUE constraint
- [ ] `getContactById` returns `allEmails` and `allPhones` arrays
- [ ] All existing tests pass (`npm run type-check`, `npm run lint`, `npm test`)
- [ ] No regressions in contact display or email sync flows

---

## Testing Requirements

### Manual Testing (Primary -- code is already written)
- [ ] Trigger email sync for a transaction with Outlook contacts, verify sent items appear
- [ ] View a contact with multiple emails, verify all are shown
- [ ] Edit a contact email to a value that already exists, verify graceful handling
- [ ] Open a transaction, verify auto-linked emails have proper communication records

### CI Gates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Branch Information

**Branch:** Changes are on the current sprint branch or `feature/task-1993-email-search-wiring`
**Base:** `sprint/083-outlook-contacts-polish` or `develop`
**Target:** `develop`

---

## Implementation Summary

_Code is already written. This task covers PR creation and merge._

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Branch** | feature/task-1993-email-search-wiring |
| **PR** | |
| **Files Changed** | autoLinkService.ts, outlookFetchService.ts, transaction-handlers.ts, contact-handlers.ts, contactDbService.ts |
| **Tests Added** | |
| **Issues/Blockers** | None -- code already tested manually |
