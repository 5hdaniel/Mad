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

## CSV Location

Metrics are stored in: `.claude/metrics/tokens.csv`

## CSV Columns

```
timestamp,session_id,agent_id,agent_type,task_id,description,input_tokens,output_tokens,cache_read,cache_create,billable_tokens,total_tokens,api_calls,duration_secs,started_at,ended_at
```
