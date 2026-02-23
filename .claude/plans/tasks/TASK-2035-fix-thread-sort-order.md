# Task TASK-2035: Fix AttachMessagesModal Thread Sort Order

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

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Fix the thread sort order in `sortThreadsByRecent()` in `MessageThreadCard.tsx` so threads are sorted by their most recent message (newest first), not their oldest message.

## Non-Goals

- Do NOT refactor the message sorting logic at line 412
- Do NOT change the message display order within threads
- Do NOT modify thread grouping logic
- Do NOT touch any other sort functions in the codebase

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` -- fix `sortThreadsByRecent()` at line 510

## Acceptance Criteria

- [ ] `sortThreadsByRecent()` uses `msgsA[0]` and `msgsB[0]` (newest message) instead of `msgsA[msgsA.length - 1]` and `msgsB[msgsB.length - 1]` (oldest message)
- [ ] Threads in AttachMessagesModal sort by most recent message (newest thread first)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No other behavior changes in MessageThreadCard

## Implementation Notes

### Root Cause

Messages within each thread are sorted newest-first at line 412. Therefore:
- `msgs[0]` = newest message in the thread
- `msgs[msgs.length - 1]` = oldest message in the thread

The `sortThreadsByRecent()` function at line 510 currently uses `msgs[msgs.length - 1]` (oldest), which means threads are sorted by their oldest message rather than their most recent message.

### The Fix (1-line change, applied twice)

```typescript
// Before (BROKEN -- uses oldest message):
const lastA = msgsA[msgsA.length - 1];
const lastB = msgsB[msgsB.length - 1];

// After (FIXED -- uses newest message):
const lastA = msgsA[0];
const lastB = msgsB[0];
```

Note: The variable name `lastA`/`lastB` is now slightly misleading (it's actually the "most recent" message, not the "last" in array order). Optionally rename to `newestA`/`newestB` for clarity, but the fix itself is just changing the index.

### Key Context

- Line 412: Messages sorted newest-first within each thread
- Line 510: `sortThreadsByRecent()` function that sorts threads relative to each other
- The function compares message dates to determine thread order

## Integration Notes

- This file is only modified by this task in SPRINT-091
- No imports or exports change
- Related to BACKLOG-175

## Do / Don't

### Do:
- Change `msgsA[msgsA.length - 1]` to `msgsA[0]` (and same for msgsB)
- Optionally rename `lastA`/`lastB` to `newestA`/`newestB` for clarity
- Verify the fix by checking that the sort comparison logic still makes sense

### Don't:
- Change the message sort order within threads (line 412)
- Refactor the sort function signature or return type
- Add pagination or lazy loading
- Touch any other component

## When to Stop and Ask

- If the line numbers have shifted significantly and you cannot locate `sortThreadsByRecent()`
- If the message sort order at line 412 is NOT newest-first (the fix depends on this assumption)
- If there are multiple callers of `sortThreadsByRecent()` that might be affected differently

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that `sortThreadsByRecent()` sorts threads by newest message date (not oldest)
  - Test with threads where newest and oldest messages would produce different sort orders
- Existing tests to update:
  - Any existing MessageThreadCard tests that validate sort order

### Coverage

- Coverage impact: Should not decrease; may slightly increase

### Integration / Feature Tests

- Required scenarios: None

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(ui): sort AttachMessagesModal threads by newest message`
- **Labels**: `bug`, `ui`, `quick-win`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `bug fix`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 (MessageThreadCard.tsx) | +5K |
| Code volume | ~2 lines changed | +2K |
| Test complexity | Low (simple sort verification) | +8K |

**Confidence:** High

**Risk factors:**
- 1-line fix with clear logic; minimal risk

**Similar past tasks:** Simple bug fixes typically complete well under estimate.

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
- [ ] src/components/transactionDetailsModule/components/MessageThreadCard.tsx

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
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

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
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
