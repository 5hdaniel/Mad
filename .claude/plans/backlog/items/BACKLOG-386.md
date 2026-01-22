# BACKLOG-386: Unified Contact Selection and Management UX

**Created**: 2026-01-22
**Priority**: High
**Category**: UX
**Status**: Pending

---

## Description

Simplify and unify the contact selection experience across the app. Currently there are separate flows for "Select Contacts" (in transaction) and "Contacts" (dashboard). These should share components and have consistent behavior.

## Current Problems

1. **Separate Import Flow**: Users must explicitly click "Import" to bring in external contacts
2. **Inconsistent UX**: Dashboard Contacts screen and Select Contacts modal have different layouts
3. **No Source Tags**: Can't tell which contacts are imported vs. external vs. manually created
4. **Message Contacts Mixed In**: Weird numbers like 1800, *166 show up in contact lists

## Solution

### 1. Single Unified Contact List with Source Tags

Show ALL contacts in one list with visual tags:

```
┌─────────────────────────────────────────────────────┐
│ Contacts                              [+ New Contact]│
│                                                      │
│ Filter: [Imported ✓] [External ✓] [Manual ✓] [Msgs ○]│
│                                                      │
├─────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────┐  │
│ │ John Smith                        [IMPORTED]   │  │
│ │ john@email.com                                 │  │
│ └────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────┐  │
│ │ Sarah Johnson                     [EXTERNAL]   │  │
│ │ +1 (424) 555-1234                              │  │
│ └────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────┐  │
│ │ Bob Wilson                        [MANUAL]     │  │
│ │ bob@company.com                                │  │
│ └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2. Contact Source Types

| Type | Tag | Description |
|------|-----|-------------|
| Imported | `[IMPORTED]` | Synced from device contacts/address book |
| External | `[EXTERNAL]` | From email headers or phone contacts app, not yet imported |
| Manual | `[MANUAL]` | Created manually in the app |
| Message | `[MSG]` | Derived from message threads (phone numbers only) |

### 3. Auto-Import on Selection

- When user selects an EXTERNAL contact, automatically import it
- No separate "Import" button needed
- Contact becomes IMPORTED after selection

### 4. Filter Controls

**Default filters (ON):**
- Imported ✓
- External ✓
- Manual ✓

**Default filters (OFF):**
- Message contacts ✗ (hide weird numbers like 1800, *166)

### 5. Consistent Across Screens

| Screen | Location | Behavior |
|--------|----------|----------|
| Dashboard → Contacts | Full contact management | All features, delete, edit |
| Transaction → Select Contacts | Modal | Same list, selection mode, auto-import |

**Reuse Components:**
- Share the same `ContactList` component
- Share the same filter controls
- Share the same tag styling

## Acceptance Criteria

- [ ] Single contact list component used in both locations
- [ ] Source tags visible on all contact cards
- [ ] Filter bar with toggles for each source type
- [ ] Message contacts hidden by default
- [ ] External contacts auto-import when selected
- [ ] No separate "Import" button/flow needed
- [ ] Dashboard Contacts and Select Contacts modal look consistent
- [ ] Prioritize showing contact names over phone numbers

## Technical Notes

- Add `source` field to contact model: 'imported' | 'external' | 'manual' | 'message'
- Create shared `<ContactListWithFilters>` component
- May need to refactor existing Contacts.tsx and SelectContactsModal.tsx

## Related

- BACKLOG-317 (Unified Contact Selection UX Refactor) - supersedes this
- BACKLOG-143 (Prevent Duplicate Contact Imports)
- BACKLOG-165 (Duplicate Contacts in Import Contacts Page)
- BACKLOG-016 (Refactor Contact Import)
