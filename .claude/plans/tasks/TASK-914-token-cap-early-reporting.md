# Task TASK-914: Token Cap with Early Reporting

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

Add token cap logic to engineer agent documentation to detect and report when engineers exceed 4x their estimated token usage, preventing runaway agents from burning millions of tokens undetected.

## Non-Goals

- Do NOT implement hard token limits that force-stop agents
- Do NOT apply token cap to SR Engineer reviews (different workflow)
- Do NOT add runtime token counting (documentation only)
- Do NOT modify code files

## Deliverables

1. Update: `.claude/agents/engineer.md` - Add token cap section and logic
2. Update: `.claude/skills/agentic-pm/templates/task-file.template.md` - Add token cap field
3. New: `.claude/docs/shared/token-cap-workflow.md` - Detailed guidance

## Acceptance Criteria

- [ ] engineer.md includes 4x token cap rule
- [ ] engineer.md includes token cap report format
- [ ] engineer.md specifies what to do when cap is reached (stop, report, wait)
- [ ] Task template includes `Token Cap: XK (4x upper estimate)` field
- [ ] New shared doc explains workflow for PM handling reports
- [ ] Language is clear: soft cap (report) not hard cap (crash)

## Implementation Notes

### Token Cap Rule (engineer.md)

Add new section after "Token Optimization Rules":

```markdown
## Token Cap Enforcement (BACKLOG-133)

**Rule:** If estimated tokens = X, then soft cap = 4X

### When You Reach 4x Estimated Tokens

1. **STOP** current work immediately
2. **REPORT** status to PM using format below
3. **WAIT** for PM decision before continuing

### Token Cap Report Format

```markdown
## TOKEN CAP REACHED

**Task:** TASK-XXX
**Estimated:** XK tokens
**Current:** YK tokens (4x cap hit)
**Cap:** ZK tokens

### Progress
- [x] Completed step 1
- [x] Completed step 2
- [ ] In progress: step 3

### Reason for Overconsumption
<One of:>
- Unexpected complexity in [area]
- Edit tool retry loops (X retries)
- CI debugging cycle (X failures)
- Large file reads (X files, ~YK tokens each)
- Scope expansion discovered: [what]
- Other: [description]

### Options for PM
1. Continue with additional XK token budget
2. Abort and investigate root cause
3. Hand off to different approach
4. Split into multiple tasks

**Awaiting PM decision.**
```
```

### Task Template Update

Add after "Estimated Totals:" section:

```markdown
**Token Cap:** XK (4x upper estimate)

> If you reach this cap, STOP and report to PM. See token cap workflow.
```

### New Shared Doc: token-cap-workflow.md

```markdown
# Token Cap Workflow

**Purpose:** Prevent runaway agents from burning excessive tokens undetected.

## For Engineers

1. Track estimated tokens from task file
2. At 4x estimate, STOP and report (see engineer.md format)
3. Wait for PM decision
4. Do NOT continue without explicit approval

## For PM (Handling Reports)

When you receive a TOKEN CAP REACHED report:

1. **Assess the situation:**
   - Is progress reasonable for tokens consumed?
   - Is the root cause fixable?
   - Should the task continue or be restructured?

2. **Decision options:**
   - **Extend cap:** "Continue with additional XK budget"
   - **Abort:** "Stop work, we need to investigate"
   - **Split:** "Create TASK-XXX-b for remaining work"
   - **Reassign:** "Different approach needed"

3. **Record the incident:**
   - Add to task file notes
   - Consider updating estimates for similar tasks

## Why 4x?

- 2x: Too sensitive, complex tasks naturally vary
- 4x: Catches genuine runaway loops
- Historical data: SPRINT-014 had 500x+ overruns; 4x would have caught early

## Exceptions

- SR Engineer reviews: No cap (different workflow)
- PM explicitly specifies different cap
- Task file notes "high variance expected"
```

## Integration Notes

- Imports from: None
- Exports to: None
- Used by: All engineers, PM
- Depends on: None

## Do / Don't

### Do:

- Make the cap a "soft" cap (report, don't crash)
- Include specific report format
- Explain WHY the cap exists (context helps compliance)
- Make PM response options clear

### Don't:

- Make it seem punitive (it's protective)
- Add runtime complexity
- Apply to SR Engineer (different context)
- Use vague language ("around 4x" - be precise)

## When to Stop and Ask

- If you find the 4x cap seems too restrictive for some task types
- If there's no good place in engineer.md for this section
- If the task template changes conflict with other recent updates

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation only)
- New tests to write: None
- Existing tests to update: None

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Required scenarios: None

### CI Requirements

This task's PR MUST pass:
- [ ] Lint / format checks

**Documentation PRs do not require code tests.**

## PR Preparation

- **Title**: `docs(agents): add 4x token cap enforcement`
- **Labels**: `documentation`, `process`
- **Depends on**: None (can merge independently of TASK-913)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Raw Estimate:** 4-6 turns, ~20K tokens, 30-45 min
**Adjustment Factor:** x0.5 (docs category)

**Adjusted Estimated Totals:**
- **Turns:** 2-3
- **Tokens:** ~10K
- **Time:** ~15-25 min
- **Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 2 existing + 1 new | +2 |
| Code volume | ~100 lines markdown | +1 |
| Patterns | Following existing doc style | +0 |
| New file creation | 1 shared doc | +0.5 |

**Confidence:** High

**Risk factors:**
- Need to find right location in engineer.md
- Token cap field needs to fit in template cleanly

**Similar past tasks:** BACKLOG-122 (worktree docs, 2 turns actual)

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop (AFTER TASK-913 merged)
**Branch Into:** develop
**Branch Name:** docs/TASK-914-token-cap

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED (with sequencing requirement)

### Execution Classification

- **Parallel Safe:** NO - must run after TASK-913
- **Depends On:** TASK-913 (shared file: engineer.md)
- **Blocks:** TASK-916

### Shared File Analysis

| File | This Task | Conflicts With |
|------|-----------|----------------|
| `.claude/agents/engineer.md` | Token cap section | TASK-913 (worktree section) |
| `.claude/skills/agentic-pm/templates/task-file.template.md` | Token cap field | None |

### Technical Considerations

- **CRITICAL:** DO NOT start until TASK-913 is merged to develop
- Both TASK-913 and TASK-914 add new sections to engineer.md
- Sequential execution prevents merge conflicts on engineer.md
- Pull latest develop before branching to get TASK-913 changes

### Worktree Command (for this task)

```bash
# WAIT for TASK-913 merge, then:
git -C /Users/daniel/Documents/Mad pull origin develop
git -C /Users/daniel/Documents/Mad worktree add ../Mad-task-914 -b docs/TASK-914-token-cap develop
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files modified:
- [ ] .claude/agents/engineer.md
- [ ] .claude/skills/agentic-pm/templates/task-file.template.md

Files created:
- [ ] .claude/docs/shared/token-cap-workflow.md

Verification:
- [ ] Token cap rule clearly stated (4x)
- [ ] Report format included
- [ ] PM decision workflow documented
- [ ] Template includes Token Cap field
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any. If none, write "None">

**Design decisions:**
<Document any decisions made>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 2 | X | +/- X | <reason> |
| Files to create | 1 | X | +/- X | <reason> |
| Code volume | ~100 lines | ~X lines | +/- X | <reason> |

**Total Variance:** Est 2-3 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** N/A
**Security Review:** N/A
**Test Coverage:** N/A

**Review Notes:**
<Key observations, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
