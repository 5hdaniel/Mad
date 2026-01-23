# Task TASK-1168: Restore "Closed" Filter Tab

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

Restore the "Closed" filter tab that was removed from the transaction list. Users need to see historical/archived transactions.

## Non-Goals

- Do NOT modify the transaction status logic
- Do NOT change how transactions are stored
- Do NOT modify the database schema

## Deliverables

1. Add "Closed" tab back to the transaction filter UI
2. Ensure clicking the tab shows closed/archived transactions
3. Display correct count badge on the tab

## Acceptance Criteria

- [ ] "Closed" tab is visible in the transaction filter bar
- [ ] Clicking "Closed" filters to show closed/archived transactions
- [ ] Count badge shows correct number of closed transactions
- [ ] Existing filter tabs (All, Pending, etc.) continue to work
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Where to Look

1. **Filter Component**: Check `src/components/Transactions/` for filter-related components
2. **Filter Constants**: Look for filter status constants/types that define available tabs
3. **Transaction Service**: Check how transactions are filtered by status

### Expected Changes

1. **Filter Constants/Types**:
   - Add `'closed'` back to the list of filter options
   - May need to include `'archived'` as well

2. **Filter UI Component**:
   - Add the tab button for "Closed"
   - Wire up the click handler to filter transactions

3. **Count Logic**:
   - Ensure the count query includes closed/archived transactions

### Status Values

Based on the schema, relevant statuses might be:
- `closed` - Completed transactions
- `archived` - Archived transactions

Filter should show transactions with either status.

## Integration Notes

- Imports from: Filter constants, transaction types
- Exports to: Transaction list view
- Used by: Users viewing transaction list
- Depends on: None (standalone fix)

## Do / Don't

### Do:
- Follow existing filter tab patterns
- Match existing UI styling
- Ensure accessibility (keyboard navigation, aria labels)

### Don't:
- Don't change how transactions are stored
- Don't modify database queries for other statuses
- Don't touch unrelated filter logic

## When to Stop and Ask

- If you can't find where filter tabs are defined
- If the "Closed" status doesn't exist in the schema
- If you need to modify database queries beyond simple filtering

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (UI change only)
- Verify: Existing filter tests still pass

### Coverage

- Coverage impact: Minimal (UI change)

### Integration / Feature Tests

- Required scenarios:
  - Filter to "Closed" shows closed transactions
  - Count badge updates correctly
  - Other filters still work

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (existing tests should not break)
- [ ] Type checking
- [ ] Lint / format checks

**PRs without passing CI WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(ui): restore closed filter tab in transaction list`
- **Labels**: `ui`, `fix`, `sprint-051`
- **Depends on**: None (can run in parallel with other Phase 3 tasks)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~5K-10K

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 filter files | +3K |
| Code volume | ~20-30 lines | +2K |
| Research needed | Minimal | +2K |
| Test verification | Low | +1K |

**Confidence:** High

**Risk factors:**
- Filter implementation may be more complex than expected
- Status values may differ from assumptions

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
- [ ] Filter component/constants file(s)

Features implemented:
- [ ] Closed tab visible
- [ ] Filtering works
- [ ] Count badge works

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

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~8K | ~XK | +/-X% |
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
