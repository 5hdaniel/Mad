# BACKLOG-357: Filter Text Preview by Audit Dates with Toggle

**Created**: 2026-01-21
**Priority**: Medium
**Category**: Feature
**Status**: Pending

---

## Description

When a user views the preview of a text chat conversation, by default only show messages that fall within the transaction's audit date range (start_date to closed_at/end_date). Provide a toggle to allow viewing the entire conversation history if needed.

## Expected Behavior

1. User clicks to view text conversation preview
2. By default, only messages within transaction date range are shown
3. Toggle at top: "Show messages within audit period only" (on by default)
4. When toggled off, shows full conversation history
5. Visual indicator showing how many messages are filtered out

## UI Mockup

```
┌─────────────────────────────────────────────┐
│ Conversation with GianCarlo                 │
│ ☑ Show audit period only (Jan 1 - Jan 6)   │
│ Showing 15 of 75 messages                   │
├─────────────────────────────────────────────┤
│ [Messages within date range...]             │
└─────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Default filter to transaction date range
- [ ] Toggle to show/hide full conversation
- [ ] Shows count of filtered vs total messages
- [ ] Date range displayed in toggle label
- [ ] Persists toggle state during session

## Related

- ConversationViewModal.tsx
- Transaction start_date and closed_at fields
