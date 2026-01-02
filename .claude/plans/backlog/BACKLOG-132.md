# BACKLOG-132: Mandatory Worktree for Parallel/Background Agents

**Priority:** CRITICAL
**Category:** Process / Agent Workflow
**Status:** Completed
**Created:** 2026-01-02
**Completed:** 2026-01-02
**Implementation:** TASK-913, PR #274
**Source:** SPRINT-014 Incident - ~18M tokens burned due to race condition

---

## Problem Statement

Two engineer agents (TASK-906 and TASK-908) were spawned to run in parallel but BOTH worked in the same directory (`/Users/daniel/Documents/Mad`). This caused:

1. **File conflicts** - Both agents editing the same files
2. **Edit tool failures** - Strings changed by one agent, causing match failures for the other
3. **Retry loops** - Agents retrying failed edits hundreds of times
4. **Massive token burn** - ~18M tokens consumed vs ~35K estimated (500x overrun)

### Root Cause

The `engineer.md` instructions say:
> "Worktree Workflow **(when PM specifies parallel execution)**"

This made worktrees **opt-in** rather than **mandatory** for background agents. The PM didn't explicitly specify worktrees, so agents used the "Standard Workflow" (same directory).

---

## Solution

### 1. Make Worktree MANDATORY for Background Agents

**Change engineer.md rule from:**
> "when PM specifies parallel execution"

**To:**
> "ALWAYS use worktrees when running as a background agent (run_in_background: true)"

### 2. Add Pre-Flight Directory Check

Before ANY file modifications, background agents MUST:

```bash
# MANDATORY PRE-FLIGHT CHECK
# If cwd is /path/to/Mad (main repo), STOP and create worktree first
if [[ "$(pwd)" == *"/Mad" ]] && [[ ! "$(pwd)" == *"/Mad-task-"* ]]; then
  echo "ERROR: Cannot work in main repo directory. Create worktree first."
  exit 1
fi
```

### 3. PM Must Include Worktree Path in Agent Prompt

When spawning engineer agents for parallel work, PM MUST specify:

```markdown
**MANDATORY: Create worktree at /path/to/Mad-task-XXX BEFORE any implementation**
```

### 4. Agent Self-Check at Start

Engineer agent must verify isolation BEFORE any work:

```markdown
## Pre-Implementation Checklist
- [ ] Working directory is NOT the main repo
- [ ] Working directory is /path/to/Mad-task-XXX (isolated worktree)
- [ ] `git worktree list` shows my worktree
- [ ] No other agent is working in this directory
```

---

## Implementation Tasks

1. **Update `.claude/agents/engineer.md`:**
   - Change "when PM specifies" to "ALWAYS when background agent"
   - Add mandatory pre-flight directory check
   - Add blocking rule: "If in main repo, STOP immediately"

2. **Update PM workflow documentation:**
   - Add explicit worktree path to agent spawn prompts
   - Add verification step after spawning agents

3. **Add to CLAUDE.md (project instructions):**
   - Add warning about parallel agent race conditions
   - Reference this incident

---

## Acceptance Criteria

- [x] Engineer agents running in background ALWAYS create worktrees
- [x] Engineer agents BLOCK if they detect they're in the main repo directory
- [x] PM spawn prompts include explicit worktree path
- [ ] No future incidents of multiple agents in same directory (ongoing)

---

## Incident Cost

| Metric | Estimated | Actual | Overrun |
|--------|-----------|--------|---------|
| TASK-906 tokens | ~20K | ~4.9M | 245x |
| TASK-908 tokens | ~15K | ~13.4M | 893x |
| **Combined** | ~35K | ~18M | **514x** |

**Estimated cost:** ~$50-100+ in token usage for work that should have cost <$0.50

---

## References

- SPRINT-014 Batch 2 incident
- BACKLOG-130 (Sub-Agent Permission Auto-Denial) - similar class of agent workflow failure
- `.claude/agents/engineer.md` lines 109-131 (current worktree instructions)
