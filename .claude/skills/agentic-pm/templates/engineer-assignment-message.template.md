# Engineer Assignment: TASK-XXX

> **NON-NEGOTIABLE: METRICS TRACKING REQUIRED**
>
> You MUST track and report YOUR OWN metrics at task completion. This is mandatory.
> - Track **turns**, **tokens**, and **time** for YOUR implementation work
> - Report using the template in "Engineer Metrics Reporting" section below
> - Start tracking NOW - note your start time before reading further
> - Senior Engineer will add their own metrics separately
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
7. Wait for CI to pass
8. **Add YOUR Engineer Metrics to PR description** (see below)
9. Request Senior Engineer review
10. Senior Engineer reviews, adds their metrics, approves, and merges

## Engineer Metrics Reporting (REQUIRED)

**TIMING: Add your metrics AFTER CI passes, BEFORE requesting SR review.**

Add this to your PR description once CI is green:

```markdown
---

## Engineer Metrics: TASK-XXX

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context about your implementation]
```

**Maps to INDEX.md columns:**
- `Impl Turns | Impl Tokens | Impl Time` → Implementation phase
- `Debug Turns | Debug Tokens | Debug Time` → Debugging phase

**What YOU track:**
- **Turns**: Your prompts during implementation and debugging
- **Tokens**: ~4K per turn (or use token counter if available)
- **Time**: Wall-clock time for YOUR active work (not CI wait time)

**What you do NOT track:**
- PR metrics (Senior Engineer reports as `PR Turns | PR Tokens | PR Time`)
- Time waiting for CI to run

After you add your metrics, request Senior Engineer review. They will:
1. Review your code
2. Add their own SR Engineer Metrics
3. Approve and merge the PR

See `.claude/docs/METRICS-PROTOCOL.md` for full protocol details.

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
