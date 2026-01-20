# TASK-1131: Add Toggle Filter for Message-Derived Contacts

## Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1131 |
| **Backlog Item** | BACKLOG-316 |
| **Sprint** | SPRINT-045 |
| **Priority** | Medium |
| **Estimated Tokens** | ~15K |
| **Status** | TODO |

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** feature/TASK-1131-message-contacts-toggle

---

## Summary

Add a toggle filter to the Select Contact modal that lets users show/hide message-derived contacts. By default, only imported contacts are shown (cleaner list); enabling the toggle reveals message-derived contacts.

---

## Context

Message-derived contacts (extracted from imported messages) include junk like service names, URNs, and short codes mixed with real contacts. Rather than trying to programmatically filter all junk, this task provides a cleaner UX by defaulting to imported-only contacts and letting users opt-in to see message-derived contacts.

**Related work:**
- TASK-1124 adds message-derived contacts to the modal (currently being implemented)
- This task adds the toggle to filter them

---

## Requirements

### Must Have
1. Toggle button/switch in the Select Contact modal header (near search bar)
2. Label: "Show message contacts" or similar
3. Default state: OFF (only imported contacts shown)
4. When ON: Show both imported and message-derived contacts
5. Toggle state persists in localStorage across modal close/reopen

### Should Have
1. Visual indicator of toggle state (switch component)
2. Works seamlessly with existing search functionality
3. Smooth transition when toggling (no jarring list changes)

### Must Not
1. Break existing contact selection functionality
2. Cause performance regression when toggle is enabled
3. Remove or hide contacts that users have already selected
4. Create TypeScript errors

---

## Implementation Plan

### Step 1: Identify Contact Source Field

**File:** `electron/services/db/contactDbService.ts`

Check how contacts are distinguished:
- Imported contacts: Created via ImportContactsModal
- Message-derived contacts: Created during message parsing

Look for a `source` field or similar discriminator. If none exists, check if imported contacts have `firstName`/`lastName` populated while message-derived only have `displayName`.

### Step 2: Add Toggle State to ContactSelectModal

**File:** `src/components/ContactSelectModal.tsx`

Add state for toggle:
```tsx
const [showMessageContacts, setShowMessageContacts] = useState<boolean>(() => {
  // Load from localStorage, default false
  const stored = localStorage.getItem('contactModal.showMessageContacts');
  return stored === 'true';
});
```

Persist changes:
```tsx
useEffect(() => {
  localStorage.setItem('contactModal.showMessageContacts', String(showMessageContacts));
}, [showMessageContacts]);
```

### Step 3: Add Toggle UI Component

**File:** `src/components/ContactSelectModal.tsx`

Add toggle near the search bar (header area):
```tsx
<div className="flex items-center gap-2">
  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
    <input
      type="checkbox"
      checked={showMessageContacts}
      onChange={(e) => setShowMessageContacts(e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
    Show message contacts
  </label>
</div>
```

Or use a proper Switch component if one exists in the codebase.

### Step 4: Filter Contacts Based on Toggle

**File:** `src/components/ContactSelectModal.tsx`

Filter the contact list based on toggle state:
```tsx
const filteredContacts = useMemo(() => {
  let contacts = allContacts;

  // Filter by source if toggle is off
  if (!showMessageContacts) {
    contacts = contacts.filter(c => c.source === 'imported' || !c.source);
  }

  // Apply search filter
  if (searchTerm) {
    contacts = contacts.filter(c =>
      // existing search logic
    );
  }

  return contacts;
}, [allContacts, showMessageContacts, searchTerm]);
```

### Step 5: Update Backend Query (if needed)

**File:** `electron/services/db/contactDbService.ts`

If contacts don't have a `source` field, may need to:
1. Add `source` column to contacts table
2. Update import flows to set `source = 'imported'`
3. Update message parsing to set `source = 'message'`

OR use a heuristic:
- Contacts with `firstName` or `lastName` populated = imported
- Contacts with only `displayName` = message-derived

---

## Testing Requirements

### Manual Testing Checklist

- [ ] Toggle appears in modal header area
- [ ] Toggle default is OFF
- [ ] With toggle OFF: only imported contacts appear
- [ ] With toggle ON: message-derived contacts also appear
- [ ] Search works in both toggle states
- [ ] Toggle state persists after closing and reopening modal
- [ ] Toggle state persists after page refresh
- [ ] Selecting a contact works in both states
- [ ] No performance issues with toggle ON (test with 2000+ contacts)

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| No imported contacts | Empty list with toggle OFF, message contacts with toggle ON |
| No message-derived contacts | Same list in both states |
| Selected contact is message-derived, toggle OFF | Contact should still be shown as selected (don't hide selections) |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ContactSelectModal.tsx` | Add toggle state, UI, and filter logic |
| `electron/services/db/contactDbService.ts` | May need to add source distinction (investigate first) |

---

## Acceptance Criteria

From BACKLOG-316:
- [ ] Toggle button visible in Select Contact modal header area
- [ ] Default state is OFF (message-derived contacts hidden)
- [ ] When ON, message-derived contacts appear in the list
- [ ] Toggle state persists across modal close/reopen (local storage)
- [ ] No performance regression when toggle is enabled
- [ ] Works with existing search functionality
- [ ] No TypeScript errors
- [ ] All tests pass

---

## Out of Scope

- Visual badge/tag distinguishing contact source in the list (future enhancement)
- Settings page toggle to change default (use localStorage for now)
- Backend API parameter for filtering (client-side filter is sufficient)

---

## Dependencies

- TASK-1124 should be completed/merged first (adds message-derived contacts to the query)
- This task adds the toggle to filter them

---

## Risks

| Risk | Mitigation |
|------|------------|
| Contact source not stored in DB | Use heuristic based on name fields |
| Performance with large contact lists | Client-side filter is O(n), acceptable for ~2000 contacts |
| Toggle state confuses users | Clear label and visible toggle state |

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | agent_01JJDGQFAVFG9GPKZW2J7VB5G3 |
| **Branch** | feature/TASK-1131-message-contacts-toggle |
| **Files Modified** | 2 |
| **Lines Changed** | +230 (approx) |
| **Tests Added/Modified** | 7 new tests |
| **PR Number** | TBD |

### Changes Made

1. **`src/components/ContactSelectModal.tsx`**:
   - Added `showMessageContacts` state with localStorage persistence (default: false)
   - Added `isMessageDerived()` helper function to check both number (1) and boolean (true) forms
   - Updated `filteredContacts` useMemo to filter out message-derived contacts when toggle is OFF
   - Added toggle checkbox UI in the search bar area with label "Include message contacts"
   - Added localStorage key constant `SHOW_MESSAGE_CONTACTS_KEY`

2. **`src/components/__tests__/ContactSelectModal.test.tsx`**:
   - Added new test suite "Message Contacts Toggle (TASK-1131)" with 7 tests:
     - Render toggle checkbox
     - Hide message-derived contacts by default
     - Show message-derived contacts when toggle ON
     - Toggle OFF again to hide
     - Persist toggle state in localStorage
     - Work with search filtering when toggle ON
     - Show empty state when all contacts are message-derived and toggle OFF

### Deviations from Plan

None - implementation follows the task plan exactly.

### Testing Performed

- [x] Type-check passes (`npm run type-check`)
- [x] Lint passes (`npm run lint --quiet`)
- [x] All 41 ContactSelectModal tests pass
- [x] 7 new toggle tests pass
- [x] Toggle checkbox renders in modal header
- [x] Toggle default is OFF (message contacts hidden)
- [x] Toggling ON shows message-derived contacts
- [x] Toggling OFF hides message-derived contacts
- [x] Toggle state persists in localStorage
