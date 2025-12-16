# Engineer Workflow Checklist

**MANDATORY**: Follow these steps for every task. SR Engineer will verify completion before approving PR.

---

## Quick Reference

```
1. BRANCH  → Create from develop
2. TRACK   → Note start time, count turns
3. IMPLEMENT → Do the work
4. METRICS → Add to PR description
5. PR      → Create when ready for review
6. SR REVIEW → Wait for SR Engineer
7. PM      → SR passes to PM for next task
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

## Step 2: Track Metrics (Start Timer)

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

## Step 3: Implement the Task

1. Read the task file (`.claude/plans/tasks/TASK-XXX.md`)
2. Understand requirements and acceptance criteria
3. Implement the solution
4. Run tests locally: `npm test`
5. Run type check: `npm run type-check`
6. Run lint: `npm run lint`

**STOP if you encounter blockers** - ask PM before proceeding.

---

## Step 4: Complete Task File Summary

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

## Step 5: Create PR with Metrics

**Only create PR when:**
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
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context]

**Estimated vs Actual:**
- Est: X turns, XK tokens
- Actual: X turns, ~XK tokens
```

---

## Step 6: Wait for CI and Debug Failures

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

## Step 7: SR Engineer Reviews and Merges

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

### Implementation
- [ ] Code complete
- [ ] Tests pass locally
- [ ] Type check passes
- [ ] Lint passes

### PR Submission
- [ ] Task file summary updated
- [ ] PR created with Engineer Metrics
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
