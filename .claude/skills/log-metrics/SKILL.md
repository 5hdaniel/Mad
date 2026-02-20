---
name: log-metrics
description: Log agent work metrics to tokens.csv for tracking effort and costs.
---

# Log Metrics Skill

Log agent work metrics to the centralized tokens.csv file.

## Usage

Type `/log-metrics` to log your work session metrics.

## When to Use

All agents (engineer, PM, SR Engineer, QA, etc.) should log their metrics:
- **At the end of a task** - When completing a task/PR
- **At handoff** - When passing work to another agent
- **At session end** - When finishing a work session

### MANDATORY: Main Session Logging

Sub-agent tokens are auto-captured by the `SubagentStop` hook (`track-agent-tokens.sh`), but **the main session is NOT a sub-agent** — its tokens are invisible unless logged manually.

At the end of every main session that performed orchestration work (sprint planning, CI triage, agent coordination), log effort:

```bash
python .claude/skills/log-metrics/log_metrics.py \
  -t main -i SPRINT-XXX -d "Sprint orchestration and CI triage" \
  --input <tokens> --output <tokens>
```

Without this step, `sum_effort.py` will undercount total sprint effort.

## Action

Run the Python script with your metrics:

```bash
python /Users/daniel/Documents/Mad/.claude/skills/log-metrics/log_metrics.py \
  --agent-type <TYPE> \
  --task-id <TASK_ID> \
  --description "<DESCRIPTION>" \
  --input <INPUT_TOKENS> \
  --output <OUTPUT_TOKENS> \
  --duration <SECONDS>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--agent-type`, `-t` | Yes | One of: `engineer`, `pm`, `sr-engineer`, `qa`, `explore`, `fix`, `main` |
| `--task-id`, `-i` | No | Task ID (e.g., `TASK-1184`, `PR-588`, `BACKLOG-497`) |
| `--description`, `-d` | No | Brief description of work done |
| `--input` | No | Input tokens used |
| `--output` | No | Output tokens used |
| `--cache-read` | No | Cache read tokens |
| `--cache-create` | No | Cache create tokens |
| `--api-calls` | No | Number of API calls made |
| `--duration` | No | Duration in seconds |

### View Summary

```bash
python /Users/daniel/Documents/Mad/.claude/skills/log-metrics/log_metrics.py --summary
```

## Examples

### Engineer completing a task:
```bash
python .claude/skills/log-metrics/log_metrics.py \
  -t engineer \
  -i TASK-1184 \
  -d "Implemented database maintenance button" \
  --input 45000 --output 12000 --duration 1200
```

### PM creating sprint plan:
```bash
python .claude/skills/log-metrics/log_metrics.py \
  -t pm \
  -i SPRINT-053 \
  -d "Created sprint plan and tasks" \
  --input 8000 --output 3000 --duration 600
```

### SR Engineer reviewing PR:
```bash
python .claude/skills/log-metrics/log_metrics.py \
  -t sr-engineer \
  -i PR-588 \
  -d "Reviewed and merged" \
  --input 15000 --output 2000 --duration 300
```

## Available Scripts

This skill provides three scripts for metrics management:

### 1. `log_metrics.py` - Append Entry

Logs a new metrics entry to tokens.csv (documented above).

### 2. `query_metrics.py` - Query/Filter Entries

Filter and search existing entries.

```bash
# By task ID
python .claude/skills/log-metrics/query_metrics.py --task TASK-1234

# By agent type
python .claude/skills/log-metrics/query_metrics.py --agent-type engineer

# By date range
python .claude/skills/log-metrics/query_metrics.py --since 2026-01-30

# Combine filters
python .claude/skills/log-metrics/query_metrics.py --task TASK-1234 --since 2026-01-30

# Output as JSON
python .claude/skills/log-metrics/query_metrics.py --task TASK-1234 --json

# Count only
python .claude/skills/log-metrics/query_metrics.py --agent-type engineer --count
```

### 3. `sum_effort.py` - Aggregate Totals

Calculate total effort for a task, session, or sprint prefix. **Used by PM in Step 14 of agent handoff workflow.**

```bash
# Task totals (for PM Step 14)
python .claude/skills/log-metrics/sum_effort.py --task TASK-1234

# Sprint prefix (all TASK-17XX)
python .claude/skills/log-metrics/sum_effort.py --task-prefix TASK-17

# Session totals
python .claude/skills/log-metrics/sum_effort.py --session-id abc123

# Pretty print
python .claude/skills/log-metrics/sum_effort.py --task TASK-1234 --pretty
```

**Output (JSON):**
```json
{
  "task_id": "TASK-1234",
  "input_tokens": 45000,
  "output_tokens": 12000,
  "billable_tokens": 57000,
  "total_tokens": 125000,
  "api_calls": 87,
  "duration_secs": 3600,
  "agent_sessions": 5,
  "entries": 12
}
```

---

## CSV Location

Metrics are stored in: `.claude/metrics/tokens.csv`

## CSV Columns

```
timestamp,session_id,agent_id,agent_type,task_id,description,input_tokens,output_tokens,cache_read,cache_create,billable_tokens,total_tokens,api_calls,duration_secs,started_at,ended_at
```
