# TASK-1125: Fix Import Contact Auto-Select and Refresh

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1125 |
| **Backlog Item** | BACKLOG-309 |
| **Sprint** | SPRINT-045 |
| **Priority** | HIGH |
| **Estimated Tokens** | ~25K |
| **Category** | ui |

---

## Problem Statement

When importing contacts from within the Edit Transaction flow (Select Contacts > Import), two issues occur:

1. **Refresh Issue:** Sometimes the newly imported contact doesn't appear in the Select Contacts list after import completes
2. **Missing Auto-Select:** Imported contacts should be automatically selected (checked) since the user clearly wants to add them to the transaction

**User Flow:**
1. User is editing transaction, wants to add a contact
2. Opens Select Contacts modal
3. Contact isn't there (not imported yet)
4. Clicks Import > Import Contacts modal opens
5. Finds and selects contact, clicks Import
6. Import modal closes, returns to Select Contacts
7. **Problem A:** Sometimes contact doesn't appear (refresh not working)
8. **Problem B:** Even when it appears, user must manually find and check it

---

## Objective

Fix the import flow so that:
1. After importing, the contact list always refreshes and shows new contacts
2. Newly imported contacts are automatically selected (checkbox checked)
3. User can immediately click "Add" without hunting for the contact they just imported

---

## Branch Information

**Branch From:** develop
**Branch Name:** fix/TASK-1125-import-auto-select

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ContactSelectModal.tsx` | Accept auto-select IDs, handle state update |
| `src/components/contact/components/ImportContactsModal.tsx` | Return imported contact IDs in `onSuccess` |

---

## Technical Approach

### Step 1: Update ImportContactsModal to Return IDs

```typescript
// Current onSuccess signature
onSuccess: () => void;

// New signature - pass back imported contact IDs
onSuccess: (importedContactIds: string[]) => void;
```

In `handleImportSelected`:
```typescript
const handleImportSelected = async () => {
  // ... existing import logic ...

  if (result.success) {
    // Get the IDs of contacts that were imported
    const importedIds = result.importedContacts?.map(c => c.id) ||
                        contactsToImport.map(c => c.id);
    onSuccess(importedIds);  // Pass IDs back
  }
};
```

### Step 2: Update ContactSelectModal to Auto-Select

```typescript
// In ContactSelectModal
const [pendingAutoSelectIds, setPendingAutoSelectIds] = useState<string[]>([]);

// When import succeeds, store the IDs to auto-select
const handleImportSuccess = (importedContactIds: string[]) => {
  setShowImportModal(false);
  setPendingAutoSelectIds(importedContactIds);
  onRefreshContacts?.();  // Refresh the list
};

// After contacts refresh, apply auto-selection
useEffect(() => {
  if (pendingAutoSelectIds.length > 0) {
    // Check if any pending IDs are now in the contacts list
    const idsToSelect = pendingAutoSelectIds.filter(id =>
      contacts.some(c => c.id === id)
    );

    if (idsToSelect.length > 0) {
      setSelectedIds(prev => [...new Set([...prev, ...idsToSelect])]);
      setPendingAutoSelectIds([]);  // Clear pending
    }
  }
}, [contacts, pendingAutoSelectIds]);
```

### Step 3: Ensure Refresh Works Reliably

The `onRefreshContacts` callback should trigger a fresh query. Verify:
- The callback is actually being invoked
- The query re-runs and fetches updated data
- No race condition between DB write and read

If race condition exists, add a small delay or use a more robust pattern:
```typescript
const handleImportSuccess = async (importedContactIds: string[]) => {
  setShowImportModal(false);
  setPendingAutoSelectIds(importedContactIds);

  // Small delay to ensure DB write is committed
  await new Promise(resolve => setTimeout(resolve, 100));
  onRefreshContacts?.();
};
```

---

## Acceptance Criteria

- [ ] After importing contact(s), Select Contacts list always shows them
- [ ] Newly imported contacts are automatically checked/selected
- [ ] Works for single contact import
- [ ] Works for multiple contact import
- [ ] No race conditions causing missing contacts
- [ ] Existing manual selection still works
- [ ] Cancel during import doesn't break state

---

## Testing Requirements

### Unit Tests
- [ ] `ImportContactsModal` calls `onSuccess` with correct IDs
- [ ] `ContactSelectModal` auto-selects when IDs provided

### Integration Tests
- [ ] Full import flow from Select Contacts modal
- [ ] Multiple contact import with auto-select

### Manual Testing
1. Open transaction > Edit Contacts
2. Click "Add Contact" for a role > opens Select Contacts modal
3. Click Import button
4. Search for a contact, select it, click Import
5. **Verify:** Select Contacts modal shows the contact AND it's selected
6. Click Add to add to transaction
7. Repeat with multiple contacts

### Edge Cases
- [ ] Import canceled (should not affect state)
- [ ] Import fails (should show error, not select anything)
- [ ] Contact already exists (should handle gracefully)

---

## Implementation Summary

**Status:** COMPLETE

### Agent ID

```
Engineer Agent ID: agent_01JHQGDV28N9B2AHB7YJJC7VGS
```

### Work Done

1. **ImportContactsModal.tsx**:
   - Updated `onSuccess` signature from `() => void` to `(importedContactIds: string[]) => void`
   - After successful import, extracts contact IDs from `result.contacts` and passes them to the callback
   - Added type assertion for the API result to fix TypeScript errors

2. **ContactSelectModal.tsx**:
   - Added `pendingAutoSelectIds` state to track IDs that need auto-selection
   - Added `useEffect` that watches for pending IDs and auto-selects them once they appear in the contacts list (uses `validContactIds` Set for efficient lookup)
   - Updated the import success handler to store imported IDs and trigger refresh

3. **Contacts.tsx**:
   - Updated the `onSuccess` callback to accept the new signature (parameter is available but not used in this context since it's the main Contacts page, not a selection modal)

4. **electron/types/ipc.ts**:
   - Fixed the type definition for `contacts:import` response to match the actual handler return type (`{ success: boolean; contacts?: Contact[]; error?: string }`)

### Files Modified
- `src/components/ContactSelectModal.tsx`
- `src/components/Contacts.tsx`
- `src/components/contact/components/ImportContactsModal.tsx`
- `electron/types/ipc.ts`

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | TBD |
| Duration | TBD |
| API Calls | TBD |

**Variance:** PM Est ~25K vs Actual ~TBD

---

## Notes

- Both `ContactSelectModal.tsx` and `ImportContactsModal.tsx` need changes
- The `onRefreshContacts` prop already exists and is passed through
- Watch for TypeScript errors when changing the `onSuccess` signature
- TASK-1127 also modifies ContactSelectModal.tsx - coordinate with SR Engineer on merge order

## SR Engineer Review Notes

**Review Date:** 2026-01-19 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1125-import-auto-select

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** TASK-1126 (Phase 2 gate)

### Shared File Analysis
- `ContactSelectModal.tsx` - Lines 326-336 (onSuccess handler)
- Conflicts with: TASK-1127 (but different code sections - lines 274-289)
- **Merge Order:** Merge TASK-1127 first (simpler), then TASK-1125

### Technical Considerations
- **Good news:** The `contacts:import` handler already returns `result.contacts` with IDs
- No backend changes needed - use existing `result.contacts?.map(c => c.id)`
- Estimate is accurate at ~25K
