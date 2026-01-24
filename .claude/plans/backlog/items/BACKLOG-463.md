# BACKLOG-463: Single-Screen Contact Management Flow

**Created**: 2026-01-23
**Status**: Ready
**Priority**: P1 (High)
**Category**: UX / Contact Management
**Sprint**: -
**Estimate**: ~45K tokens

---

## Problem

Current contact flow is two-step:
1. Import contacts (from address book, external sources)
2. Add/select contacts for transactions

User wants a **single-screen flow** where users can select, import, AND add contacts all in one place.

## User Story

**As a** real estate agent creating a transaction
**I want** to select, import, or create contacts from a single screen
**So that** I don't have to navigate between multiple screens to add a new contact

## Current Flow (BACKLOG-386 + BACKLOG-418)

```
Step 1: Select Contacts screen
  - Shows imported contacts
  - [Import] button -> goes to Import screen
  - [Add New] button -> goes to Add Contact form
  - User must navigate away and back

Step 2: Import Contacts screen (separate)
  - Shows address book contacts
  - Imports selected contacts
  - Returns to Select Contacts

Step 3: Add Contact form (separate)
  - Manual contact creation
  - Returns to Select Contacts
```

## Expected Flow (Single Screen)

```
┌─────────────────────────────────────────────────────────────────┐
│ Select Contacts for Transaction                      [Done]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Search: [_______________________________] [+ Add New Contact]   │
│                                                                 │
│ ┌─ YOUR CONTACTS ─────────────────────────────────────────────┐ │
│ │ ☑ John Smith         john@email.com          [IMPORTED]     │ │
│ │ ☑ Sarah Johnson      +1 (424) 555-1234       [MANUAL]       │ │
│ │ ☐ Bob Wilson         bob@company.com         [IMPORTED]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ FROM ADDRESS BOOK (click to import) ───────────────────────┐ │
│ │ ☐ Alice Brown        alice@example.com       [+ Import]     │ │
│ │ ☐ Carol Davis        carol@work.com          [+ Import]     │ │
│ │ ☐ ...                                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Selected: 2 contacts                                            │
└─────────────────────────────────────────────────────────────────┘

When user selects address book contact:
- Auto-import happens in background
- Contact moves to "Your Contacts" section
- Selection checkmark applied automatically
```

## Key Features

### 1. Unified List with Sections

Two sections in one view:
- **Your Contacts**: Already imported + manual contacts
- **From Address Book**: External contacts available to import

### 2. Inline Import

When user checks an address book contact:
1. Import happens automatically (async)
2. Contact moves to "Your Contacts" section
3. Checkmark retained (already selected)
4. No navigation required

### 3. Inline Add Contact

[+ Add New Contact] opens inline form (modal or expandable section):
- Name, Email, Phone fields
- Save creates contact AND selects it
- Returns to same screen with new contact visible

### 4. Search Across Both Sections

Search filters both:
- Your contacts (name, email, phone)
- Address book contacts (name, email, phone)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/shared/UnifiedContactSelector.tsx` | **NEW** - Single-screen component |
| `src/components/shared/AddressBookSection.tsx` | **NEW** - External contacts section |
| `src/components/shared/InlineAddContact.tsx` | **NEW** - Inline add form |
| `src/components/ContactSelectModal.tsx` | Replace with UnifiedContactSelector |
| `src/components/audit/ContactAssignmentStep.tsx` | Use UnifiedContactSelector |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | Use UnifiedContactSelector |

## Data Flow

```typescript
interface UnifiedContactSelectorProps {
  selectedContactIds: string[];
  onSelectionChange: (ids: string[]) => void;
  mode: 'select' | 'multiselect';
}

// Internal state
const [yourContacts, setYourContacts] = useState<Contact[]>([]);
const [addressBookContacts, setAddressBookContacts] = useState<ExternalContact[]>([]);
const [searchQuery, setSearchQuery] = useState('');

// On address book contact selected:
const handleExternalSelect = async (contact: ExternalContact) => {
  // 1. Import contact
  const imported = await importContact(contact);

  // 2. Move to yourContacts
  setYourContacts(prev => [...prev, imported]);
  setAddressBookContacts(prev => prev.filter(c => c.id !== contact.id));

  // 3. Add to selection
  onSelectionChange([...selectedContactIds, imported.id]);
};
```

## Acceptance Criteria

- [ ] Single screen shows both imported contacts and address book contacts
- [ ] Selecting address book contact auto-imports it
- [ ] Imported contact appears in "Your Contacts" section immediately
- [ ] [+ Add New Contact] opens inline form (no navigation)
- [ ] New contact created and selected without leaving screen
- [ ] Search works across both sections
- [ ] No "Import" button navigation required
- [ ] Used in: Transaction creation, Edit Contacts modal
- [ ] TypeScript compiles
- [ ] Tests pass

## Migration Notes

- Replace ContactSelectModal with UnifiedContactSelector
- Remove separate ImportContactsModal navigation
- Keep ImportContactsModal for bulk import from Dashboard (optional)

## Dependencies

- BACKLOG-386: Unified Contact Selection (supersedes/extends)
- BACKLOG-418: Redesign Contact Selection UX (complements - Step 2 uses this)

## Estimated Effort

~45K tokens (new unified component + 3 integration points + data flow)
