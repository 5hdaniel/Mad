# TASK-989: Contact-First AttachMessagesModal Interface

**Sprint**: N/A (Emergency fix during SPRINT-026)
**Priority**: Critical
**Estimate**: 40,000 tokens
**Status**: Completed (PR #353)
**Dependencies**: None
**Backlog**: BACKLOG-173

---

## Objective

Redesign AttachMessagesModal to use a contact-first interface to fix UI freeze when loading 500k+ messages.

## Context

During BACKLOG-170 investigation ("Messages Not Loading"), discovered that the modal attempted to load ALL messages at once. With 579k+ messages in the database, this caused:
- Complete UI freeze for 30+ seconds
- "No unlinked messages available" displayed after timeout
- Unusable feature for power users with large message databases

## Implementation Summary

### Solution Approach

Replaced single-view "all messages" design with two-view contact-first interface:

1. **View 1: Contact Selection**
   - Query unique contacts with message counts (fast, LIMIT-protected)
   - Show contact name (resolved from macOS Contacts if available)
   - Display message count per contact
   - Search by phone number or name

2. **View 2: Thread Selection**
   - Load only selected contact's messages
   - Group into threads by conversation
   - Show participant list and date range
   - Checkbox selection for attaching

### Database Layer

Added three new methods to `databaseService.ts`:

```typescript
// Get contacts with message counts (optimized)
getMessageContacts(): Promise<ContactWithMessageCount[]>

// Get messages for specific contact only
getMessagesByContact(contactId: string): Promise<Message[]>

// Get unlinked emails (separate from texts)
getUnlinkedEmails(): Promise<Message[]>
```

### IPC Layer

Added handlers in `transaction-handlers.ts`:
- `transactions:getMessageContacts`
- `transactions:getMessagesByContact`
- `transactions:getUnlinkedEmails`

### UI Changes

Complete rewrite of `AttachMessagesModal.tsx`:
- Two-panel interface (contacts | threads)
- Contact search with debouncing
- Thread cards with participant info
- Date range display
- Updated terminology: "messages" -> "chats"

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `electron/preload/transactionBridge.ts` | +25 | Expose new IPC methods |
| `electron/services/databaseService.ts` | +69 | Contact-based queries |
| `electron/services/transactionService.ts` | +82 | Service layer methods |
| `electron/transaction-handlers.ts` | +108 | IPC handlers |
| `AttachMessagesModal.tsx` | +436/-242 | Complete rewrite |
| `AttachMessagesModal.test.tsx` | +196/-230 | Updated tests |

## Acceptance Criteria

- [x] Modal opens instantly (<100ms) regardless of message count
- [x] Contact list displays with message counts
- [x] Contact search works (phone/name)
- [x] Selecting contact shows their message threads
- [x] Thread cards show participants and date range
- [x] Can select threads and attach to transaction
- [x] TypeScript type check passes
- [x] ESLint passes
- [x] All 21 tests pass

## Quality Gates

- [x] Type-check: PASS
- [x] Lint: PASS (only pre-existing warnings)
- [x] Tests: 21/21 passing
- [ ] SR Engineer review: Pending

## Branch

```
feature/contact-first-attach-messages
```

## PR

**PR #353**: feat: contact-first interface for AttachMessagesModal
- Status: Open
- Additions: 916
- Deletions: 472
- Files: 6

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (from session) |
| Total Tokens | ~40,000 (estimated) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated after merge) |

---

## Notes

This was an emergency architectural fix. The original approach of loading all messages was fundamentally flawed for users with large message databases (500k+ messages from years of texts).

The contact-first pattern is also more intuitive from a UX perspective - users know who they communicated with, not specific message dates.
