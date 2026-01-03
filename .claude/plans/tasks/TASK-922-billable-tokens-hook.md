# TASK-922: Add billable_tokens to SubagentStop Hook

**Sprint:** SPRINT-018 (Token Accounting Clarity)
**Category:** tooling
**Priority:** High

---

## PM Estimate

| Metric | Value |
|--------|-------|
| **Est. Billable Tokens** | ~20K |
| **Token Cap** | 80K |
| **Category Multiplier** | 1.0x (tooling) |

---

## Goal

Add `billable_tokens` field to the SubagentStop hook output to distinguish actual new work from total context usage.

## Non-Goals

- Do NOT change the existing total_tokens calculation
- Do NOT modify any other hook behavior
- Do NOT add complex logic

## Deliverables

| File | Action |
|------|--------|
| `.claude/hooks/track-agent-tokens.sh` | Add billable_tokens calculation and JSON field |

## Token Accounting

| Metric | Formula | Purpose |
|--------|---------|---------|
| **billable_tokens** | output_tokens + cache_create | Actual new work (PM estimates target this) |
| **total_tokens** | input + output + cache_read + cache_create | Full context usage |

## Implementation

### Step 1: Add Calculation

After line 54 (after TOTAL_TOKENS calculation), add:

```bash
# Billable = actual new work (output + cache creation, NOT cache reads)
BILLABLE_TOKENS=$((TOTAL_OUTPUT + TOTAL_CACHE_CREATE))
```

### Step 2: Update JSON Output

In the jq command (lines 72-85), add new argument:

```bash
--argjson billable "$BILLABLE_TOKENS" \
```

And add to the JSON object structure:

```
billable_tokens: $billable,
```

### Expected Output Format

```json
{
  "timestamp": "2026-01-03T20:00:00Z",
  "session_id": "xxx",
  "agent_id": "xxx",
  "input_tokens": 122,
  "output_tokens": 2233,
  "cache_read": 892585,
  "cache_create": 109391,
  "billable_tokens": 111624,
  "total_tokens": 1004331,
  "api_calls": 31,
  "duration_secs": 174,
  "started_at": "...",
  "ended_at": "..."
}
```

## Acceptance Criteria

- [ ] `billable_tokens` field appears in new tokens.jsonl entries
- [ ] `billable_tokens` = output_tokens + cache_create (verify math)
- [ ] `total_tokens` unchanged (still includes all)
- [ ] Hook still returns `{"decision": "allow"}`
- [ ] No bash syntax errors

## Testing

```bash
# After implementation, run any Task agent, then check:
tail -1 .claude/metrics/tokens.jsonl | jq '.billable_tokens, .total_tokens'

# Verify billable < total (unless no cache reads)
```

## Stop-and-Ask Triggers

- If unsure about bash arithmetic syntax
- If jq JSON construction fails

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer after implementation*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

- [ ] Read task file
- [ ] Created branch from develop
- [ ] Implemented billable_tokens calculation
- [ ] Tested hook locally
- [ ] PR created using template

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Billable Tokens** | |
| **Total Tokens** | |
| Duration | seconds |
| API Calls | |

**Variance:** PM Est ~20K billable vs Actual

### Notes

**Approach taken:**
**Issues encountered:**
