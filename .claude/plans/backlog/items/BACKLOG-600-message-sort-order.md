# BACKLOG-600: Message Sort Order Bug - Oldest First Instead of Newest

## Summary

Message preview panel in transaction details sorts messages oldest-first when it should be newest-first. Users see old messages at the top and must scroll down to see the most recent communications.

## Problem

When viewing messages in the transaction detail view (MessageThreadCard and ConversationViewModal), messages are sorted in ascending order by date (oldest first). This is the opposite of what users expect - they want to see the most recent messages at the top.

## Root Cause

The sort comparison returns `dateA - dateB` which sorts ascending (oldest first). It should return `dateB - dateA` for descending (newest first).

## Files to Modify

1. `src/components/transaction/MessageThreadCard.tsx` (line ~462)
   - Change: `return dateA - dateB;` to `return dateB - dateA;`

2. `src/components/transaction/ConversationViewModal.tsx` (line ~228)
   - Change: `return dateA - dateB;` to `return dateB - dateA;`

## Acceptance Criteria

- [ ] Messages in MessageThreadCard sort newest-first
- [ ] Messages in ConversationViewModal sort newest-first
- [ ] Most recent messages appear at the top of the list
- [ ] No regressions in message display functionality

## Priority

**HIGH** - User-facing bug affecting core message viewing experience

## Estimated Tokens

~5K (simple two-line fix)

## Created

2026-02-02 (discovered during SPRINT-068 testing)
