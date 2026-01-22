# BACKLOG-394: Transaction Card Shows Individual Text Count Instead of Thread Count

**Created**: 2026-01-22
**Priority**: High
**Category**: Bug
**Status**: In Progress

---

## Problem

Transaction cards show the count of individual text messages instead of text threads/conversations. This is the same issue we fixed for emails (BACKLOG-390).

## Solution

Update the card to show text thread count (conversations) instead of individual message count.

## Acceptance Criteria

- [ ] Card shows text thread/conversation count, not individual messages
- [ ] Count matches what's shown in the Messages tab

---

# Also: Show "0" counts for design consistency

Instead of hiding the email/text counts when 0, always show them:
- "0 email threads"
- "0 texts"

This maintains design consistency across all transaction cards.
