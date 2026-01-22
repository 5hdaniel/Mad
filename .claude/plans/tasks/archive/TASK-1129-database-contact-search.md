# TASK-1129: Implement Database-Level Contact Search

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1129 |
| **Backlog Item** | BACKLOG-314 |
| **Sprint** | SPRINT-045 |
| **Priority** | HIGH |
| **Estimated Tokens** | ~25K |
| **Category** | feature |

---

## Problem Statement

The LIMIT 200 added to `getMessageDerivedContacts()` for performance (BACKLOG-311) causes a functional issue: users cannot find contacts beyond the first 200 when searching in the Select Contact modal.

### Current Flow (Broken)
1. Load 200 contacts from database (limited for performance)
2. Filter in JavaScript based on search query
3. **Problem:** Contacts #201+ are never searchable

### Required Flow
1. Pass search query to backend
2. Run SQL query with WHERE clause matching the search term
3. Return matching results (no arbitrary LIMIT on searchable pool)

---

## Objective

Implement database-level search for contacts so users can find ANY contact, not just the first 200. This involves:

1. Adding a new `searchContactsForSelection()` function in contactDbService
2. Adding IPC handler for `contacts:search`
3. Exposing the search method via contactBridge
4. Updating ContactSelectModal to use database search when typing

---

## Branch Information

**Branch From:** develop
**Branch Name:** feature/TASK-1129-database-contact-search

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/db/contactDbService.ts` | Add `searchContactsForSelection()` function |
| `electron/contact-handlers.ts` | Add IPC handler for `contacts:search` |
| `electron/preload/contactBridge.ts` | Expose `searchContacts` method |
| `src/components/ContactSelectModal.tsx` | Use database search when user types |

---

## Technical Approach

### 1. Database Layer (contactDbService.ts)

Add new function that searches across all contacts (imported AND message-derived):

```typescript
/**
 * Search contacts for selection modal
 * Searches both imported contacts and message-derived contacts
 * Used when user types in search box (database-level search vs client-side filter)
 */
export function searchContactsForSelection(
  userId: string,
  query: string,
  limit: number = 50
): ContactWithActivity[] {
  const searchPattern = `%${query}%`;

  // Search imported contacts
  const importedSql = `
    SELECT
      c.*,
      c.display_name as name,
      ce_primary.email as email,
      cp_primary.phone_e164 as phone,
      0 as is_message_derived
    FROM contacts c
    LEFT JOIN contact_emails ce_primary ON c.id = ce_primary.contact_id AND ce_primary.is_primary = 1
    LEFT JOIN contact_phones cp_primary ON c.id = cp_primary.contact_id AND cp_primary.is_primary = 1
    LEFT JOIN contact_emails ce_all ON c.id = ce_all.contact_id
    WHERE c.user_id = ? AND c.is_imported = 1
      AND (
        c.display_name LIKE ?
        OR ce_all.email LIKE ?
        OR cp_primary.phone_e164 LIKE ?
        OR c.company LIKE ?
      )
    GROUP BY c.id
    LIMIT ?
  `;

  // Search message-derived contacts (no LIMIT 200 restriction when searching)
  const messageSql = `
    SELECT
      'msg_' || LOWER(json_extract(participants, '$.from')) as id,
      json_extract(participants, '$.from') as display_name,
      json_extract(participants, '$.from') as name,
      /* ... rest of message-derived query ... */
    FROM messages
    WHERE user_id = ?
      AND participants IS NOT NULL
      AND json_extract(participants, '$.from') IS NOT NULL
      AND json_extract(participants, '$.from') LIKE ?
      /* ... nameless filter from TASK-1128 ... */
    GROUP BY LOWER(json_extract(participants, '$.from'))
    LIMIT ?
  `;

  // Merge and deduplicate results
  // Return sorted by relevance/activity
}
```

### 2. IPC Handler (contact-handlers.ts)

Add handler for search:

```typescript
ipcMain.handle('contacts:search', async (_event, userId: string, query: string) => {
  if (!query || query.length < 2) {
    // Return recent contacts for short/empty queries
    return getContactsSortedByActivity(userId);
  }
  return searchContactsForSelection(userId, query);
});
```

### 3. Preload Bridge (contactBridge.ts)

Expose the search method:

```typescript
searchContacts: (userId: string, query: string) =>
  ipcRenderer.invoke('contacts:search', userId, query),
```

### 4. Frontend (ContactSelectModal.tsx)

Add debounced database search:

```typescript
// Debounce search to avoid hammering database on every keystroke
const debouncedSearch = useMemo(
  () => debounce(async (query: string) => {
    if (query.length < 2) {
      setSearchResults(null); // Use default contacts list
      return;
    }
    const results = await window.api.contacts.searchContacts(userId, query);
    setSearchResults(results);
  }, 300),
  [userId]
);

// Use search results when available, otherwise filtered contacts
const displayedContacts = searchResults || filteredContacts;
```

---

## Acceptance Criteria

- [ ] Users can search for ANY contact in the database, not just the first 200
- [ ] Search results return within 200ms for typical queries
- [ ] Empty/short search shows recent contacts (existing behavior preserved)
- [ ] Search works across name, email, phone, and company fields
- [ ] Both imported and message-derived contacts are searchable
- [ ] Search is debounced (300ms) to avoid excessive database queries
- [ ] No TypeScript errors
- [ ] Existing tests pass

---

## Testing Requirements

### Manual Testing
1. Open Select Contact modal on a transaction
2. **Verify:** Initial load shows recent contacts (existing behavior)
3. Type a search query for a contact you know exists beyond position 200
4. **Verify:** Contact appears in results
5. Search by name, email, phone, and company
6. **Verify:** All search types work
7. Select a contact from search results
8. **Verify:** Selection works correctly
9. Clear search box
10. **Verify:** Recent contacts list returns

### Performance Testing
1. Time search queries - should return in <200ms
2. Test with database containing 1000+ contacts
3. Verify no UI freeze during search

### Unit Testing
- Test `searchContactsForSelection()` with various query patterns
- Test empty query returns default sorted list
- Test deduplication between imported and message-derived results

---

## Implementation Summary

**Status:** COMPLETE

### Agent ID

```
Engineer Agent ID: opus-4-5-task-1129
```

### Work Done

Implemented full-stack database-level contact search to fix the LIMIT 200 issue:

1. **Database Layer (`contactDbService.ts`)**
   - Added `searchContactsForSelection()` function (~170 lines)
   - Searches both imported contacts AND message-derived contacts at DB level
   - Applies BACKLOG-313 filters (excludes raw email/phone as names)
   - Searches across: display_name, email, phone, company fields
   - Returns results sorted by name prefix match, then by last communication date
   - Includes communication_count from aggregated queries (no N+1)

2. **IPC Handler (`contact-handlers.ts`)**
   - Added `contacts:search` IPC handler with validation
   - For queries <2 chars, returns getContactsSortedByActivity() (existing behavior)
   - For longer queries, performs database-level search
   - Full input validation with validateUserId, validateString

3. **Preload Bridge (`contactBridge.ts`)**
   - Exposed `searchContacts(userId, query)` method to renderer

4. **Frontend (`ContactSelectModal.tsx`)**
   - Added debounced database search (300ms delay)
   - Loading spinner during search
   - Falls back to client-side filtering for short queries
   - Seamless integration - search results filter out excluded IDs

5. **Type Definitions (`window.d.ts`)**
   - Added full contacts API type definitions (previously missing)
   - Includes searchContacts method signature

### Engineer Checklist

- [x] Tests pass: `npm test -- --testPathPattern="contact"` (155 passed)
- [x] Types pass: `npm run type-check`
- [x] Lint passes: `npm run lint` (0 errors, pre-existing warnings only)
- [x] BACKLOG-313 filters applied to search results
- [x] Debounced search prevents DB hammering
- [x] Loading indicator during search

### Files Changed

| File | Changes |
|------|---------|
| `electron/services/db/contactDbService.ts` | Added `searchContactsForSelection()` function |
| `electron/services/databaseService.ts` | Added wrapper for `searchContactsForSelection()` |
| `electron/contact-handlers.ts` | Added `contacts:search` IPC handler |
| `electron/preload/contactBridge.ts` | Exposed `searchContacts` method |
| `src/components/ContactSelectModal.tsx` | Added debounced database search |
| `src/window.d.ts` | Added contacts API type definitions |

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |

**Variance:** PM Est ~25K vs Actual - (auto-captured)

---

## Notes

- This is a functional fix for a regression caused by BACKLOG-311 performance optimization
- The LIMIT 200 for initial load should remain (performance) - only search bypasses it
- Consider adding a loading spinner during search to indicate backend work
- Debounce is important to avoid hammering the database on every keystroke

### Dependency Note
- TASK-1128 (filter nameless contacts) modifies the same file (contactDbService.ts)
- If running in parallel, coordinate merge order carefully
- **Recommended:** Execute TASK-1128 first (simpler), then TASK-1129

## SR Engineer Review Notes

**Review Date:** - | **Status:** PENDING

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-1129-database-contact-search

### Execution Classification
- **Parallel Safe:** CAUTION - shares files with TASK-1128
- **Depends On:** Ideally TASK-1128 (same file, simpler change first)
- **Blocks:** None

### Shared File Analysis
- `contactDbService.ts` - Both TASK-1128 and TASK-1129 modify this
- `ContactSelectModal.tsx` - Only this task modifies
- `contact-handlers.ts` - Only this task modifies
- `contactBridge.ts` - Only this task modifies

### Merge Coordination
If running parallel with TASK-1128:
1. Merge TASK-1128 first (simpler SQL change)
2. TASK-1129 may need minor rebase to incorporate TASK-1128 filter logic in search query

### Technical Considerations
- Full-stack change: database -> IPC -> preload -> component
- Requires debounce implementation
- Performance testing recommended with large contact datasets
- Estimate ~25K appropriate for scope
