# Task TASK-1014: Show Sender Name on Group Chat Messages

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

Display sender name (or phone number) on each inbound message in group chats so users can identify who sent which message. Also update thread header to show group chat name or participant list.

## Non-Goals

- Do NOT add sender avatars or colors (nice-to-have for future)
- Do NOT modify 1:1 conversation display
- Do NOT add participant management features
- Do NOT change message data model/schema

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Thread header logic
2. Update: `src/components/transactionDetailsModule/components/MessageBubble.tsx` - Add sender name display
3. Update or Create: `src/components/transactionDetailsModule/components/ThreadListItem.tsx` - Group chat name in list

## Acceptance Criteria

- [ ] Inbound messages in group chats show sender name above the bubble
- [ ] Consecutive messages from same sender don't repeat the name
- [ ] Contact name used when available, falls back to phone number
- [ ] Outbound messages (from user) don't show sender label
- [ ] Thread header shows group chat name if available
- [ ] Thread header shows comma-separated participants if no group name
- [ ] Works correctly for both group and 1:1 threads (1:1 unchanged)
- [ ] All CI checks pass

## Implementation Notes

### Message Bubble Updates (MessageBubble.tsx)

```tsx
interface MessageBubbleProps {
  message: Message;
  isOutbound: boolean;
  isGroupChat: boolean;  // NEW
  senderName?: string;   // NEW - resolved name or phone
  showSender: boolean;   // NEW - false if same as previous message
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutbound,
  isGroupChat,
  senderName,
  showSender
}) => {
  return (
    <div className={`message-bubble ${isOutbound ? 'outbound' : 'inbound'}`}>
      {/* Show sender only for inbound group messages when sender changed */}
      {isGroupChat && !isOutbound && showSender && senderName && (
        <div className="sender-name text-xs text-gray-500 mb-1">
          {senderName}
        </div>
      )}
      <div className="bubble-content">
        {message.body}
      </div>
    </div>
  );
};
```

### Sender Resolution Logic

Messages have a `participants` JSON field:
```json
{
  "from": "+15551234567",
  "to": ["+15559876543", "+15551111111"]
}
```

Resolution order:
1. Look up contact by phone number from `participants.from`
2. If contact found, use contact name
3. If not found, display phone number

### Consecutive Message Grouping

```typescript
function shouldShowSender(
  currentMessage: Message,
  previousMessage: Message | null
): boolean {
  if (!previousMessage) return true;

  const currentSender = JSON.parse(currentMessage.participants)?.from;
  const previousSender = JSON.parse(previousMessage.participants)?.from;

  return currentSender !== previousSender;
}
```

### Thread Header Logic (ConversationViewModal.tsx)

```tsx
function getThreadTitle(thread: MessageThread): string {
  // If group chat has a name, use it
  if (thread.groupName) {
    return thread.groupName;
  }

  // Otherwise, show participant list
  if (thread.isGroupChat && thread.participants.length > 0) {
    return thread.participants
      .map(p => resolveContactName(p) || p)
      .join(', ');
  }

  // 1:1 chat - show contact name
  return thread.contactName || thread.contactIdentifier;
}
```

### Data Available

Check how threads are structured. Messages have:
- `participants` JSON with `from` and `to` fields
- `is_from_me` boolean to determine outbound

Threads may have:
- `group_name` or similar field
- List of participant identifiers

## Integration Notes

- Imports from: Contacts service for name resolution
- Exports to: ConversationViewModal uses MessageBubble
- Used by: Message viewing in transaction details
- Depends on: None (can run in parallel with TASK-1013, TASK-1015)

## Do / Don't

### Do:
- Parse participants JSON safely (handle malformed data)
- Cache contact lookups to avoid repeated queries
- Test with both group and 1:1 conversations
- Handle missing/null sender gracefully

### Don't:
- Add colors or avatars (future enhancement)
- Modify the message data model
- Break existing 1:1 conversation display
- Make database schema changes

## When to Stop and Ask

- If MessageBubble component doesn't exist or is structured very differently
- If participants field uses a different format than expected
- If group chat detection isn't straightforward
- If contact lookup service is unclear

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Sender name resolution logic
  - Consecutive message grouping
  - Thread title generation (group vs 1:1)
- Existing tests to update:
  - MessageBubble component tests (new props)

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Group chat displays sender names correctly
  - 1:1 chat unchanged (no sender labels)
  - Contact names resolve from phone numbers

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(messages): show sender name on group chat messages`
- **Labels**: `enhancement`, `ui`, `messages`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-3 files | +8K |
| UI complexity | Conditional rendering, name resolution | +8K |
| Logic complexity | Consecutive grouping, contact lookup | +5K |
| Test updates | Medium | +4K |

**Confidence:** Medium

**Risk factors:**
- Contact lookup service may be complex to integrate
- Thread structure may differ from expectations

**Similar past tasks:** TASK-992 (message bubble direction, simpler scope)

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
- [ ] MessageBubble.tsx
- [ ] ConversationViewModal.tsx
- [ ] ThreadListItem.tsx (if exists)

Features implemented:
- [ ] Sender name on inbound group messages
- [ ] Consecutive message grouping
- [ ] Thread header with group name/participants

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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

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
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
