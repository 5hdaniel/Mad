# TASK-1763: ContactSearchList Component

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 1 - Core Shared Components
**Branch:** `feature/task-1763-contactsearchlist-component`
**Estimated Tokens:** ~18K
**Depends On:** TASK-1762 (ContactRow)

---

## Objective

Create a ContactSearchList component that combines a search input with a filterable list of contacts. This component handles both imported and external contacts, with auto-import capability when external contacts are selected.

---

## Context

ContactSearchList is the main selection component used in:
- Edit Contacts "Add Contacts" modal (Screen 2)
- New Audit contact selection (Step 1)
- Potentially the Contacts page

It replaces the existing `ContactSelector` with enhanced functionality:
- Unified list of imported + external contacts
- Source pills showing contact origin
- Auto-import on selection (optional)
- Import buttons for manual import

---

## Requirements

### Must Do:
1. Create `ContactSearchList.tsx` component in `src/components/shared/`
2. Use ContactRow component from TASK-1762
3. Implement search filtering (name, email, phone)
4. Support multi-select with checkboxes
5. Accept both imported and external contact arrays
6. Support auto-import callback for external contacts
7. Show loading and empty states
8. Write comprehensive unit tests

### Must NOT Do:
- Do not implement actual import API calls (just call callback)
- Do not manage contact data fetching (receives as props)
- Do not add role assignment (separate component)

---

## Acceptance Criteria

- [ ] Search input filters contacts by name, email, and phone
- [ ] Imported contacts display with [Imported] pill
- [ ] External contacts display with [External] pill and [+] button
- [ ] Multi-select works with checkboxes
- [ ] Selecting external contact triggers onImportContact callback (if provided)
- [ ] Selection count displays at bottom
- [ ] Loading state shows spinner
- [ ] Empty state shows appropriate message
- [ ] Keyboard navigation works (arrow keys, enter/space)
- [ ] Unit tests pass for all scenarios

---

## Technical Specification

### Component Interface

```tsx
// src/components/shared/ContactSearchList.tsx

import type { ExtendedContact } from '../../types/components';

export interface ExternalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: 'external';
}

export interface ContactSearchListProps {
  /** Imported/existing contacts */
  contacts: ExtendedContact[];
  /** External contacts (from address book, not yet imported) */
  externalContacts?: ExternalContact[];
  /** Currently selected contact IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: string[]) => void;
  /** Callback to import an external contact - returns the imported contact */
  onImportContact?: (contact: ExternalContact) => Promise<ExtendedContact>;
  /** Show loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Additional CSS classes */
  className?: string;
}

export function ContactSearchList(props: ContactSearchListProps): React.ReactElement;
```

### Visual Layout

```
+----------------------------------------------------------+
| Search: [____________________________] (magnifying glass) |
|                                                           |
| [x] [Avatar] John Smith        [Imported]                 |
|              john@email.com                               |
|                                                           |
| [ ] [Avatar] Jane Doe          [Imported]                 |
|              jane@realty.com                              |
|                                                           |
| [ ] [Avatar] Bob Wilson        [External] [+]             |
|              bob@work.com                                 |
|                                                           |
| [ ] [Avatar] Carol Chen        [External] [+]             |
|              carol@title.co                               |
|                                                           |
| Selected: 1 contact                                       |
+----------------------------------------------------------+
```

### Data Flow

```
contacts (ExtendedContact[]) ─┐
                              ├─► Combined List ─► Filter by search ─► Display
externalContacts (External[])─┘

User selects external contact:
1. Call onImportContact(externalContact)
2. Wait for promise to resolve with ExtendedContact
3. Add returned contact.id to selectedIds
4. (Parent should add to contacts array and remove from externalContacts)
```

### Implementation Sketch

```tsx
import React, { useState, useMemo, useCallback } from 'react';
import { ContactRow } from './ContactRow';
import type { ExtendedContact } from '../../types/components';

export interface ExternalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: 'external';
}

interface CombinedContact {
  contact: ExtendedContact | ExternalContact;
  isExternal: boolean;
}

export interface ContactSearchListProps {
  contacts: ExtendedContact[];
  externalContacts?: ExternalContact[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onImportContact?: (contact: ExternalContact) => Promise<ExtendedContact>;
  isLoading?: boolean;
  error?: string | null;
  searchPlaceholder?: string;
  className?: string;
}

export function ContactSearchList({
  contacts,
  externalContacts = [],
  selectedIds,
  onSelectionChange,
  onImportContact,
  isLoading = false,
  error = null,
  searchPlaceholder = 'Search contacts...',
  className = '',
}: ContactSearchListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // Combine and filter contacts
  const combinedContacts = useMemo((): CombinedContact[] => {
    const combined: CombinedContact[] = [
      ...contacts.map(c => ({ contact: c, isExternal: false })),
      ...externalContacts.map(c => ({ contact: c, isExternal: true })),
    ];

    if (!searchQuery.trim()) {
      return combined;
    }

    const query = searchQuery.toLowerCase();
    return combined.filter(({ contact }) => {
      const name = (contact.name || '').toLowerCase();
      const email = (contact.email || '').toLowerCase();
      const phone = (contact.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [contacts, externalContacts, searchQuery]);

  // Handle contact selection
  const handleSelect = useCallback((contactId: string) => {
    if (selectedIds.includes(contactId)) {
      onSelectionChange(selectedIds.filter(id => id !== contactId));
    } else {
      onSelectionChange([...selectedIds, contactId]);
    }
  }, [selectedIds, onSelectionChange]);

  // Handle external contact import
  const handleImport = useCallback(async (externalContact: ExternalContact) => {
    if (!onImportContact || importingIds.has(externalContact.id)) {
      return;
    }

    setImportingIds(prev => new Set(prev).add(externalContact.id));

    try {
      const imported = await onImportContact(externalContact);
      // Add the imported contact to selection
      onSelectionChange([...selectedIds, imported.id]);
    } catch (err) {
      console.error('Failed to import contact:', err);
    } finally {
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(externalContact.id);
        return next;
      });
    }
  }, [onImportContact, importingIds, selectedIds, onSelectionChange]);

  // Handle selecting an external contact (auto-import)
  const handleExternalSelect = useCallback(async (externalContact: ExternalContact) => {
    if (onImportContact) {
      // Auto-import when selecting external contact
      await handleImport(externalContact);
    }
  }, [onImportContact, handleImport]);

  return (
    <div className={`flex flex-col ${className}`} data-testid="contact-search-list">
      {/* Search Input */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
            aria-label="Search contacts"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto" role="listbox" aria-multiselectable="true">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-500">Loading contacts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : combinedContacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? `No contacts match "${searchQuery}"` : 'No contacts available'}
          </div>
        ) : (
          combinedContacts.map(({ contact, isExternal }) => (
            <ContactRow
              key={contact.id}
              contact={contact as ExtendedContact}
              isSelected={selectedIds.includes(contact.id)}
              showCheckbox={true}
              showImportButton={!!onImportContact}
              onSelect={() => {
                if (isExternal) {
                  handleExternalSelect(contact as ExternalContact);
                } else {
                  handleSelect(contact.id);
                }
              }}
              onImport={() => handleImport(contact as ExternalContact)}
            />
          ))
        )}
      </div>

      {/* Selection Count */}
      <div className="p-3 border-t border-gray-200 text-sm text-gray-600">
        Selected: {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default ContactSearchList;
```

---

## Files to Modify

- **Create:** `src/components/shared/ContactSearchList.tsx`
- **Create:** `src/components/shared/ContactSearchList.test.tsx`

## Files to Read (for context)

- `src/components/shared/ContactRow.tsx` - Dependency (TASK-1762)
- `src/components/shared/ContactSelector.tsx` - Similar patterns to reference
- `src/types/components.ts` - ExtendedContact type

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test file:** `src/components/shared/ContactSearchList.test.tsx`

```tsx
describe('ContactSearchList', () => {
  describe('search filtering', () => {
    it('filters contacts by name', () => {});
    it('filters contacts by email', () => {});
    it('filters contacts by phone', () => {});
    it('shows all contacts when search is empty', () => {});
    it('shows "no matches" message when search has no results', () => {});
  });

  describe('combined list', () => {
    it('shows both imported and external contacts', () => {});
    it('shows [Imported] pill for imported contacts', () => {});
    it('shows [External] pill for external contacts', () => {});
    it('shows import button only for external contacts', () => {});
  });

  describe('selection', () => {
    it('adds contact to selection on click', () => {});
    it('removes contact from selection on second click', () => {});
    it('shows selected styling for selected contacts', () => {});
    it('updates selection count display', () => {});
  });

  describe('auto-import', () => {
    it('calls onImportContact when selecting external contact', () => {});
    it('adds imported contact ID to selection after import', () => {});
    it('handles import errors gracefully', () => {});
    it('shows loading state while importing', () => {});
  });

  describe('manual import button', () => {
    it('calls onImportContact when import button clicked', () => {});
    it('does not toggle selection when import button clicked', () => {});
  });

  describe('states', () => {
    it('shows loading spinner when isLoading is true', () => {});
    it('shows error message when error is provided', () => {});
    it('shows empty state when no contacts', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add ContactSearchList component (TASK-1763)`
- **Branch:** `feature/task-1763-contactsearchlist-component`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Verified TASK-1762 is merged
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: ContactSelector without external contact support
- **After**: ContactSearchList with unified list and auto-import
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~18K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- TASK-1762 (ContactRow) is not merged yet
- You need to define new types for external contacts beyond ExternalContact interface
- The auto-import behavior seems unclear or needs modification
- Performance concerns with large contact lists (>1000)
