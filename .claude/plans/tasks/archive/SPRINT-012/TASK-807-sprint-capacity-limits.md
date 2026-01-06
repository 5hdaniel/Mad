# Task TASK-807: Add Sprint Capacity Limits to PM Workflow

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

Add explicit sprint capacity guidelines to the PM sprint selection module to prevent scope overflow, based on patterns observed in SPRINT-010 where 7 tasks were planned but only 4 completed.

## Non-Goals

- Do NOT create automated capacity enforcement
- Do NOT modify existing sprint files
- Do NOT add capacity fields to task templates
- Do NOT create new PM skill modules

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/sprint-selection.md` - Add Sprint Capacity Guidelines section

## Acceptance Criteria

- [ ] sprint-selection.md includes Sprint Capacity Guidelines section
- [ ] Guidelines specify max tasks for solo vs parallel sprints
- [ ] Guidelines specify max sequential chain length
- [ ] Stretch goal marking guidance included
- [ ] Example good/risky structure provided
- [ ] All CI checks pass

## Implementation Notes

### sprint-selection.md Addition

Add new section "Sprint Capacity Guidelines":

```markdown
## Sprint Capacity Guidelines

**Purpose:** Prevent scope overflow by setting explicit limits based on historical data.

**Source:** SPRINT-010 retrospective - 7 tasks planned, 4 completed. Sequential chains and parallel sprint execution exceeded capacity.

### Capacity Limits

| Sprint Type | Max Tasks | Max Sequential Chain |
|-------------|-----------|----------------------|
| Solo sprint | 5-7 tasks | 2-3 sequential |
| Parallel sprints | 4-5 per sprint | 1-2 sequential |

### Rules

1. **Sequential chains beyond 2 tasks should be separate sprints**
   - Each task in a chain blocks the next
   - Risk of deferral compounds with chain length
   - Exception: Very small tasks (< 2 turns each)

2. **When running parallel sprints, reduce capacity**
   - Context switching overhead
   - Merge conflict risk increases
   - CI queue congestion
   - Reduce by ~30% from solo capacity

3. **Stretch goals should be explicitly marked**
   - Tasks 6-7 in a 7-task sprint = stretch
   - Don't count stretch goals in commitment
   - Label in sprint file as "(stretch)"

### Sprint Structure Examples

**Good sprint structure:**
```
Phase 1 (Parallel): 4 tasks
Phase 2 (Sequential): 2 tasks (depends on 1 task from Phase 1)
Stretch: 1 task (explicitly marked)
```

**Risky sprint structure:**
```
Phase 1 (Parallel): 3 tasks
Phase 2 (Sequential): 4 tasks (chain of 4)  <- Too long
```

**Why risky:** A 4-task sequential chain means:
- Task 2 waits for Task 1
- Task 3 waits for Tasks 1+2
- Task 4 waits for Tasks 1+2+3
- Any blocker in the chain delays everything downstream

**Fix:** Split into 2 sprints:
- Sprint A: 3 parallel + 2 sequential
- Sprint B: 2 sequential (former chain tasks 3-4)

### Capacity Calculation

```
Base capacity: 5-7 tasks (solo sprint)

Adjustments:
- Parallel sprint execution: -30%
- Sequential chain > 2: Split chain
- High complexity tasks: Count as 1.5-2 tasks
- Documentation-only tasks: Count as 0.5 tasks
```

### Planning Checklist

Before finalizing sprint:
- [ ] Total tasks <= capacity limit
- [ ] Sequential chains <= 2-3 tasks
- [ ] Stretch goals explicitly marked
- [ ] Parallel sprint overlap considered
```

## Integration Notes

- Imports from: N/A (documentation only)
- Exports to: N/A (documentation only)
- Used by: PM during sprint planning
- Depends on: None

## Do / Don't

### Do:

- Reference SPRINT-010 as the source of this guidance
- Provide concrete numbers for capacity limits
- Include the calculation example
- Keep the section focused and actionable

### Don't:

- Create rigid rules that prevent PM judgment
- Add fields to sprint templates
- Duplicate capacity discussion elsewhere
- Over-engineer the guidelines

## When to Stop and Ask

- If sprint-selection.md already has capacity guidance
- If the section placement is unclear
- If guidance conflicts with existing content

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation only)

### Coverage

- Coverage impact: None (documentation only)

### Integration / Feature Tests

- Required: No (documentation only)

### CI Requirements

This task's PR MUST pass:
- [ ] No broken links in documentation
- [ ] Markdown formatting valid

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `docs(pm): add sprint capacity limits to PM workflow`
- **Labels**: `documentation`, `process`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~4K-6K
- **Time:** ~8-12m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 1 existing file | +0.5 |
| Content provided | BACKLOG-127 has content outline | +0.5 |
| Integration complexity | Simple append | +0 |

**Confidence:** High

**Risk factors:**
- Very straightforward documentation update
- Single file modification

**Similar past tasks:** Documentation updates typically complete in 1-2 turns

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
- [ ] .claude/skills/agentic-pm/modules/sprint-selection.md

Content verified:
- [ ] Capacity limits table included
- [ ] Examples are clear
- [ ] Calculation example is accurate
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
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 1 | X | +/- X | <reason> |

**Total Variance:** Est 1-2 turns -> Actual X turns (X% over/under)

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

**Architecture Compliance:** N/A (documentation)
**Security Review:** N/A
**Test Coverage:** N/A

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
