# BACKLOG-127: Add Sprint Capacity Limits to PM Workflow

**Priority:** Medium
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-010 Retrospective - Pattern 1: Sprint Scope Overflow

---

## Problem Statement

SPRINT-010 had 7 tasks planned but only 4 were completed. The remaining 3 (TASK-703, 704, 706) were deferred because:
1. Sequential task chains blocked on each other
2. Combined with parallel SPRINT-011 execution, capacity was exceeded
3. No documented guidance on sprint capacity limits

**Evidence from SPRINT-010 Retro:**
> "Original plan: 7 tasks, 45-69 turns estimated. Executed: 4 tasks in Batch 1. Deferred: 3 tasks (TASK-703, 704, 706) - all sequential dependencies."

---

## Proposed Solution

Add explicit sprint capacity guidelines to prevent scope overflow.

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/sprint-selection.md` - Add capacity guidelines section

## Implementation Notes

### Proposed Content

```markdown
## Sprint Capacity Guidelines

| Sprint Type | Max Tasks | Max Sequential Chain |
|-------------|-----------|----------------------|
| Solo sprint | 5-7 tasks | 2-3 sequential |
| Parallel sprints | 4-5 per sprint | 1-2 sequential |

### Rules

1. **Sequential chains beyond 2 tasks should be separate sprints**
   - Each task in a chain blocks the next
   - Risk of deferral compounds with chain length

2. **When running parallel sprints, reduce capacity**
   - Context switching overhead
   - Merge conflict risk increases
   - CI queue congestion

3. **Stretch goals should be explicitly marked**
   - Tasks 6-7 in a 7-task sprint = stretch
   - Don't count stretch goals in commitment

### Example

**Good sprint structure:**
- 4 parallel tasks (Batch 1)
- 2 sequential tasks (Batch 2, depends on 1 task from Batch 1)
- 1 stretch goal (explicitly marked)

**Risky sprint structure:**
- 3 parallel tasks
- 4 sequential tasks (chain of 4)  ← Too long, split into 2 sprints
```

---

## Acceptance Criteria

- [ ] sprint-selection.md includes Sprint Capacity Guidelines section
- [ ] Guidelines specify max tasks for solo vs parallel sprints
- [ ] Guidelines specify max sequential chain length
- [ ] Stretch goal marking guidance included
- [ ] Example good/risky structure provided

---

## Estimated Effort

- **Turns:** 1-2
- **Tokens:** ~6K
- **Time:** 10-15m

---

## References

- SPRINT-010 Retrospective: Pattern 1 (Sprint Scope Overflow)
- SPRINT-010-phase-retro-report.md: Proposal 1
