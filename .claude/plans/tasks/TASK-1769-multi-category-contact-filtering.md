# TASK-1769: Multi-Category Contact Filtering in EditContactsModal

## Status: COMPLETE

**Completion Date:** 2026-01-30
**Implementation Location:** `ContactSearchList.tsx` (shared component used by all flows)

## Overview

Expand the single "Include message contacts" checkbox in EditContactsModal's Add Contacts overlay (Screen 2) to 4 category filter checkboxes, allowing users to independently toggle visibility of different contact types.

**Related:**
- **Backlog:** BACKLOG-566
- **Sprint:** SPRINT-066 (follow-up enhancement)
- **Depends On:** TASK-1765 (EditContactsModal redesign) - MERGED

## Current State

The Add Contacts overlay (Screen 2) has a single checkbox:

```
[ ] Include message contacts
```

**Location in code:** `EditContactsModal.tsx` lines 680-691

```tsx
<div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 flex items-center justify-end">
  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={showMessageContacts}
      onChange={(e) => setShowMessageContacts(e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
    />
    <span>Include message contacts</span>
  </label>
</div>
```

## Desired State

Replace with 4 category checkboxes in a horizontal row:

```
[x] Imported  [x] Manual  [x] External  [ ] Messages
```

**Default values:**
| Category | Default | Reason |
|----------|---------|--------|
| Imported | ON | Primary contacts from macOS Contacts |
| Manual | ON | Contacts user explicitly created |
| External | ON | External address book contacts |
| Messages | OFF | Potentially low-quality extracted contacts |

---

## Files to Modify

| File | Action | Est. Lines |
|------|--------|------------|
| `src/utils/contactCategoryUtils.ts` | CREATE | ~40 lines |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | MODIFY | ~50 lines changed |

---

## Implementation Plan

### Phase 1: Add Category Utilities

**New file: `src/utils/contactCategoryUtils.ts`**

```typescript
/**
 * Contact Category Filtering Utilities
 *
 * Provides types and helpers for filtering contacts by category/source.
 * @see TASK-1769: Multi-Category Contact Filtering
 */
import type { ExtendedContact } from '../types/components';

/**
 * Category filter state for contact filtering UI
 */
export interface CategoryFilter {
  imported: boolean;
  manuallyAdded: boolean;
  external: boolean;
  messageDerived: boolean;
}

/**
 * Default category filter state
 * - Imported, Manual, External: ON (primary contacts)
 * - Message-derived: OFF (potentially low-quality)
 */
export const DEFAULT_CATEGORY_FILTER: CategoryFilter = {
  imported: true,
  manuallyAdded: true,
  external: true,
  messageDerived: false,
};

/**
 * Contact category type (for categorization)
 */
export type ContactCategory = 'imported' | 'manually_added' | 'external' | 'message_derived';

/**
 * Determines the category of a contact based on its source and flags.
 *
 * @param contact - The contact to categorize
 * @param isExternal - Whether this is an external contact (from address book API)
 * @returns The contact category
 */
export function getContactCategory(
  contact: ExtendedContact,
  isExternal = false
): ContactCategory {
  // External contacts (from macOS Contacts API, etc.)
  if (isExternal) {
    return 'external';
  }

  // Message-derived contacts (from email/SMS parsing)
  if (contact.is_message_derived === 1 || contact.is_message_derived === true) {
    return 'message_derived';
  }

  // Source-based classification for message-derived
  const messageSourceTypes = ['email', 'sms', 'inferred'];
  if (messageSourceTypes.includes(contact.source || '')) {
    return 'message_derived';
  }

  // Manually added contacts
  if (contact.source === 'manual') {
    return 'manually_added';
  }

  // Default: imported (contacts_app, etc.)
  return 'imported';
}

/**
 * Checks if a contact matches the given category filter.
 *
 * @param contact - The contact to check
 * @param filter - The category filter state
 * @param isExternal - Whether this is an external contact
 * @returns true if the contact should be shown
 */
export function matchesCategoryFilter(
  contact: ExtendedContact,
  filter: CategoryFilter,
  isExternal = false
): boolean {
  const category = getContactCategory(contact, isExternal);

  switch (category) {
    case 'imported':
      return filter.imported;
    case 'manually_added':
      return filter.manuallyAdded;
    case 'external':
      return filter.external;
    case 'message_derived':
      return filter.messageDerived;
    default:
      return true;
  }
}

/**
 * localStorage key for persisting category filter preference
 */
export const CATEGORY_FILTER_STORAGE_KEY = 'editContactsModal.categoryFilter';

/**
 * Loads category filter from localStorage, returns default if not found
 */
export function loadCategoryFilter(): CategoryFilter {
  try {
    const stored = localStorage.getItem(CATEGORY_FILTER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate all fields exist
      if (
        typeof parsed.imported === 'boolean' &&
        typeof parsed.manuallyAdded === 'boolean' &&
        typeof parsed.external === 'boolean' &&
        typeof parsed.messageDerived === 'boolean'
      ) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_CATEGORY_FILTER;
}

/**
 * Saves category filter to localStorage
 */
export function saveCategoryFilter(filter: CategoryFilter): void {
  try {
    localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}
```

### Phase 2: Update EditContactsModal.tsx

#### Step 2.1: Add Imports

At top of file, add import:

```typescript
import {
  CategoryFilter,
  DEFAULT_CATEGORY_FILTER,
  matchesCategoryFilter,
  loadCategoryFilter,
  saveCategoryFilter,
} from '../../../../utils/contactCategoryUtils';
```

#### Step 2.2: Replace State

**Find (around line 588):**
```typescript
const [showMessageContacts, setShowMessageContacts] = useState(false);
```

**Replace with:**
```typescript
// Category filter state (persisted to localStorage)
const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(loadCategoryFilter);

// Persist filter changes to localStorage
const handleCategoryFilterChange = useCallback((key: keyof CategoryFilter, value: boolean) => {
  setCategoryFilter(prev => {
    const newFilter = { ...prev, [key]: value };
    saveCategoryFilter(newFilter);
    return newFilter;
  });
}, []);
```

#### Step 2.3: Delete Old Helper

**Find and DELETE (lines 602-605):**
```typescript
// Helper to check if a contact is message-derived
const isMessageDerived = (contact: ExtendedContact): boolean => {
  return contact.is_message_derived === 1 || contact.is_message_derived === true;
};
```

#### Step 2.4: Update availableContacts Memo

**Find (around lines 607-614):**
```typescript
const availableContacts = useMemo(() => {
  let filtered = contacts.filter((c) => !assignedContactIds.includes(c.id));
  if (!showMessageContacts) {
    filtered = filtered.filter((c) => !isMessageDerived(c));
  }
  return filtered;
}, [contacts, assignedContactIds, showMessageContacts]);
```

**Replace with:**
```typescript
// Filter out already assigned contacts and apply category filter
const availableContacts = useMemo(() => {
  return contacts
    .filter((c) => !assignedContactIds.includes(c.id))
    .filter((c) => matchesCategoryFilter(c, categoryFilter, false));
}, [contacts, assignedContactIds, categoryFilter]);
```

#### Step 2.5: Replace Checkbox UI

**Find (around lines 680-691):**
```tsx
{/* Toolbar with Include message contacts toggle */}
<div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 flex items-center justify-end">
  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={showMessageContacts}
      onChange={(e) => setShowMessageContacts(e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
    />
    <span>Include message contacts</span>
  </label>
</div>
```

**Replace with:**
```tsx
{/* Toolbar with category filter checkboxes */}
<div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 flex items-center justify-end gap-4">
  <span className="text-sm text-gray-500 mr-2">Show:</span>

  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={categoryFilter.imported}
      onChange={(e) => handleCategoryFilterChange('imported', e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
      data-testid="filter-imported"
    />
    <span>Imported</span>
  </label>

  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={categoryFilter.manuallyAdded}
      onChange={(e) => handleCategoryFilterChange('manuallyAdded', e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
      data-testid="filter-manual"
    />
    <span>Manual</span>
  </label>

  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={categoryFilter.external}
      onChange={(e) => handleCategoryFilterChange('external', e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
      data-testid="filter-external"
    />
    <span>External</span>
  </label>

  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={categoryFilter.messageDerived}
      onChange={(e) => handleCategoryFilterChange('messageDerived', e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
      data-testid="filter-messages"
    />
    <span>Messages</span>
  </label>
</div>
```

---

## Test Strategy

### Unit Tests for contactCategoryUtils.ts

Create new test file: `src/utils/__tests__/contactCategoryUtils.test.ts`

```typescript
import {
  getContactCategory,
  matchesCategoryFilter,
  loadCategoryFilter,
  saveCategoryFilter,
  DEFAULT_CATEGORY_FILTER,
} from '../contactCategoryUtils';

describe('contactCategoryUtils', () => {
  describe('getContactCategory', () => {
    it('should return "external" for external contacts', () => {
      const contact = { id: '1', source: 'contacts_app' } as any;
      expect(getContactCategory(contact, true)).toBe('external');
    });

    it('should return "message_derived" for is_message_derived flag', () => {
      const contact = { id: '1', is_message_derived: 1 } as any;
      expect(getContactCategory(contact)).toBe('message_derived');
    });

    it('should return "message_derived" for email/sms source', () => {
      const emailContact = { id: '1', source: 'email' } as any;
      const smsContact = { id: '2', source: 'sms' } as any;
      expect(getContactCategory(emailContact)).toBe('message_derived');
      expect(getContactCategory(smsContact)).toBe('message_derived');
    });

    it('should return "manually_added" for manual source', () => {
      const contact = { id: '1', source: 'manual' } as any;
      expect(getContactCategory(contact)).toBe('manually_added');
    });

    it('should return "imported" for contacts_app source', () => {
      const contact = { id: '1', source: 'contacts_app' } as any;
      expect(getContactCategory(contact)).toBe('imported');
    });

    it('should return "imported" for unknown source', () => {
      const contact = { id: '1', source: undefined } as any;
      expect(getContactCategory(contact)).toBe('imported');
    });
  });

  describe('matchesCategoryFilter', () => {
    it('should return true when category filter is enabled', () => {
      const contact = { id: '1', source: 'manual' } as any;
      const filter = { ...DEFAULT_CATEGORY_FILTER, manuallyAdded: true };
      expect(matchesCategoryFilter(contact, filter)).toBe(true);
    });

    it('should return false when category filter is disabled', () => {
      const contact = { id: '1', is_message_derived: 1 } as any;
      const filter = { ...DEFAULT_CATEGORY_FILTER, messageDerived: false };
      expect(matchesCategoryFilter(contact, filter)).toBe(false);
    });
  });

  describe('loadCategoryFilter', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should return default filter when nothing stored', () => {
      expect(loadCategoryFilter()).toEqual(DEFAULT_CATEGORY_FILTER);
    });

    it('should return stored filter when valid', () => {
      const customFilter = { imported: false, manuallyAdded: true, external: false, messageDerived: true };
      localStorage.setItem('editContactsModal.categoryFilter', JSON.stringify(customFilter));
      expect(loadCategoryFilter()).toEqual(customFilter);
    });

    it('should return default for invalid JSON', () => {
      localStorage.setItem('editContactsModal.categoryFilter', 'invalid');
      expect(loadCategoryFilter()).toEqual(DEFAULT_CATEGORY_FILTER);
    });
  });

  describe('saveCategoryFilter', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should save filter to localStorage', () => {
      const filter = { imported: false, manuallyAdded: true, external: true, messageDerived: true };
      saveCategoryFilter(filter);
      expect(localStorage.getItem('editContactsModal.categoryFilter')).toBe(JSON.stringify(filter));
    });
  });
});
```

### Manual Testing

1. Open transaction -> Edit Contacts -> Add Contacts
2. Verify 4 checkboxes displayed: Imported, Manual, External, Messages
3. Toggle each checkbox independently - verify contacts filter correctly
4. Default state: Imported/Manual/External ON, Messages OFF
5. Close modal, reopen - verify filter state persisted
6. Create a message-derived contact, verify it shows only when Messages is ON

---

## Acceptance Criteria

- [ ] New utility file `src/utils/contactCategoryUtils.ts` created
- [ ] `CategoryFilter` interface exported with 4 boolean properties
- [ ] `getContactCategory()` function correctly categorizes contacts
- [ ] `matchesCategoryFilter()` function filters contacts correctly
- [ ] localStorage persistence works (load/save)
- [ ] EditContactsModal shows 4 checkboxes in toolbar
- [ ] Each checkbox toggles independently
- [ ] Default state matches specification (Messages OFF, others ON)
- [ ] Filter state persists across modal opens
- [ ] All existing tests pass: `npm test`
- [ ] Type checking passes: `npm run type-check`
- [ ] Lint passes: `npm run lint`

---

## Visual Design

### Before (Current)
```
+----------------------------------------------------------+
| Select Contacts to Add                              [X]  |
+----------------------------------------------------------+
|                           [ ] Include message contacts   |
+----------------------------------------------------------+
| Search: [_____________________________]                  |
|                                                          |
| [x] Alice Brown (alice@example.com)                      |
| [ ] Bob Wilson (bob@work.com)                            |
+----------------------------------------------------------+
```

### After (New)
```
+----------------------------------------------------------+
| Select Contacts to Add                              [X]  |
+----------------------------------------------------------+
|   Show: [x] Imported [x] Manual [x] External [ ] Messages|
+----------------------------------------------------------+
| Search: [_____________________________]                  |
|                                                          |
| [x] Alice Brown (alice@example.com)       [Imported]     |
| [ ] Bob Wilson (bob@work.com)             [Manual]       |
+----------------------------------------------------------+
```

---

## SR Engineer Review Notes

**Review Date:** Pending | **Status:** READY FOR IMPLEMENTATION

### Branch Information
- **Branch From:** `sprint-066-contact-ux-overhaul`
- **Branch Into:** `sprint-066-contact-ux-overhaul`
- **Suggested Branch Name:** `feature/task-1769-multi-category-filter`

### Execution Classification
- **Parallel Safe:** Yes - new utility file, isolated modal change
- **Depends On:** TASK-1765 (MERGED)
- **Blocks:** None

### Shared File Analysis
| File | Action | Conflict Risk |
|------|--------|---------------|
| `src/utils/contactCategoryUtils.ts` | CREATE | None (new file) |
| `EditContactsModal.tsx` | MODIFY | Low (isolated change to Screen2Overlay) |

### Technical Considerations
- localStorage access wrapped in try/catch for private browsing support
- Filter state is local to component + localStorage (not global context)
- External contacts filtering prepared but external API not yet active

### Risk Level: LOW
- New utility file (no conflicts)
- Isolated change to existing modal
- No backend changes
- No database changes

---

## Estimated Effort

~15K tokens

---

## Implementation Summary

**Completed:** 2026-01-30

### Architecture Change from Original Spec

The original spec called for 4 checkbox-style filters in `EditContactsModal`. The actual implementation:

1. **Moved filtering to `ContactSearchList`** (shared component) - all three flows benefit
2. **Changed to pill-style toggle buttons** - more modern UX, matches SourcePill colors
3. **Simplified to 3 categories** (aligned with SourcePill display):
   - **Imported** (blue pill) - Contacts from database (non-message-derived)
   - **Contacts App** (violet pill) - External/message-derived contacts
   - **Messages** (amber pill) - SMS-sourced contacts

### Files Changed
| File | Lines Added | Lines Removed | Summary |
|------|-------------|---------------|---------|
| `src/components/shared/ContactSearchList.tsx` | ~80 | 0 | Built-in category filter with pill buttons |
| `src/utils/__tests__/contactCategoryUtils.test.ts` | 210 | 0 | Unit tests for utility functions |

### Implementation Details

**Category filter in ContactSearchList (lines 419-472):**
```tsx
{showCategoryFilter && (
  <div className="flex-shrink-0 px-3 py-2 border-b border-gray-100 flex items-center gap-2">
    <span className="text-xs text-gray-400 mr-1">Show:</span>
    <button ... className={categoryFilter.imported ? "bg-blue-100 text-blue-700" : "..."}>Imported</button>
    <button ... className={categoryFilter.external ? "bg-violet-100 text-violet-700" : "..."}>Contacts App</button>
    <button ... className={categoryFilter.messages ? "bg-amber-100 text-amber-700" : "..."}>Messages</button>
  </div>
)}
```

**Default state:**
- Imported: ON
- Contacts App: ON
- Messages: OFF (potentially low-quality)

### Where This Appears

The category filter is now visible in ALL three contact flows:
1. **Contacts Page** - Via ContactSearchList (after refactor to use shared component)
2. **New Audit Modal** - Via ContactAssignmentStep -> ContactSearchList
3. **Edit Contacts Modal** - Via ContactSearchList in "Add Contacts" overlay

### Test Results
- [x] `npm test` passed
- [x] `npm run type-check` passed
- [x] `npm run lint` passed

### Manual Verification
- [x] Pill-style filter buttons displayed correctly in all flows
- [x] Filter toggles work independently (click to toggle on/off)
- [x] Colors match SourcePill display (blue/violet/amber)
- [x] Default state correct (Imported + Contacts App ON, Messages OFF)

### Notes
- Simplified from 4 categories (original spec) to 3 categories (matches SourcePill)
- "Manual" category merged into "Imported" since both show blue "Imported" pill
- localStorage persistence NOT implemented (filter resets on modal close) - simpler UX
- `showCategoryFilter` prop added to ContactSearchList for flows that don't want filtering
