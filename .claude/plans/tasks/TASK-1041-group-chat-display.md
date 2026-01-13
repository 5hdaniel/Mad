# TASK-1041: Group Chat Display in Transaction Details

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1041 |
| **Sprint** | SPRINT-034 |
| **Backlog Item** | BACKLOG-218 |
| **Priority** | HIGH |
| **Phase** | 3 |
| **Estimated Tokens** | ~30K |
| **Token Cap** | 120K |
| **Status** | **READY FOR IMPLEMENTATION** |

---

## Problem Statement

Group chats in transaction details should be visually distinct from 1:1 chats, using the same format as the chat selection modal.

---

## Requirements (Confirmed by User)

Use **Option C: Visual Distinction** matching the existing chat selection UI:

```
+------------------------------------------+
| [Purple Group Icon] Group Chat  [4 people]|
| Also includes: Name1, Name2, Name3       |
| Jan 3 - Jan 9  •  69 messages            |
+------------------------------------------+
```

### Visual Elements:
- Purple background circle with group people icon
- "Group Chat" as title (bold)
- Purple badge showing participant count (e.g., "4 people")
- "Also includes:" line with participant names
- Date range and message count

---

## Current Behavior (Presumed)

| Aspect | Current (TBD) | Desired (TBD) |
|--------|---------------|---------------|
| Group name | ? | ? |
| Participants | ? | ? |
| Message preview | ? | ? |
| Visual style | ? | ? |
| Expand/collapse | ? | ? |

---

## Possible Requirements (TBD)

Based on common patterns, the user might want:

### Option A: Participant List Display

```
+------------------------------------------+
| Group Chat: House Purchase Discussion     |
| Participants: John, Jane, Bob, Sarah     |
| Last message: "Thanks everyone!" - Bob   |
| 15 messages                              |
+------------------------------------------+
```

### Option B: Expandable Group Details

```
+------------------------------------------+
| [>] House Purchase Discussion  (15 msgs)  |
+------------------------------------------+
    Expanded:
    +--------------------------------------+
    | Participants:                        |
    | - John Smith (Buyer)                 |
    | - Jane Doe (Seller)                  |
    | - Bob Johnson (Agent)                |
    | Recent messages:                     |
    | - "Thanks everyone!" - Bob           |
    | - "Great news!" - Jane               |
    +--------------------------------------+
```

### Option C: Visual Distinction from 1:1

```
1:1 Chat:
+------------------------------------------+
| [Avatar] John Smith                      |
| 12 messages                              |
+------------------------------------------+

Group Chat:
+------------------------------------------+
| [Group Icon] House Discussion (4 people)  |
| 15 messages                              |
+------------------------------------------+
```

---

## Files Likely to Modify (TBD)

| File | Likely Changes |
|------|----------------|
| Transaction detail view component | Display logic |
| Communication list component | Rendering |
| CSS/styles | Visual distinction |

---

## Acceptance Criteria

**TBD - Pending user clarification**

- [ ] [Requirements to be defined]
- [ ] Full test suite passes
- [ ] No regression in 1:1 chat display

---

## Testing Requirements

**TBD - Pending requirements**

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** feature/TASK-1041-group-chat-display

---

## Implementation Summary

### Changes Made
1. Added utility functions to detect group chats and extract participants:
   - `getThreadParticipants()` - extracts all unique participants from messages
   - `isGroupChat()` - returns true if more than one external participant
   - `formatParticipantNames()` - formats participant names with contact name resolution

2. Updated `MessageThreadCard` component to render differently for group chats:
   - Purple background with group icon (instead of green avatar)
   - "Group Chat" title with "[X people]" badge
   - "Also includes: Name1, Name2, Name3" participant list
   - Date range and message count inline

### Files Modified
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

### Tests Added
- None (existing component structure, visual-only changes)

### Manual Testing Done
- TypeScript compilation passes

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1035 | Must complete before this (Phase 1) - encoding fix for group chats |
| TASK-1036 | Must complete before this (Phase 1) |
| TASK-1037 | Must complete before this (Phase 2) |
| TASK-1038 | Must complete before this (Phase 2) |
| TASK-1039 | Must complete before this (Phase 2) |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-218 | Group Chat Display | Source backlog item |
| BACKLOG-215 | iMessage Encoding Corruption | Related - group chats affected |

---

## Notes

- **DO NOT ASSIGN** until requirements are clarified with user
- TASK-1035 (encoding fix) must be complete first - group chats are affected by encoding bug
- Once requirements are clear, update this task file with:
  - Specific acceptance criteria
  - Implementation approach
  - Files to modify
  - Testing requirements
- If requirements are not clarified during SPRINT-034, defer to next sprint
