# TASK-993: Fix Thread Grouping by Participants

**Sprint**: SPRINT-027 - Messages & Contacts Polish
**Priority**: 1 (Blocking - must fix before other tasks)
**Estimated Tokens**: ~15,000
**Phase**: Phase 0 (Pre-requisite)
**Status**: IN PROGRESS - Initial fix attempted, needs further debugging

---

## Problem Statement

When selecting a contact in AttachMessagesModal, messages should be grouped into distinct chats like on a phone:
- **ONE** 1:1 chat with the selected contact
- **Multiple** group chats where that contact is a participant (each with different participant combinations)

**Current Behavior**: All messages are clustered into a single thread regardless of actual conversation grouping.

**Expected Behavior**:
- "Chat with Paul Dorian" (1:1 messages only)
- "Group Chat: Paul Dorian, Alice, Bob" (3-person group)
- "Group Chat: Paul Dorian, Charlie" (different 2-person group)

## Work Done So Far

1. Changed `groupMessagesByThread` to prioritize `thread_id` field over participant-based grouping
2. Added `getThreadKey()` function that uses `thread_id` (format: `macos-chat-{chat_id}`) first
3. **Result**: Still not working correctly - messages still clustering into one thread

## Root Cause Investigation (Still Needed)

Possible issues:
1. **`thread_id` not populated**: Messages may not have `thread_id` field set in the database
2. **Query not returning thread_id**: The `getMessagesByContact` query may not be selecting `thread_id`
3. **Type issue**: `thread_id` may not be on the `MessageLike` type being returned
4. **Participant fallback not working**: When `thread_id` is null, participant-based grouping failing

## Debug Steps Required

1. Log actual message data returned from `getMessagesByContact` to see:
   - Is `thread_id` populated?
   - What does `participants` JSON look like?
2. Check if messages table has `thread_id` values via SQL query
3. Verify `Message` type includes `thread_id` field

## Technical Details

**File**: `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

**Current Implementation**:
```typescript
function getThreadKey(msg: MessageLike): string {
  // FIRST: Use thread_id if available
  if (msg.thread_id) {
    return msg.thread_id;
  }
  // FALLBACK: Compute from participants
  // ... normalize and join participants
}
```

**Data Source**: Messages from `getMessagesByContact` query

## Acceptance Criteria

- [ ] 1:1 chats appear as single "Chat with [Contact]" entry
- [ ] Each unique group chat appears as separate entry
- [ ] Group chats show all participants in the title
- [ ] Message counts per chat are accurate
- [ ] Works for both phone numbers and email addresses

## Implementation Steps

1. **Debug**: Add console.log to see actual data structure returned from API
2. **Verify DB**: Check if `thread_id` is populated in messages table
3. **Fix query**: Ensure `getMessagesByContact` returns `thread_id`
4. **Fix types**: Ensure `Message` type has `thread_id` property
5. **Test**: Verify grouping works correctly with real data

## Dependencies

- None (this is blocking other tasks)

## Files to Modify

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- `electron/services/db/databaseService.ts` (getMessagesByContact query)
- Possibly: Type definitions for Message

---
