# BACKLOG-207: Auto-Link Communications When Contact Added to Transaction

**Created**: 2026-01-11
**Priority**: Medium
**Category**: enhancement
**Status**: Pending

---

## Description

When a user adds a contact to a transaction, the system should automatically search for existing communications (emails and iMessages/SMS) with that contact and link them to the transaction. This saves the user from manually attaching messages after adding a contact.

## Problem Context

Currently, when a user adds a contact to a transaction:
1. The contact is associated with the transaction
2. But existing emails and text messages with that contact are NOT automatically linked
3. User must manually go to the Messages/Emails tab and attach relevant communications
4. This is tedious, especially for transactions with multiple contacts

## User Value

- **Time savings**: Eliminates manual message attachment for each contact
- **Completeness**: Ensures relevant communications are not missed
- **Better UX**: Transaction setup is more "automatic" and intelligent

## Current Behavior

1. User opens transaction
2. User adds contact (e.g., "John Smith - Buyer's Agent")
3. Contact is saved to transaction
4. Emails/messages with John Smith remain unlinked
5. User must manually search and attach communications

## Expected Behavior

1. User opens transaction
2. User adds contact (e.g., "John Smith - Buyer's Agent")
3. System automatically:
   - Searches emails for contact's email address(es)
   - Searches iMessages/SMS for contact's phone number(s)
   - Links matching communications to the transaction (within date range if applicable)
4. User sees notification: "Found 12 emails and 8 text messages with John Smith. Linked to transaction."
5. User can review linked communications in the Messages/Emails tabs

## Technical Implementation

### Trigger Point

The auto-link should trigger when:
- A contact is added to a transaction via `addContactToTransaction` or similar
- NOT when contact is updated (unless email/phone changed)
- NOT during bulk import (performance consideration)

### Search Strategy

```typescript
interface AutoLinkOptions {
  contactId: string;
  transactionId: string;
  dateRange?: {
    start: Date;  // Transaction listing date?
    end: Date;    // Transaction closing date?
  };
}

async function autoLinkCommunicationsForContact(options: AutoLinkOptions) {
  const contact = await getContact(options.contactId);

  // Search emails by email address(es)
  const emails = await searchEmailsByAddress(
    contact.emails,
    options.dateRange
  );

  // Search messages by phone number(s)
  const messages = await searchMessagesByPhone(
    contact.phoneNumbers,
    options.dateRange
  );

  // Link to transaction
  await linkEmailsToTransaction(emails, options.transactionId);
  await linkMessagesToTransaction(messages, options.transactionId);

  return {
    emailsLinked: emails.length,
    messagesLinked: messages.length
  };
}
```

### Date Range Filtering

Communications should be filtered to relevant date range:
- If transaction has listing/closing dates: use that range (with buffer)
- If no dates: use last 6 months (configurable?)
- This prevents linking ancient communications

### User Notification

Options for notifying the user:
1. **Toast notification**: "Linked 12 emails and 8 messages with John Smith"
2. **Inline in contact row**: Small badge showing linked count
3. **Summary when saving**: "Added 3 contacts. Linked 45 communications."

### Performance Considerations

- Run search/linking asynchronously (don't block contact save)
- Show progress indicator for large datasets
- Consider batch processing if multiple contacts added at once
- May need to leverage existing indexes on email addresses and phone numbers

### Files to Modify

| File | Changes |
|------|---------|
| `electron/services/transactionService.ts` | Add auto-link trigger after contact add |
| `electron/services/emailService.ts` or similar | Add search by address function |
| `electron/services/macosMessagesService.ts` | Add search by phone number function |
| `src/components/AuditTransactionModal.tsx` | Show linking progress/results |
| `src/components/EditTransactionModal.tsx` | Same for edit flow |

### Edge Cases

1. **Contact with no email/phone**: Skip auto-link (nothing to search)
2. **Duplicate communications**: Check if already linked before adding
3. **Large result sets**: May need pagination or limit (e.g., top 100 most recent)
4. **Contact added to multiple transactions**: Each transaction gets its own links
5. **Email provider not connected**: Only search available sources

## Acceptance Criteria

- [ ] When a contact is added to a transaction, relevant emails are auto-linked
- [ ] When a contact is added to a transaction, relevant iMessages/SMS are auto-linked
- [ ] Communications are filtered to transaction date range (if available)
- [ ] User is notified of how many communications were linked
- [ ] Duplicate links are prevented (idempotent operation)
- [ ] Performance is acceptable (< 2 seconds for typical contact)
- [ ] User can disable auto-linking in settings (optional/stretch goal)

## Estimated Tokens

~35,000-50,000 (moderate complexity, touches multiple services)

## Testing

- [ ] Unit tests for email search by address
- [ ] Unit tests for message search by phone
- [ ] Integration test: add contact -> verify communications linked
- [ ] Test with contact having no email/phone
- [ ] Test with contact having multiple emails/phones
- [ ] Test duplicate prevention
- [ ] Test date range filtering
- [ ] Performance test with large message database

## Related Items

- BACKLOG-105: Text Messages Tab in Transaction Details (completed)
- BACKLOG-173: AttachMessagesModal improvements
- BACKLOG-190: Transaction date range filtering for messages

## Notes

This feature is a natural progression from the manual attach flow. It builds on existing infrastructure:
- Email/message search already exists for manual attach
- Transaction-communication linking already exists
- Contact-transaction association already exists

The main new work is:
1. Triggering the search automatically on contact add
2. Filtering by date range
3. User notification of results
