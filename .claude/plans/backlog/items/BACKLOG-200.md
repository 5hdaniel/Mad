# BACKLOG-200: Contacts import fails with email validation error

## Category
Bug

## Priority
Medium

## Description
When importing contacts from macOS Contacts during onboarding, the import fails with a validation error on the email field. This results in "No contacts imported yet" being shown when users try to create transactions manually.

## Error Details
```
[Contacts] [Main] Import contacts failed:
{
  "error": {
    "name": "ValidationError",
    "field": "email"
  }
}
```

## User Impact
- Users cannot assign contacts to transactions
- Manual transaction creation shows empty contacts list
- Must manually create contacts instead of importing from address book

## Steps to Reproduce
1. Fresh install / delete database
2. Go through onboarding
3. Grant Full Disk Access permissions
4. Contacts import attempts but fails
5. Try to create a transaction manually
6. See "No contacts imported yet" message

## Technical Notes
- 1006 contacts were found for import but import failed
- Error occurs in `contactsHandlers.ts` when calling `importContacts`
- Likely a contact in the address book has a malformed email that fails validation
- Need to investigate the validation logic and handle edge cases gracefully

## Files to Investigate
- `electron/handlers/contactsHandlers.ts`
- `electron/services/contactsService.ts`
- Contact validation logic

## Acceptance Criteria
- [ ] Contacts import succeeds even if some contacts have invalid data
- [ ] Invalid contacts are skipped with a warning, not fail entire import
- [ ] Import summary shows how many were skipped due to validation
- [ ] Users see their imported contacts when creating transactions

## Related
- Sprint-030 onboarding flow
- macOS Contacts integration

## Created
2026-01-11
