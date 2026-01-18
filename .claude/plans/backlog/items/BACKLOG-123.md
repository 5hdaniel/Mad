# BACKLOG-123: Update Test Category Estimation Multiplier

**Priority:** Low
**Category:** docs
**Created:** 2025-12-31
**Source:** SPRINT-011 Retrospective

---

## Problem Statement

SPRINT-011 data shows `test` category tasks are consistently overestimated:
- Average variance: -28% (actual < estimated)
- This follows the pattern seen in `refactor` category (-52%)

Current estimation guidance does not include a multiplier for `test` category.

## Proposed Solution

Update the estimation accuracy analysis and PM guidelines to include a 0.7x multiplier for test tasks.

## Deliverables

1. Update: `.claude/plans/backlog/INDEX.md` - Update estimation multiplier table
2. Update: `.claude/docs/shared/metrics-templates.md` - Add test category guidance

## Acceptance Criteria

- [ ] INDEX.md estimation table includes `test` category with 0.7x multiplier
- [ ] Metrics templates document includes test category notes
- [ ] SPRINT-011 data added to variance breakdown

## Implementation Notes

### Updated Estimation Table

```markdown
| Category | Base Estimate | Adjustment | Notes |
|----------|---------------|------------|-------|
| schema | PM estimate | x 1.3 | High variance, add buffer |
| refactor | PM estimate | x 0.5 | Consistently overestimate |
| **test** | PM estimate | **x 0.7** | SPRINT-011 data: -28% avg |
| config | PM estimate | x 0.5 | Significantly overestimate |
| security | PM estimate | x 0.4 | SPRINT-009 showed simpler implementations |
| service | PM estimate | x 1.0 | TBD - need data |
| ui | PM estimate | x 1.0 | TBD - need data |
```

### SPRINT-011 Test Task Data

| Task | Est. Turns | Actual | Variance |
|------|------------|--------|----------|
| TASK-800 | 8-12 | ~4 | -60% |
| TASK-801 | 10-14 | 10 | -14% |
| TASK-802 | 12-18 | 8 | -47% |
| TASK-804 | 2-4 | 6 | +50% |
| **Average** | - | - | **-28%** |

Note: TASK-804 was higher than estimated due to root cause analysis complexity, but still reasonable.

## Estimated Effort

- **Turns:** 1-2
- **Tokens:** ~5K
- **Time:** 10-15m

---

## References

- SPRINT-011 Retrospective
- INDEX.md Estimation Accuracy Analysis section
