# Task TASK-990: Auto-Linked Messages Display in Transaction Details

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

Fix the Transaction Details Messages tab to display messages that were automatically linked to a transaction via contact phone number matching. Currently, auto-linked messages are invisible even though the linking logic works correctly.

## Non-Goals

- Do NOT modify the auto-linking logic in `messageMatchingService.ts`
- Do NOT change the `communications` table schema
- Do NOT modify the AttachMessagesModal (that's TASK-991)
- Do NOT change message bubble styling (that's TASK-992)
- Do NOT add new UI for managing auto-linked vs manually-linked messages

## Problem Analysis

The issue is a data retrieval mismatch:

1. **Auto-linking flow** (`messageMatchingService.autoLinkTextsToTransaction`):
   - Creates entries in `communications` table with `message_id` reference
   - Updates `messages.transaction_id` directly
   - Works correctly

2. **Display flow** (`useTransactionMessages`):
   - Calls `transactions.getDetails(transactionId)`
   - Gets communications from `getCommunicationsByTransaction`
   - Filters for `channel === 'sms' || channel === 'imessage'`
   - **Problem**: Communications table may have entries but they use `communication_type`, not `channel`

3. **Root cause**: The hook filters on `channel` but the `communications` table stores `communication_type` (sms/imessage/email).

## Deliverables

1. Update: `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts`
   - Fix the channel/communication_type field mismatch
   - Alternatively: Query messages table directly for transaction_id matches

2. Update: `electron/services/transactionService.ts` (if needed)
   - Add method to get messages by transaction_id from messages table

3. Update: `src/components/transactionDetailsModule/hooks/__tests__/useTransactionMessages.test.ts`
   - Add test for auto-linked messages appearing

## Acceptance Criteria

- [ ] Messages auto-linked via `messageMatchingService` appear in Transaction Details Messages tab
- [ ] Messages manually attached via AttachMessagesModal still appear (no regression)
- [ ] Message count in tab header accurately reflects total linked messages
- [ ] Loading and error states work correctly
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Option A: Fix the filter in useTransactionMessages

The simplest fix is to check `communication_type` instead of (or in addition to) `channel`:

```typescript
// Current (broken for communications table data):
const textMessages = allCommunications.filter(
  (comm: Communication) =>
    comm.channel === "sms" || comm.channel === "imessage"
);

// Fixed (works with communications table):
const textMessages = allCommunications.filter(
  (comm: Communication) =>
    comm.channel === "sms" || comm.channel === "imessage" ||
    comm.communication_type === "sms" || comm.communication_type === "imessage"
);
```

### Option B: Query messages table directly

For a more robust solution, query the `messages` table directly:

```typescript
// In transactionService.ts
async getTextMessagesForTransaction(transactionId: string): Promise<Message[]> {
  const sql = `
    SELECT * FROM messages
    WHERE transaction_id = ?
      AND channel IN ('sms', 'imessage')
    ORDER BY sent_at DESC
  `;
  return dbAll<Message>(sql, [transactionId]);
}
```

Then update `useTransactionMessages` to call this method.

### Recommended: Option A (simpler, less risk)

Option A is recommended because:
- Minimal code change
- Works with existing architecture
- Communications table already has the data (created by `createCommunicationReference`)

### Key Files to Examine

```
src/components/transactionDetailsModule/hooks/useTransactionMessages.ts  # Hook to fix
electron/services/messageMatchingService.ts                              # Creates comms with communication_type
electron/services/db/communicationDbService.ts                           # getCommunicationsByTransaction
src/components/transactionDetailsModule/types.ts                         # Communication type definition
```

### Type Reference

Check `src/components/transactionDetailsModule/types.ts` for Communication interface:
```typescript
interface Communication {
  id: string;
  channel?: string;            // Sometimes used
  communication_type?: string; // Sometimes used
  // ... other fields
}
```

## Integration Notes

- Imports from: `window.api.transactions.getDetails`
- Exports to: `TransactionMessagesTab` via the hook return value
- Used by: `TransactionDetails.tsx`
- Depends on: None (can run in parallel with TASK-992)

## Do / Don't

### Do:

- Test with both auto-linked AND manually-attached messages
- Preserve existing behavior for manual attachments
- Check both `channel` and `communication_type` fields
- Log helpful debug info if messages are filtered out

### Don't:

- Remove the existing channel filter entirely (emails shouldn't appear)
- Modify the auto-linking logic in messageMatchingService
- Change the database schema
- Add new IPC handlers (existing ones should work)

## When to Stop and Ask

- If the `communication_type` field is not populated in the communications table
- If there are no entries in communications table for auto-linked messages
- If the data structure differs significantly from what's documented here
- If tests reveal messages table and communications table have conflicting data

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that messages with `communication_type: 'sms'` are returned
  - Test that messages with `communication_type: 'imessage'` are returned
  - Test that messages with `channel: 'sms'` still work (backward compat)

- Existing tests to update:
  - `useTransactionMessages.test.ts` may need mock data adjustment

### Coverage

- Coverage impact:
  - Must not decrease current coverage
  - New filter logic should have test coverage

### Integration / Feature Tests

- Required scenarios:
  1. Transaction with auto-linked messages -> Messages tab shows them
  2. Transaction with manually-attached messages -> Still works
  3. Transaction with both -> All messages appear

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): display auto-linked messages in Transaction Details`
- **Labels**: `fix`, `messages`
- **Base Branch**: `feature/contact-first-attach-messages`

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-3 files | +10K |
| Code volume | ~50 lines changed | +5K |
| Test updates | Low-medium complexity | +5K |
| Debugging | Some investigation needed | +5K |

**Confidence:** Medium

**Risk factors:**
- May need to examine database contents to verify data structure
- Communication/Message type differences may require normalization

**Similar past tasks:** TASK-704 (text messages feature, higher complexity)

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
- [ ] src/components/transactionDetailsModule/hooks/useTransactionMessages.ts
- [ ] Tests updated

Features implemented:
- [ ] Auto-linked messages appear in Messages tab
- [ ] Backward compatibility with existing messages

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
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** feature/contact-first-attach-messages
