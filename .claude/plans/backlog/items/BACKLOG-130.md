# BACKLOG-130: Sub-Agent Permission Auto-Denial Incident

**Status:** Pending
**Priority:** High
**Category:** infra/process
**Created:** 2026-01-01
**Sprint:** Discovered during SPRINT-012

---

## Incident Summary

During SPRINT-012 execution, 5 engineer sub-agents were spawned in parallel to implement documentation tasks. All 5 agents entered infinite retry loops due to tool permissions being auto-denied, burning approximately **9.6 million tokens** before the issue was identified.

---

## Timeline

| Time | Event |
|------|-------|
| T+0 | PM created SPRINT-012 with 5 documentation tasks |
| T+5m | SR Engineer approved sprint plan |
| T+7m | 5 engineer agents spawned in parallel with worktrees |
| T+10m | First status check: all agents "running", reading files |
| T+15m | Second status check: agents still running, high token counts |
| T+25m | Investigation: agents stuck in retry loops |
| T+30m | Root cause identified: permission auto-denial |

---

## Root Cause Analysis

### What Happened

1. Engineer agents were spawned using `Task` tool with `subagent_type="engineer"`
2. Agents read task files and target files successfully (Read tool works)
3. Agents attempted to use Edit/Write tools to make changes
4. **Tool permissions were auto-denied** with message: "Permission to use [Tool] has been auto-denied (prompts unavailable)"
5. Agents retried the same operation repeatedly, burning tokens each time
6. No error surfaced to the parent conversation - agents appeared to be "running"

### Why It Happened

- Sub-agents run in background mode (`run_in_background: true`)
- Write/Edit tools require user approval (interactive prompt)
- Background agents cannot display interactive prompts to the user
- The system auto-denies permissions instead of failing cleanly
- Agents have no circuit breaker to stop after N failed attempts

### Evidence

Agent output logs show repeated identical tool calls:
```
[Tool: Write] {"file_path":"...","content":"..."}
[Tool: Write] {"file_path":"...","content":"..."}  # Same content
[Tool: Write] {"file_path":"...","content":"..."}  # Same content
... (15+ times)
```

---

## Impact

### Token Waste

| Agent | Task | Tokens Burned |
|-------|------|---------------|
| a331a5d | TASK-805 | ~68,000 |
| a51d515 | TASK-806 | ~1,050,000 |
| a08af27 | TASK-807 | ~3,500,000 |
| a4b6a5a | TASK-808 | ~3,400,000 |
| a2ba871 | TASK-809 | ~1,600,000 |
| **Total** | | **~9,618,000** |

### Time Waste

- ~30 minutes of wall-clock time spent on failed execution
- Investigation and documentation: ~15 minutes
- Total: ~45 minutes of debugging

### Tasks Blocked

All 5 SPRINT-012 tasks remain unimplemented:
- TASK-805: Debugging Metrics Enforcement
- TASK-806: Sprint Completion Checklist
- TASK-807: Sprint Capacity Limits
- TASK-808: Type Verification Checklist
- TASK-809: CI Troubleshooting Docs

---

## Immediate Resolution

1. Cancel/ignore stuck sub-agents
2. Clean up orphaned worktrees
3. Implement tasks directly in parent conversation (has permissions)
4. Document this incident for future prevention

---

## Prevention Recommendations

### Short-term (Workaround)

1. **Don't use background agents for write operations** - Only use `run_in_background: true` for read-only tasks (exploration, search, analysis)
2. **Use foreground agents for implementation** - Run engineer agents without `run_in_background` so they can prompt for permissions
3. **Add explicit guidance to engineer.md** - Warn about this limitation

### Medium-term (Process)

1. **Pre-flight permission check** - Before spawning implementation agents, verify required tools are pre-approved
2. **Agent circuit breaker** - Add retry limits to agent prompts ("if tool fails 3 times, report error and stop")
3. **Token budgets per agent** - Set maximum token spend per sub-agent

### Recommended Fix (Configuration)

**Pre-approve Write/Edit for engineer agents in project settings.**

Rationale: Since ALL engineer work goes through SR Engineer review before merge, the quality gate is at PR review, not at tool execution. Pre-approving these tools:
- Eliminates permission prompts that can't be shown to background agents
- Maintains safety through mandatory SR Engineer PR review
- Enables parallel agent execution for multi-task sprints

Implementation:
```
# In .claude/settings.json or project config
{
  "allowedTools": ["Write", "Edit", "Bash"]
}
```

### Long-term (Infrastructure)

1. **Sub-agent permission inheritance** - Allow parent conversation permissions to flow to sub-agents
2. **Clean failure mode** - When permissions are denied, agent should error cleanly instead of retrying
3. **Progress visibility** - Surface permission denials to parent conversation immediately

---

## Backlog Items Created

| ID | Title | Priority |
|----|-------|----------|
| BACKLOG-130 | This incident report | High |
| (pending) | Add sub-agent permission guidance to engineer.md | Medium |
| (pending) | Add retry limits to agent prompts | Medium |

---

## Lessons Learned

1. **Background agents can't write** - Permission prompts require foreground execution
2. **Token waste accumulates silently** - No visibility into sub-agent spend until manual check
3. **Parallel execution amplifies problems** - 5 agents failing = 5x token waste
4. **Documentation tasks are ironic** - A sprint to improve process documentation was blocked by a process gap

---

## Cross-References

- Sprint: `SPRINT-012-process-docs-improvements.md`
- Related: BACKLOG-126 (debugging metrics) - would have caught this if implemented
- Agent docs: `.claude/agents/engineer.md`

---

## Changelog

- 2026-01-01: Created incident report
