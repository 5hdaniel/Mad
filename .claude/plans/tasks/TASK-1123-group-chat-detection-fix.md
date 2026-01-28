# Task TASK-1123: Fix 1:1 Chat Group Detection

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

## Goal

Fix the group chat detection logic so that 1:1 conversations with an "unknown" participant are not incorrectly displayed as group chats.

## Background

BACKLOG-299 documents that 1:1 chats where one participant has an "unknown" identifier are incorrectly flagged as group chats. The `isGroupChat()` function appears to count "unknown" as a participant, making 1:1 conversations appear as 3+ party groups.

## Non-Goals

- Do NOT change how actual group chats are detected
- Do NOT modify the group chat UI itself
- Do NOT change participant storage schema
- Do NOT implement new chat features

## Deliverables

1. Update: `isGroupChat()` function or equivalent logic
2. Update: Participant counting to exclude/handle "unknown"
3. Tests: Verify 1:1 with unknown shows as 1:1

## Acceptance Criteria

- [ ] 1:1 chats display as 1:1 (not group) regardless of "unknown" participants
- [ ] Actual group chats (3+ known participants) still display as groups
- [ ] Edge cases handled (2 unknown + 1 known = group)
- [ ] No regressions in chat list display
- [ ] All CI checks pass

## Implementation Notes

### Root Cause Analysis

**Verified from code review:**

The `isGroupChat()` function in `MessageThreadCard.tsx` (line 78-81):
```typescript
function isGroupChat(messages: MessageLike[]): boolean {
  const participants = getThreadParticipants(messages);
  return participants.length > 1;  // NOT > 2 as assumed
}
```

The `getThreadParticipants()` function (line 46-73) already filters out "me" but NOT "unknown":
```typescript
if (parsed.from && parsed.from !== "me") {
  participants.add(parsed.from);  // "unknown" passes this filter
}
```

**Two-pronged issue:**
1. **Display issue:** `getThreadParticipants()` doesn't filter "unknown"
2. **Data issue:** Where is "unknown" being SET in the messages table?

### Investigation Steps

1. Add "unknown" filter to `getThreadParticipants()` (immediate fix)
2. Query messages table for records with "unknown" in participants JSON
3. Trace back to message import to find where "unknown" originates
4. Fix at source to prevent "unknown" from being stored

### Key Files to Review

```typescript
// Display logic (PRIMARY - immediate fix here)
src/components/transactionDetailsModule/components/MessageThreadCard.tsx
  - getThreadParticipants() - line 46-73, needs "unknown" filter
  - isGroupChat() - line 78-81, no changes needed if filter added above

// Data creation (ROOT CAUSE investigation)
electron/services/macOSMessagesImportService.ts
  - Where is participants JSON being constructed?
  - What happens when a participant can't be resolved?

// Other files using isGroupChat pattern (check for consistency)
src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx
src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx
```

### Logic Fix

```typescript
// In getThreadParticipants(), add filter for "unknown":
function getThreadParticipants(messages: MessageLike[]): string[] {
  const participants = new Set<string>();
  for (const msg of messages) {
    try {
      if (msg.participants) {
        const parsed = typeof msg.participants === "string"
          ? JSON.parse(msg.participants)
          : msg.participants;
        // Filter out "me" AND "unknown"
        if (parsed.from && parsed.from !== "me" && parsed.from !== "unknown") {
          participants.add(parsed.from);
        }
        if (parsed.to) {
          const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
          toList.forEach((p: string) => {
            if (p && p !== "me" && p !== "unknown") participants.add(p);
          });
        }
      }
    } catch { /* Fall through */ }
  }
  return Array.from(participants);
}
```

## Integration Notes

- Imports from: Message/chat utilities
- Exports to: Chat display components
- Used by: Conversation list, chat view
- Depends on: Participant data structure

## Do / Don't

### Do:
- Handle "unknown" consistently (filter or ignore)
- Preserve actual group chat detection
- Test with various participant combinations
- Consider edge cases (all unknown, 2 known + unknown, etc.)

### Don't:
- Don't change how participants are stored
- Don't modify actual group chat UI
- Don't break iMessage threading
- Don't ignore the "unknown" data - it may have meaning

## When to Stop and Ask

- If "unknown" represents something other than missing contact
- If fix affects how messages are grouped into conversations
- If the issue is in how participants are parsed from iMessage DB

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test 1:1 with "unknown" returns false for isGroupChat
  - Test actual group (3+ known) returns true
  - Test edge cases (2 unknown + 1 known, etc.)
- Existing tests to update:
  - Update isGroupChat tests if they exist

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - View 1:1 conversation - displays as 1:1
  - View group conversation - displays as group
  - Conversation list - correct icons/labels

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(chat): correct group chat detection for unknown participants`
- **Labels**: `bug`, `ui`, `messages`
- **Depends on**: TASK-1122 (Phase 2 sequential)

---

## SR Engineer Pre-Implementation Review

**Review Date:** - | **Status:** PENDING

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1123-group-chat-detection

### Execution Classification
- **Parallel Safe:** Yes (Phase 1, parallel with TASK-1120)
- **Depends On:** None
- **Blocks:** TASK-1122 (Phase 2 waits for Phase 1)

### Shared File Analysis
- **Primary file:** `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- **Secondary files:** `ConversationViewModal.tsx`, `AttachMessagesModal.tsx` (check for similar patterns)
- **Root cause investigation:** `electron/services/macOSMessagesImportService.ts`
- **Conflicts with:** None expected - display logic only

### Technical Considerations

*(To be completed by SR Engineer)*

### Architecture Notes

*(To be completed by SR Engineer)*

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Investigation | Find isGroupChat logic | +5K |
| Implementation | Update filter logic | +8K |
| Testing | Edge case coverage | +8K |
| Complexity | Low - logic update | +4K |

**Confidence:** High

**Risk factors:**
- "unknown" may have semantic meaning
- Edge cases in participant counting

**Similar past tasks:** UI logic fixes typically ~15-25K

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
- [ ] (files modified)

Features implemented:
- [ ] isGroupChat() fix
- [ ] Participant filtering
- [ ] Edge case handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Will be captured on session completion

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | - |
| Cache Create | - |

**Variance:** PM Est ~25K vs Actual XK (X%)

### Notes

**Planning notes:**
<What you discovered during investigation>

**Deviations from plan:**
<Any changes from the original task description>

**Design decisions:**
<Key choices made and rationale>

**Issues encountered:**
<Problems faced and how resolved>

**Reviewer notes:**
<Notes for SR Engineer review>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | XK | X% |
| Duration | - | X min | - |

**Root cause of variance:**
<Explain why estimate differed from actual>

**Suggestion for similar tasks:**
<Recommendation for future estimates>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
