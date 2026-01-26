# Task TASK-1403: Fix Email Count Query for New Architecture

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

Fix the email count calculation in `transactionDbService.ts` to work correctly with the new three-table architecture (emails, messages, communications as junction).

## Non-Goals

- Do NOT modify the database schema
- Do NOT change how text thread counts are calculated (that's TASK-1404)
- Do NOT re-enable UI counters yet (that's TASK-1407)
- Do NOT modify frontend components

## Deliverables

1. Update: `electron/services/db/transactionDbService.ts` - Fix email count subquery
2. Update/Create: Tests for email count calculation

## Acceptance Criteria

- [ ] Email count query no longer references `c.communication_type` (removed column)
- [ ] Email count correctly counts distinct emails linked to transaction via `communications.email_id`
- [ ] Query handles NULL `email_id` values gracefully
- [ ] Unit tests verify email count calculation
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Current (Broken) Implementation

The current query in `transactionDbService.ts` (around lines 119-125) uses:
```sql
COALESCE(m.channel, c.communication_type) = 'email'
```

But `c.communication_type` was removed in BACKLOG-506 (schema v23).

### New Architecture

```
emails table
  |- id (PK)
  |- subject, body_plain, sender, etc.

communications table (junction)
  |- transaction_id FK -> transactions
  |- email_id FK -> emails (nullable)
  |- message_id FK -> messages (nullable)
  |- (no communication_type column)

messages table
  |- id (PK)
  |- body_text, participants, channel, etc.
```

### Expected Fix Pattern

Replace the email count subquery with:
```sql
(SELECT COUNT(DISTINCT c.email_id)
 FROM communications c
 WHERE c.transaction_id = t.id
 AND c.email_id IS NOT NULL) as email_count
```

Or if joining to verify email exists:
```sql
(SELECT COUNT(DISTINCT e.id)
 FROM communications c
 JOIN emails e ON c.email_id = e.id
 WHERE c.transaction_id = t.id) as email_count
```

### Verification Query

After implementing, verify with:
```sql
-- Should return correct email counts
SELECT t.id, t.address,
  (SELECT COUNT(DISTINCT c.email_id) FROM communications c WHERE c.transaction_id = t.id AND c.email_id IS NOT NULL) as email_count
FROM transactions t
WHERE t.status = 'active'
LIMIT 10;
```

## Integration Notes

- **Depends on**: TASK-1400 (investigation findings)
- **Blocks**: TASK-1407 (re-enable UI counters)
- **Related files**:
  - `electron/services/db/communicationDbService.ts` (may have similar issues)
  - `src/components/transaction/components/TransactionCard.tsx` (consumer)
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Use investigation findings from TASK-1400 to guide implementation
- Preserve existing query structure where possible
- Add appropriate indexes if needed for performance
- Test with transactions that have 0, 1, and many emails

### Don't:

- Change database schema
- Modify how `text_thread_count` is calculated
- Touch frontend components
- Make changes outside the email count calculation

## When to Stop and Ask

- If investigation findings suggest a different approach
- If the fix requires schema changes
- If other queries also use the deprecated `communication_type` column
- If performance degrades significantly

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `transactionDbService.getTransactions()` returns correct email_count
  - Email count is 0 when no emails linked
  - Email count is correct when multiple emails linked
  - Email count handles NULL email_id correctly
- Existing tests to update:
  - Any tests that mock `communication_type` column

### Coverage

- Coverage impact: Must not decrease
- Focus: `transactionDbService.ts` email count logic

### Integration / Feature Tests

- Required scenarios:
  - Transaction with linked emails shows correct count
  - Transaction with no linked communications shows 0

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(db): update email count query for new architecture`
- **Labels**: `bug`, `database`
- **Depends on**: TASK-1400 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +10K |
| Query complexity | SQL subquery update | +5K |
| Test updates | 3-4 test cases | +5K |

**Confidence:** Medium-High

**Risk factors:**
- Query may be used in multiple places
- Performance impact unclear

**Similar past tasks:** BACKLOG-506 email table migration

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
- [ ] electron/services/db/transactionDbService.ts
- [ ] (tests)

Features implemented:
- [ ] Email count query updated
- [ ] NULL handling verified
- [ ] Tests added/updated

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~17.5K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~17.5K | ~XK | +/-X% |
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
