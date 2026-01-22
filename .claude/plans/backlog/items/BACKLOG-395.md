# BACKLOG-395: Transaction Card - Reorder Counts and Make Clickable

**Created**: 2026-01-22
**Priority**: Medium
**Category**: UI/UX Enhancement
**Status**: In Progress

---

## Requirements

1. **Reorder counts**: Messages on left, Emails on right
2. **Use same icons** as transaction details tabs (consistency)
3. **Make clickable**: Clicking opens transaction details on the corresponding tab
   - Click "X texts" → Opens details on Messages tab
   - Click "X email threads" → Opens details on Emails tab

## Current
```
📧 6 email threads, 💬 12 texts
```

## Expected
```
💬 12 texts    📧 6 email threads
[clickable]    [clickable]
```

Icons should match the ones used in TransactionDetails tabs.

## Files to Modify

- `src/components/transaction/components/TransactionCard.tsx`
- May need to pass callback props for opening specific tabs

## Acceptance Criteria

- [ ] Messages count shown on left, emails on right
- [ ] Icons match transaction details tab icons
- [ ] Clicking messages count opens details on Messages tab
- [ ] Clicking email count opens details on Emails tab
