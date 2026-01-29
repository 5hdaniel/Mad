# TASK-1760: Unified Contact Selection and Management UX

**Backlog Item**: BACKLOG-386
**Sprint**: TBD
**Estimated Tokens**: ~10K (revised - see SR Engineer Review)
**Priority**: High
**Status**: Pending

---

## Summary

Enhance the `ContactSelector` component to provide a unified contact selection experience that shows ALL contacts (imported and not-imported) in a single list with visual source badges and multi-filter controls. This aligns the selection modal UX with the design patterns already established in `Contacts.tsx` and `ContactCard.tsx`.

---

## Context

### Current State
- `ContactSelector.tsx` already has partial BACKLOG-386 implementation:
  - `showSourceFilters` prop enables multi-filter chip UI
  - `SourceFilterChip` component exists for filter toggles
  - `getSourceBadge()` function exists in `src/types/components.ts`
  - Source badges display when `showSourceFilters={true}`
- `EditContactsModal.tsx` uses `ContactSelector` with `showSourceFilters={true}`
- `Contacts.tsx` (dashboard) has its own implementation with a single "Include message contacts" toggle

### Problems to Solve
1. **Not all contact sources shown together**: Need to ensure imported AND external contacts appear in same list
2. **Source pill styling inconsistency**: Current `SourceFilterChip` has different styling than `ContactCard` source badges
3. **Messages filter default**: Messages (SMS) should be OFF by default to hide weird numbers (1800, *166)
4. **Scrollbar padding**: List needs proper padding so content doesn't overlap scrollbar
5. **Filter state persistence**: Consider persisting filter preferences to localStorage (like `Contacts.tsx` does)

---

## Acceptance Criteria

### Required
- [ ] Contact list shows ALL contacts regardless of import status (imported, external, manual, message, inferred)
- [ ] Each contact row displays a colored source pill badge matching the design in `ContactCard.tsx`
- [ ] Multi-filter checkboxes for each source type: Manual, Email, Contacts App, Messages, Inferred
- [ ] Messages (SMS) filter is OFF by default
- [ ] All other filters (Manual, Email, Contacts App, Inferred) are ON by default
- [ ] Filter controls use chip/pill design that matches the source badges aesthetically
- [ ] Contact list has proper padding-right to prevent content overlapping scrollbar
- [ ] Selected contacts remain visible even if their source filter is toggled off (prevent "lost" selections)

### Nice to Have
- [ ] Persist filter preferences to localStorage (key: `contactSelector.sourceFilters`)
- [ ] Show count of contacts per source type in filter chips
- [ ] Animate filter chip state changes

---

## Implementation Notes

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared/ContactSelector.tsx` | Main component - enhance filtering, badges, scrollbar padding |

### Key Implementation Details

#### 1. Source Badge Consistency (ALREADY DONE)
`getSourceBadge()` from `src/types/components.ts` is already imported and used. The badge colors are:
```typescript
manual: { text: "Manual", color: "bg-blue-100 text-blue-700" }
email: { text: "From Email", color: "bg-green-100 text-green-700" }
contacts_app: { text: "Contacts App", color: "bg-purple-100 text-purple-700" }
sms: { text: "From SMS", color: "bg-orange-100 text-orange-700" }
inferred: { text: "Inferred", color: "bg-gray-100 text-gray-700" }
```

**Note:** Fix SourceFilterChip "Inferred" color from `bg-gray-200` to `bg-gray-100` (line 464).

#### 2. Default Filter State (ALREADY DONE)
Current `DEFAULT_SOURCE_FILTERS` is correct - no changes needed:
```typescript
const DEFAULT_SOURCE_FILTERS: SourceFilters = {
  manual: true,
  email: true,
  contacts_app: true,
  sms: false,  // Messages OFF by default
  inferred: true,
};
```

#### 3. Scrollbar Padding Fix (NEEDS IMPLEMENTATION)
Add padding-right to the contact list container (line 491):
```tsx
// Current:
className="flex-1 overflow-y-auto"

// Change to:
className="flex-1 overflow-y-auto pr-2"
```

#### 4. Preserve Selected Contacts When Filter Changes (NEEDS IMPLEMENTATION)
**This is the main implementation work.** When a filter is toggled off, contacts that are already selected should remain visible.

Current code (lines 252-260):
```typescript
if (showSourceFilters) {
  filtered = filtered.filter((contact) => {
    const source = getContactSource(contact);
    return sourceFilters[source] ?? true;
  });
}
```

Change to:
```typescript
if (showSourceFilters) {
  filtered = filtered.filter((contact) => {
    // Always show selected contacts regardless of filter
    if (selectedIds.includes(contact.id)) {
      return true;
    }
    const source = getContactSource(contact);
    return sourceFilters[source] ?? true;
  });
}
```

**Also update the useMemo dependency array** (line 293) to include `selectedIds`:
```typescript
// Current:
}, [contacts, searchQuery, showSourceFilters, sourceFilters, showMessageContactsFilter, includeMessageContacts, getContactSource]);

// Change to:
}, [contacts, searchQuery, showSourceFilters, sourceFilters, selectedIds, showMessageContactsFilter, includeMessageContacts, getContactSource]);
```

#### 5. Filter Chip Label Updates
Consider updating filter chip labels to be more user-friendly:
- "Manual" -> "Manual"
- "Email" -> "Email"
- "Contacts" -> "Contacts App"
- "Messages" -> "Messages" (keep short)
- "Inferred" -> "Inferred"

#### 6. Optional: localStorage Persistence
```typescript
const FILTER_STORAGE_KEY = "contactSelector.sourceFilters";

const [sourceFilters, setSourceFilters] = useState<SourceFilters>(() => {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SOURCE_FILTERS, ...JSON.parse(stored) };
    }
  } catch {}
  return DEFAULT_SOURCE_FILTERS;
});

useEffect(() => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(sourceFilters));
  } catch {}
}, [sourceFilters]);
```

---

## Testing Checklist

### Manual Testing
- [ ] Open Edit Contacts modal on a transaction
- [ ] Verify all contact sources appear in the list
- [ ] Verify source badges display with correct colors
- [ ] Toggle each filter and verify contacts filter correctly
- [ ] Verify Messages filter is OFF by default
- [ ] Select a contact, then toggle its source filter OFF - contact should remain visible
- [ ] Verify scrollbar doesn't overlap contact content
- [ ] Search for contacts and verify filtering works with search

### Edge Cases
- [ ] Contact with no source field defaults to "manual"
- [ ] Contact with `is_message_derived=true` treated as "sms" source
- [ ] Empty contact list shows appropriate empty state
- [ ] All filters OFF shows only selected contacts (or empty if none selected)

---

## Non-Goals

The following are explicitly OUT OF SCOPE for this task:

1. **Backend changes**: No API or database schema modifications
2. **Data model changes**: No changes to Contact type or ContactSource enum
3. **Auto-import on selection**: Not implementing the "auto-import external contacts when selected" feature from BACKLOG-386 (separate task)
4. **Contacts.tsx unification**: Not modifying the dashboard Contacts page to share components (separate task)
5. **Import flow changes**: Not modifying ImportContactsModal or import workflows
6. **New contact creation**: Not adding "Add New Contact" button to selector

---

## Dependencies

- None - this is a standalone UI enhancement

---

## Related Items

| Item | Relationship |
|------|--------------|
| BACKLOG-386 | Parent backlog item |
| BACKLOG-418 | Related - Contact Selection UX redesign |
| TASK-1752 | Previous work - Added legacy message contacts filter |
| TASK-1751 | Previous work - Integrated ContactSelector into EditContactsModal |

---

## Files Reference

### Primary
- `/Users/daniel/Documents/Mad/src/components/shared/ContactSelector.tsx` - Component to modify

### Reference (read-only patterns)
- `/Users/daniel/Documents/Mad/src/types/components.ts` - `getSourceBadge()` function
- `/Users/daniel/Documents/Mad/src/components/Contacts.tsx` - Dashboard design patterns
- `/Users/daniel/Documents/Mad/src/components/contact/components/ContactCard.tsx` - Source badge styling
- `/Users/daniel/Documents/Mad/src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Usage example

---

## Implementation Summary

**Completed:** 2026-01-28

### Changes Made
- [x] `src/components/shared/ContactSelector.tsx`:
  - Added `pr-2` to list container className (line 359) for scrollbar padding
  - Added `selectedIds.includes(contact.id)` check in filter logic (lines 168-171) to preserve selected contacts when message filter is off
  - Added `selectedIds` to useMemo dependency array (line 202)

### Decisions Made
- The current codebase uses `showMessageContactsFilter` (simple checkbox) not `showSourceFilters` (multi-chip UI) as described in the task file. Implemented the preservation logic for the existing filter system.
- `EditContactsModal.tsx` already has the 2-step flow (ContactSelector + RoleAssigner) implemented - no changes needed there.
- The "Inferred chip color fix" was not applicable since `SourceFilterChip` component doesn't exist in the current codebase.

### Testing Done
- [x] TypeScript type-check passes
- [x] All 48 ContactSelector tests pass
- [x] Lint check shows only pre-existing error in NotificationContext.tsx (not related to these changes)

---

## SR Engineer Review Notes

**Review Date:** 2026-01-28 | **Status:** APPROVED WITH CLARIFICATIONS

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1760-unified-contact-selection`

### Execution Classification
- **Parallel Safe:** Yes (isolated UI component work)
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `src/components/shared/ContactSelector.tsx` only
- Conflicts with: None expected

### Code Review Findings

#### Already Implemented (Verified in Codebase)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Multi-filter chip toggles | DONE | `SourceFilterChip` component (lines 181-211) |
| Messages OFF by default | DONE | `DEFAULT_SOURCE_FILTERS.sms = false` (line 74) |
| Source badges on contacts | DONE | `showSourceBadge={showSourceFilters}` (line 582) |
| Badge colors via getSourceBadge() | DONE | Imported and used correctly |
| EditContactsModal integration | DONE | `showSourceFilters={true}` (line 421) |

#### NOT Implemented (Actual Work Required)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Scrollbar padding | NOT DONE | Line 491: `className="flex-1 overflow-y-auto"` missing `pr-2` |
| Selected contacts visible when filter off | NOT DONE | Filter logic (lines 252-260) does not check `selectedIds` |
| Styling consistency (Inferred chip) | MINOR | Filter chip uses `bg-gray-200` but `getSourceBadge` uses `bg-gray-100` |

### Critical Clarifications

#### 1. "Show ALL contacts" Requirement - NEEDS VERIFICATION

The task states contacts should show "imported AND external contacts" together. However:

- `ContactsContext` uses `contactService.getSortedByActivity()` or `getAll()`
- These call `window.api.contacts.*` backend methods
- **I cannot verify from frontend code if the backend returns external/message contacts**

**Action Required:** Before implementation, verify that `window.api.contacts.getSortedByActivity()` returns:
1. Imported contacts (source: manual, email, contacts_app)
2. Message-derived contacts (source: sms, is_message_derived: true)
3. Inferred contacts (source: inferred)

If the backend only returns "imported" contacts, a backend change may be required (out of scope for this task).

#### 2. Styling Inconsistency Detail

```typescript
// SourceFilterChip (line 461-465):
color="bg-gray-200 text-gray-700"  // Inferred

// getSourceBadge (components.ts line 81):
inferred: { text: "Inferred", color: "bg-gray-100 text-gray-700" }
```

**Recommendation:** Change SourceFilterChip to use `bg-gray-100` for consistency.

### Implementation Scope Refinement

Based on code review, the actual implementation is smaller than estimated:

| Change | Lines | Complexity |
|--------|-------|------------|
| Add `pr-2` to list container | 1 | Trivial |
| Add `selectedIds` check in filter | 3 | Low |
| Fix Inferred chip color | 1 | Trivial |
| (Optional) localStorage persistence | 15 | Low |

**Revised Token Estimate:** ~10K (reduced from ~25K)

### Edge Cases to Handle

1. **Empty state with all filters off** - Should show "No contacts match your filters" (not "No contacts available")
2. **Selected contact from hidden source** - Should remain visible with a visual indicator that it's from a filtered-out source (optional UX enhancement)
3. **Performance** - No concerns; filter is O(n) and already memoized

### Technical Recommendations

1. **Preserve selected contacts filter logic:**
```typescript
// In filteredContacts useMemo, change:
filtered = filtered.filter((contact) => {
  const source = getContactSource(contact);
  return sourceFilters[source] ?? true;
});

// To:
filtered = filtered.filter((contact) => {
  // Always show selected contacts regardless of filter
  if (selectedIds.includes(contact.id)) {
    return true;
  }
  const source = getContactSource(contact);
  return sourceFilters[source] ?? true;
});
```

2. **Add selectedIds to useMemo dependencies** (line 293)

3. **Update empty state message when filters are active** to be more helpful

### Testing Recommendations

Add to testing checklist:
- [ ] Verify selected contact remains visible after toggling off its source filter
- [ ] Verify Inferred badge color matches between filter chip and contact badge
- [ ] Verify list content doesn't visually overlap with scrollbar on macOS and Windows

### Risk Assessment
- **Risk Level:** LOW
- **Reason:** Isolated UI changes, no backend modifications, existing patterns followed

---

## Metrics

| Metric | Value |
|--------|-------|
| Agent ID | _assigned at start_ |
| Estimated Tokens | ~10K (revised down from ~25K) |
| Actual Tokens | _recorded after completion_ |
