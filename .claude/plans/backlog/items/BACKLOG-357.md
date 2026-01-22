# BACKLOG-357: Filter Text Message List by Audit Dates

**Created**: 2026-01-21
**Updated**: 2026-01-22
**Priority**: High
**Category**: Feature
**Status**: Pending

---

## Description

Add a toggle to filter the text message **card list** by the transaction's audit date range.

## Current State

- **Conversation preview modal**: Has date filtering toggle ✓ DONE
- **Text message card list**: No date filtering toggle ✗ PENDING

## Required Changes

### Add Toggle to Text Message Card List

Near the "Text Messages (X) in Y conversations" header, add a toggle to filter by audit dates:

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

**Behavior:**
- Toggle ON (default): Shows only threads/messages within audit date range (started_at to closed_at)
- Toggle OFF: Shows all threads/messages
- Count updates to reflect filtered totals
- Threads with NO messages in audit period are hidden when toggle is ON

## Acceptance Criteria

- [ ] Toggle button in text messages header area
- [ ] Default: ON (show audit period only)
- [ ] Updates message count and conversation count when toggled
- [ ] Shows date range in UI (e.g., "Nov 8 - Jan 27")
- [ ] Threads with no messages in audit period are hidden when toggle is ON
- [ ] Toggle state persists during session
- [ ] Handles missing dates gracefully (if no dates set, show all)

## Technical Notes

- TransactionMessagesTab.tsx - Main list view
- Need access to transaction.started_at and transaction.closed_at
- Filter logic similar to enhancedExportService._filterCommunicationsByDate()
- Match the toggle styling from ConversationViewModal

## Related

- ConversationViewModal.tsx (already has this feature - use as reference)
- Export filtering uses same date range logic
