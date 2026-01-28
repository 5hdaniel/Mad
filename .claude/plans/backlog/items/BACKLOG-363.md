# BACKLOG-363: Reorganize Transaction Details Tabs - Move Emails to Own Tab

**Created**: 2026-01-21
**Priority**: High
**Category**: UI
**Status**: Pending

---

## Description

Reorganize the transaction details page tabs:

1. **Move** "Related Emails" from the current details tab to its own "Emails" tab
2. **Add** relevant transaction details to the default/overview tab:
   - Audit start and end dates
   - Contacts with their roles (moved from Contacts tab or duplicated)

## Current Tab Structure

```
[Details] [Messages] [Contacts] [...]
   └── Related Emails section
   └── Other details
```

## Expected Tab Structure

```
[Overview] [Messages] [Emails] [Contacts] [...]
   │          │         │        │
   │          │         │        └── Contact list only
   │          │         └── Dedicated email threads section
   │          └── Text conversations
   └── Transaction info:
       - Audit period (start - end date)
       - Contacts & their roles
       - Property address
       - Status
```

## Changes Summary

1. **New "Emails" tab**: Dedicated space for email threads
2. **Rename "Details" to "Overview"** (optional, for clarity)
3. **Add to Overview tab**:
   - Audit period prominently displayed
   - Contacts with roles (may be summary/quick view)
4. **Remove from Overview tab**:
   - Related Emails section (moved to Emails tab)

## Acceptance Criteria

- [ ] New "Emails" tab created
- [ ] Email threads moved from details to Emails tab
- [ ] Audit date range shown in overview/default tab
- [ ] Contacts with roles shown in overview/default tab
- [ ] Navigation between tabs works smoothly
- [ ] Tab counts/badges updated appropriately

## Related

- TransactionDetailsPage.tsx
- TransactionDetailsTab.tsx
- TransactionEmailsTab.tsx (may need to create)
- TransactionContactsTab.tsx
