# BACKLOG-173: Contact-First AttachMessagesModal Interface

**Created**: 2026-01-05
**Priority**: High
**Category**: ui / performance
**Status**: Completed (PR #353)

---

## Description

Redesign the AttachMessagesModal to use a contact-first interface instead of loading all messages at once. This addresses a critical performance issue where loading 500k+ messages caused the UI to freeze.

## Problem Statement

The original AttachMessagesModal attempted to load ALL messages from the database on open:
- With 579,000+ messages, this caused a complete UI freeze
- The modal would show "No unlinked messages available" or hang indefinitely
- Users could not attach text messages to transactions

## Solution Implemented

**Two-View Interface:**
1. **Contact List View**: Shows contacts with message counts (fast query with LIMIT)
2. **Thread Selection View**: Shows message threads for the selected contact only

**New Database Methods:**
- `getMessageContacts()`: Returns unique contacts who have messages, with message counts
- `getMessagesByContact()`: Returns messages for a specific contact
- `getUnlinkedEmails()`: Returns emails not linked to any transaction

**Additional Enhancements:**
- Contact name resolution from macOS Contacts database
- Thread cards show participants and date ranges
- Updated terminology from "messages" to "chats"
- Search contacts by phone number or name

## Technical Changes

### Database Layer (electron/services/databaseService.ts)
```typescript
// New methods added
getMessageContacts(): Promise<ContactWithMessageCount[]>
getMessagesByContact(contactId: string): Promise<Message[]>
getUnlinkedEmails(): Promise<Message[]>
```

### Service Layer (electron/services/transactionService.ts)
- Added contact-based message queries
- Optimized queries with proper LIMIT clauses

### IPC Handlers (electron/transaction-handlers.ts)
- `transactions:getMessageContacts` - Get contacts with message counts
- `transactions:getMessagesByContact` - Get messages for specific contact
- `transactions:getUnlinkedEmails` - Get unlinked emails

### Preload Bridge (electron/preload/transactionBridge.ts)
- Exposed new IPC methods to renderer

### UI Component (src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx)
- Complete rewrite with two-view interface
- Contact search functionality
- Thread selection UI
- 436 lines added, 242 lines removed

## Files Modified

| File | Changes |
|------|---------|
| `electron/preload/transactionBridge.ts` | +25 lines - New IPC bridges |
| `electron/services/databaseService.ts` | +69 lines - New query methods |
| `electron/services/transactionService.ts` | +82 lines - Contact-based queries |
| `electron/transaction-handlers.ts` | +108 lines - New IPC handlers |
| `src/components/.../AttachMessagesModal.tsx` | +436/-242 - Complete rewrite |
| `src/components/.../__tests__/AttachMessagesModal.test.tsx` | +196/-230 - Updated tests |

## Performance Impact

| Scenario | Before | After |
|----------|--------|-------|
| Open modal (579k messages) | UI freeze (~30s+) | Instant (<100ms) |
| Initial data load | All messages | Contacts only (~50-100 items) |
| Message list | Full scan | Filtered by contact |

## Acceptance Criteria

- [x] Modal opens instantly regardless of message count
- [x] Contact list shows message counts
- [x] Search contacts by phone/name works
- [x] Selecting contact shows their threads
- [x] Thread cards show participants and date range
- [x] Can select and attach threads to transaction
- [x] 21 tests pass for new contact-first flow
- [x] TypeScript type check passes
- [x] ESLint passes (only pre-existing warnings)

## PR Details

- **PR**: #353
- **Branch**: `feature/contact-first-attach-messages`
- **Status**: Open (ready for merge)
- **Additions**: 916 lines
- **Deletions**: 472 lines

## Related Items

- **BACKLOG-105**: Text Messages Tab in Transaction Details (parent feature, completed)
- **BACKLOG-170**: Messages Not Loading in Attach Modal (bug that triggered this work)
- **BACKLOG-172**: macOS Messages Import (future enhancement)
- **TASK-704**: Original attach/unlink messages task

## Metrics

| Metric | Value |
|--------|-------|
| Estimated Tokens | ~40,000 |
| Actual Tokens | (from hook data) |
| Files Changed | 6 |
| Lines Added | 916 |
| Lines Removed | 472 |
| Tests | 21 passing |

---

## Notes

This was an emergency performance fix triggered by BACKLOG-170 investigation. The original "messages not loading" bug led to discovering that loading 579k+ messages was never going to work - a fundamental architecture change was needed.

The contact-first approach is more intuitive for users anyway: they typically know WHO they want to attach messages from, not a specific message date/time.
