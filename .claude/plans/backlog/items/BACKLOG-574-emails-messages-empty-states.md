# BACKLOG-574: Emails and Messages Empty State Styling

## Summary
Update empty states for Emails and Messages tabs to match the Contacts empty state style.

## Before
- Action buttons at top right
- Plain centered text
- No visual container

## After
- Gray rounded box container (`bg-gray-50 rounded-lg p-6`)
- Centered icon matching tab icon (envelope / chat bubble)
- "No emails/messages linked" heading
- "Click [Action] to get started" helper text
- Centered action button inside the box

## Consistency
Now matches the Key Contacts empty state:
```
┌─────────────────────────────────────────────┐
│            [icon - gray]                     │
│                                              │
│           No [items] linked                  │
│   Click "[Action]" to get started            │
│                                              │
│           [+ Action Button]                  │
└─────────────────────────────────────────────┘
```

## Files Modified
- `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx`
- `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`

## Status
Completed - Sprint 066
