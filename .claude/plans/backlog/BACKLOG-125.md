# BACKLOG-125: Enforce Metrics Collection for All Sprints

**Priority:** Low
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-010 Retrospective

---

## Problem Statement

SPRINT-010 was completed without detailed metrics tracking:
- No turn counts per task
- No token estimates
- No time measurements
- This reduces estimation accuracy data for future sprints

Historical metrics data is critical for improving PM estimates (see INDEX.md Estimation Accuracy Analysis).

## Proposed Solution

Add explicit metrics collection requirements to:
1. Engineer workflow - must report metrics even for "fast" sprints
2. SR Engineer review - verify metrics present before merge approval
3. PM sprint templates - pre-populate metrics tables

## Deliverables

1. Update: `.claude/agents/engineer.md` - Add "no metrics = no merge" reminder
2. Update: `.claude/docs/PR-SOP.md` - Add metrics verification to checklist
3. Update: `.claude/skills/agentic-pm/templates/` - Ensure metrics tables in all templates

## Acceptance Criteria

- [ ] Engineer agent explicitly states metrics are required for ALL tasks
- [ ] PR-SOP includes "Engineer Metrics section present" as blocking check
- [ ] Sprint templates include pre-formatted metrics tables
- [ ] Documentation clarifies: fast sprints still need metrics

## Implementation Notes

### Minimum Metrics Required

Even for simple tasks, engineers must report:

```markdown
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | X | ~XK | Xm |
| Implementation | X | ~XK | Xm |
| Total | X | ~XK | Xm |
```

### Why This Matters

Without metrics from SPRINT-010 (7 UI tasks), we can't update the `ui` category estimation multiplier in INDEX.md. The category still shows "TBD - need data".

## Estimated Effort

- **Turns:** 2-3
- **Tokens:** ~8K
- **Time:** 15-20m

---

## References

- SPRINT-010 Retrospective (missing metrics)
- INDEX.md Estimation Accuracy Analysis (ui category has no data)
- metrics-templates.md
