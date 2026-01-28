# BACKLOG-495: Text messages show twice in conversation view modal

## Type
Bug

## Priority
Medium

## Status
Open

## Description
In the Message Thread View Modal (MessageThreadViewModal), each text message is displayed twice - the same message appears as two consecutive bubbles with identical content, timestamps, and styling.

## Reproduction Steps
1. Open a transaction with text messages linked
2. Click "View Thread" on a message thread with multiple texts
3. Observe that each message appears duplicated in the conversation view

## Expected Behavior
Each text message should appear exactly once in the thread view.

## Actual Behavior
Each text message bubble appears twice consecutively, making the conversation view confusing and hard to read.

## Technical Notes
- This may be related to how messages are grouped in `MessageThreadCard.tsx`
- Could be a duplicate in the data source or in the rendering logic
- Similar architecture to EmailThreadCard which does not have this issue

## Related Files
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- `src/components/transactionDetailsModule/components/modals/MessageThreadViewModal.tsx`

## Created
2025-01-24

## Labels
bug, ui, messages
