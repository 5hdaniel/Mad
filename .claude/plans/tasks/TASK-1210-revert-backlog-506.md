# Task TASK-1210: Revert BACKLOG-506 and BACKLOG-508 Changes

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

Revert all commits from BACKLOG-506 and BACKLOG-508 to restore develop to the last known working state (commit `59ca47a9`).

## Non-Goals

- Do NOT attempt to fix the issues (that's for later phases)
- Do NOT preserve any of the BACKLOG-506/508 changes
- Do NOT create a new implementation approach yet
- Do NOT close PR #607 (BACKLOG-508) - that can be done manually later

## Deliverables

1. Revert commit for all post-SPRINT-052 changes
2. Verification that app works after revert

## Commits to Revert (in reverse chronological order)

**On develop branch (actual current state):**

```
85e3b6c1 chore: update BACKLOG-372 with settings toggle approach  [DOCS ONLY - KEEP]
62cc4f75 chore: add BACKLOG-510 Gmail sync freezes UI              [DOCS ONLY - KEEP]
36cd16bf fix: handle partial Migration 24 state on retry           [CODE - part of BACKLOG-506 fix cascade]
a0be6f40 chore: add BACKLOG-509 unify loading animations           [DOCS ONLY - KEEP]
6e6ae2f9 chore(pm): create TASK-1201 for BACKLOG-508               [DOCS ONLY - KEEP]
6d615711 Merge pull request #606 (BACKLOG-506 merge commit)        [CODE - REVERT THIS]
```

**Strategy:** Revert the merge commit `6d615711` with `-m 1`. This will undo all BACKLOG-506 code changes.
The migration fix `36cd16bf` was made to fix BACKLOG-506 issues, so it should also be reverted (will conflict otherwise).
Documentation commits (BACKLOG-XXX.md files) can be kept - they don't affect code.

## Last Known Good State

**Commit:** `59ca47a9` (Merge PR #590 from sprint-052-closure)

## Acceptance Criteria

- [ ] All commits after `59ca47a9` are reverted
- [ ] `npm run type-check` passes
- [ ] `npm test` passes (or has only pre-existing failures)
- [ ] `npm run lint` passes (or has only pre-existing errors)
- [ ] App starts successfully: `npm run dev`
- [ ] Contact search works (no "no such column" error)
- [ ] Message display works
- [ ] All CI checks pass

## Implementation Notes

### Approach: Revert Merge Commit

The cleanest approach is to revert the merge commit and the related migration fix:

```bash
# Start from develop
git checkout develop
git pull origin develop

# Create revert branch
git checkout -b fix/task-1210-revert-backlog-506

# Revert the migration fix first (it depends on BACKLOG-506 changes)
git revert 36cd16bf --no-commit

# Then revert the merge commit (reverting to parent 1 which is develop)
git revert -m 1 6d615711 --no-commit

# Commit all reverts together
git commit -m "revert: BACKLOG-506 database architecture changes

Reverting to restore app stability:
- Reverts merge commit 6d615711 (PR #606)
- Reverts migration fix 36cd16bf (was fixing BACKLOG-506 issues)

This restores the database schema and services to the SPRINT-052 closure state.
Documentation commits (BACKLOG-508, 509, 510) are preserved as they don't affect code."
```

**Note:** The documentation commits (`6e6ae2f9`, `a0be6f40`, `62cc4f75`, `85e3b6c1`) only modify
`.claude/plans/backlog/items/*.md` files and should NOT be reverted - they are harmless backlog documentation.

### If Conflicts Occur

If reverting causes conflicts, prefer to:
1. Document the conflicting files
2. Manually restore from `59ca47a9` for those files
3. Ensure the result matches the known good state

### Verification Steps

After revert:
```bash
# Verify schema is back to original
git diff 59ca47a9 -- electron/database/schema.sql

# Should show no differences for these files:
git diff 59ca47a9 -- electron/services/db/communicationDbService.ts
git diff 59ca47a9 -- electron/services/db/contactDbService.ts
```

## Integration Notes

- This is Phase 0 - must complete before any other tasks
- User must confirm app is working before proceeding to TASK-1211

## Do / Don't

### Do:

- Verify the revert is complete by comparing to `59ca47a9`
- Test that the app actually works after revert
- Document any files that couldn't be cleanly reverted

### Don't:

- Don't try to preserve any "good parts" of BACKLOG-506
- Don't create new code - this is purely a revert
- Don't skip verification steps
- Don't merge before user confirmation

## When to Stop and Ask

- If revert causes unexpected conflicts in more than 5 files
- If app still shows errors after revert
- If any verification step fails
- If you're unsure which commits to revert

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (this is a revert)
- Existing tests should pass (or have pre-existing failures only)

### Coverage

- Coverage should return to pre-BACKLOG-506 baseline

### Integration / Feature Tests

- Required: Manual verification that app works
- Contact search must return results without SQL errors
- Message display must work

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `revert: BACKLOG-506 and BACKLOG-508 changes (return to 59ca47a9)`
- **Labels**: `revert`, `critical`
- **Depends on**: None (this is Phase 0)

---

## PM Estimate (PM-Owned)

**Category:** `revert`

**Estimated Tokens:** ~10K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to revert | ~10-15 files | +10K |
| Conflict resolution | Low - clean revert expected | +5K |
| Verification | Quick checks | +2K |

**Confidence:** High

**Risk factors:**
- Merge commit revert might be tricky
- Post-merge fixes may conflict with revert

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
Revert actions:
- [ ] Commits reverted
- [ ] No conflicts (or conflicts documented and resolved)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (or pre-existing failures only)
- [ ] App starts with npm run dev
- [ ] Contact search works
- [ ] Message display works
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
| **Tokens** | ~15K | ~XK | +/-X% |
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
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A (revert only)
**Test Coverage:** N/A (revert only)

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

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

---

## User Approval Gate

**AFTER this task merges, user must confirm:**

- [ ] App starts successfully
- [ ] Contact search works without errors
- [ ] Message display works
- [ ] Export works
- [ ] User explicitly approves proceeding to TASK-1211

**DO NOT proceed to TASK-1211 without user approval.**
