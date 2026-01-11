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

## Quick Start

**Read this section first to understand what already exists.**

### Current State (As of 2026-01-10)

The codebase already has most of the infrastructure for this feature:

1. **MessageBubble.tsx** (lines 9-16) already has the props:
   ```tsx
   export interface MessageBubbleProps {
     message: Communication;
     senderName?: string;      // Already exists!
     showSender?: boolean;     // Already exists!
   }
   ```

2. **ConversationViewModal.tsx** (lines 196-332) already:
   - Detects group chats (`isGroupChat` on line 222)
   - Extracts sender phone (`getSenderPhone` on lines 45-65)
   - Resolves contact names (`contactNames` prop)
   - Tracks consecutive sender grouping (lines 321-331)

3. **What's Missing:**
   - Thread header shows contact name even for group chats
   - Header should show group chat name OR participant list
   - Visual polish for sender name display above bubble

---

## Goal

Display sender name (or phone number) on each inbound message in group chats so users can identify who sent which message. Also update thread header to show group chat name or participant list.

## Non-Goals

- Do NOT add sender avatars or colors (nice-to-have for future)
- Do NOT modify 1:1 conversation display
- Do NOT add participant management features
- Do NOT change message data model/schema

---

## Step-by-Step Implementation Guide

### Step 1: Review Existing Code (5 min)

Read these files to understand current implementation:

```bash
# MessageBubble - already has senderName/showSender props
cat src/components/transactionDetailsModule/components/MessageBubble.tsx

# ConversationViewModal - has group chat detection and sender resolution
cat src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx
```

**Key observations:**
- `MessageBubble` shows sender inside the bubble (line 61-75), not above it
- `ConversationViewModal` header always shows `contactName || phoneNumber`

### Step 2: Update Thread Header for Group Chats

**File:** `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx`

**Location:** Lines 282-292 (header section)

**Current code:**
```tsx
<h4 className="text-white font-semibold">
  {contactName || phoneNumber}
  {isGroupChat && (
    <span className="text-green-100 text-xs ml-2">(Group)</span>
  )}
</h4>
```

**Change to:**
```tsx
<h4 className="text-white font-semibold">
  {isGroupChat ? getGroupChatTitle() : (contactName || phoneNumber)}
</h4>
```

**Add helper function (around line 220):**
```tsx
// Get title for group chat header
const getGroupChatTitle = (): string => {
  // If we have a group name (from thread data), use it
  // Note: Check if thread has groupName property

  // Otherwise, show participant list
  const participants = Object.entries(contactNames)
    .map(([phone, name]) => name || phone)
    .filter(Boolean);

  if (participants.length > 0) {
    // Show up to 3 names, then "+X more"
    if (participants.length <= 3) {
      return participants.join(', ');
    }
    return `${participants.slice(0, 3).join(', ')} +${participants.length - 3} more`;
  }

  return `Group (${uniqueSenders.size} participants)`;
};
```

### Step 3: Verify Sender Name Display Position

**File:** `src/components/transactionDetailsModule/components/MessageBubble.tsx`

**Current implementation (lines 61-75):**
The sender name is currently displayed INSIDE the bubble, after the message text:

```tsx
{(timestampDisplay || senderDisplay) && (
  <p className={`text-xs mt-1 ...`}>
    {senderDisplay && (
      <span data-testid="message-sender" className="font-medium">
        {senderDisplay}
        {timestampDisplay && " • "}
      </span>
    )}
    {timestampDisplay}
  </p>
)}
```

**Option A: Keep as-is (recommended)**
The current design shows sender + timestamp together at bottom of bubble. This is a valid UX pattern (like Telegram).

**Option B: Move sender above bubble**
If the requirement is strictly "above the bubble", update the JSX:

```tsx
return (
  <div className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}>
    {/* Sender name ABOVE the bubble for inbound group messages */}
    {senderDisplay && (
      <span className="text-xs text-gray-500 mb-1 ml-4" data-testid="message-sender">
        {senderDisplay}
      </span>
    )}
    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ...`}>
      <p className="text-sm whitespace-pre-wrap break-words">{messageText}</p>
      {timestampDisplay && (
        <p className={`text-xs mt-1 ...`}>
          {timestampDisplay}
        </p>
      )}
    </div>
  </div>
);
```

**Decision:** Discuss with PM if current "inside bubble" design is acceptable.

### Step 4: Test Scenarios

Run manual tests to verify:

1. **Group chat with 3 participants:**
   - Header shows all 3 names (or participant list)
   - Each inbound message shows sender name
   - Consecutive messages from same sender don't repeat name

2. **Group chat with 5+ participants:**
   - Header shows "Name1, Name2, Name3 +2 more"
   - Sender resolution works for all

3. **1:1 conversation:**
   - Header shows contact name (unchanged)
   - No sender names on messages (1:1 is always same sender)

4. **Unknown sender (no contact):**
   - Shows phone number instead of name

### Step 5: Update Tests

**File to update:** `src/components/transactionDetailsModule/components/__tests__/MessageBubble.test.tsx`

**New test cases:**
```tsx
describe('MessageBubble sender display', () => {
  it('shows sender name for inbound messages when provided', () => {
    render(<MessageBubble message={inboundMessage} senderName="John Doe" showSender />);
    expect(screen.getByTestId('message-sender')).toHaveTextContent('John Doe');
  });

  it('hides sender name when showSender is false', () => {
    render(<MessageBubble message={inboundMessage} senderName="John Doe" showSender={false} />);
    expect(screen.queryByTestId('message-sender')).not.toBeInTheDocument();
  });

  it('does not show sender name for outbound messages', () => {
    render(<MessageBubble message={outboundMessage} senderName="John Doe" showSender />);
    expect(screen.queryByTestId('message-sender')).not.toBeInTheDocument();
  });
});
```

---

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Thread header logic
2. Verify: `src/components/transactionDetailsModule/components/MessageBubble.tsx` - Sender name display (may already work)
3. Tests: Update `MessageBubble.test.tsx` with sender scenarios

## Acceptance Criteria

- [ ] Inbound messages in group chats show sender name
- [ ] Consecutive messages from same sender don't repeat the name
- [ ] Contact name used when available, falls back to phone number
- [ ] Outbound messages (from user) don't show sender label
- [ ] Thread header shows group chat name if available
- [ ] Thread header shows comma-separated participants if no group name
- [ ] Works correctly for both group and 1:1 threads (1:1 unchanged)
- [ ] All CI checks pass

---

## Do / Don't

### Do:
- Parse participants JSON safely (handle malformed data)
- Test with both group and 1:1 conversations
- Handle missing/null sender gracefully
- Keep changes minimal - infrastructure already exists

### Don't:
- Add colors or avatars (future enhancement)
- Modify the message data model
- Break existing 1:1 conversation display
- Make database schema changes

## When to Stop and Ask

- If `contactNames` prop is not being passed correctly
- If group chat detection logic differs from expected
- If consecutive sender grouping breaks
- If the current "inside bubble" design needs to change to "above bubble"

---

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Sender name display in MessageBubble
  - Group chat header title generation
- Existing tests to update:
  - MessageBubble component tests (verify senderName handling)

### Coverage

- Coverage impact: Must not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
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

**Estimated Tokens:** ~15-20K (reduced - infrastructure exists)

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Infrastructure | Already exists (senderName, showSender props) | -10K |
| Header logic | Simple string manipulation | +5K |
| Visual position | May need adjustment | +5K |
| Test updates | Moderate | +5K |

**Confidence:** High (most code already exists)

**Risk factors:**
- Design decision on sender name position (inside vs above bubble)

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
- [ ] ConversationViewModal.tsx (header logic)
- [ ] MessageBubble.tsx (if position change needed)
- [ ] MessageBubble.test.tsx (new test cases)

Features implemented:
- [ ] Group chat header shows participants
- [ ] Sender name displays correctly
- [ ] Consecutive grouping works

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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
