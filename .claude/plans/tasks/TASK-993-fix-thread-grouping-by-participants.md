# TASK-993: Fix Thread Grouping by Participants

**Sprint**: SPRINT-027 - Messages & Contacts Polish
**Priority**: 1 (Blocking - must fix before other tasks)
**Estimated Tokens**: ~15,000
**Phase**: Phase 0 (Pre-requisite)

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

## Root Cause Investigation

The `getParticipantKey()` function in `MessageThreadCard.tsx` attempts to group by participant set, but:
1. May not be parsing participants JSON correctly from the messages table
2. Phone number normalization may be too aggressive or inconsistent
3. The "me" identifier may vary (could be actual phone number, email, or literal "me")

## Technical Details

**File**: `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

**Current Implementation**:
```typescript
function getParticipantKey(msg: MessageLike): string {
  // Parses participants, normalizes phones, removes "me"
  // Returns sorted participant list joined by "|"
}
```

**Data Source**: Messages from `getMessagesByContact` query which filters by contact appearing in participants JSON.

## Acceptance Criteria

- [ ] 1:1 chats appear as single "Chat with [Contact]" entry
- [ ] Each unique group chat appears as separate entry
- [ ] Group chats show all participants in the title
- [ ] Message counts per chat are accurate
- [ ] Works for both phone numbers and email addresses

## Implementation Steps

1. Debug: Log participant data to understand actual structure
2. Fix `getParticipantKey` to handle real data format
3. Handle variations in "me" identifier (phone, email, literal)
4. Test with real data from user's message database

## Dependencies

- None (this is blocking other tasks)

## Files to Modify

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- Possibly: `electron/services/db/databaseService.ts` (if query needs adjustment)

---
