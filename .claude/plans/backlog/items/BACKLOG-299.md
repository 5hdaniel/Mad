# BACKLOG-299: 1:1 Chat Incorrectly Displayed as Group Chat Due to "unknown" Participant

## Type
Bug

## Priority
Medium

## Status
Open (Needs Investigation)

## Summary
A 1:1 conversation in MessageThreadCard is incorrectly displayed as "Group Chat: Joanne Pauls Mom, unknown". The presence of an "unknown" participant value causes `isGroupChat()` to return true when it should return false.

## Problem
The `isGroupChat()` function in `MessageThreadCard.tsx` (line 78-81) determines group status by counting participants:

```typescript
function isGroupChat(messages: MessageLike[]): boolean {
  const participants = getThreadParticipants(messages);
  return participants.length > 1;
}
```

When a participant is stored as "unknown" (instead of a valid phone number or being excluded), the participant count becomes 2, triggering group chat display for what is actually a 1:1 conversation.

## Root Cause Investigation Needed

The "unknown" value could originate from:

1. **iOS/macOS Message Parser** - The parser may be storing "unknown" for participants it cannot resolve
2. **Phone Number Normalization** - A normalization function may be producing "unknown" for edge cases
3. **Database Import** - The messages table may have records with "unknown" in sender/recipient fields
4. **Contact Resolution** - A lookup that fails may be writing "unknown" instead of null/undefined

### Investigation Steps
1. Query messages table for records containing "unknown" in participant fields
2. Trace the message import flow for this specific thread
3. Check `getThreadParticipants()` implementation for how it handles missing data
4. Review phone number normalization logic

## Affected Files
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- Likely: message parsing/import services (to be identified)
- Possibly: phone number normalization utilities

## Acceptance Criteria
- [ ] Root cause of "unknown" participant values identified
- [ ] Fix prevents "unknown" from being stored/used as a participant
- [ ] Existing "unknown" values handled gracefully (excluded from participant count or cleaned)
- [ ] 1:1 chats display correctly as 1:1, not group
- [ ] Test case covers the specific scenario

## Dependencies
None

## Discovered During
SPRINT-041 testing

## Notes
This bug affects user trust in the data - seeing "unknown" participants and incorrect chat type labels creates confusion about what data was actually imported.
