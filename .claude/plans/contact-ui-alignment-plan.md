# Contact UI Alignment Plan

**Created:** 2026-01-29
**Sprint:** 066 (Contact UX Overhaul)
**Status:** INVESTIGATION

---

## Overview

This plan addresses two related issues:
1. **Issue 1**: Contact sorting by recent message (SMS/iMessage) not working correctly
2. **Issue 2**: Interface inconsistency between Contacts Screen and Transaction Contact Selection

---

## Issue 1: Contact Sorting Investigation

### Current Data Flow

```
Backend (contactDbService.ts)
    |
    v
getContactsSortedByActivity()
    |-- Query 1: Get contacts (fast)
    |-- Query 2: Get last message dates via phone matching
    |-- Merge dates into contacts
    |-- Sort by last_communication_at DESC
    |
    v
ContactsContext (via contactService.getSortedByActivity)
    |
    v
Screen2Overlay in EditContactsModal
    |-- Filters out assigned contacts
    |-- Calls sortByRecentCommunication() again (REDUNDANT)
    |
    v
ContactSearchList
    |-- Calls sortByRecentCommunication() AGAIN (DOUBLE REDUNDANT)
    |
    v
Rendered list
```

### Identified Problems

#### Problem 1.1: Phone Number Matching May Be Flawed

**Location:** `/Users/daniel/Documents/Mad/electron/services/db/contactDbService.ts` lines 644-656

```sql
-- Current messagesSql query (line 650-653)
JOIN messages m ON (
  m.user_id = ?
  AND (m.channel = 'sms' OR m.channel = 'imessage')
  AND m.participants_flat LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), -10) || '%'
)
```

**Analysis:**
- `phone_e164` in contact_phones is stored as `+14155550000` format
- `participants_flat` in messages is built by stripping all non-digits: `participantsObj.from.replace(/\D/g, "")`
- The query takes last 10 digits of normalized phone_e164 and checks if it appears anywhere in participants_flat

**Potential Issues:**
1. **No strict boundary matching** - searching for `5551234567` could match `15551234567` or `25551234567` or even `555123456789` if the number is embedded
2. **phone_e164 may contain unexpected formats** - if some contacts have `phone_e164` stored differently, the REPLACE chain may not normalize correctly
3. **participants_flat may be NULL or malformed** - if messages were imported before the `participants_flat` column existed, they may have NULL values

#### Problem 1.2: Triple Sorting (Performance + Potential Bugs)

**Sorting happens THREE times:**

1. **Backend** (`contactDbService.ts` line 714-726): Sorts by `last_communication_at` DESC
2. **Screen2Overlay** (`EditContactsModal.tsx` line 672): `sortByRecentCommunication(filtered)`
3. **ContactSearchList** (`ContactSearchList.tsx` line 199-206): Re-sorts via `sortByRecentCommunication`

The frontend sorts use the same `sortByRecentCommunication` utility, but they operate on `CombinedContact[]` with index mapping which could introduce bugs.

**ContactSearchList sorting issue (lines 199-206):**
```typescript
const contactsWithIndex = combined.map((item, index) => ({
  index,
  last_communication_at: item.contact.last_communication_at,
}));
const sortedIndices = sortByRecentCommunication(contactsWithIndex);
const sorted = sortedIndices.map((item) => combined[item.index]);
```

This creates objects with `{index, last_communication_at}` then tries to sort them. The sort function will work on these objects, but the `index` property is meaningless after sort - it just points back to the original position in `combined`.

**The mapping is correct**, but it's wasteful since the backend already sorted.

#### Problem 1.3: Dates May Be Incorrect at Source

The user reports dates like:
- Madison - 2026-01-29
- Hadas Foox - 2026-01-17

These could be wrong because:
1. **Phone number doesn't match any message** - contact has wrong phone or no phone in contact_phones table
2. **Messages from that contact have different phone** - contact's phone doesn't match what's in messages
3. **Message import didn't populate participants_flat** - older messages may lack this field

### Recommended Investigation Steps

1. **Query validation**: Run the messagesSql query directly against the database to verify phone matching logic
2. **Check contact_phones data**: Verify contacts have correct phone_e164 values
3. **Check messages.participants_flat**: Verify messages have populated participants_flat values
4. **Add better debug logging**: Log the actual phone numbers being matched

### Proposed Fixes

#### Fix 1.1: Improve Phone Matching Query

```sql
-- Proposed: Use more precise matching
AND (
  -- Last 10 digits match exactly
  ',' || m.participants_flat || ',' LIKE '%,' || SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), -10) || ',%'
)
```

#### Fix 1.2: Remove Redundant Frontend Sorting

**ContactSearchList should NOT re-sort** - it receives pre-sorted contacts from the backend via ContactsProvider. Remove the sorting in `combinedContacts` memo.

**Screen2Overlay sorting is also redundant** since ContactsProvider calls `getSortedByActivity` which returns sorted contacts.

#### Fix 1.3: Backfill participants_flat for Old Messages

If older messages lack `participants_flat`, add a migration to populate them.

---

## Issue 2: Interface Alignment

### Current State Analysis

#### A. Contacts Screen (`/Users/daniel/Documents/Mad/src/components/Contacts.tsx`)

| Feature | Current State | Implementation |
|---------|--------------|----------------|
| Search | YES | `useContactSearch` hook, searches name/email/company |
| Filters | PARTIAL | Only toggle for "Include message contacts" |
| Import button | YES | On ContactCard for external contacts |
| Shows | ALL contacts | Via `useContactList` -> `getAll()` |
| Card component | ContactCard | Grid layout, shows avatar/name/email/phone/company |

#### B. Transaction Contact Selection (`EditContactsModal.tsx` Screen2Overlay)

| Feature | Current State | Implementation |
|---------|--------------|----------------|
| Search | YES | Built into ContactSearchList |
| Filters | YES | Multi-category checkboxes (Imported, Manual, External, Msg Inferred) |
| Add button | YES | Click row to toggle selection, then bulk "Add Selected" |
| Shows | NON-ASSIGNED contacts | Filters out `assignedContactIds` |
| Row component | ContactRow | List layout, compact with checkbox |

### Key Differences

| Aspect | Contacts Screen | Transaction Contact Selection |
|--------|-----------------|------------------------------|
| **Layout** | Grid (3-column) | List (single column) |
| **Component** | ContactCard | ContactRow |
| **Filter UI** | Single toggle | 4 checkboxes |
| **Import UX** | Button on card | Auto-import on select |
| **Selection** | Click opens modal | Click toggles checkbox |
| **Action** | View details | Add to transaction |

### User's Desired Alignment

> "The user wants these two screens to have consistent interfaces"

**A. Contacts Screen should have:**
- Search (already has)
- Filters (same as transaction selection) - **NEEDS WORK**
- Import button on individual contact cards (already has)
- Shows ALL contacts (already does)

**B. Transaction Contact Selection should have:**
- Search (already has)
- Filters (already has)
- "Add" button on contact cards (similar to import) - **NEEDS WORK**
- Filters OUT already assigned contacts (already does)

### Proposed Unified Architecture

#### Option A: Shared Filter Component

Create a reusable `ContactFilterBar` component used by both screens:

```
ContactFilterBar
  |-- Search input
  |-- Filter checkboxes (Imported, Manual, External, Msg Inferred)
  |-- (Optional) Additional controls per-screen
```

**Pros:** DRY, consistent behavior
**Cons:** May need props for different contexts

#### Option B: Use Same List Component (ContactSearchList) in Both Places

Modify `Contacts.tsx` to use `ContactSearchList` instead of manual grid + ContactCard.

**Pros:** Maximum consistency
**Cons:** May limit layout flexibility (grid vs list)

#### Option C: Hybrid - Shared Filters, Different Layouts

- Extract filter logic into shared hook `useContactFilters`
- Create shared `ContactFilterBar` component
- Each screen uses its preferred layout (grid/list) and component (ContactCard/ContactRow)
- Filter state persisted to localStorage (already done)

**Recommended: Option C**

### Implementation Plan

#### Phase 1: Sorting Fix (Issue 1)

| Task | File | Description |
|------|------|-------------|
| 1.1 | `contactDbService.ts` | Add debug logging to verify phone matching |
| 1.2 | `contactDbService.ts` | Improve LIKE pattern for precise matching |
| 1.3 | `ContactSearchList.tsx` | Remove redundant sorting |
| 1.4 | `EditContactsModal.tsx` | Remove redundant sorting in Screen2Overlay |

#### Phase 2: Filter Alignment (Issue 2)

| Task | File | Description |
|------|------|-------------|
| 2.1 | `src/utils/` | Create shared `useContactFilters` hook |
| 2.2 | `src/components/shared/` | Create `ContactFilterBar` component |
| 2.3 | `Contacts.tsx` | Replace single toggle with ContactFilterBar |
| 2.4 | `EditContactsModal.tsx` | Use ContactFilterBar (refactor from inline) |

#### Phase 3: Action Button Alignment (Issue 2)

| Task | File | Description |
|------|------|-------------|
| 3.1 | `ContactRow.tsx` | Add "Add" button prop (already has `showImportButton`) |
| 3.2 | `EditContactsModal.tsx` | Style "Add" similar to ContactCard's Import |

---

## File Inventory

### Files to Modify

| File | Changes |
|------|---------|
| `/Users/daniel/Documents/Mad/electron/services/db/contactDbService.ts` | Fix phone matching, add logging |
| `/Users/daniel/Documents/Mad/src/components/shared/ContactSearchList.tsx` | Remove redundant sorting |
| `/Users/daniel/Documents/Mad/src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | Remove redundant sorting, use shared FilterBar |
| `/Users/daniel/Documents/Mad/src/components/Contacts.tsx` | Add multi-category filters via shared FilterBar |

### Files to Create

| File | Purpose |
|------|---------|
| `/Users/daniel/Documents/Mad/src/hooks/useContactFilters.ts` | Shared filter state/logic |
| `/Users/daniel/Documents/Mad/src/components/shared/ContactFilterBar.tsx` | Reusable filter UI |

### Existing Shared Utilities

| File | Purpose |
|------|---------|
| `/Users/daniel/Documents/Mad/src/utils/contactSortUtils.ts` | Sorting utilities |
| `/Users/daniel/Documents/Mad/src/utils/contactCategoryUtils.ts` | Category filter logic (already exists) |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Phone matching fix breaks existing matches | HIGH | Test with actual user data before deploying |
| Removing frontend sort causes wrong order | MEDIUM | Verify backend sort is correct first |
| Filter bar changes break existing localStorage | LOW | Same keys used, additive change |

---

## Testing Requirements

1. **Unit tests** for phone normalization matching
2. **Integration tests** for contact sorting end-to-end
3. **Manual QA** with real contacts and messages

---

## Estimated Effort

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1 | Sorting Fix | 2-3 hours |
| Phase 2 | Filter Alignment | 3-4 hours |
| Phase 3 | Action Button Alignment | 1-2 hours |
| **Total** | | **6-9 hours** |

---

## Next Steps

1. **Immediate**: Create backlog items for Phase 1 (critical bug fix)
2. **This sprint**: Phase 1 implementation
3. **Future sprint**: Phases 2-3 (UX polish)

---

## Appendix: Debug Queries

### Check if contacts have phone numbers

```sql
SELECT c.display_name, cp.phone_e164, cp.phone_display
FROM contacts c
LEFT JOIN contact_phones cp ON c.id = cp.contact_id
WHERE c.is_imported = 1
ORDER BY c.display_name;
```

### Check messages with participants_flat

```sql
SELECT
  id,
  channel,
  participants_flat,
  sent_at,
  SUBSTR(participants_flat, 1, 50) as flat_preview
FROM messages
WHERE channel IN ('sms', 'imessage')
AND participants_flat IS NOT NULL
ORDER BY sent_at DESC
LIMIT 20;
```

### Test phone matching for specific contact

```sql
SELECT
  c.display_name,
  cp.phone_e164,
  SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), -10) as normalized_phone,
  MAX(m.sent_at) as last_msg
FROM contacts c
JOIN contact_phones cp ON c.id = cp.contact_id
LEFT JOIN messages m ON
  (m.channel = 'sms' OR m.channel = 'imessage')
  AND m.participants_flat LIKE '%' || SUBSTR(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), -10) || '%'
WHERE c.display_name LIKE '%Madison%'
GROUP BY c.id, cp.phone_e164;
```
