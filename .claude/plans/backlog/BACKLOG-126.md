# BACKLOG-126: Add Incident/Blocker Tracking to Engineer Workflow

**Priority:** High
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-010 Retrospective (TASK-704 CI incident)

---

## Problem Statement

TASK-704 took **22 hours** to merge due to CI debugging, but the engineer metrics only reported:
- Implementation: 4 turns, 30 min
- Debugging: 0

The actual debugging effort (~20 turns, ~21 hours) was completely invisible. This:
1. Invalidated estimation accuracy data
2. Made the sprint look artificially fast
3. Lost valuable incident data for future planning

## Proposed Solution

Add explicit "Incident/Blocker" tracking to the engineer workflow:

1. **Engineer Workflow**: Add mandatory incident section when blockers occur
2. **Metrics Template**: Add "Incidents" row to metrics table
3. **PR Template**: Add incident checkbox and section
4. **SR Engineer Review**: Verify incident documentation before merge

## Deliverables

1. Update: `.claude/agents/engineer.md` - Add incident tracking section
2. Update: `.claude/docs/shared/metrics-templates.md` - Add incident row
3. Update: `.github/PULL_REQUEST_TEMPLATE.md` - Add incident section
4. Update: `.claude/docs/PR-SOP.md` - Add incident verification

## Acceptance Criteria

- [ ] Engineer workflow explicitly requires incident documentation
- [ ] Metrics template includes "Incidents/Debugging" as separate category
- [ ] PR template has incident section (collapsible if not applicable)
- [ ] SR Engineer checklist includes "Incidents documented if any"
- [ ] Example incident documentation provided

## Implementation Notes

### Incident Detection Triggers

Document an incident when ANY of these occur:
- CI fails more than 3 times on same issue
- Debugging takes >1 hour
- External blocker (dependency, API, infrastructure)
- Scope discovered to be larger than estimated
- Had to involve other team members

### Incident Documentation Template

```markdown
## Incident Report

**Type:** [CI Failure | External Blocker | Scope Creep | Other]
**Duration:** X hours
**Turns Spent:** X

### Timeline
- [Time]: [Event]
- [Time]: [Event]

### Root Cause
[Description]

### Resolution
[What fixed it]

### Prevention
[How to avoid in future]
```

### Updated Metrics Table

```markdown
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | X | ~XK | Xm |
| Implementation | X | ~XK | Xm |
| **Incidents** | X | ~XK | Xh |
| PR Review | X | ~XK | Xm |
| **Total** | X | ~XK | Xh |
```

### PR Template Addition

```markdown
## Incidents

- [ ] No incidents during this PR
- [ ] Incident(s) documented below

<details>
<summary>Incident Details (if any)</summary>

[Use incident template]

</details>
```

## Why This Matters

Without incident tracking:
- **Estimation accuracy is wrong** - TASK-704 showed -70% variance (under), but was actually +140% (over)
- **Pattern detection impossible** - Can't identify recurring CI issues
- **Resource planning fails** - Can't account for debugging time in sprints
- **Knowledge lost** - Root causes and fixes not documented

## Estimated Effort

- **Turns:** 3-4
- **Tokens:** ~15K
- **Time:** 30-45m

---

## References

- TASK-704 CI incident (22 hours, undocumented)
- BACKLOG-120 (CI Testing Infrastructure Gaps - created from incident)
- SPRINT-010 Retrospective
