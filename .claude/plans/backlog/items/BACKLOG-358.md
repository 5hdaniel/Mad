# BACKLOG-358: Deleted Messages Tab in Transaction Details

**Created**: 2026-01-21
**Priority**: Medium
**Category**: Feature
**Status**: Pending

---

## Description

Add a new tab in the transaction details view to show deleted messages. These are orphan messages that might have been deleted during the time of the transaction. Since we know they were deleted, they should be visible in the audit even though they can't be 100% associated with a specific conversation.

## Why This Matters

In real estate audits, deleted messages during a transaction period could be significant. By surfacing these deleted/orphan messages, auditors can:
- See communications that may have been intentionally hidden
- Identify gaps in conversation threads
- Provide a more complete audit trail

## Implementation

1. Add a new "Deleted Messages" tab in TransactionDetailsPage
2. Query for messages marked as deleted or orphaned within the transaction date range
3. Display with appropriate warnings that these couldn't be matched to conversations
4. Show metadata: date, approximate time, any recoverable content

## UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ [Messages] [Emails] [Contacts] [Deleted Messages (3)]        │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ These messages were deleted during the transaction period │
│ and could not be matched to a specific conversation.        │
├─────────────────────────────────────────────────────────────┤
│ Jan 3, 2026 2:15 PM - Unknown Sender                        │
│ [Content if recoverable, or "Message content deleted"]      │
├─────────────────────────────────────────────────────────────┤
│ Jan 4, 2026 10:30 AM - +14155551234                         │
│ "Partial message content..."                                │
└─────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] New "Deleted Messages" tab in transaction details
- [ ] Queries deleted/orphan messages within transaction date range
- [ ] Shows warning banner explaining these are deleted messages
- [ ] Displays available metadata and content
- [ ] Count shown in tab title
- [ ] Excluded from main Messages tab

## Technical Notes

Need to investigate:
- How iOS backup marks deleted messages
- Whether we're already storing this data
- If not, may need to enhance import to capture deleted message records

## Related

- TransactionDetailsPage.tsx
- Messages import service
- iOS backup parser
