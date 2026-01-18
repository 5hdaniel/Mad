# BACKLOG-137: Automatic Token Tracking Tooling

**Priority:** High
**Status:** COMPLETE
**Category:** tooling
**Created:** 2026-01-02
**Completed:** 2026-01-03

---

## Problem Statement

Engineers self-report ~8-12K tokens but actual consumption is ~800K-1.1M (~100x higher). Current process (BACKLOG-136) requires PM to manually check TaskOutput, but:

1. TaskOutput files are ephemeral (cleared between sessions)
2. PM doesn't consistently check after every agent
3. No persistent record of actual vs estimated
4. Estimates remain guesses without real data feedback loop

**Impact:**
- Token caps (4x estimate) are meaningless
- Budget forecasting impossible
- Category multipliers based on bad data
- No accountability for token efficiency

---

## Proposed Solution

Build automated tooling that captures and logs actual token usage per task.

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  PM spawns      │────▶│  Token Tracker   │────▶│  Metrics Log    │
│  Engineer Agent │     │  (wrapper/hook)  │     │  (persistent)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Task File       │
                        │  (auto-updated)  │
                        └──────────────────┘
```

### Implementation Options

#### Option A: Claude Code Hook (Recommended)

Use Claude Code's hook system to capture token usage after each agent completes.

```json
// .claude/settings.json
{
  "hooks": {
    "post-agent": {
      "command": "node .claude/scripts/log-agent-tokens.js",
      "args": ["$AGENT_ID", "$TASK_ID"]
    }
  }
}
```

**Pros:** Native integration, runs automatically
**Cons:** Need to verify hook system supports this

#### Option B: Wrapper Script

PM invokes engineers through a wrapper that captures metrics.

```bash
# .claude/scripts/run-engineer.sh
claude-agent engineer "$@" | tee /tmp/agent-output.log
node .claude/scripts/extract-tokens.js /tmp/agent-output.log >> .claude/metrics/tokens.jsonl
```

**Pros:** Works today, no Claude Code changes needed
**Cons:** Manual invocation required

#### Option C: Post-Task MCP Tool

Create an MCP tool that PM calls after each engineer completes.

```typescript
// mcp-token-logger
server.tool("log_task_tokens", {
  task_id: string,
  agent_id: string,
  estimated_tokens: number
}, async (params) => {
  const actual = await getAgentTokenUsage(params.agent_id);
  await appendToMetricsLog(params.task_id, estimated, actual);
  await updateTaskFile(params.task_id, actual);
  return { variance: (actual / estimated * 100 - 100).toFixed(0) + "%" };
});
```

**Pros:** Clean integration, reusable
**Cons:** MCP setup overhead

---

## Deliverables

1. **Token capture mechanism** (hook, wrapper, or MCP tool)
2. **Persistent metrics log** (`.claude/metrics/tokens.jsonl`)
   ```jsonl
   {"task":"TASK-919","estimated":20000,"actual":45000,"variance":"+125%","date":"2026-01-02"}
   ```
3. **Auto-update task files** with actual tokens in Implementation Summary
4. **Dashboard/report script** to analyze trends
5. **Alert on overruns** - flag when actual > 4x estimate

---

## Acceptance Criteria

- [x] Token usage captured automatically after every engineer agent
- [x] Metrics persisted to file (survives session clear)
- [x] Task files template updated with auto-captured section
- [ ] PM can run `npm run metrics:tokens` to see variance report (future)
- [ ] 4x overrun triggers visible warning (future)

## Implementation Notes

**Implemented via Option A: Claude Code SubagentStop Hook**

Files created:
- `.claude/hooks/track-agent-tokens.sh` - Hook script that parses agent transcripts
- `.claude/metrics/tokens.jsonl` - Persistent metrics log
- `.claude/scripts/show-token-metrics.sh` - Basic metrics viewer

Configuration:
- `.claude/settings.json` - SubagentStop hook registration

Captures:
- `input_tokens`, `output_tokens` (new tokens)
- `cache_read_input_tokens`, `cache_creation_input_tokens` (cache tokens)
- `total_tokens` = sum of all above
- `api_calls` count
- `agent_id` for correlation with Task tool output

Usage:
```bash
# View all metrics
cat .claude/metrics/tokens.jsonl | jq '.'

# Find specific agent's data
grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'

# View formatted summary
./.claude/scripts/show-token-metrics.sh
```

---

## Estimated Effort

**Category:** tooling
**Estimate:** 6-10 turns, ~40K tokens
**Complexity:** Medium (depends on hook system capabilities)

---

## Dependencies

- Investigate Claude Code hook system capabilities
- May require Claude Code feature request if hooks don't support post-agent

---

## Success Metrics

After implementation:
- 100% of tasks have actual token data
- Category multipliers updated quarterly with real data
- Token variance per sprint tracked
- Budget forecasting accuracy improves to ±50%

---

## Notes

This is a foundational improvement. Without real token data, all estimation is guesswork. Priority should be high - every sprint without this loses data we can't recover.
