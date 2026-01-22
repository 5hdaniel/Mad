# BACKLOG-165: Duplicate Contacts in Import Contacts Page

## Problem
Every contact appears twice in the Import Contacts page, causing confusion and potential duplicate imports.

## Impact
- **User Experience**: Confusing UI with duplicate entries
- **Data Integrity**: Risk of importing the same contact multiple times
- **Priority**: Medium

## Root Cause (To Investigate)
Likely causes:
1. `contacts:get-available` handler combines iPhone-synced contacts AND macOS Contacts app contacts without proper deduplication
2. The deduplication logic in `contact-handlers.ts` (lines 119-180) may not be catching all duplicates
3. Same contact may exist in both `unimportedDbContacts` (from iPhone sync) and `phoneToContactInfo` (from macOS Contacts app)

## Relevant Code
- `electron/contact-handlers.ts` - `contacts:get-available` handler (lines 94-218)
- Deduplication uses `seenContacts` Set with lowercase name as key
- May need to also dedupe by email/phone

## Acceptance Criteria
- [ ] Each contact appears only once in Import Contacts page
- [ ] Deduplication considers name, email, AND phone
- [ ] Contacts from iPhone sync take precedence (they have real DB IDs)

## Notes
- Discovered: 2025-01-05
- Reporter: User
