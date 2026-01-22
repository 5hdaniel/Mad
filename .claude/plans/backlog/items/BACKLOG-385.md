# BACKLOG-385: Contact Email Missing Prompt

**Created**: 2026-01-22
**Priority**: High
**Category**: UX
**Status**: Pending

---

## Description

When adding contacts to a transaction, if any contacts are missing email addresses, show a popup prompting the user to add emails now. This ensures contacts have the information needed for email linking.

## User Flow

1. User adds contacts to a transaction
2. On save/confirm, system checks if any added contacts lack email addresses
3. If contacts are missing emails, show popup:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ Missing Email Addresses                             │
   │                                                     │
   │ The following contacts don't have email addresses.  │
   │ Would you like to add them now?                     │
   │                                                     │
   │ ☐ John Smith                                        │
   │ ☐ Sarah Johnson                                     │
   │                                                     │
   │ Adding email addresses helps us find related        │
   │ emails for your transaction audit.                  │
   │                                                     │
   │         [Add Emails Now]  [Skip for Now]            │
   └─────────────────────────────────────────────────────┘
   ```
4. If user clicks "Add Emails Now", show inline email input for each contact
5. Save emails and continue

## Acceptance Criteria

- [ ] System detects contacts without email addresses on transaction save
- [ ] Popup appears listing contacts missing emails
- [ ] User can add email directly in the popup
- [ ] User can skip and proceed without adding emails
- [ ] Added emails are saved to contact records
- [ ] Emails are validated before saving
- [ ] Works in both new transaction creation and edit flows

## Technical Notes

- Check contact.email field for null/empty
- Could reuse inline edit pattern from contact cards
- Should not block transaction save - just prompt

## Related

- BACKLOG-371 (Contact Update Sync and Re-link Messages)
- Transaction creation flow
- Contact editing
