# Task TASK-991: Manual Thread Management (Complete AttachMessagesModal)

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

Complete and verify the manual thread attachment/removal functionality in the Messages tab. The AttachMessagesModal exists and was significantly enhanced in PR #353, but needs end-to-end verification and any remaining bug fixes.

## Non-Goals

- Do NOT redesign the AttachMessagesModal UI (already done in PR #353)
- Do NOT modify the contact-first interface (already working)
- Do NOT change the thread grouping logic (already fixed)
- Do NOT modify auto-linking behavior
- Do NOT add batch operations (single thread attach/remove only)

## Current State

From PR #353 and recent commits:
- AttachMessagesModal has contact-first interface (working)
- Thread grouping fixed to group by participant set
- `linkMessages` and `unlinkMessages` IPC handlers exist
- 21 tests passing for AttachMessagesModal

## What Needs Verification/Fixing

1. **Link flow**: Select contact -> select threads -> attach -> verify messages appear in tab
2. **Unlink flow**: Click unlink on thread card -> confirm -> verify thread removed
3. **Message count updates**: Transaction's `message_count` should update correctly
4. **Refresh behavior**: Messages tab should refresh after attach/unlink

## Deliverables

1. Verify/Fix: `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`
   - Unlink button functionality
   - Refresh after unlink

2. Verify/Fix: `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx`
   - Link functionality end-to-end
   - Error handling

3. Verify/Fix: `electron/transaction-handlers.ts`
   - `transactions:linkMessages` handler
   - `transactions:unlinkMessages` handler

4. Update: Test coverage for link/unlink flows

## Acceptance Criteria

- [ ] Can attach message threads from AttachMessagesModal to transaction
- [ ] Attached messages appear immediately in Messages tab
- [ ] Can unlink message threads from Messages tab
- [ ] Unlinked messages removed from Messages tab immediately
- [ ] Transaction message_count updates correctly on attach/unlink
- [ ] Error states display properly when link/unlink fails
- [ ] All 21+ AttachMessagesModal tests pass
- [ ] All CI checks pass

## Implementation Notes

### Link Flow (Already Implemented - Verify)

```typescript
// In AttachMessagesModal.tsx
const handleAttach = async () => {
  const messageIds: string[] = [];
  for (const threadId of selectedThreadIds) {
    const messages = threads.get(threadId);
    if (messages) {
      messageIds.push(...messages.map((m) => m.id));
    }
  }

  const result = await (window.api.transactions as any).linkMessages(
    messageIds,
    transactionId
  );

  if (result.success) {
    onAttached();  // Triggers refresh in parent
    onClose();
  }
};
```

### Unlink Flow (Verify Implementation)

```typescript
// In TransactionMessagesTab.tsx
const handleUnlinkConfirm = useCallback(async () => {
  const messageIds = threadMessages.map((m) => m.id);
  const result = await (window.api.transactions as any).unlinkMessages(messageIds);

  if (result.success) {
    onShowSuccess?.("Messages removed from transaction");
    onMessagesChanged?.();  // Triggers refresh
  }
}, [/* deps */]);
```

### Key IPC Handlers to Verify

```typescript
// electron/transaction-handlers.ts
ipcMain.handle('transactions:linkMessages', async (_event, messageIds, transactionId) => {
  await transactionService.linkMessages(messageIds, transactionId);
});

ipcMain.handle('transactions:unlinkMessages', async (_event, messageIds) => {
  await transactionService.unlinkMessages(messageIds);
});
```

### Key Service Methods

```typescript
// electron/services/transactionService.ts
async linkMessages(messageIds: string[], transactionId: string) {
  // Updates messages.transaction_id
  // Updates transaction.message_count
}

async unlinkMessages(messageIds: string[]) {
  // Sets messages.transaction_id = null
  // Updates transaction.message_count
}
```

## Integration Notes

- Imports from: `window.api.transactions.linkMessages`, `window.api.transactions.unlinkMessages`
- Used by: `TransactionMessagesTab`, `AttachMessagesModal`
- Depends on: TASK-990 (auto-linked messages should already display)
- Works with: TASK-992 (bubble direction is separate)

## Do / Don't

### Do:

- Test the complete flow: modal open -> select -> attach -> verify display
- Test error handling (network failure, invalid IDs)
- Verify message_count updates correctly
- Ensure refresh happens after operations

### Don't:

- Rewrite the AttachMessagesModal (it's already working)
- Change the contact-first interface
- Modify the thread grouping logic
- Add new features beyond verification/bug fixes

## When to Stop and Ask

- If `linkMessages` or `unlinkMessages` IPC handlers are missing
- If the service methods don't exist in transactionService
- If message_count updates require schema changes
- If the refresh mechanism doesn't work and needs significant refactoring

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- Tests to verify/add:
  - Attach flow: select threads -> attach -> success callback
  - Unlink flow: unlink button -> confirm -> messages removed
  - Error handling: network failure shows error message

- Existing tests to verify:
  - `AttachMessagesModal.test.tsx` - 21 tests passing

### Coverage

- Coverage impact:
  - Must not decrease current coverage
  - Any new error handling should have tests

### Integration / Feature Tests

- Required scenarios:
  1. Open modal -> select contact -> select 2 threads -> attach -> verify in tab
  2. In Messages tab -> click unlink on thread -> confirm -> verify removed
  3. Attach fails -> error message shown -> can retry
  4. Unlink fails -> error message shown -> can retry

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(messages): complete manual thread attach/unlink functionality`
- **Labels**: `enhancement`, `messages`
- **Base Branch**: `feature/contact-first-attach-messages`
- **Depends on**: TASK-990 (for stable message display)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to verify/modify | 3-4 files | +15K |
| Bug fixes | 1-2 minor issues expected | +5K |
| Test updates | Verify existing, add edge cases | +10K |
| Investigation | Check IPC/service layer | +5K |

**Confidence:** Medium

**Risk factors:**
- May find additional bugs in attach/unlink flow
- Refresh mechanism may need adjustment

**Similar past tasks:** TASK-704 (attach/unlink messages original work)

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
Files verified/modified:
- [ ] TransactionMessagesTab.tsx
- [ ] AttachMessagesModal.tsx
- [ ] transaction-handlers.ts
- [ ] Tests updated

Features verified:
- [ ] Attach flow works end-to-end
- [ ] Unlink flow works end-to-end
- [ ] message_count updates correctly
- [ ] Error handling works

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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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
