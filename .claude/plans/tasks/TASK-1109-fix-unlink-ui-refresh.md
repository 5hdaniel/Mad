# Task TASK-1109: Fix Unlink Communications UI Refresh

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

Fix the unlink communications UI to immediately update when a user unlinks a message thread from a transaction, without requiring a page refresh.

## Non-Goals

- Do NOT refactor the entire unlink flow
- Do NOT change the unlink API endpoint
- Do NOT modify the UnlinkMessageModal component styling
- Do NOT add new features to the unlink functionality

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`
2. Possibly update: Parent component that passes `onMessagesChanged` callback

## Acceptance Criteria

- [ ] Unlinking a communication immediately removes it from the UI
- [ ] No page refresh required after unlink
- [ ] Works for both individual messages and entire threads
- [ ] Toast notification still displays on successful unlink
- [ ] Error handling still displays errors correctly
- [ ] All existing tests pass
- [ ] All CI checks pass

## Implementation Notes

### Root Cause Analysis

Looking at `TransactionMessagesTab.tsx`, the `handleUnlinkConfirm` function:

```typescript
const handleUnlinkConfirm = useCallback(async () => {
  // ... unlink logic ...
  if (result.success) {
    onShowSuccess?.("Messages removed from transaction");
    onMessagesChanged?.();  // <-- This callback may not be triggering refetch
    setUnlinkTarget(null);
  }
}, [unlinkTarget, messages, onMessagesChanged, onShowSuccess, onShowError]);
```

The issue is likely one of:
1. `onMessagesChanged` callback doesn't trigger a refetch of messages
2. Parent component state not being invalidated
3. Local messages array not being updated

### Likely Fix

The fix should ensure the parent component's message data is refetched or the local state is updated after unlink. Options:

**Option A: Ensure callback triggers refetch**
- Trace `onMessagesChanged` to parent and verify it triggers data refetch

**Option B: Optimistic UI update**
- Remove the unlinked thread from local state immediately:
```typescript
if (result.success) {
  // Optimistically remove unlinked messages from local state
  const unlinkedIds = new Set(messageIds);
  // Filter out unlinked messages from the UI
  onShowSuccess?.("Messages removed from transaction");
  onMessagesChanged?.();
  setUnlinkTarget(null);
}
```

### Files to Investigate

1. `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` - Unlink handler
2. Parent component that provides `onMessagesChanged` prop
3. Check where `messages` prop comes from and how it's refreshed

### Key Patterns

The component receives `messages` as a prop and `onMessagesChanged` as a callback:

```typescript
interface TransactionMessagesTabProps {
  messages: Communication[];
  onMessagesChanged?: () => void;  // Should trigger refetch
  // ...
}
```

After unlink succeeds, `onMessagesChanged?.()` is called, but the parent must actually refetch data.

## Integration Notes

- Imports from: Parent component (TransactionDetails or similar)
- Exports to: None
- Used by: Transaction details view
- Depends on: None

## Do / Don't

### Do:

- Trace the callback chain to find where refetch should happen
- Ensure optimistic UI update if refetch is slow
- Test with both single message and full thread unlinks
- Verify state updates correctly in React DevTools

### Don't:

- Don't add artificial delays or timeouts as a "fix"
- Don't create new API endpoints
- Don't modify the unlink confirmation modal
- Don't change the backend unlink logic

## When to Stop and Ask

- If you find the parent component callback chain is broken in multiple places
- If the fix requires changes to more than 2-3 files
- If you discover the issue is in the backend API response
- If the fix requires changes to the database layer

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that calling `onMessagesChanged` after unlink updates parent state
  - Test that unlinked thread is removed from UI immediately
- Existing tests to update:
  - Update any mocks for `onMessagesChanged` to verify it's called

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Unlink single thread, verify UI updates
  - Unlink thread with multiple messages, verify all removed
  - Unlink when other threads exist, verify only target removed

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): refresh UI immediately after unlink`
- **Labels**: `bug`, `ui`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20-30K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +10K |
| Investigation | Trace callback chain | +8K |
| Testing | Unit tests for state update | +7K |
| Complexity | Low - state management fix | - |

**Confidence:** High

**Risk factors:**
- Parent component callback chain may be deeper than expected
- May need to trace through multiple HOCs or context providers

**Similar past tasks:** UI state refresh fixes are typically straightforward

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
- [ ] <file 1>
- [ ] <file 2>

Features implemented:
- [ ] UI updates immediately after unlink
- [ ] No page refresh required

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
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
