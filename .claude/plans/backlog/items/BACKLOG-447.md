# BACKLOG-447: Manually Added Contact Not Showing in Select Contacts Modal

**Priority:** P1 (High)
**Category:** bug / contacts
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~8K

---

## Summary

After creating a contact via "Add Manually" button in the Select Contacts modal, the newly created contact doesn't appear in the contact list.

---

## Problem Statement

User flow:
1. Open Select Contacts modal (e.g., when assigning contacts to transaction)
2. Click "Add Manually" button
3. Fill out contact form and save
4. Contact form closes
5. **BUG**: New contact is NOT visible in the Select Contacts list

Expected: The contact should appear immediately in the list after creation.

---

## Root Cause Analysis

Likely causes:

1. **Refresh not triggered**: The `onRefreshContacts?.()` callback may not be called or may not work correctly after ContactFormModal closes.

2. **Contact list filtering**: The contact list may filter by `is_imported=1` or other criteria that excludes manually created contacts.

3. **Async timing**: The refresh may fire before the database write completes.

---

## Code Path

```
ContactSelectModal
  → showAddForm = true
  → ContactFormModal
    → onSuccess()
      → setShowAddForm(false)
      → onRefreshContacts?.()  // This should refresh the list
```

---

## Files to Check/Modify

| File | Change |
|------|--------|
| `src/components/ContactSelectModal.tsx` | Verify onRefreshContacts is called and works |
| `src/components/contact/components/ContactFormModal.tsx` | Verify contact creation succeeds |
| `electron/contact-handlers.ts` | Check contacts:create handler |
| `electron/services/db/contactDbService.ts` | Check createContact function |

---

## Acceptance Criteria

- [ ] After creating contact via "Add Manually", contact appears in list
- [ ] Contact is selectable immediately after creation
- [ ] No page refresh required

---

## Related Items

- ContactSelectModal fix for "Add Manually" button (added this session)
- BACKLOG-443: Contact email storage in junction tables
