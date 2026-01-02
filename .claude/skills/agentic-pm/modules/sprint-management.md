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

- [ ] All PRs merged
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
