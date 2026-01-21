# BACKLOG-356: Redesign Text Conversation Cards (Date Range, No Preview)

**Created**: 2026-01-21
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

Redesign the Text Conversation cards in the transaction details view to be cleaner and more informative:

**Current:**
```
GianCarlo
+14243335133
75 messages
"Last message preview text..."
[View]
```

**Expected:**
```
GianCarlo (+14243335133) Jan 1, 2026 - Jan 6, 2026    View Full →
```

## Changes

1. **Remove**: Last message preview text
2. **Remove**: Message count
3. **Remove**: Phone number on separate line
4. **Add**: Phone number inline with name in parentheses
5. **Add**: Date range showing first to last message dates
6. **Update**: "View" button to "View Full →"

## Acceptance Criteria

- [ ] Contact name with phone in parentheses on same line
- [ ] Date range (first message - last message) displayed
- [ ] No message preview text
- [ ] No message count
- [ ] "View Full →" button styling

## Related

- MessageThreadCard.tsx
- TransactionDetailsTab.tsx
