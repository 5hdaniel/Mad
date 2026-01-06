# TASK-993: Fix Thread Grouping by Participants

**Sprint**: SPRINT-027 - Messages & Contacts Polish
**Priority**: 0 (Blocking - must fix before Phase 1 tasks)
**Estimated Tokens**: ~15,000
**Phase**: Phase 0 (Pre-requisite)
**Status**: Ready for Assignment

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Branch Information

**Branch From:** `feature/contact-first-attach-messages`
**Branch Into:** `feature/contact-first-attach-messages`
**Branch Name:** `fix/TASK-993-thread-grouping`

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

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (if feasible)
- Test grouping logic with mocked thread_id data
- Test fallback to participant-based grouping

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): group messages by iMessage thread_id`
- **Labels**: `fix`, `messages`
- **Base Branch**: `feature/contact-first-attach-messages`

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Confidence:** Medium

**Risk factors:**
- May need database inspection to verify thread_id population
- Query modifications may affect other consumers

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] MessageThreadCard.tsx
- [ ] databaseService.ts (if needed)
- [ ] Type definitions (if needed)
- [ ] Tests updated

Features implemented:
- [ ] thread_id used for grouping
- [ ] Fallback to participant grouping works
- [ ] Group chats display correctly

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** feature/contact-first-attach-messages
