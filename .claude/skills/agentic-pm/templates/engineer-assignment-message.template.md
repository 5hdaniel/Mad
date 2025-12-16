# Engineer Assignment: TASK-XXX

> **NON-NEGOTIABLE: METRICS TRACKING REQUIRED**
>
> You MUST track and report metrics at task completion. This is mandatory.
> - Track **turns**, **tokens**, and **time** for each phase (implementation, PR review, debugging)
> - Report using the template in "Completion Reporting" section below
> - Start tracking NOW - note your start time before reading further
>
> **Start Time:** _______________

---

## Summary

You are assigned to **TASK-XXX: <Title>**.

## Task File Location

```
.claude/plans/tasks/TASK-XXX-<slug>.md
```

Read the full task file before starting.

## Quick Context

- **Goal**: <1 sentence>
- **Phase**: Phase <N>
- **Dependencies**: <none / TASK-YYY must complete first>
- **Conflicts with**: <none / TASK-ZZZ - do not run in parallel>

## Key Points

1. **Non-goals**: Review the non-goals section carefully. Do not expand scope.
2. **Integration**: Your work will be used by <TASK-AAA, TASK-BBB>.
3. **Testing**: <specific testing requirements>
4. **Branch**: Create `feat/<ID>-<slug>` from `<base branch>`.

## Workflow

1. Read the full task file
2. Create your feature branch
3. Implement according to acceptance criteria
4. Complete the Implementation Summary section
5. Run all CI checks locally
6. Open PR targeting `<branch>`
7. Have senior-engineer-pr-lead agent review the PR
8. After merge, report completion metrics (see below)

## Completion Reporting (REQUIRED)

After your task is complete and PR is merged, you MUST report:

```
## Task Completion Report: TASK-XXX

**Status:** ✅ Complete
**PR:** #<number>

### Metrics Breakdown

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | <N> | ~<X>K | <X> min |
| PR Review (sr-eng agent) | <N> | ~<X>K | <X> min |
| Debugging/Fixes | <N> | ~<X>K | <X> min |
| **Total** | <N> | ~<X>K | <X> min |

### Variance Notes
(if significantly different from estimate of <X> turns, <X>K tokens)
<explanation>
```

**How to track:**
- **Turns**: Count user message prompts (yours = implementation, agent spawns = PR review)
- **Tokens**: Estimate based on conversation length (~4 tokens/word, or use Claude Code token counter if available)
- **Time**: Note start/end timestamps for each phase

This data is used to improve future estimates. The PM will update the backlog index with these metrics.

## Stop and Ask If

- You're unsure about acceptance criteria
- You discover work outside the defined scope
- You encounter blockers from dependencies
- You need to deviate from the implementation notes

## Communication

- Questions: Post in <channel/thread>
- Blockers: Escalate immediately
- Updates: <frequency/channel>

## Timeline

- **Start**: <date/time>
- **Integration checkpoint**: <date/time>
- **Phase deadline**: <date/time>

---

Good luck! Ping if you have questions.
