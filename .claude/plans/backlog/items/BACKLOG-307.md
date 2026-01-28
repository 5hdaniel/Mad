# BACKLOG-307: Contact Select Modal Missing Message-Derived Contacts

## Type
Bug / UX

## Priority
High

## Status
Done

**Sprint:** SPRINT-045
**PR:** #473
**Completed:** 2026-01-19

## Summary

When using the "Select Contact" modal (e.g., in Attach Messages screen), contacts detected from imported messages do not appear. Users see "2206 contacts with unlinked messages" elsewhere in the app, but the Select Contact modal shows 0 contacts because it only queries "imported" contacts.

## Problem

**User Report:**
- Dashboard shows "2206 contacts with unlinked messages"
- User has 0 "imported" contacts
- When trying to attach messages to a transaction, contact "Carol Graffius" (who exists in their messages) does not appear in Select Contact modal
- User cannot link messages to contacts they've communicated with

**Root Cause:**
The `ContactSelectModal` calls:
```typescript
await window.api.contacts.getAll(userId)
// or
await window.api.contacts.getSortedByActivity(userId, propertyAddress)
```

Both of these query `getImportedContactsByUserId()` which only returns contacts from the `contacts` table that were explicitly imported.

Contacts detected from messages (phone numbers, email addresses extracted during message import) are stored differently and not included in this query.

## Expected Behavior

The Select Contact modal should show:
1. Explicitly imported contacts (from Contacts page import)
2. Contacts derived from imported messages (anyone the user has communicated with)

Or at minimum, provide a way to quickly import/create a contact from message-derived data.

## Affected Files

- `src/components/ContactSelectModal.tsx` - Consumer of contact data
- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Calls loadContacts
- `electron/contact-handlers.ts` - `contacts:get-all` and `contacts:get-sorted-by-activity` handlers
- `electron/services/databaseService.ts` - `getImportedContactsByUserId()` query

## Acceptance Criteria

- [ ] Select Contact modal shows contacts the user has messaged
- [ ] User can find "Carol Graffius" (or any contact from their messages) in the modal
- [ ] Search works across both imported and message-derived contacts
- [ ] Performance acceptable with 2000+ contacts

## Potential Solutions

1. **Merge queries** - Combine imported contacts with unique senders/recipients from messages table
2. **Auto-import on message sync** - Create contact records for all unique participants during message import
3. **Separate section** - Show "Recent Contacts" from messages alongside imported contacts
4. **On-demand creation** - Allow creating a contact directly from the modal search when no match found

## Dependencies

None

## Related

- BACKLOG-306: Hide Phone/Email in Contact Selection Modal (same modal, different issue)

## Discovered During

User testing - 2026-01-18

## Notes

This is a significant UX blocker - users import messages expecting to work with those contacts, but can't find them in the contact selection flow.
