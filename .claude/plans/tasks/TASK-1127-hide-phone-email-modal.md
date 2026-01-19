# TASK-1127: Hide Phone/Email in Contact Select Modal

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1127 |
| **Backlog Item** | BACKLOG-306 |
| **Sprint** | SPRINT-045 |
| **Priority** | LOW |
| **Estimated Tokens** | ~8K |
| **Category** | ui |

---

## Problem Statement

The Contact Select Modal ("Link chats to" / "Select Contact") currently displays phone numbers and email addresses for each contact. This adds visual clutter and is unnecessary for the selection context. Only the contact name is needed for selection.

---

## Objective

Remove phone number and email address display from the contact list items in the Contact Select Modal. Keep search functionality intact (users should still be able to search by email).

---

## Branch Information

**Branch From:** develop
**Branch Name:** fix/TASK-1127-hide-phone-email

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ContactSelectModal.tsx` | Remove phone/email display from contact list items |

---

## Technical Approach

This is a simple UI change. In `ContactSelectModal.tsx`, locate the contact list item rendering and remove the phone/email display lines.

### Current Code (lines ~274-289)

```tsx
{/* Contact Info */}
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-2">
    <h4 className="font-semibold text-gray-900 truncate">
      {contact.name}
    </h4>
    {/* ... address mention badge ... */}
  </div>
  <div className="text-sm text-gray-600 space-y-0.5">
    {contact.email && (
      <p className="truncate">{contact.email}</p>  // REMOVE THIS
    )}
    {contact.company && (
      <p className="truncate">{contact.company}</p>
    )}
    {contact.last_communication_at && (
      <p className="text-xs text-gray-500">
        Last contact: {new Date(contact.last_communication_at).toLocaleDateString()}
      </p>
    )}
  </div>
</div>
```

### After Change

```tsx
{/* Contact Info */}
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-2">
    <h4 className="font-semibold text-gray-900 truncate">
      {contact.name}
    </h4>
    {/* ... address mention badge ... */}
  </div>
  <div className="text-sm text-gray-600 space-y-0.5">
    {/* Phone and email removed - keep company and last contact */}
    {contact.company && (
      <p className="truncate">{contact.company}</p>
    )}
    {contact.last_communication_at && (
      <p className="text-xs text-gray-500">
        Last contact: {new Date(contact.last_communication_at).toLocaleDateString()}
      </p>
    )}
  </div>
</div>
```

### Keep Search Functionality

The search filter (line ~69-74) should NOT be changed:

```tsx
const filteredContacts = availableContacts.filter(
  (c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||  // KEEP THIS
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()),
);
```

This allows users to search by email even though it's not displayed.

---

## Acceptance Criteria

- [ ] Contact selection modal shows only contact names (and company if available)
- [ ] No phone numbers displayed in the list
- [ ] No email addresses displayed in the list
- [ ] Search by email still works (email just not shown)
- [ ] Selection functionality unchanged
- [ ] Last communication date still shown (if available)
- [ ] Address mention badge still shown (if relevant)

---

## Testing Requirements

### Manual Testing
1. Open Select Contact modal
2. **Verify:** Only name, company, and last contact date shown
3. **Verify:** No phone numbers visible
4. **Verify:** No email addresses visible
5. Search for a contact by their email address
6. **Verify:** Contact appears in results (search works)
7. Select a contact and add to transaction
8. **Verify:** Selection works correctly

### No Unit Tests Required
This is a display-only change with no logic modifications.

---

## Implementation Summary

**Status:** COMPLETE

### Agent ID

```
Engineer Agent ID: 9bd50bd0-20a8-4ca8-9d2b-77dec2e0d4ef
```

### Work Done

1. Removed email display from contact list items in `ContactSelectModal.tsx` (lines 275-277)
2. Updated test `should display contact emails` to `should NOT display contact emails` in `ContactSelectModal.test.tsx`
3. Verified all 34 tests pass
4. Search by email still works (only display removed, not search functionality)
5. Company name and last communication date still displayed

### Files Changed
- `src/components/ContactSelectModal.tsx` - Removed email conditional render
- `src/components/__tests__/ContactSelectModal.test.tsx` - Updated test to verify email NOT displayed

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | ~8K |
| Duration | ~5 min |
| API Calls | ~15 |

**Variance:** PM Est ~8K vs Actual ~8K (on target)

---

## Notes

- This is a ~5 minute change - just removing two conditional renders
- TASK-1125 also modifies ContactSelectModal.tsx - coordinate with SR Engineer on merge order
- The search placeholder text mentions "email" - could optionally update it, but not required
- Company name is kept as it provides useful context (e.g., "John Smith - ABC Realty")

## SR Engineer Review Notes

**Review Date:** 2026-01-19 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1127-hide-phone-email

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** TASK-1126 (Phase 2 gate)

### Shared File Analysis
- `ContactSelectModal.tsx` - Lines 274-289 (contact list item display)
- Conflicts with: TASK-1125 (different code sections - lines 326-336)
- **Merge Order:** Merge this task FIRST (simpler change, less conflict risk)

### Technical Considerations
- Simple JSX removal, no logic changes
- Line numbers verified as accurate
- Estimate is accurate at ~8K
