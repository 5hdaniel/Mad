# BACKLOG-408: Sync Communications Not Finding Emails for Contacts

**Priority:** P0 (Critical)
**Category:** bug / sync
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~15K

---

## Summary

When a contact is added to a transaction and "Sync Communications" is clicked, the system doesn't find/link emails from that contact's email address, even when emails from that address exist in the connected mailbox.

---

## Problem Statement

User reported:
1. Added Madison with work email `madison.delvigo@cbolympia.com`
2. Clicked "Sync Communications" on the transaction
3. No emails were linked, despite emails from that address existing

**Also affects new transaction creation:**
- Created a NEW transaction with this contact assigned
- Emails from contact's address were NOT pulled into the transaction
- This means both sync AND transaction creation flows are broken

### Root Cause Analysis

The `autoLinkCommunicationsForContact` function has two issues:

1. **Contact emails not stored in junction table**: When a contact is created, the email may not be stored in `contact_emails` table (BACKLOG-443). The auto-link queries `contact_emails` to get the contact's email addresses.

2. **Only searches already-scanned emails**: The sync only searches the `communications` table for previously-fetched emails. It does NOT fetch new emails from the mailbox. If emails haven't been scanned yet, they won't be found.

### Code Path

```
Sync Button → resyncAutoLink → autoLinkCommunicationsForContact
  → getContactInfo() - queries contact_emails table
  → findEmailsByContactEmails() - searches communications table
  → linkExistingCommunication() - links found emails
```

---

## Proposed Solution

### Fix 1: Ensure contact emails are stored (BACKLOG-443 dependency)

When creating a contact via `contacts:create`, ensure the email is stored in both:
- `contacts` table (for display)
- `contact_emails` table (for auto-link queries)

### Fix 2: Option to fetch fresh emails during sync

Add optional mailbox fetch during sync:
```typescript
// In resyncAutoLink, optionally fetch emails for contact's email addresses
if (options.fetchFromMailbox) {
  await fetchEmailsForAddresses(contactInfo.emails, dateRange);
}
```

### Fix 3: Better error feedback

Show user why no emails were found:
- "No emails in contact_emails table for this contact"
- "No matching emails found in scanned communications"
- "Try running a full email scan first"

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/autoLinkService.ts` | Add logging for empty contact emails |
| `electron/contact-handlers.ts` | Ensure email stored in contact_emails on create |
| `electron/services/db/contactDbService.ts` | Fix createContact to use contact_emails |
| `src/components/TransactionDetails.tsx` | Better sync feedback |

---

## Acceptance Criteria

- [ ] Creating a contact stores email in `contact_emails` table
- [ ] Sync Communications finds emails for newly added contacts
- [ ] User gets clear feedback if no emails found
- [ ] Existing contacts have emails backfilled to `contact_emails`

---

## Related Items

- BACKLOG-443: Contact Import Should Store All Emails/Phones in Junction Tables
- BACKLOG-437: Display all emails on contact card
- autoLinkService.ts - Main auto-link logic
