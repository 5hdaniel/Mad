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

**Full reference:** `.claude/docs/shared/plan-first-protocol.md`

**Before ANY implementation**, invoke the Plan agent to create an implementation plan.

**Quick Steps:**
1. Invoke Plan agent with task context
2. Review plan for feasibility
3. Track Plan agent metrics (turns, tokens, time)
4. Only proceed after plan is approved

**BLOCKING**: Do NOT start implementation until you have an approved plan.

---

## Step 3: Prepare for Metrics Capture

**IMPORTANT:** Metrics are now auto-captured via SubagentStop hook.

Your only responsibility:
1. **Record your agent_id immediately** when the Task tool returns
2. After completion, retrieve metrics using the grep command

```bash
# After agent completes, find your metrics:
grep "<your_agent_id>" .claude/metrics/tokens.jsonl | jq '.'
```

The hook automatically captures:
- Total tokens (input + output + cache)
- Duration (seconds)
- API calls

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

## Step 5: Complete Task File Summary (MANDATORY)

**Before creating PR**, update the task file's Implementation Summary with your agent_id and auto-captured metrics.

**BLOCKING**: SR Engineer will reject PRs with incomplete task file summaries.

```markdown
## Implementation Summary (Engineer-Owned)

*Completed: YYYY-MM-DD*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist
[Mark all items complete]

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~XK vs Actual ~XK (X% over/under)

### Notes
**Deviations from plan:** [explain any changes from approved plan]
**Issues encountered:** [document challenges, blockers, unexpected complexity]
```

**Why This Matters:**
- PM uses these metrics for estimation calibration
- Auto-captured data is objective (no self-reporting errors)
- Pattern analysis requires documented deviations

**Required Fields Summary:**

| Field | Required | Used For |
|-------|----------|----------|
| Agent ID | Yes | Metrics lookup |
| Total Tokens | Yes | Resource tracking |
| Variance | Yes | Estimation calibration |
| Deviations from plan | Yes | Pattern analysis |
| Issues encountered | Yes | Quality tracking |

---

## Step 6: Create PR with Metrics

**Metrics format:** `.claude/docs/shared/metrics-templates.md`

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

**PR Description MUST include Engineer Metrics** - see the metrics templates doc for exact format.

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

## Parallel Task Execution

Sometimes PM will assign multiple tasks to run in parallel. This is only safe when SR Engineer has reviewed and approved parallel execution.

### Recommended: Git Worktree Pattern

**SPRINT-009 Lesson:** Git worktrees work well for parallel independent tasks. Each worktree is a separate working directory with its own branch, preventing conflicts.

**Setup (one-time):**
```bash
# From main repository
cd /path/to/Mad

# Create worktrees for parallel tasks
git worktree add ../Mad-TASK-601 feature/TASK-601-description
git worktree add ../Mad-TASK-602 feature/TASK-602-description
```

**Benefits:**
- Isolated working directories (no uncommitted file conflicts)
- Each worktree has its own branch
- Can run parallel Claude sessions, one per worktree
- Git handles tracking automatically

**Cleanup after merge:**
```bash
git worktree remove ../Mad-TASK-601
git worktree remove ../Mad-TASK-602
```

### When You're Assigned Parallel Tasks

**You will be told explicitly:**
```
Parallel Assignment: TASK-XXX and TASK-YYY
These tasks are approved for parallel execution.
Create separate branches for each.
Use worktrees for isolation (recommended).
```

**Rules for parallel work:**
1. Each task gets its own branch (from develop)
2. Use worktrees for isolation (recommended)
3. Do NOT modify files that aren't listed in your task
4. If you discover shared file needs, STOP and notify PM
5. Submit PRs independently - don't wait for the other task

### When Parallel Goes Wrong

**Warning signs:**
- You need to modify a file not in your task scope
- Git shows conflicts when you pull develop
- Another task's PR merged changes you depend on

**If this happens:**
1. STOP work immediately
2. Notify PM: "Parallel conflict detected"
3. Wait for PM/SR guidance on resolution

### Why Same-Session Parallel Can Fail

When two agents run in the **same Claude Code session**, they share:
- The same working directory
- The same uncommitted file state

**What happens:**
1. Agent A writes to `databaseService.ts` (uncommitted)
2. Agent B reads `databaseService.ts` - sees A's uncommitted changes
3. Agent B tries to edit - conflicts with A's version
4. Both agents re-read/re-write in a loop, burning tokens

**This is NOT a git branch problem** - branches only matter at commit/merge time.

**Safe parallel requires:**
- Separate working directories (different terminal sessions)
- OR truly isolated files (no overlap)
- OR sequential execution with commits between tasks

### Token Burn Early Warning

If a parallel task exceeds **2x estimated tokens** in first 10% of work:
- This may indicate agent conflict (shared file loop)
- Notify PM immediately
- Do not continue burning tokens hoping it resolves

## What NOT To Do

| Don't | Why |
|-------|-----|
| Skip branch creation | Makes tracking and rollback impossible |
| Forget to track metrics | PM needs data for estimation calibration |
| Create PR without metrics | SR Engineer will block it |
| Merge your own PR | Only SR Engineer merges |
| Start next task without PM | PM assigns based on priorities |
| Modify files outside task scope | Can cause parallel conflicts |
| Continue when tokens exceed 2x estimate | Early warning of problems |

---

## Checklist Template

Copy this to your task file or notes:

```
## Engineer Checklist: TASK-XXX

### Pre-Work
- [ ] Created branch from develop
- [ ] Read task file

### Plan-First (MANDATORY)
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan from Engineer perspective
- [ ] Plan approved (or revised and re-approved)

### Implementation
- [ ] Code complete (following approved plan)
- [ ] Tests pass locally
- [ ] Type check passes
- [ ] Lint passes

### Metrics (Auto-Captured)
- [ ] Agent ID recorded immediately when Task tool returned
- [ ] Metrics retrieved: grep "<agent_id>" .claude/metrics/tokens.jsonl
- [ ] Variance calculated (PM Est vs Actual)
- [ ] Deviations from plan documented
- [ ] Issues encountered documented

### PR Submission
- [ ] Task file summary updated with agent_id and metrics
- [ ] PR created
- [ ] CI passes
- [ ] SR Engineer review requested

### Completion
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

---

## Enforcement Mechanisms

This workflow is **technically enforced** through multiple mechanisms:

### 1. CI Validation (Automated)

The `pr-metrics-check.yml` workflow automatically validates PRs:

| Check | Validation | Failure Action |
|-------|------------|----------------|
| Engineer Metrics section | Must be present | PR blocked |
| Plan-First Protocol section | Must be present | PR blocked |
| Metrics table structure | Must have correct format | PR blocked |
| Planning (Plan) row | Must exist | PR blocked |
| Estimated vs Actual | Must be present | PR blocked |

**Bypassing CI (emergency only):**
- Add `[skip-metrics]` to PR title
- Dependabot PRs are automatically exempt
- **WARNING:** Manual bypasses are logged and reviewed

### 2. SR Engineer Verification (Manual)

The SR Engineer performs additional verification beyond CI:

- **Plan-First Protocol checkboxes** - Must be checked, not empty
- **Metrics values** - Must be real numbers, not "X" placeholders
- **Planning Notes** - Must document any plan revisions
- **Implementation Summary** - Must be complete in task file

### 3. Workflow Violations

| Violation | Detection Method | Consequence |
|-----------|------------------|-------------|
| Missing Engineer Metrics | CI automation | PR auto-blocked |
| Missing Plan-First Protocol | CI automation | PR auto-blocked |
| Placeholder metrics ("X") | SR Engineer review | PR rejected |
| Skipped planning phase | SR Engineer review | PR rejected, must retroactively plan |
| Incomplete Implementation Summary | SR Engineer review | PR rejected |

### 4. Violation Recovery

If you violate the workflow:

1. **Skipped Plan-First Protocol:**
   - Invoke Plan agent retroactively
   - Document as "DEVIATION: Plan created post-implementation"
   - Include retroactive plan metrics

2. **Missing Metrics:**
   - Calculate from your session history
   - Document estimation method in notes

3. **CI Blocking PR:**
   - Update PR description with required sections
   - Push any additional commits
   - Wait for CI to re-run

---

## Questions?

- **Workflow issues:** Ask PM
- **Technical blockers:** Ask SR Engineer
- **Task clarification:** Ask PM before starting
- **Enforcement questions:** See `.claude/agents/engineer.md` for details
