# BACKLOG-136: PM Token Monitoring Dashboard (HOTFIX)

**Priority:** CRITICAL
**Status:** NOT STARTED
**Category:** process
**Sprint:** HOTFIX (before SPRINT-016)

---

## Problem Statement

Engineers self-report ~8K tokens but actual consumption is 100x+ higher (~800K-1.1M tokens).

**Root Cause:** Engineers have NO visibility into actual token usage. The "token cap" feature (TASK-914) cannot work if engineers can't see their real consumption.

**Impact:**
- TASK-914 and TASK-915 each consumed ~1M tokens against ~10K estimates
- PM estimates are meaningless without real consumption data
- Token caps cannot be enforced without visibility
- Budget forecasting impossible

---

## Proposed Solution

PM must monitor actual token consumption from the orchestrator level, not rely on engineer self-reporting.

### Implementation Options

**Option A: Per-Agent File Output** (Simplest)
When spawning engineer agents:
```
# Track agent task_id
Agent spawned: task_id = a82dc40

# After completion, check actual tokens
Read /tmp/claude/-Users-daniel-Documents-Mad/tasks/a82dc40.output
# Parse "X new tokens" from progress messages
```

**Option B: Token Tracking in Agent Spawn**
Add token tracking to PM workflow:
1. Record estimated tokens from task file
2. Record agent task_id at spawn
3. After agent completes, check TaskOutput for actual tokens
4. Compare and flag overruns in task file

### Minimum Viable Hotfix

Add to PM workflow documentation (`.claude/skills/agentic-pm/modules/sprint-management.md`):

```markdown
## Token Monitoring (MANDATORY)

After EVERY engineer agent completes:

1. Check TaskOutput for actual tokens consumed
2. If actual > 4x estimate: FLAG as incident
3. Update task file with actual tokens
4. Add to sprint retro data

Example check:
- Task estimate: 10K tokens
- Agent task_id: a82dc40
- Actual: "595084 new tokens" (59x overrun!)
- Action: Flag, investigate, update estimates
```

---

## Acceptance Criteria

- [ ] PM documents token monitoring workflow
- [ ] PM checks actual tokens after EVERY engineer agent completes
- [ ] Overruns >4x are flagged immediately
- [ ] Task files updated with actual (not self-reported) tokens
- [ ] Sprint retros include actual token data

---

## Effort Estimate

**Category:** process (documentation)
**Estimate:** 1-2 turns, ~5K tokens
**Urgency:** IMMEDIATE - before spawning more engineer agents

---

## Notes

This is a process/documentation hotfix, not a code change. The Claude Code tool already tracks tokens - we just need PM to check it.

The 100x discrepancy discovered in TASK-914/TASK-915 means ALL historical estimates are unreliable until we have real consumption data.
