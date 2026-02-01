# Sprint Management Module

This module covers sprint lifecycle operations: creating sprints, monitoring execution, closing sprints, and moving tasks between sprints.

---

## Token Monitoring (MANDATORY - HOTFIX BACKLOG-136)

**CRITICAL: This section is non-negotiable. Failure to follow this workflow results in meaningless estimates.**

### The Problem

Engineers self-report token usage (~8K) but actual consumption is 100x+ higher (~800K-1.1M).

**Why this matters:**
- Token caps cannot be enforced without visibility
- Estimates are meaningless without real consumption data
- Budget forecasting impossible

### Required Workflow: After EVERY Engineer Agent Completes

1. **Get the agent task_id** (shown when spawning with Task tool)
   ```
   Agent spawned with task_id: a82dc40
   ```

2. **Check actual tokens via TaskOutput**
   ```
   TaskOutput(task_id="a82dc40", block=false)
   ```
   Look for: `"X new tokens"` in the output or `"Y new tools used, Z new tokens"`

3. **Compare to estimate**
   ```
   Task estimate: 10K tokens
   Actual: 595084 tokens
   Ratio: 59x (INCIDENT)
   ```

4. **Flag if actual > 4x estimate**
   - Update task file with actual tokens
   - Note in sprint tracking
   - Investigate root cause

5. **Update task file**
   ```markdown
   ### Engineer Metrics (ACTUAL)

   | Phase | Self-Reported | Actual (Monitored) |
   |-------|---------------|-------------------|
   | Implementation | ~8K | ~800K |
   | **Ratio** | - | **100x** |
   ```

### Token Monitoring Checklist

Before marking any engineer task complete:
- [ ] Retrieved agent task_id
- [ ] Checked TaskOutput for actual tokens
- [ ] Compared to estimate
- [ ] Flagged if >4x overrun
- [ ] Updated task file with actual tokens

### Why Engineers Can't Self-Report Accurately

Engineers see only:
- Text they generate (~1-5K tokens)
- File content they read (counts against context)

Engineers DON'T see:
- Tool call overhead (~100+ tokens per call)
- Context window accumulation
- Failed edit retries (each retry = full context)
- npm/bash verbose output (often 10-50K per command)
- File re-reads (same file read 3x = 3x tokens)

**Rule of thumb:** Actual consumption = 50-100x visible work.

---

## Estimate Integrity Rules (MANDATORY)

**CRITICAL: Estimates are historical data. Never modify them after sprint creation.**

### Why Estimates Must Stay Fixed

Estimates capture planning assumptions at sprint start. Changing them retroactively:
- Destroys ability to measure estimation accuracy
- Makes variance analysis meaningless
- Prevents learning from over/under-estimates

### Rules

1. **Never modify original estimates** in the "In Scope" table
   - Total Estimated tokens stays fixed
   - SR Review Overhead stays fixed
   - Grand Total stays fixed

2. **Billable Tokens = Actuals Only**
   - Leave as "-" until task is complete AND tokens are tracked
   - Never put estimates in this column
   - Only fill with actual monitored token consumption

3. **Mid-Sprint Additions**
   - Add new task row with `*(added mid-sprint)* ` note
   - Add footnote: `*Note: TASK-XXXX added mid-sprint (+~XK est.)*`
   - Do NOT modify original totals

### Example: Adding Task Mid-Sprint

**WRONG:**
```markdown
**Total Estimated:** ~165K tokens  <!-- Changed from 150K -->
```

**RIGHT:**
```markdown
| TASK-1780 | New Feature | ~15K | HIGH | 3 | *(added mid-sprint)*

**Total Estimated (implementation):** ~150K tokens  <!-- Unchanged -->

*Note: TASK-1780 added mid-sprint (+~15K est.)*
```

### Progress Tracking Table

| Column | Contains | When Filled |
|--------|----------|-------------|
| Status | TODO/IN_PROGRESS/MERGED | Real-time |
| Billable Tokens | **Actual** monitored tokens | After task complete |
| Duration | Actual time if tracked | After task complete |
| PR | PR number(s) | When PR created |

**NEVER put estimates in Billable Tokens column.**

---

## Creating a Sprint

### Prerequisites

1. Sprint plan reviewed by SR Engineer
2. All task files created
3. Dependency graph validated
4. Token caps set (4x upper estimate)

### Sprint Creation Checklist

- [ ] Sprint file created: `.claude/plans/sprints/SPRINT-XXX-slug.md`
- [ ] All task files created in `.claude/plans/tasks/`
- [ ] INDEX.md updated with sprint assignment
- [ ] **Backlog CSV updated** - All items have `sprint` column set
- [ ] Worktrees ready for parallel tasks (BACKLOG-132)

---

## Executing a Sprint

### Starting Tasks

1. Check dependency graph - only start tasks with no pending dependencies
2. For parallel tasks, create isolated worktrees
3. Spawn engineer agents with proper context
4. **Record agent task_id for token monitoring**

### Monitoring Progress

Every time you check on running agents:
1. TaskOutput with `block=false` to check status
2. If complete, check actual tokens
3. Update task files with real consumption
4. Flag overruns immediately

### Handling Overruns

If actual tokens > 4x estimate:

1. **Do NOT let the engineer continue unsupervised**
2. Check what's consuming tokens:
   - Edit retries? → Agent is struggling with edits
   - npm commands? → Unnecessary verbose output
   - File re-reads? → Context management issue
3. Document in task file
4. Adjust future estimates for similar tasks

---

## Closing a Sprint

### Sprint Closure Checklist

> **Incident Reference:** SPRINT-051/052 had 20+ orphaned PRs that were created but never merged, causing massive confusion.

**Full lifecycle reference:** `.claude/docs/shared/pr-lifecycle.md`

#### PR Verification (MANDATORY - Do First)

Before ANY other closure activity:

```bash
# Check for orphaned PRs
gh pr list --state open --search "TASK-"
gh pr list --state open --search "SPRINT-"
```

**A sprint CANNOT be closed if:**
- Any sprint-related PR is still open
- Any task has a PR in `OPEN` state (not `MERGED`)
- Any approved PR is waiting for merge

**For each open PR found:**
| PR State | Action |
|----------|--------|
| CI failing | Fix before closing sprint |
| Awaiting review | Complete review and merge |
| Approved but not merged | Merge immediately |
| Has conflicts | Resolve and merge |

**Verify all PRs are merged:**
```bash
# For each task's PR, verify state is MERGED
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED (not OPEN, not CLOSED)
```

#### Full Closure Checklist

- [ ] **PR Audit complete** - `gh pr list --state open` shows no sprint PRs
- [ ] **All PRs verified MERGED** - Not just approved, actually merged
- [ ] All task files have actual (monitored) token data
- [ ] Token variance analysis complete
- [ ] INDEX.md updated with completion
- [ ] Worktrees cleaned up
- [ ] Retrospective notes captured

### Retrospective Data Points

Capture for each task:
- Estimated tokens vs Actual tokens (monitored, not self-reported)
- Root cause of variance (if >50%)
- Lessons for future estimates

---

## Tracking Unplanned Work (MANDATORY)

**CRITICAL: Unplanned work must be documented AS IT HAPPENS, not reconstructed during sprint reviews.**

### Why Track Unplanned Work?

1. **Estimation Accuracy**: Unplanned work reveals gaps in initial scoping
2. **Future Prediction**: Patterns in unplanned work improve future estimates
3. **Sprint Velocity**: True velocity = planned + unplanned work
4. **Root Cause Analysis**: Tracking sources of unplanned work enables process improvements

### What Counts as Unplanned Work?

| Category | Example | Track As |
|----------|---------|----------|
| **Discovered Bug** | State machine wasn't wired into main.tsx | New TASK with `(unplanned)` tag |
| **Integration Gap** | Login button not connected to state machine | New TASK with `(unplanned)` tag |
| **Validation Discovery** | Returning users see onboarding again | New TASK with `(unplanned)` tag |
| **Review Finding** | SR Engineer finds type assertion issue | New TASK referencing review |
| **Scope Expansion** | Feature needs additional edge case handling | Update existing TASK, note in sprint file |
| **Dependency Discovery** | Task X requires Task Y to be done first | Add TASK Y as `(unplanned)` |

### Required Workflow: When Unplanned Work Arises

1. **Create Task File Immediately**
   ```markdown
   # TASK-XXX: <Title> (Unplanned)

   ## Source
   - **Discovered During:** TASK-YYY / Platform Validation / SR Engineer Review
   - **Root Cause:** <Why this wasn't in the original plan>
   - **Discovery Date:** YYYY-MM-DD
   ```

2. **Update Sprint File**
   Add to the "Unplanned Work" section (create if it doesn't exist):
   ```markdown
   ## Unplanned Work Log

   | Task | Source | Root Cause | Added Date |
   |------|--------|------------|------------|
   | TASK-XXX | TASK-YYY validation | Integration not wired | 2026-01-04 |
   ```

3. **Update INDEX.md**
   - Add task with sprint assignment
   - Mark as `(unplanned)` in notes

4. **Track Metrics Separately**
   Unplanned tasks should be tracked separately for estimation analysis:
   - Planned tasks: used for estimation accuracy
   - Unplanned tasks: used for "discovery buffer" calculation

### Sprint File Unplanned Work Section

Every sprint file MUST have this section (add during sprint if missing):

```markdown
## Unplanned Work Log

| Task | Source | Root Cause | Added Date | Impact |
|------|--------|------------|------------|--------|
| - | - | - | - | - |

### Unplanned Work Summary

| Metric | Value |
|--------|-------|
| Unplanned tasks | 0 |
| Unplanned PRs | 0 |
| Unplanned lines changed | 0 |
| Root causes | - |
```

### Discovery Buffer Calculation

After each sprint, calculate the discovery buffer:

```
Discovery Buffer = Unplanned Work / Planned Work

Example:
- Planned: 6 tasks, ~150K tokens
- Unplanned: 4 tasks, ~50K tokens
- Discovery Buffer: 4/6 = 67% or 50K/150K = 33%

Future Sprint Adjustment:
- If discovery buffer > 30%, reduce planned scope by 20%
- If discovery buffer > 50%, reduce planned scope by 30%
```

---

## Investigation-First Pattern (for Bug Fix Sprints)

**Source:** SPRINT-061 - Saved ~17K tokens by avoiding unnecessary TASK-1406 implementation.

### When to Use

Use investigation-first for sprints where:
- Root cause is unclear
- Multiple possible causes exist
- "Bugs" may already be fixed or not exist

### Structure

```
Phase 1: Investigation (Parallel)
  - TASK-X00: Investigate issue A
  - TASK-X01: Investigate issue B
  - TASK-X02: Investigate issue C

Phase 2: Implementation (Based on Findings)
  - TASK-X03: Fix for A (if investigation confirms bug)
  - TASK-X04: Fix for B (if investigation confirms bug)
  - etc.
```

### Key Rules

1. **Investigation tasks are read-only** - No file modifications, safe to parallelize
2. **Define implementation tasks tentatively** - Mark as "pending investigation"
3. **Defer if no bug found** - Don't implement fixes for non-existent bugs
4. **Update backlog immediately** - Change status to `deferred` with reason

### PM Checkpoint After Investigation Phase

Before starting implementation phase:
1. Review all investigation findings
2. For each planned implementation task, decide:
   - **PROCEED**: Bug confirmed, fix needed
   - **MODIFY**: Different fix needed (update task file)
   - **SKIP**: No bug found, mark backlog item as `deferred`
3. Update sprint file with decisions
4. Notify user of any scope changes

---

## Moving Tasks Between Sprints

### When to Move a Task

- Sprint scope too large
- Unexpected blockers
- Priority shift
- Dependency issues

### How to Move

1. Update task file with new sprint assignment
2. Update INDEX.md
3. Update both sprint files
4. Note reason for move in decision log
