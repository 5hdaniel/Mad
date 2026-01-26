# Task TASK-1404: Fix Text Thread Count Calculation

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Verify and fix (if needed) the text thread count calculation in `communicationDbService.ts` to correctly count distinct text threads linked to a transaction.

## Non-Goals

- Do NOT modify the email count calculation (that's TASK-1403)
- Do NOT re-enable UI counters yet (that's TASK-1407)
- Do NOT modify the messages table structure
- Do NOT modify frontend thread grouping logic

## Deliverables

1. Review/Update: `electron/services/db/communicationDbService.ts` - `countTextThreadsForTransaction()`
2. Review/Update: `electron/services/db/transactionDbService.ts` - `updateTransactionThreadCount()`
3. Update/Create: Tests for text thread count calculation

## Acceptance Criteria

- [ ] `countTextThreadsForTransaction()` correctly counts unique text threads
- [ ] Count matches what's displayed in TransactionMessagesTab grouping
- [ ] Handles edge cases: NULL thread_id, same participants different threads
- [ ] `updateTransactionThreadCount()` stores correct value
- [ ] Unit tests verify thread count calculation
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Current Implementation to Verify

In `communicationDbService.ts` (lines 837-870):
```sql
-- countTextThreadsForTransaction uses something like:
SELECT COUNT(DISTINCT COALESCE(m.thread_id, m.id)) ...
```

### Questions from Investigation (TASK-1400)

Based on investigation findings, verify:
1. Does the COALESCE fallback cause duplicate counting?
2. Does the query match frontend grouping logic?
3. Are messages without thread_id handled correctly?

### Expected Pattern

Count should match unique thread_ids from messages linked via communications:
```sql
SELECT COUNT(DISTINCT
  CASE
    WHEN m.thread_id IS NOT NULL THEN m.thread_id
    ELSE m.id  -- Fallback to message id for ungrouped messages
  END
)
FROM communications c
JOIN messages m ON c.message_id = m.id
WHERE c.transaction_id = ?
  AND m.channel IN ('text', 'imessage')
```

### Verification Steps

1. Link several text threads to a transaction
2. Check stored `text_thread_count` vs manual count
3. Compare with frontend `TransactionMessagesTab` grouping

## Integration Notes

- **Depends on**: TASK-1400 (investigation findings)
- **Blocks**: TASK-1407 (re-enable UI counters)
- **Related files**:
  - `electron/services/db/transactionDbService.ts` (stores count)
  - `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` (displays groups)
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Use investigation findings from TASK-1400 to guide implementation
- Ensure backend count matches frontend display logic
- Handle NULL thread_id consistently
- Test with various thread configurations

### Don't:

- Change database schema
- Modify email count logic
- Touch frontend components in this task
- Modify message import logic (that's TASK-1406)

## When to Stop and Ask

- If investigation findings show no fix is needed (update task status only)
- If the counting logic requires frontend changes to match
- If NULL handling requires schema migration
- If performance issues are discovered

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `countTextThreadsForTransaction()` returns correct count
  - Count is 0 when no text messages linked
  - Count handles NULL thread_id correctly
  - Count matches number of displayed thread groups
- Existing tests to update:
  - Any tests that assume specific count logic

### Coverage

- Coverage impact: Must not decrease
- Focus: `communicationDbService.ts` thread counting logic

### Integration / Feature Tests

- Required scenarios:
  - Transaction with linked text threads shows correct count
  - Transaction with no linked texts shows 0

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(db): verify/fix text thread count calculation`
- **Labels**: `bug`, `database`
- **Depends on**: TASK-1400 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +8K |
| Query analysis | May be no changes needed | +4K |
| Test updates | 2-3 test cases | +3K |

**Confidence:** Medium

**Risk factors:**
- May not require changes (verify only)
- Frontend/backend mismatch may exist

**Note**: This task may result in "no changes needed" if investigation shows counting is correct.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-01-26*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: (running as direct engineer agent - no subagent ID)
```

### Checklist

```
Files modified:
- [x] electron/services/db/communicationDbService.ts (if needed) - NO CHANGES NEEDED
- [x] electron/services/db/transactionDbService.ts (if needed) - NO CHANGES NEEDED
- [x] electron/services/db/__tests__/communicationDbService.test.ts (NEW)

Features implemented:
- [x] Thread count logic verified
- [x] Fixes applied (if needed) - NOT NEEDED
- [x] Tests added/updated

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (on new files - pre-existing lint issue in NotificationContext.tsx)
- [x] npm test passes (17/17 new tests pass - pre-existing failures in databaseService.test.ts unrelated)
```

### Investigation Result

- [x] **No changes needed** - existing logic is correct
- [ ] **Changes made** - see details below

The existing `countTextThreadsForTransaction()` implementation correctly:
1. Queries messages linked via communications table
2. Groups by thread_id when available
3. Falls back to participant-based grouping when thread_id is NULL
4. Uses message ID as ultimate fallback for ungrouped messages
5. Normalizes phone numbers for consistent participant matching

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | TBD (auto-captured) |
| Duration | TBD |
| API Calls | TBD |

**Variance:** PM Est ~13.5K vs Actual ~TBD (TBD% over/under)

### Notes

**Planning notes:**
SR Engineer review confirmed this is a TEST-ONLY task based on Phase 1 investigation (TASK-1400) findings that the existing logic is correct.

**Deviations from plan:**
None

**Design decisions:**
- Created comprehensive test suite with 17 test cases covering:
  - Basic counting (0, 1, multiple threads)
  - NULL thread_id handling (fallback to message ID)
  - Participant-based grouping when thread_id is NULL
  - Phone number normalization
  - Mixed scenarios with real threads, participant groups, and standalone messages
  - SQL query structure verification
  - updateTransactionThreadCount integration

**Issues encountered:**
- Initially landed on wrong branch (fix/task-1403) due to parallel task execution. Resolved by switching to correct branch and discarding unrelated changes.
- Pre-existing lint error in NotificationContext.tsx (unrelated to this task)
- Pre-existing test failures in databaseService.test.ts migration code (unrelated to this task)

**Reviewer notes:**
- Tests verify expected behavior matches frontend `MessageThreadCard.tsx` grouping logic
- Test file follows same mock patterns as `llmSettingsDbService.test.ts`
- All 17 tests pass independently

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
