# Engineer Workflow Checklist

**MANDATORY**: Follow these steps for every task. SR Engineer will verify completion before approving PR.

---

## Quick Reference

```
1. BRANCH  → Create from develop
2. PLAN    → Invoke Plan agent (MANDATORY)
3. TRACK   → Note start time, count turns
4. IMPLEMENT → Do the work
5. METRICS → Add to PR description (including Plan metrics)
6. PR      → Create when ready for review
7. SR REVIEW → Wait for SR Engineer
8. PM      → SR passes to PM for next task
```

---

## Step 1: Create Branch

**Before writing any code:**

```bash
# Always start from develop
git checkout develop
git pull origin develop

# Create feature branch with task ID
git checkout -b fix/task-XXX-description
# or: feature/task-XXX-description
# or: claude/task-XXX-description
```

**Naming Convention:**
- `fix/task-XXX-...` for bug fixes
- `feature/task-XXX-...` for new features
- `claude/task-XXX-...` for AI-assisted work

---

## Step 2: Plan-First Protocol (MANDATORY)

**Before ANY implementation**, invoke the Plan agent to create an implementation plan.

Use the Task tool with `subagent_type="Plan"` and provide:
- Task context (file, branch, objective, constraints)
- Expected deliverables from task file
- Architecture boundaries to respect

**Track Plan Agent Metrics:**

| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |

**Review the plan** from your Engineer perspective:
- [ ] Files to modify are correct
- [ ] Implementation sequence is logical
- [ ] Test strategy is complete
- [ ] Architecture boundaries respected

**If issues found**, re-invoke Plan agent with revision request.

**BLOCKING**: Do NOT start implementation until you have an approved plan.

See `.claude/agents/engineer.md` for detailed Plan-First Protocol.

---

## Step 3: Track Metrics (Start Timer)

**Before reading the task file:**

Note your start time. You will track:

| Metric | What to Count |
|--------|---------------|
| **Turns** | Number of user messages/prompts |
| **Tokens** | Estimate: Turns × 4K |
| **Time** | Wall-clock active work time |

**Tip:** Keep a simple tally as you work:
```
Start: 2:00 PM
Turns: |||| |||| || (12)
```

---

## Step 4: Implement the Task

1. Read the task file (`.claude/plans/tasks/TASK-XXX.md`)
2. Understand requirements and acceptance criteria
3. Implement the solution following your approved plan
4. Run tests locally: `npm test`
5. Run type check: `npm run type-check`
6. Run lint: `npm run lint`

**STOP if you encounter blockers** - ask PM before proceeding.

---

## Step 5: Complete Task File Summary

**Before creating PR**, update the task file's Implementation Summary:

```markdown
## Implementation Summary (Engineer-Owned)

*Completed: YYYY-MM-DD*

### Checklist
[Mark all items complete]

### Results
- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **PR**: [will add after PR created]

### Notes
**Deviations from plan:** [explain any changes]
**Issues encountered:** [document challenges]
```

---

## Step 6: Create PR with Metrics

**Only create PR when:**
- [ ] Plan agent approved and metrics recorded
- [ ] All tests pass locally
- [ ] Type check passes
- [ ] Lint passes
- [ ] Task file summary is complete

**Create PR:**
```bash
git add .
git commit -m "type(scope): description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push -u origin your-branch-name
gh pr create --base develop --title "..." --body "..."
```

**PR Description MUST include Engineer Metrics:**

```markdown
---

## Engineer Metrics: TASK-XXX

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Planning Notes:** [plan revisions if any, key decisions]
**Implementation Notes:** [any context]

**Estimated vs Actual:**
- Est: X turns, XK tokens
- Actual: X turns, ~XK tokens (Plan: X, Impl: X, Debug: X)
```

---

## Step 7: Wait for CI and Debug Failures

1. **Wait for CI to complete:**
   ```bash
   gh pr checks <PR-NUMBER> --watch
   ```

2. **If CI fails - Debug and Fix:**

   This is part of your work! Track debugging separately from implementation.

   ```bash
   # View failure details
   gh run view <RUN-ID> --log-failed

   # Or check on GitHub Actions tab
   ```

   **Common CI failures:**
   - Test failures → Run `npm test` locally, fix, push
   - Type errors → Run `npm run type-check`, fix, push
   - Lint errors → Run `npm run lint --fix`, commit, push
   - Build failures → Check logs, often dependency issues

   **Track debugging time:**
   - Note when you start debugging
   - Count turns spent fixing CI issues
   - Add to "Debugging (Debug)" row in metrics

   **After fixing, wait for CI again:**
   ```bash
   gh pr checks <PR-NUMBER> --watch
   ```

3. **Once ALL checks pass, request SR review:**
   - Use the `senior-engineer-pr-lead` agent
   - Provide PR URL and task summary
   - Include your Engineer Metrics

**Example SR Review Request:**
```
Please review PR #XXX for merge readiness.

**PR URL:** https://github.com/org/repo/pull/XXX
**Task:** TASK-XXX
**Summary:** [what was done]
**Engineer Metrics:** X turns, ~XK tokens, X min

Please verify, add SR metrics, approve and merge.
```

---

## Step 8: SR Engineer Reviews and Merges

The SR Engineer will:
1. Verify Engineer Metrics are present
2. Review code quality
3. Add SR Engineer Metrics to PR
4. Approve and merge
5. **Pass to PM for next task assignment**

**You are done when:**
- PR is merged
- SR Engineer has notified PM

---

## What NOT To Do

| Don't | Why |
|-------|-----|
| Skip branch creation | Makes tracking and rollback impossible |
| Forget to track metrics | PM needs data for estimation calibration |
| Create PR without metrics | SR Engineer will block it |
| Merge your own PR | Only SR Engineer merges |
| Start next task without PM | PM assigns based on priorities |

---

## Checklist Template

Copy this to your task file or notes:

```
## Engineer Checklist: TASK-XXX

### Pre-Work
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file

### Plan-First (MANDATORY)
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan from Engineer perspective
- [ ] Plan approved (or revised and re-approved)
- [ ] Plan agent metrics recorded (turns, tokens, time)

### Implementation
- [ ] Code complete (following approved plan)
- [ ] Tests pass locally
- [ ] Type check passes
- [ ] Lint passes

### PR Submission
- [ ] Task file summary updated
- [ ] PR created with Engineer Metrics (including Plan metrics)
- [ ] CI passes
- [ ] SR Engineer review requested

### Completion
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

---

## Questions?

- **Workflow issues:** Ask PM
- **Technical blockers:** Ask SR Engineer
- **Task clarification:** Ask PM before starting
