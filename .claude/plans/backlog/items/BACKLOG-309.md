# BACKLOG-309: Import Contact Flow - Auto-Select and Refresh Issues

## Type
Bug / UX

## Priority
High

## Status
Done

**Sprint:** SPRINT-045
**PR:** #474
**Completed:** 2026-01-19

## Summary

When importing contacts from within the Edit Transaction flow (via Select Contacts → Import Contacts), two issues occur:

1. **Refresh Issue:** Sometimes the newly imported contact doesn't appear in the Select Contacts list after import completes
2. **Missing Auto-Select:** Imported contacts should be automatically selected (checked) since the user clearly wants to add them to the transaction

## Current Behavior

1. User is editing a transaction and wants to add a contact
2. Opens Select Contacts modal
3. Contact "Carol Graffius" isn't in the list (not imported yet)
4. User clicks "Import" button → Import Contacts modal opens
5. User finds and selects "Carol Graffius", clicks Import
6. Import Contacts modal closes, returns to Select Contacts
7. **Problem A:** Sometimes "Carol Graffius" doesn't appear in the list (refresh not working)
8. **Problem B:** Even when it appears, user must manually find and check the contact they just imported

## Expected Behavior

1. After importing contacts, Select Contacts list should **always** refresh and show the new contact(s)
2. Newly imported contacts should be **automatically selected** (checkbox checked)
3. User can immediately click "Add" to attach the contact to the transaction

## Root Cause Investigation

### Refresh Issue
- `ContactSelectModal.tsx` has `onRefreshContacts` callback
- `EditContactsModal.tsx` passes `loadContacts` as `onRefreshContacts`
- Need to verify this callback is being invoked after import
- May be a race condition - import completes but query returns before DB write commits

### Auto-Select Issue
- `ImportContactsModal` returns via `onSuccess` callback
- The imported contact IDs are not passed back to `ContactSelectModal`
- `ContactSelectModal` has no way to know which contacts were just imported

## Affected Files

- `src/components/ContactSelectModal.tsx` - Needs to receive and auto-select imported IDs
- `src/components/contact/components/ImportContactsModal.tsx` - Needs to return imported contact IDs
- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Orchestrates the flow

## Acceptance Criteria

- [ ] After importing contact(s), Select Contacts list always shows them
- [ ] Newly imported contacts are automatically checked/selected
- [ ] Works for single contact import
- [ ] Works for multiple contact import
- [ ] No race conditions causing missing contacts

## Proposed Solution

```typescript
// ImportContactsModal should return imported contact IDs
onSuccess?: (importedContactIds: string[]) => void;

// ContactSelectModal should accept and auto-select
interface ContactSelectModalProps {
  // ... existing props
  autoSelectIds?: string[];  // IDs to auto-select when they appear
}

// Or simpler: pass imported IDs through and add to selectedIds state
```

## Dependencies

None

## Related

- BACKLOG-307: Contact Select Modal Missing Message-Derived Contacts
- BACKLOG-306: Hide Phone/Email in Contact Selection Modal

## Discovered During

User testing - 2026-01-18

## Notes

This is a workflow friction issue. The user's intent is clear (import + use contact), but the UI makes them do extra steps.
