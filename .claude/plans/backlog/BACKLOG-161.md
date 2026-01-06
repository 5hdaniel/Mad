# BACKLOG-161: Agent Anti-Loop Enforcement (Exploration + Verification)

**Created**: 2026-01-05
**Priority**: Critical
**Category**: infra
**Status**: Pending

---

## Problem

Engineer agents can get stuck in TWO types of loops:

1. **Exploration Loop**: Reading files endlessly before writing code
2. **Verification Loop**: Running type-check/tests repeatedly after code is written

SPRINT-025 TASK-976 burned **14.2M tokens** (2849x over estimate) primarily in a verification loop - the agent kept running `npm run type-check` and reading files trying to "fix" a type error that was already resolved.

## Root Causes

1. **No tool call limits** - Agent can make unlimited Read/Bash calls
2. **No "give up" threshold** - Agent tries forever instead of asking for help
3. **No loop detection** - Same command repeated 50+ times goes unnoticed
4. **Background execution** - No human monitoring until too late
5. **Perfectionism** - Agent won't commit until everything "feels right"
6. **PM monitoring failure** - PM launched agent and didn't check until USER noticed the problem

## Proposed Solutions

### Solution 1: PostToolUse Hook with Loop Detection

```bash
#!/bin/bash
# .claude/hooks/loop-detector.sh

TOOL="$1"
AGENT_ID="${CLAUDE_AGENT_ID:-default}"
STATE_FILE="/tmp/claude-agent-${AGENT_ID}.state"

# Initialize state file
touch "$STATE_FILE"

# Track tool usage
if [[ "$TOOL" =~ Read|Glob|Grep ]]; then
  EXPLORE_COUNT=$(($(grep "explore:" "$STATE_FILE" | cut -d: -f2) + 1))
  sed -i '' "s/explore:.*/explore:$EXPLORE_COUNT/" "$STATE_FILE" 2>/dev/null || echo "explore:$EXPLORE_COUNT" >> "$STATE_FILE"

  if [ "$EXPLORE_COUNT" -gt 20 ]; then
    echo "⚠️ WARNING: $EXPLORE_COUNT exploration calls. Start writing code or ask for help!" >&2
  fi

elif [[ "$TOOL" =~ Write|Edit ]]; then
  # Reset exploration counter on write
  sed -i '' "s/explore:.*/explore:0/" "$STATE_FILE" 2>/dev/null

elif [[ "$TOOL" == "Bash" ]]; then
  # Track repeated bash commands (verification loop)
  LAST_CMD=$(grep "lastcmd:" "$STATE_FILE" | cut -d: -f2-)
  CURRENT_CMD="$2"  # Command argument

  if [[ "$CURRENT_CMD" == "$LAST_CMD" ]]; then
    REPEAT_COUNT=$(($(grep "repeat:" "$STATE_FILE" | cut -d: -f2) + 1))
    sed -i '' "s/repeat:.*/repeat:$REPEAT_COUNT/" "$STATE_FILE" 2>/dev/null || echo "repeat:$REPEAT_COUNT" >> "$STATE_FILE"

    if [ "$REPEAT_COUNT" -gt 5 ]; then
      echo "🛑 STOP: You've run the same command $REPEAT_COUNT times. Either:" >&2
      echo "   1. The issue is fixed - commit and move on" >&2
      echo "   2. You're stuck - ask for help" >&2
      echo "   3. Try a DIFFERENT approach" >&2
    fi
  else
    sed -i '' "s/repeat:.*/repeat:0/" "$STATE_FILE" 2>/dev/null
    sed -i '' "s/lastcmd:.*/lastcmd:$CURRENT_CMD/" "$STATE_FILE" 2>/dev/null || echo "lastcmd:$CURRENT_CMD" >> "$STATE_FILE"
  fi
fi
```

### Solution 2: Engineer Agent Prompt Update

Add to `.claude/agents/engineer.md`:

```markdown
## Anti-Loop Rules (MANDATORY)

### Exploration Limits
- Read max 10 files before your first Write/Edit
- If you need more context, write a minimal implementation first, then iterate
- Don't try to understand the entire codebase - focus on what you're changing

### Verification Limits
- Run type-check/lint/test MAX 3 times for the same issue
- If it fails 3 times with the same error:
  1. Commit what you have with a TODO comment
  2. Document the issue in your PR
  3. Ask for help or move on

### When Stuck
- DO NOT repeat the same action hoping for different results
- DO say "I'm stuck on X, I've tried Y and Z"
- DO commit partial progress rather than burning tokens

### Background Agent Rule
- Check in every 30 minutes of work
- If making no progress for 15 minutes, STOP and report status
```

### Solution 3: Token Budget Kill Switch

Add to PM workflow:
- Set max token budget per task (e.g., 10x estimate)
- Monitor background agents every 30 minutes
- Kill agents exceeding budget with no output

### Solution 4: PM Background Agent Monitoring Protocol (MANDATORY)

**The hook is a safety net. Monitoring is the primary defense.**

When launching background agents, PM MUST:

```markdown
## Background Agent Launch Checklist

BEFORE launching:
- [ ] Note the estimated token budget (e.g., 5K)
- [ ] Set timer for 30-minute check-in
- [ ] Record agent task_id

AT 30-minute check-in:
- [ ] Check agent status: `TaskOutput --task_id=<id> --block=false`
- [ ] Verify progress: Has agent produced commits/PRs?
- [ ] Check token consumption: Is it within 5x estimate?
- [ ] If stuck: Kill agent, investigate, restart with guidance

NEVER:
- Launch and forget
- Wait for user to notice problems
- Assume "no news is good news"
```

**SPRINT-025 Failure Example:**
- Agent launched at T+0
- User noticed token burn at T+???
- PM only investigated AFTER user raised concern
- If user hadn't noticed, agent could have burned 100M+ tokens

## Acceptance Criteria

- [ ] Hook detects exploration loop (>20 Read/Glob/Grep without Write)
- [ ] Hook detects verification loop (>5 identical Bash commands)
- [ ] Warning messages injected to agent context
- [ ] Engineer agent prompt includes anti-loop rules
- [ ] PM checklist includes "check file overlap before parallel execution"
- [ ] Background agent monitoring documented
- [ ] PM skill updated with mandatory monitoring protocol (Solution 4)
- [ ] agentic-pm.md includes "30-minute check-in" requirement for background agents

## Incident Reference

**SPRINT-025 TASK-976:**
- 14.2M tokens consumed
- 2849x over 5K estimate
- Agent ran `npm run type-check` 20+ times
- Agent read same files repeatedly
- Code was DONE - agent couldn't recognize success

**PM Monitoring Failure:**
- PM launched agent in background and did NOT monitor
- USER noticed the token consumption and asked about it
- PM only verified work output AFTER user raised concerns
- PM never proactively checked the worktree or agent progress
- This is a discipline failure, not a tooling gap

## Estimate

~5,000 tokens (hook implementation + prompt updates + documentation)
