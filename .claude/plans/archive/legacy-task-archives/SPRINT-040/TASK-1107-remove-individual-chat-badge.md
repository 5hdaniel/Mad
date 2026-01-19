# TASK-1107: Remove Message Count Badge from Individual Chat Cards

## Status: Complete

## Context

TASK-1106 removed the message count badge from group chats but kept it on 1:1 (individual) chat cards. The user wants consistent behavior - no message count badges on any chat cards.

## Objective

Remove the green "X messages" badge from individual (1:1) chat cards in `MessageThreadCard.tsx`.

## File to Modify

`src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

## Implementation Details

### Current State (Lines 262-267)

The 1:1 chat header currently displays a badge with message count:

```tsx
<span
  className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full"
  data-testid="individual-message-count-badge"
>
  {messages.length} {messages.length === 1 ? "message" : "messages"}
</span>
```

### Required Change

Remove the entire `<span>` element (lines 262-267) from the 1:1 chat header section. The header should just show the contact name without the badge.

### After Change

The 1:1 chat header div (lines 255-268) should become:

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <h4
    className="font-semibold text-gray-900 truncate"
    data-testid="thread-contact-name"
  >
    {contactName || phoneNumber}
  </h4>
</div>
```

## Acceptance Criteria

- [x] Green message count badge is removed from individual (1:1) chat cards
- [x] Contact name still displays correctly
- [x] No visual regressions in the thread card layout
- [x] Tests pass (update any tests that reference `individual-message-count-badge` test ID)

## Test Considerations

Check if any tests reference `data-testid="individual-message-count-badge"` - those assertions would need to be removed or updated.

## Effort Estimate

~5K tokens - Simple removal of a UI element.

## Branch Information

**Branch From:** develop
**Branch Name:** fix/TASK-1107-remove-individual-chat-badge

---

## Implementation Summary

### Agent ID
`engineer-task-1107`

### Changes Made
- [x] `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - Removed the green message count badge span (lines 262-267) from the 1:1 chat header section
- [x] `src/components/transactionDetailsModule/components/__tests__/MessageThreadCard.test.tsx` - Removed the "message count badge" test describe block (3 tests that were testing the removed badge)

### Testing Done
- [x] All 35 MessageThreadCard tests pass
- [x] Type-check passes
- [x] Lint passes (pre-existing issue in ContactSelectModal.tsx unrelated to this change)

### Notes
- Simple removal matching TASK-1106 which removed the badge from group chats
- Individual chat cards now match group chat cards in not displaying message count badges
- The flex container structure was preserved to maintain layout consistency
