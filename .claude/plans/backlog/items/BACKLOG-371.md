# BACKLOG-371: Contact Update Sync and Re-link Messages

## Category
feature

## Priority
High

## Status
Pending

## Description

Users need the ability to refresh contacts and re-link messages when contact information changes after initial import. Currently, if a user creates a transaction with contacts but later updates a contact's email or phone number in their address book, the system has no way to:
1. Detect the contact information has changed
2. Re-run the email/text matching logic for affected transactions

This creates a usability gap where users must manually manage message associations for updated contacts.

## User Story

1. User creates a transaction and assigns contacts to it
2. User forgets to add an email to one of the contacts at that time
3. User later updates the contact externally (in their phone/address book) to add the email
4. The software needs to detect this contact update
5. The software should allow users to re-trigger email and text lookup based on the updated contact info

## Feature Requirements

### 1. Contact Sync/Refresh
- Ability to re-sync contacts from the source (phone/address book)
- Compare local contact data with source data
- Update local contact records when changes detected

### 2. Change Detection
- Detect when contact info has changed (email added, phone number changed, etc.)
- Track which fields were modified
- Identify transactions that have the changed contact assigned

### 3. Re-trigger Message Lookup
- When a contact is updated, re-run the email/text matching logic
- Only process transactions that have that contact assigned
- Associate newly matched messages with the transaction
- Avoid duplicating already-linked messages

### 4. UI for Manual Trigger
- Allow user to manually trigger a "refresh contact and re-link messages" action
- Provide this action at both:
  - Contact level (refresh this contact across all transactions)
  - Transaction level (refresh all contacts for this transaction)
- Show progress/results of the re-linking operation

## Acceptance Criteria

- [ ] User can refresh/re-sync a contact's info from their device
- [ ] System detects changes to contact email/phone
- [ ] User can trigger re-linking of messages for updated contacts
- [ ] Newly found emails/texts are associated with the transaction
- [ ] Previously linked messages are not duplicated
- [ ] UI provides feedback on what was found/linked during refresh
- [ ] Works for both email and text message matching

## Technical Considerations

- Leverage existing `autoLinkService` for message matching logic
- May need to add a "last synced" timestamp to contacts
- Consider batch processing for contacts with many transactions
- Ensure proper handling of deleted contacts in source
- May need to coordinate with existing sync mechanisms

## Related Items

- BACKLOG-207: Auto-Link Communications When Contact Added
- BACKLOG-143: Prevent Duplicate Contact Imports
- BACKLOG-016: Refactor Contact Import
- BACKLOG-018: Smart Contact Sync

## Estimated Tokens

~50K (involves contact sync, change detection, message re-linking, and UI)
