# TASK-1043: Fix Unlink Communications UI Refresh

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1043 |
| **Sprint** | SPRINT-035 |
| **Backlog Item** | BACKLOG-220 |
| **Priority** | HIGH |
| **Phase** | 1 |
| **Estimated Tokens** | ~35K |
| **Token Cap** | 140K |

---

## Problem Statement

When unlinking/removing a communication (email or iMessage) from a transaction, the UI does not update. The backend operation succeeds (visible in console logs), but the communication remains visible until page refresh.

**This creates a confusing UX where the user thinks the operation failed.**

---

## Current Behavior

1. Open transaction with linked communications
2. Click to unlink/remove a communication
3. **Nothing visually changes**
4. Backend logs show successful operation
5. Manual page refresh shows the communication is gone

---

## Expected Behavior

1. Open transaction with linked communications
2. Click to unlink/remove a communication
3. **Communication immediately disappears from UI**
4. Success feedback (toast or subtle animation)
5. No page refresh required

---

## Root Cause Investigation

Likely causes to investigate:

### 1. Missing State Invalidation
```typescript
// After unlink operation, state is not being refreshed
const handleUnlink = async () => {
  await window.api.communications.unlink(commId);
  // BUG: Missing state refresh
};
```

### 2. Missing Query Refetch
```typescript
// If using React Query or similar
const { data: communications } = useQuery('communications', fetchComms);

const handleUnlink = async () => {
  await unlinkCommunication(commId);
  // BUG: Missing queryClient.invalidateQueries('communications')
};
```

### 3. Callback Not Propagating to Parent
```typescript
// Child component does operation but parent state unchanged
<CommunicationItem
  onUnlink={handleUnlink} // May not trigger parent re-render
/>
```

### 4. Optimistic Update Missing
```typescript
// Should remove from UI immediately, not wait for refetch
const handleUnlink = async (commId) => {
  // Optimistically remove from list
  setCommunications(prev => prev.filter(c => c.id !== commId));
  // Then do actual operation
  await window.api.communications.unlink(commId);
};
```

---

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Messages display and unlink |
| `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx` | Emails display and unlink |
| `src/components/TransactionDetails.tsx` | Parent component state management |
| `src/components/communications/*.tsx` | Communication components |
| `electron/handlers/communication-handlers.ts` | IPC handlers |

---

## Technical Approach

### Step 1: Identify the Unlink Handler

Find where unlink is triggered:
```typescript
// Search for unlink, remove, detach in communication components
// Likely in TransactionMessagesTab or similar
```

### Step 2: Trace State Management

Map out how communication state is managed:
- Where is the list of communications stored?
- What triggers a refresh?
- Is there a parent callback for updates?

### Step 3: Add Optimistic Update OR Refetch

Option A - Optimistic Update (better UX):
```typescript
const handleUnlink = async (commId: string) => {
  // Immediately remove from UI
  setCommunications(prev => prev.filter(c => c.id !== commId));

  try {
    await window.api.communications.unlink(commId);
  } catch (error) {
    // Rollback on error
    setCommunications(prev => [...prev, removedItem]);
    toast.error('Failed to unlink communication');
  }
};
```

Option B - Refetch After Operation:
```typescript
const handleUnlink = async (commId: string) => {
  await window.api.communications.unlink(commId);
  // Trigger refetch
  await refetchCommunications();
};
```

### Step 4: Ensure Both Email and iMessage Work

The fix must work for both communication types:
- Email unlink from transaction
- iMessage unlink from transaction

---

## Implementation Plan

1. **Reproduce the bug** - Confirm exact component/flow
2. **Map state management** - Understand data flow
3. **Add optimistic update or refetch** - Fix the UI refresh
4. **Add success feedback** - Toast or visual confirmation
5. **Test both email and iMessage** - No type-specific bugs
6. **Add regression test** - Prevent recurrence

---

## Acceptance Criteria

- [ ] Unlinking communication immediately removes it from UI
- [ ] Works for email communications
- [ ] Works for iMessage communications
- [ ] No page refresh required
- [ ] Success feedback shown to user
- [ ] Error handling with rollback if operation fails
- [ ] Regression test added

---

## Testing Requirements

### Unit Tests

```typescript
describe('Communication Unlink UI', () => {
  it('removes email from list immediately after unlink', async () => {
    // Setup: Render component with 2 emails
    // Action: Click unlink on first email
    // Assert: Only 1 email visible in DOM (no wait for refetch)
  });

  it('removes message from list immediately after unlink', async () => {
    // Setup: Render component with 2 messages
    // Action: Click unlink on first message
    // Assert: Only 1 message visible in DOM
  });

  it('shows error and restores item if unlink fails', async () => {
    // Setup: Mock API to fail
    // Action: Click unlink
    // Assert: Item remains visible, error toast shown
  });
});
```

### Integration Tests

1. Load transaction with linked email
2. Unlink email
3. Verify UI updates without refresh
4. Repeat for iMessage

### Manual Testing

1. Open transaction with multiple linked emails
2. Unlink one email
3. Verify it disappears immediately
4. Do NOT refresh page
5. Verify count updates
6. Repeat for iMessages
7. Close and reopen transaction
8. Verify unlinked items stay unlinked

---

## UI Feedback Options

Consider adding subtle feedback:

```typescript
// Option A: Toast notification
toast.success('Communication unlinked');

// Option B: Fade out animation
// CSS transition before removal

// Option C: Count update in tab header
// "Emails (3)" -> "Emails (2)"
```

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1043-unlink-ui-refresh

---

## Implementation Summary

*To be completed by engineer after implementation.*

### Changes Made
-

### Files Modified
-

### Tests Added
-

### Manual Testing Done
-

---

## Dependencies

| Task | Relationship |
|------|-------------|
| None | Can be developed independently |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-220 | Unlink Communications UI Not Refreshing | Source backlog item |
| TASK-1037 | Auto-Link Fix | Found during verification |

---

## Notes

- This is a pure UI state management issue - backend works correctly
- Optimistic updates provide better UX than refetch
- Make sure to handle error case with rollback
- Consider adding loading state while operation is in progress
