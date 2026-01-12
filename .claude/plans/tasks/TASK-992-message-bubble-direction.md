# Task TASK-992: Message Bubble Direction Fix

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

Fix the message bubble display direction so outgoing messages appear on the RIGHT side and incoming messages appear on the LEFT side, creating a phone-style conversation view. Currently, all messages display on the left side regardless of direction.

## Non-Goals

- Do NOT redesign the bubble styling (colors, shapes are fine)
- Do NOT modify the AttachMessagesModal bubble viewer (it already works correctly)
- Do NOT add new message metadata or fields
- Do NOT change the thread grouping logic
- Do NOT modify how messages are loaded

## Problem Analysis

Looking at `MessageBubble.tsx`:

```typescript
export function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  const isOutbound = message.direction === "outbound";
  // ...
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
```

The component is **correctly implemented** - it checks `direction` and applies `justify-end` for outbound. However, there are two possible issues:

1. **The `direction` field is not populated** - Messages may be missing the `direction` attribute
2. **The field name differs** - The field might be called something other than `direction` in the data

Note: The message viewer in `AttachMessagesModal.tsx` lines 666-696 works correctly because it explicitly checks `msg.direction === "outbound"`.

## Deliverables

1. Investigate: Check what `direction` value messages actually have
2. Fix: `src/components/transactionDetailsModule/components/MessageBubble.tsx` OR
3. Fix: `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` (if data issue)
4. Update: `src/components/transactionDetailsModule/components/__tests__/MessageBubble.test.tsx`

## Acceptance Criteria

- [ ] Outgoing (sent by user) messages display on the RIGHT side with blue background
- [ ] Incoming (received by user) messages display on the LEFT side with gray background
- [ ] Direction works correctly in Transaction Details Messages tab
- [ ] MessageBubble tests pass with direction scenarios
- [ ] All CI checks pass

## Implementation Notes

### Step 1: Investigate the Data

First, check what the `direction` field actually contains:

```typescript
// Add temporary logging in useTransactionMessages.ts
console.log('Message data:', textMessages.map(m => ({
  id: m.id,
  direction: m.direction,
  body_text: m.body_text?.substring(0, 30)
})));
```

Also check the Communication type definition:

```typescript
// src/components/transactionDetailsModule/types.ts
interface Communication {
  direction?: string;  // Check if this exists and its values
  // ...
}
```

### Step 2: Possible Fixes

**If direction is missing or null:**

Check how messages are stored in the database. The `messages` table should have a `direction` column. The issue might be in the data transformation when loading:

```typescript
// In getCommunicationsByTransaction or the hook
// Ensure direction is preserved from the original data
```

**If direction uses different values:**

```typescript
// MessageBubble.tsx - check for variations
const isOutbound =
  message.direction === "outbound" ||
  message.direction === "out" ||
  message.direction === "sent";
```

**If the field is named differently:**

```typescript
// MessageBubble.tsx - check alternate field names
const isOutbound =
  message.direction === "outbound" ||
  message.is_from_me === true ||  // Common in iOS messages
  message.is_outgoing === true;
```

### Step 3: Reference Working Implementation

The AttachMessagesModal viewer works correctly (lines 666-696). Compare its data source:

```typescript
// AttachMessagesModal uses getMessagesByContact which returns from messages table
// MessageBubble uses data from getCommunicationsByTransaction

// Check if the data structure differs between these sources
```

### iOS Messages Direction

For macOS Messages import, the `is_from_me` field in the Apple Messages database indicates direction:
- `is_from_me = 1` -> outbound
- `is_from_me = 0` -> inbound

This should be converted to `direction: 'outbound'` or `direction: 'inbound'` during import.

## Integration Notes

- Imports from: `Communication` type from `../types`
- Used by: `TransactionMessagesTab` which displays threads
- Parallel with: TASK-990 (can run simultaneously, different files)

## Do / Don't

### Do:

- Check actual message data before making changes
- Test with both SMS and iMessage channels
- Verify the fix works for both auto-linked and manually-attached messages
- Keep the existing bubble styling

### Don't:

- Change bubble colors or shapes
- Modify how messages are grouped into threads
- Add complex fallback logic without understanding root cause
- Assume the component is wrong (it looks correct)

## When to Stop and Ask

- If the `direction` field is never set in the database
- If the macOS Messages import isn't populating direction correctly
- If the fix requires changing the import service
- If there's a type mismatch between `messages` and `communications` tables

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- Tests to verify/add:
  - MessageBubble with `direction: 'outbound'` displays on right
  - MessageBubble with `direction: 'inbound'` displays on left
  - MessageBubble with undefined direction displays on left (safe default)

- Existing tests to update:
  - `MessageBubble.test.tsx` - verify direction test coverage

### Coverage

- Coverage impact:
  - Should not decrease coverage
  - Direction logic must have explicit tests

### Integration / Feature Tests

- Required scenarios:
  1. Open Transaction Details -> Messages tab -> verify bubble alignment
  2. Outgoing messages (sent by user) appear on right with blue
  3. Incoming messages (received) appear on left with gray

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): correct message bubble direction display`
- **Labels**: `fix`, `ui`
- **Base Branch**: `feature/contact-first-attach-messages`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 50K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +5K |
| Investigation | Check data structure | +3K |
| Test updates | Simple test additions | +2K |

**Confidence:** High

**Risk factors:**
- Root cause might be data layer not component (adds investigation)
- If import service needs changes, scope increases significantly

**Similar past tasks:** Simple UI fixes in SPRINT-009

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
Investigation:
- [ ] Checked message.direction values in actual data
- [ ] Identified root cause

Files modified:
- [ ] MessageBubble.tsx (if component issue)
- [ ] useTransactionMessages.ts (if data issue)
- [ ] Tests updated

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

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Root cause found:**
<What was actually causing the issue>

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
| **Tokens** | ~10K | ~XK | +/-X% |
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
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** feature/contact-first-attach-messages
