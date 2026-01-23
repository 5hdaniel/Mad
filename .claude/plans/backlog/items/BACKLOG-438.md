# BACKLOG-438: Sync Communications Should Pull Emails for All Contact Addresses

## Summary

When "Sync Communications" is clicked, emails are not being fetched for all email addresses associated with a contact. If a contact has multiple emails, communications from all addresses should be imported.

## Category

Bug / Sync

## Priority

P1 - High (Missing communications in audit)

## Description

### Problem

Contact "Madison" has two email addresses:
- `madison@email1.com`
- `madison@email2.com`

When Sync Communications runs:
- Emails from `madison@email1.com` may be imported
- Emails from `madison@email2.com` are NOT imported
- Results in incomplete audit record

### Root Cause (Suspected)

The sync service may only be using the "primary" email or first email when querying the mailbox, instead of all associated email addresses.

### Expected Behavior

Sync Communications should:
1. Get ALL email addresses for each contact
2. Query mailbox for communications from ALL addresses
3. Import all matching emails/threads

### Reproduction Steps

1. Create transaction with contact who has 2+ emails
2. Ensure emails exist in mailbox from the secondary email
3. Click "Sync Communications"
4. Emails from secondary address are not imported

## Acceptance Criteria

- [ ] Sync queries mailbox for ALL contact email addresses
- [ ] Emails from any associated address are imported
- [ ] Same applies to phone numbers for text sync
- [ ] Audit record includes all communications

## Estimated Effort

~15K tokens

## Dependencies

- Need to verify contact data model stores all emails

## Related Items

- BACKLOG-437: Display all emails on contact card
- Communication sync service
- Email import service
