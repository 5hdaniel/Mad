# Task TASK-806: Add Sprint Completion Checklist to PM Workflow

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

Add a mandatory "Sprint Completion Checklist" to the PM workflow that must be executed after the last PR merges, ensuring sprint files, backlog items, and INDEX.md are properly updated.

## Non-Goals

- Do NOT create automation for sprint completion
- Do NOT modify existing sprint files
- Do NOT change backlog item format
- Do NOT create new PM skill modules

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/backlog-maintenance.md` - Add sprint completion checklist section
2. Update: `.claude/docs/shared/plan-first-protocol.md` - Add brief reference to PM sprint completion responsibility

## Acceptance Criteria

- [ ] Sprint completion checklist documented with specific steps
- [ ] Checklist includes: update sprint file, mark backlog items, update INDEX.md
- [ ] Verification step: `gh pr list` to confirm all tasks merged
- [ ] Git commit step for documentation updates
- [ ] Checklist is referenced in plan-first-protocol.md
- [ ] All CI checks pass

## Implementation Notes

### backlog-maintenance.md Addition

Add new section "Sprint Completion Checklist":

```markdown
## Sprint Completion Checklist (After Last PR Merges)

**MANDATORY**: Execute this checklist immediately after the final sprint PR merges.

**Why this exists:** SPRINT-010 was fully merged on 2025-12-29 but sprint file still showed "Planning" status when reviewed on 2026-01-01. This checklist prevents stale documentation.

### 1. Verify All PRs Merged

```bash
# List all PRs for sprint tasks
gh pr list --state all | grep -E "(TASK-XXX|TASK-YYY|...)"
# All should show "MERGED"

# Or check by branch pattern
gh pr list --state merged --search "head:fix/task-" --limit 20
```

### 2. Update Sprint File

Location: `.claude/plans/sprints/SPRINT-XXX-slug.md`

Update these sections:
- [ ] Change status from "PLANNING" or "IN PROGRESS" to "COMPLETED (YYYY-MM-DD)"
- [ ] Update all task rows to show "**Merged** (PR #XXX)"
- [ ] Update progress tracking: "X/X tasks merged (100%)"
- [ ] Add entries to "Merged PRs" table with dates

### 3. Update INDEX.md

Location: `.claude/plans/backlog/INDEX.md`

Update these sections:
- [ ] Mark all addressed backlog items as "Completed"
- [ ] Update Pending/Completed counts in header
- [ ] Update sprint assignment line to show "Completed"
- [ ] Add changelog entry with completion date and summary

### 4. Mark Backlog Items Complete (Optional)

If individual BACKLOG-XXX.md files exist, update their status headers.

### 5. Archive Task Files

Move completed task files to archive:
```bash
git mv .claude/plans/tasks/TASK-XXX.md .claude/plans/tasks/archive/
```

### 6. Commit Updates

```bash
git add .claude/plans/
git commit -m "docs: mark SPRINT-XXX as complete

- Updated sprint file status to COMPLETED
- Marked BACKLOG-XXX, BACKLOG-YYY as complete
- Archived task files
- Updated INDEX.md counts"
git push
```

### Quick Reference

| Step | File | Action |
|------|------|--------|
| 1 | - | Verify PRs merged |
| 2 | Sprint file | Status -> COMPLETED |
| 3 | INDEX.md | Backlog items -> Completed |
| 4 | BACKLOG-XXX.md | Status -> Completed (if exists) |
| 5 | Task files | Move to archive/ |
| 6 | - | Commit and push |
```

### plan-first-protocol.md Addition

Add to "Role-Specific Extensions > PM" section:

```markdown
### Sprint Completion (After Final Merge)

PM MUST execute the Sprint Completion Checklist (`.claude/skills/agentic-pm/modules/backlog-maintenance.md`) immediately after the final sprint PR merges:
- Update sprint file status
- Mark backlog items complete
- Update INDEX.md
- Archive task files

**Failure to complete this checklist results in stale documentation.**
```

## Integration Notes

- Imports from: N/A (documentation only)
- Exports to: N/A (documentation only)
- Used by: PM after every sprint completion
- Depends on: None

## Do / Don't

### Do:

- Use specific file paths in the checklist
- Include bash commands that can be copy-pasted
- Reference the SPRINT-010 incident as motivation
- Keep the checklist actionable and concise

### Don't:

- Add complex automation requirements
- Create new files beyond the two updates
- Duplicate content that exists elsewhere
- Make the checklist overly long

## When to Stop and Ask

- If backlog-maintenance.md structure is unclear
- If there's already a similar checklist that would conflict
- If plan-first-protocol.md doesn't have PM section

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

- **Title**: `docs(pm): add sprint completion checklist to PM workflow`
- **Labels**: `documentation`, `process`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~5K-8K
- **Time:** ~10-15m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 2 existing files | +0.5 |
| Content provided | BACKLOG-124 has checklist content | +0.5 |
| Integration complexity | Simple append | +0 |

**Confidence:** High

**Risk factors:**
- Very straightforward documentation update
- Content already defined in backlog item

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
- [ ] .claude/skills/agentic-pm/modules/backlog-maintenance.md
- [ ] .claude/docs/shared/plan-first-protocol.md

Content verified:
- [ ] Checklist is actionable
- [ ] Bash commands are correct
- [ ] Cross-reference to backlog-maintenance.md works
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
| Files to modify | 2 | X | +/- X | <reason> |

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
