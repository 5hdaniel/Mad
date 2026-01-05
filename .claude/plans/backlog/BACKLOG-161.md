# BACKLOG-161: Agent Anti-Exploration-Loop Enforcement

**Created**: 2026-01-05
**Priority**: High
**Category**: infra
**Status**: Pending

---

## Problem

Engineer agents can get stuck in exploration loops, consuming massive tokens (1M+) reading files without writing code. Observed in SPRINT-025 where two agents burned ~2.5M tokens before starting implementation.

## Root Cause

Agents are overly cautious - wanting to understand entire codebase before writing. No enforcement mechanism to break the loop.

## Proposed Solutions

### Option 1: PostToolUse Hook (Recommended)
Count exploration tools (Read/Glob/Grep) and inject warning after threshold:

```bash
# .claude/hooks/exploration-limit.sh
COUNTER_FILE="/tmp/claude-agent-exploration.count"
TOOL="$1"

if [[ "$TOOL" =~ Read|Glob|Grep ]]; then
  COUNT=$(($(cat "$COUNTER_FILE" 2>/dev/null || echo 0) + 1))
  echo "$COUNT" > "$COUNTER_FILE"
  if [ "$COUNT" -gt 15 ]; then
    echo "WARNING: $COUNT exploration calls without writing. Start coding!" >&2
  fi
elif [[ "$TOOL" =~ Write|Edit ]]; then
  echo "0" > "$COUNTER_FILE"  # Reset on code write
fi
```

Hook config in `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": ["bash .claude/hooks/exploration-limit.sh $TOOL_NAME"]
  }
}
```

### Option 2: Agent Prompt Update
Add to engineer agent system prompt:
```markdown
## Anti-Exploration-Loop Rule (MANDATORY)
- Start writing code within 10 tool calls
- Read max 5 files before first Write/Edit
- If unsure, write minimal implementation and iterate
```

### Option 3: Both
Combine prompt guidance with hook enforcement.

## Acceptance Criteria

- [ ] Agents start writing code within 10 tool calls
- [ ] Warning triggered after 15 exploration calls
- [ ] Exploration counter resets on Write/Edit
- [ ] Documented in agent guidelines

## Incident Reference

SPRINT-025 TASK-976/977: ~2.5M tokens burned in exploration before implementation started.

## Estimate

~2,000 tokens (simple hook + prompt update)
