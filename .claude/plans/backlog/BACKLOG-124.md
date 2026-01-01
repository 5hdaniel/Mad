# BACKLOG-124: Add Sprint Completion Checklist to PM Workflow

**Priority:** Medium
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-010 Retrospective

---

## Problem Statement

SPRINT-010 was fully merged on 2025-12-29 but:
- Sprint file still showed "Planning" status
- Backlog items (054, 103, 104, 105) not marked complete
- INDEX.md not updated with completion info

This led to incorrect status reports when asked "where are we with SPRINT-010?" on 2026-01-01.

## Proposed Solution

Add a mandatory "Sprint Completion Checklist" to the PM workflow that must be executed after the last PR merges.

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/backlog-maintenance.md` - Add sprint completion checklist
2. Update: `.claude/docs/shared/plan-first-protocol.md` - Reference sprint completion as PM responsibility

## Acceptance Criteria

- [ ] Sprint completion checklist documented with specific steps
- [ ] Checklist includes: update sprint file, mark backlog items, update INDEX.md
- [ ] Verification step: `gh pr list` to confirm all tasks merged
- [ ] Checklist is referenced in PM skill documentation

## Implementation Notes

### Sprint Completion Checklist

```markdown
## Sprint Completion Checklist (After Last PR Merges)

### 1. Verify All PRs Merged
```bash
gh pr list --state all | grep -E "(TASK-XXX|TASK-YYY|...)"
# All should show "MERGED"
```

### 2. Update Sprint File
- [ ] Change status to "COMPLETED (YYYY-MM-DD)"
- [ ] Update all task rows to "**Merged** (PR #XXX)"
- [ ] Update progress tracking section to "X/X tasks merged (100%)"
- [ ] Add "Merged PRs" table with dates

### 3. Update INDEX.md
- [ ] Mark all addressed backlog items as "Completed"
- [ ] Update Pending/Completed counts
- [ ] Update sprint assignment line to "Completed"
- [ ] Add changelog entry

### 4. Commit Updates
```bash
git add .claude/plans/
git commit -m "docs: mark SPRINT-XXX as complete"
git push
```
```

## Estimated Effort

- **Turns:** 2-3
- **Tokens:** ~10K
- **Time:** 15-20m

---

## References

- SPRINT-010 Retrospective (stale sprint file incident)
- backlog-maintenance.md Sprint Status Verification section
