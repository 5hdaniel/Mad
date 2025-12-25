# Metrics Templates

**Status:** Canonical reference for all metrics tracking
**Last Updated:** 2024-12-24

---

## Overview

All sprint tasks require metrics tracking for:
- Estimation calibration
- Workflow efficiency analysis
- Resource planning

**Metric Types:**
- **Turns**: Number of user messages/prompts (1 turn = 1 message)
- **Tokens**: Estimated as Turns × 4K (adjust for long file reads: +2-5K each)
- **Time**: Wall-clock active work time (exclude waiting for CI/responses)

---

## Engineer Metrics (PR Description)

Include this section in every PR for sprint tasks:

```markdown
---

## Engineer Metrics: TASK-XXX

**Engineer Start Time:** [HH:MM]
**Engineer End Time:** [HH:MM]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Planning Notes:** [Plan revisions, key decisions from planning phase]
**Implementation Notes:** [Approach summary, any deviations from plan]

**Estimated vs Actual:**
- Est: X-Y turns, XK-YK tokens
- Actual: X turns, ~XK tokens (Plan: X, Impl: X, Debug: X)
```

### Phase Definitions

| Phase | What to Count |
|-------|---------------|
| **Planning (Plan)** | All Plan agent invocations and revisions |
| **Implementation (Impl)** | Actual coding, testing, file modifications |
| **Debugging (Debug)** | CI failures, bug fixes, test fixes |

---

## SR Engineer Metrics (PR Description)

Add after Engineer Metrics when approving/merging:

```markdown
---

## Senior Engineer Metrics: TASK-XXX

**SR Review Start:** [HH:MM]
**SR Review End:** [HH:MM]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| PR Review (PR) | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |

**Planning Notes:** [Review strategy decisions, plan revisions if any]
**Review Notes:** [Architecture concerns, security review, approval rationale]
```

---

## PM Notification Format (After Merge)

SR Engineer sends to PM after merging:

```markdown
## Task Complete - PM Action Required

**Task**: TASK-XXX
**PR**: #XXX (merged)
**Branch**: [branch name]

### Metrics Summary
| Role | Phase | Turns | Tokens | Time |
|------|-------|-------|--------|------|
| Engineer | Planning | X | ~XK | X min |
| Engineer | Implementation | X | ~XK | X min |
| Engineer | Debugging | X | ~XK | X min |
| **Engineer Total** | - | X | ~XK | X min |
| SR | Planning | X | ~XK | X min |
| SR | PR Review | X | ~XK | X min |
| **SR Total** | - | X | ~XK | X min |
| **Grand Total** | - | X | ~XK | X min |

### PM Actions Needed
1. Update INDEX.md with metrics
2. Archive task file
3. Assign next task to engineer
```

---

## INDEX.md Recording Format

When PM records metrics in `.claude/plans/backlog/INDEX.md`:

| Column | Source | Format |
|--------|--------|--------|
| Est Turns | Task file | `X-Y` |
| Eng Turns | PR metrics | `X` |
| PR Turns | SR metrics | `X` |
| Est Tokens | Task file | `XK-YK` |
| Eng Tokens | PR metrics | `~XK` |
| PR Tokens | SR metrics | `~XK` |
| Est Time | Task file | `Xm` |
| Eng Time | PR metrics | `Xm` |
| PR Time | SR metrics | `Xm` |

---

## Batch Review Metrics

When SR Engineer reviews multiple PRs in one session:

```markdown
## Batch Review Metrics

| Task | PR Review | Feedback | Total |
|------|-----------|----------|-------|
| TASK-XXX | 2 turns, ~8K, 5m | 0 | 2 turns, ~8K, 5m |
| TASK-YYY | 2 turns, ~8K, 5m | 0 | 2 turns, ~8K, 5m |
| **Batch Total** | 4 turns | ~16K | 10m |
```

Update each task file with its individual SR metrics.

---

## Token Estimation Guidelines

| Activity | Token Estimate |
|----------|----------------|
| Standard turn | ~4K |
| Long file read (>300 lines) | +2-5K |
| Complex plan generation | ~6-8K |
| Code review with context | ~5-8K |

---

## Validation Rules

**CI will block PRs missing:**
- [ ] Engineer Metrics section
- [ ] Planning (Plan) row with actual numbers
- [ ] Estimated vs Actual comparison

**SR Engineer will reject:**
- [ ] Placeholder values ("X" instead of numbers)
- [ ] Missing Planning Notes
- [ ] Incomplete Implementation Summary in task file
