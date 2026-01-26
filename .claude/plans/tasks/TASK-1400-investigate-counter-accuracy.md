# Task TASK-1400: Investigate Communication Counter Accuracy

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent investigates, documents findings, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Investigate why text and email thread counters on TransactionCard show incorrect counts. Document root causes and propose fixes for BACKLOG-510.

## Non-Goals

- Do NOT implement fixes in this task (that's Phase 2)
- Do NOT modify any production code
- Do NOT change the database schema
- Do NOT re-enable the hidden counters yet

## Deliverables

1. Update: `.claude/plans/tasks/TASK-1400-investigate-counter-accuracy.md` (this file - Investigation Findings section)
2. New file: `.claude/plans/investigations/BACKLOG-510-counter-accuracy-findings.md`

## Acceptance Criteria

- [ ] Email count calculation analyzed and issues documented
- [ ] Text thread count calculation analyzed and issues documented
- [ ] Root causes clearly identified
- [ ] Proposed fixes documented with specific file/line changes
- [ ] No production code modified (investigation only)
- [ ] Findings PR created and merged

## Investigation Notes

### Key Questions to Answer

1. **Email Count Issue**: The query in `transactionDbService.ts` uses:
   ```sql
   COALESCE(m.channel, c.communication_type) = 'email'
   ```
   But `c.communication_type` was removed in BACKLOG-506. Is this causing the issue?

2. **Email Architecture**: With the new architecture:
   - Emails should be in `emails` table
   - `communications.email_id` should reference them
   - How should email count be calculated?

3. **Text Thread Count**: The stored `text_thread_count` is updated by `updateTransactionThreadCount()`.
   - Is the calculation in `countTextThreadsForTransaction()` correct?
   - Does it handle all edge cases (thread_id null, different channels)?

4. **Frontend vs Backend**: Are the counts different between:
   - TransactionCard (uses stored `text_thread_count` and computed `email_count`)
   - TransactionDetails (uses grouped threads)

### Files to Investigate

| File | Focus |
|------|-------|
| `electron/services/db/transactionDbService.ts` | Lines 119-125, 177-182: email_count subquery |
| `electron/services/db/communicationDbService.ts` | Lines 837-870: `countTextThreadsForTransaction()` |
| `electron/database/schema.sql` | Verify `communications` has no `communication_type` column |
| `src/components/transaction/components/TransactionCard.tsx` | Lines 117-120: How counts are used |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Compare with card count logic |

### Investigation Commands

```bash
# Check if communication_type column still exists (should NOT)
grep -n "communication_type" electron/database/schema.sql

# Check all uses of communication_type in queries
grep -rn "communication_type" --include="*.ts" electron/

# Check how email_count is calculated
grep -rn "email_count" --include="*.ts" electron/

# Check text_thread_count updates
grep -rn "text_thread_count\|updateTransactionThreadCount" --include="*.ts" electron/
```

## Integration Notes

- **Blocks**: TASK-1403 (Fix email count), TASK-1404 (Fix text count)
- **Related**: BACKLOG-506 database architecture cleanup
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Document exact line numbers and code snippets
- Test queries manually against a real database
- Compare frontend and backend counting logic
- Document any architecture misunderstandings found

### Don't:

- Modify any production code
- Create database migrations
- Fix bugs (save for Phase 2)
- Spend more than ~15K tokens on investigation

## When to Stop and Ask

- If the issue requires schema changes (not expected based on audit)
- If multiple conflicting root causes are found
- If investigation reveals issues outside BACKLOG-510 scope

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (investigation only)

### Coverage

- Coverage impact: None (no code changes)

### Integration / Feature Tests

- Required scenarios: None (investigation only)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no code changes expected)
- [ ] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `investigation`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to read | 5-6 files | +8K |
| Query analysis | SQL query debugging | +4K |
| Documentation | Findings document | +3K |

**Confidence:** Medium

**Risk factors:**
- Issue may have multiple root causes
- May need to trace through multiple service layers

---

## Investigation Findings (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Investigation Date: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Email Count Analysis

**Current Implementation:**
```sql
-- Paste the actual query from transactionDbService.ts
```

**Issue Found:**
<Document the specific issue>

**Root Cause:**
<Explain why this happens>

**Proposed Fix:**
<Specific code changes needed>

---

### Text Thread Count Analysis

**Current Implementation:**
```sql
-- Paste the actual query from communicationDbService.ts
```

**Issue Found:**
<Document the specific issue, or "No issue found">

**Root Cause:**
<Explain why this happens, or "N/A">

**Proposed Fix:**
<Specific code changes needed, or "None required">

---

### Architecture Findings

**New Architecture Summary:**
- [ ] Emails stored in `emails` table
- [ ] Texts stored in `messages` table
- [ ] `communications` is pure junction (no content columns)

**Query Compatibility:**
<Document which queries are compatible with new architecture>

---

### Recommended Phase 2 Tasks

Based on investigation, recommend specific implementation tasks:

1. **TASK-1403**: <specific scope>
2. **TASK-1404**: <specific scope, or "Not needed">

---

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Investigation Quality:** PASS / NEEDS MORE
**Root Causes Identified:** Yes / No / Partial

**Review Notes:**
<Key observations, concerns, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes
