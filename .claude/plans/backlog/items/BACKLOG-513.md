# BACKLOG-513: Fix Unknown Contact Name Display in Text Threads

## Type
bug

## Priority
medium

## Status
in_progress

## Sprint
SPRINT-061

## Description

When linking text threads to transactions, some 1:1 conversations display "unknown" as the contact name instead of the actual contact name. The contact lookup is not finding a phone number match even when the contact exists in the contacts table.

### Steps to Reproduce

1. Import contacts from iPhone/macOS
2. Import text messages from macOS
3. Create a transaction
4. Link a text thread where the phone number has a known contact
5. Observe that some contacts show "unknown" instead of their name

### Expected Behavior

- 1:1 text conversations should display the contact's name
- Phone number lookup should match contacts regardless of phone format

### Actual Behavior

- Some 1:1 conversations display "unknown"
- Contact name resolution failing for certain phone number formats

### Technical Investigation Needed

1. **Phone Format Mismatch**: Are phone numbers stored differently in `contact_phones` vs `messages.participants`?
2. **Normalization**: Does `normalizePhoneForLookup()` handle all common formats (+1, parentheses, dashes)?
3. **Lookup Flow**: Is the lookup using the correct normalization at all points?
4. **Fallback Logic**: Is "unknown" returned too early before all lookup attempts?

### Files to Investigate

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - lines 108-162
- `electron/services/iosContactsParser.ts` - `lookupByPhone()` method (line 371)
- `electron/services/db/contactDbService.ts` - contact phone lookup
- `electron/services/contactsService.ts` - "Unknown" fallback handling

## Acceptance Criteria

- [ ] 1:1 text conversations show contact name (not "unknown") when contact exists
- [ ] Phone normalization handles: +1 (555) 123-4567, 555-123-4567, 5551234567
- [ ] International numbers work correctly
- [ ] "Unknown" only displayed when contact truly doesn't exist

## Related

- SPRINT-061: Communication Display Fixes
- Contact import functionality
- Phone normalization utilities
