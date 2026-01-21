# BACKLOG-357: Filter Text Messages by Audit Dates with Toggle

**Created**: 2026-01-21
**Priority**: High
**Category**: Feature
**Status**: Pending

---

## Description

Add toggles to filter text messages by the transaction's audit date range (started_at to closed_at) in two places:

1. **Main text messages list** - Near "Text Messages (571) in 6 conversations" header
2. **Conversation preview modal** - When user clicks "View" on a conversation

This ensures users see exactly what will be exported in the audit, with the option to view all messages if needed.

## Expected Behavior

### Part 1: Main List View Toggle

1. Toggle button near "Text Messages (X) in Y conversations" header
2. When ON (default): Shows only messages/threads within audit date range
3. When OFF: Shows all messages/threads
4. Count updates to reflect filtered totals

```
┌─────────────────────────────────────────────────────┐
│ Text Messages (45)              [☑ Audit period]   │
│ in 4 conversations                                  │
│                                                     │
│ (Showing 45 of 571 messages within Nov 8 - Jan 27) │
├─────────────────────────────────────────────────────┤
│ [Thread cards...]                                   │
└─────────────────────────────────────────────────────┘
```

### Part 2: Conversation Preview Toggle

1. User clicks "View" to open conversation modal
2. By default, only messages within audit date range are shown
3. Toggle at top to show full conversation history
4. Visual indicator showing filtered vs total count

```
┌─────────────────────────────────────────────────────┐
│ Conversation with GianCarlo              [Dismiss] │
│ ☑ Show audit period only (Nov 8 - Jan 27)         │
│ Showing 15 of 75 messages                          │
├─────────────────────────────────────────────────────┤
│ [Messages within date range...]                    │
└─────────────────────────────────────────────────────┘
```

## Acceptance Criteria

### Main List View
- [ ] Toggle button in text messages header area
- [ ] Default: ON (show audit period only)
- [ ] Updates message count and conversation count when toggled
- [ ] Shows date range in UI (e.g., "Nov 8 - Jan 27")
- [ ] Threads with NO messages in audit period are hidden when toggle is ON

### Conversation Preview
- [ ] Toggle in ConversationViewModal header
- [ ] Default: ON (show audit period only)
- [ ] Shows "X of Y messages" count
- [ ] Date range displayed in toggle label
- [ ] Smooth transition when toggling

### General
- [ ] Toggle state persists during session
- [ ] Uses transaction.started_at and transaction.closed_at for date range
- [ ] Handles missing dates gracefully (if no dates set, show all)

## Technical Notes

- TransactionMessagesTab.tsx - Main list view
- ConversationViewModal.tsx - Chat preview modal
- Need access to transaction.started_at and transaction.closed_at
- Filter logic similar to enhancedExportService._filterCommunicationsByDate()

## Related

- Export filtering uses same date range logic
- BACKLOG-359: Audit date range shown in Summary PDF header
