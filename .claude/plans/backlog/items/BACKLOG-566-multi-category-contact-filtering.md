# BACKLOG-566: Multi-Category Contact Filtering in EditContactsModal

## Status
- **Priority**: Medium
- **Status**: Ready
- **Category**: Enhancement
- **Created**: 2026-01-29
- **Related Sprint**: SPRINT-066 (follow-up to TASK-1765)

## Problem Statement

The current EditContactsModal (Screen 2 - Add Contacts overlay) has a single checkbox toggle "Include message contacts" that filters contacts in/out. This is too coarse-grained.

**Current state:**
- Single checkbox: "Include message contacts" (on/off)
- When OFF: hides all message-derived contacts
- When ON: shows all contacts including message-derived

**User need:**
Users want finer-grained control to filter by contact category:
- Imported contacts (from macOS Contacts or other imports)
- Manually added contacts
- External contacts (from address book APIs)
- Message-derived contacts (extracted from emails/SMS)

## Proposed Solution

Replace the single "Include message contacts" checkbox with 4 category filter checkboxes that can be independently toggled:

```
[x] Imported  [x] Manual  [x] External  [ ] Messages
```

**Default state:**
- Imported: ON
- Manually Added: ON
- External: ON
- Message-derived: OFF (same as current default)

**Benefits:**
- Users can see only imported contacts
- Users can hide external contacts while keeping message-derived visible
- Fine-grained filtering without multiple modal flows

## Technical Approach

### New Utility File: `src/utils/contactCategoryUtils.ts`

```typescript
export interface CategoryFilter {
  imported: boolean;
  manuallyAdded: boolean;
  external: boolean;
  messageDerived: boolean;
}

export const DEFAULT_CATEGORY_FILTER: CategoryFilter = {
  imported: true,
  manuallyAdded: true,
  external: true,
  messageDerived: false,
};

export function getContactCategory(contact: ExtendedContact, isExternal = false): string {
  if (isExternal) return 'external';
  if (contact.is_message_derived === 1 || contact.is_message_derived === true) return 'message_derived';
  if (['email', 'sms', 'inferred'].includes(contact.source || '')) return 'message_derived';
  if (contact.source === 'manual') return 'manually_added';
  return 'imported';
}
```

### Changes to EditContactsModal.tsx

1. Replace `showMessageContacts: boolean` state with `categoryFilter: CategoryFilter` state
2. Persist filter state to localStorage for user preference retention
3. Replace single checkbox with 4 inline checkboxes (same styling)
4. Update `availableContacts` memo to filter by category
5. Lazy-load external contacts when "External" checkbox is enabled

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `src/utils/contactCategoryUtils.ts` | CREATE | New utility file for category types and helpers |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | MODIFY | Expand single checkbox to 4 category checkboxes |

## Acceptance Criteria

- [ ] New utility file created with `CategoryFilter` interface and `getContactCategory()` function
- [ ] EditContactsModal shows 4 checkboxes instead of 1
- [ ] Each checkbox toggles independently
- [ ] Default state: Imported, Manual, External ON; Messages OFF
- [ ] Filter state persists across modal opens (localStorage)
- [ ] Contacts correctly categorized based on source field
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Verification Steps

1. Open transaction -> Edit Contacts -> Add Contacts
2. Verify 4 checkboxes displayed in same row style as before
3. Toggle each checkbox - verify contacts filter correctly
4. Close and reopen modal - verify filter state persisted
5. Run `npm run type-check` and `npm test`

## Estimated Effort

~15K tokens (small enhancement, well-scoped)

## Dependencies

- TASK-1765 (EditContactsModal redesign) - COMPLETED

## Notes

This is a follow-up enhancement to the SPRINT-066 contact UX overhaul. The current single-checkbox design was implemented in TASK-1765 as a quick solution; this backlog item provides the full multi-category filtering originally envisioned.
