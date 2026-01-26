# Task TASK-1407: Re-enable Communication Counters in UI

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

Re-enable the text and email thread counters on TransactionCard that were hidden due to incorrect counts. The underlying counting bugs should now be fixed by TASK-1403 and TASK-1404.

## Non-Goals

- Do NOT modify the counting logic (that's already done in TASK-1403/1404)
- Do NOT change the counter styling or placement
- Do NOT add new counter features
- Do NOT modify backend queries

## Deliverables

1. Update: `src/components/transaction/components/TransactionCard.tsx` - Re-enable counter display
2. Verify: Counters display correct values

## Acceptance Criteria

- [ ] Text thread counter is visible on TransactionCard
- [ ] Email counter is visible on TransactionCard
- [ ] Counters show correct values (verified against actual data)
- [ ] Counter shows "0" gracefully when no communications
- [ ] No visual regressions to TransactionCard
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Current State

In `TransactionCard.tsx` (around lines 208-225), the counters are commented out or hidden:
```tsx
// Counter display hidden until counting bugs fixed
// See BACKLOG-510
```

### Expected Change

Simply re-enable the existing counter display code. The code is likely already there but disabled.

### Verification Steps

1. Create a test transaction
2. Link several email threads
3. Link several text threads
4. Verify TransactionCard shows correct counts
5. Verify Dashboard shows cards with counters

## Integration Notes

- **Depends on**: TASK-1403 (email count fix), TASK-1404 (text count fix)
- **Related files**:
  - `electron/services/db/transactionDbService.ts` (provides counts)
  - `src/components/transaction/index.ts` (TransactionCard exports)
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Verify counts are correct before un-hiding
- Preserve existing counter styling
- Test with 0, 1, and many communications
- Ensure counter updates when communications change

### Don't:

- Modify counting queries
- Change counter visual design
- Add new counter features
- Touch backend code

## When to Stop and Ask

- If counters still show incorrect values (means TASK-1403/1404 not complete)
- If counter code is not just hidden (requires more work)
- If visual changes are needed (scope expansion)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (update existing tests)
- New tests to write:
  - TransactionCard renders email counter
  - TransactionCard renders text thread counter
  - Counter shows "0" when no communications
- Existing tests to update:
  - TransactionCard tests that expect hidden counters

### Coverage

- Coverage impact: Must not decrease
- Focus: TransactionCard rendering

### Integration / Feature Tests

- Required scenarios:
  - Dashboard shows transaction cards with visible counters
  - Counters update after linking/unlinking communications

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(ui): re-enable communication counters on TransactionCard`
- **Labels**: `enhancement`, `ui`
- **Depends on**: TASK-1403, TASK-1404 (both must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~6K-8K

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +4K |
| Code changes | Un-comment/enable | +2K |
| Test updates | 2-3 test cases | +2K |

**Confidence:** High

**Risk factors:**
- Counter code may need more than just un-hiding
- Visual regression possible

**Note**: This is a simple UI task - mostly enabling already-written code.

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
- [ ] src/components/transaction/components/TransactionCard.tsx
- [ ] (tests)

Features implemented:
- [ ] Email counter visible
- [ ] Text thread counter visible
- [ ] Tests updated

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual: counters display correct values
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~7K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~7K | ~XK | +/-X% |
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
