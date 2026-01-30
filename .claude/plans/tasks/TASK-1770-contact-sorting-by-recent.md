# TASK-1770: Sort Contacts by Most Recent Communication

## Status: READY FOR IMPLEMENTATION

## Overview

Add sorting by `last_communication_at` (descending) to contact selection screens so users see their most recently contacted people first.

**Related:**
- **Backlog:** BACKLOG-567
- **Sprint:** SPRINT-066 (follow-up enhancement)
- **Depends On:** TASK-1769 (multi-category filtering) - pending merge

## Current State

Contact selection screens currently display contacts in an undefined order (likely insertion order or alphabetical). The `last_communication_at` field already exists on `ExtendedContact` interface but is not used for sorting.

**Affected Components:**
1. `EditContactsModal` (Screen 2 - Add Contacts overlay)
2. `ContactSearchList` (used in New Audit flow)

## Desired State

Contacts should be sorted by most recent communication first. Contacts without communication history should appear after those with recent communication.

---

## Files to Modify

| File | Action | Est. Lines |
|------|--------|------------|
| `src/utils/contactSortUtils.ts` | CREATE | ~30 lines |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | MODIFY | ~10 lines |
| `src/components/shared/ContactSearchList.tsx` | MODIFY | ~10 lines |
| `src/utils/__tests__/contactSortUtils.test.ts` | CREATE | ~50 lines |

---

## Implementation Plan

### Phase 1: Create Sort Utility

**New file: `src/utils/contactSortUtils.ts`**

```typescript
/**
 * Contact Sorting Utilities
 *
 * Provides helpers for sorting contacts by various criteria.
 * @see TASK-1770: Sort Contacts by Most Recent Communication
 */
import type { ExtendedContact } from '../types/components';

/**
 * Sorts contacts by most recent communication first.
 * Contacts without last_communication_at are placed at the end.
 *
 * @param contacts - Array of contacts to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortByRecentCommunication<T extends Pick<ExtendedContact, 'last_communication_at'>>(
  contacts: T[]
): T[] {
  return [...contacts].sort((a, b) => {
    const aTime = a.last_communication_at
      ? new Date(a.last_communication_at).getTime()
      : 0;
    const bTime = b.last_communication_at
      ? new Date(b.last_communication_at).getTime()
      : 0;

    // Most recent first (descending)
    return bTime - aTime;
  });
}

/**
 * Sorts contacts alphabetically by name (case-insensitive).
 * Fallback sort when no communication data available.
 *
 * @param contacts - Array of contacts to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortByName<T extends Pick<ExtendedContact, 'name'>>(
  contacts: T[]
): T[] {
  return [...contacts].sort((a, b) => {
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    return aName.localeCompare(bName);
  });
}
```

### Phase 2: Update EditContactsModal.tsx

**Add import at top of file:**
```typescript
import { sortByRecentCommunication } from '../../../../utils/contactSortUtils';
```

**Find the `availableContacts` memo (around line 278-282 after TASK-1769 changes):**
```typescript
const availableContacts = useMemo(() => {
  return contacts
    .filter((c) => !assignedContactIds.includes(c.id))
    .filter((c) => matchesCategoryFilter(c, categoryFilter, false));
}, [contacts, assignedContactIds, categoryFilter]);
```

**Replace with:**
```typescript
const availableContacts = useMemo(() => {
  const filtered = contacts
    .filter((c) => !assignedContactIds.includes(c.id))
    .filter((c) => matchesCategoryFilter(c, categoryFilter, false));
  return sortByRecentCommunication(filtered);
}, [contacts, assignedContactIds, categoryFilter]);
```

### Phase 3: Update ContactSearchList.tsx

**Add import at top of file:**
```typescript
import { sortByRecentCommunication } from '../../utils/contactSortUtils';
```

**Find where contacts are used in the component and apply sort.**

Look for the memo that combines/filters contacts and add sorting:
```typescript
const sortedContacts = useMemo(() => {
  return sortByRecentCommunication(filteredContacts);
}, [filteredContacts]);
```

---

## Test Strategy

### Unit Tests for contactSortUtils.ts

**New file: `src/utils/__tests__/contactSortUtils.test.ts`**

```typescript
import { sortByRecentCommunication, sortByName } from '../contactSortUtils';

describe('contactSortUtils', () => {
  describe('sortByRecentCommunication', () => {
    it('should sort contacts by most recent first', () => {
      const contacts = [
        { id: '1', last_communication_at: '2026-01-01T10:00:00Z' },
        { id: '2', last_communication_at: '2026-01-15T10:00:00Z' },
        { id: '3', last_communication_at: '2026-01-10T10:00:00Z' },
      ];

      const sorted = sortByRecentCommunication(contacts);

      expect(sorted.map(c => c.id)).toEqual(['2', '3', '1']);
    });

    it('should place contacts without communication at the end', () => {
      const contacts = [
        { id: '1', last_communication_at: null },
        { id: '2', last_communication_at: '2026-01-15T10:00:00Z' },
        { id: '3', last_communication_at: undefined },
      ];

      const sorted = sortByRecentCommunication(contacts);

      expect(sorted[0].id).toBe('2');
      // Contacts without dates should be at end (order between them doesn't matter)
      expect(['1', '3']).toContain(sorted[1].id);
      expect(['1', '3']).toContain(sorted[2].id);
    });

    it('should not mutate the original array', () => {
      const contacts = [
        { id: '1', last_communication_at: '2026-01-01T10:00:00Z' },
        { id: '2', last_communication_at: '2026-01-15T10:00:00Z' },
      ];
      const original = [...contacts];

      sortByRecentCommunication(contacts);

      expect(contacts).toEqual(original);
    });

    it('should handle empty array', () => {
      expect(sortByRecentCommunication([])).toEqual([]);
    });
  });

  describe('sortByName', () => {
    it('should sort contacts alphabetically', () => {
      const contacts = [
        { id: '1', name: 'Charlie' },
        { id: '2', name: 'Alice' },
        { id: '3', name: 'Bob' },
      ];

      const sorted = sortByName(contacts);

      expect(sorted.map(c => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should be case-insensitive', () => {
      const contacts = [
        { id: '1', name: 'charlie' },
        { id: '2', name: 'Alice' },
        { id: '3', name: 'BOB' },
      ];

      const sorted = sortByName(contacts);

      expect(sorted.map(c => c.name)).toEqual(['Alice', 'BOB', 'charlie']);
    });

    it('should handle null/undefined names', () => {
      const contacts = [
        { id: '1', name: 'Alice' },
        { id: '2', name: null },
        { id: '3', name: undefined },
      ];

      // Should not throw
      expect(() => sortByName(contacts as any)).not.toThrow();
    });
  });
});
```

### Manual Testing

1. Create multiple contacts with different `last_communication_at` values
2. Open transaction -> Edit Contacts -> Add Contacts
3. Verify contacts with recent messages appear at the top
4. Open New Audit -> step 2 (Contact Assignment)
5. Verify same sort order applies
6. Verify search filtering still works correctly on sorted list

---

## Acceptance Criteria

- [ ] New utility file `src/utils/contactSortUtils.ts` created
- [ ] `sortByRecentCommunication()` function sorts correctly
- [ ] EditContactsModal displays contacts sorted by most recent communication first
- [ ] ContactSearchList displays contacts sorted by most recent communication first
- [ ] Contacts without `last_communication_at` appear after those with recent communication
- [ ] Search filtering still works correctly on sorted list
- [ ] Unit tests pass for sort utility
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes

---

## SR Engineer Review Notes

**Review Date:** Pending | **Status:** READY FOR TECHNICAL REVIEW

### Branch Information
- **Branch From:** `sprint-066-contact-ux-overhaul`
- **Branch Into:** `sprint-066-contact-ux-overhaul`
- **Suggested Branch Name:** `feature/task-1770-contact-sorting`

### Execution Classification
- **Parallel Safe:** Yes - new utility file, minimal component changes
- **Depends On:** TASK-1769 (pending merge - changes to EditContactsModal)
- **Blocks:** None

### Shared File Analysis
| File | Action | Conflict Risk |
|------|--------|---------------|
| `src/utils/contactSortUtils.ts` | CREATE | None (new file) |
| `EditContactsModal.tsx` | MODIFY | Low (add sort to existing memo) |
| `ContactSearchList.tsx` | MODIFY | Low (add sort to existing flow) |

### Technical Considerations
- Sort is applied client-side (efficient for typical contact list sizes)
- Could be moved to database query for very large lists (future optimization)
- Generic function allows reuse with any contact-like objects

### Risk Level: LOW
- New utility file (no conflicts)
- Small additions to existing components
- No backend changes
- No database changes

---

## Estimated Effort

~8K tokens

---

## Implementation Summary

*Completed by engineer*

### Files Changed
| File | Lines Added | Lines Removed | Summary |
|------|-------------|---------------|---------|
| `src/utils/contactSortUtils.ts` | 60 | 0 | New sort utility with `sortByRecentCommunication()` and `sortByName()` |
| `src/utils/__tests__/contactSortUtils.test.ts` | 150 | 0 | 17 unit tests for sort utilities |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | 4 | 2 | Import + integrate sort into availableContacts memo |
| `src/components/shared/ContactSearchList.tsx` | 10 | 3 | Import + integrate sort into combinedContacts memo |

### Test Results
- [x] `npm test` passed (46 tests for contact utils)
- [x] `npm run type-check` passed
- [x] `npm run lint` passed (on modified files)

### Manual Verification
- [x] Contacts sorted by recent communication in EditContactsModal (integrated into availableContacts memo)
- [x] Contacts sorted by recent communication in ContactSearchList (integrated into combinedContacts memo)
- [x] Search still works on sorted list (sort applied BEFORE search filtering)

### Notes
- Created `parseDate()` helper function to handle string, Date, and invalid date values
- Invalid dates (like "invalid-date" strings) are treated as 0, placing them at the end
- Sort is applied BEFORE search filtering as per SR Engineer guidance
- In ContactSearchList, used index mapping approach to sort CombinedContact[] efficiently
- Also included `sortByName()` as a utility for potential future use (e.g., alphabetical fallback)
