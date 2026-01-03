# Metrics Templates

**Status:** Canonical reference for all metrics tracking
**Last Updated:** 2026-01-03

---

## Overview

All sprint tasks require metrics tracking for:
- Estimation calibration
- Workflow efficiency analysis
- Resource planning

### Metrics Format Change (2026-01-03)

**Self-reported metrics (Turns/Time) have been deprecated.** New tasks use auto-captured metrics via SubagentStop hook.

| Old (Deprecated) | New (Auto-Captured) |
|------------------|---------------------|
| Turns (manual count) | API Calls (from hook) |
| Tokens (estimate: Turns × 4K) | Total Tokens (from hook) |
| Time (self-reported) | Duration (from hook, seconds) |

**Metric Types (Current):**
- **Total Tokens**: Sum of input + output + cache tokens (auto-captured)
- **Duration**: Time from first to last message in transcript (auto-captured)
- **API Calls**: Number of API roundtrips (auto-captured)

**How to access:**
```bash
# View all metrics
cat .claude/metrics/tokens.jsonl | jq '.'

# Find specific agent's data
grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'
```

---

## Token Accounting

Understanding the difference between token metrics:

| Metric | Formula | Use For |
|--------|---------|---------|
| **Billable Tokens** | output + cache_create | PM estimates, variance analysis |
| **Total Tokens** | input + output + cache_read + cache_create | Context usage, debugging |

### Why Billable vs Total?

- **Cache reads are "free"** - Reusing previously cached context doesn't represent new work
- **Output + cache_create = actual new work** - This is what PM estimates should target
- **Example from SPRINT-017:**
  - Total: ~1M tokens (inflated by 892K cache reads)
  - Billable: ~112K tokens (actual new work)
  - PM estimate was ~15K - variance should compare to billable, not total

---

## Estimation Multipliers (Token-Based)

Based on actual data from sprints. Apply to PM token estimates:

| Category | Multiplier | Notes |
|----------|------------|-------|
| **refactor** | **0.5x** | Consistently overestimate (-52% avg) |
| **security** | 0.4x | Simple focused fixes |
| **config** | 0.5x | Significantly overestimate |
| **service** | **0.5x** | SPRINT-014/015 confirmed |
| **test** | 0.9x | Usually accurate |
| **schema** | 1.3x | High variance, add buffer |
| **docs** | **5.0x** | Iteration can spiral (SPRINT-015) |
| **types** | 1.0x | Usually accurate |
| **ipc** | 1.5x | Suspected underestimate |
| **ui** | 1.0x | TBD - need data |

**Example:**
- PM estimates ~20K tokens for a refactor task
- Apply 0.5x → Expect ~10K actual tokens

---

## Engineer Metrics (Task File)

Engineers capture their agent_id and populate from hook data:

```markdown
### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~XK vs Actual ~XK (X% over/under)
```

---

## SR Engineer Metrics (Task File)

SR Engineer captures their agent_id when reviewing:

```markdown
### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
```

---

## PM Notification Format (After Merge)

SR Engineer sends to PM after merging:

```markdown
## Task Complete - PM Action Required

**Task**: TASK-XXX
**PR**: #XXX (merged)
**Branch**: [branch name]

### Metrics Summary (Auto-Captured)

| Role | Agent ID | Total Tokens | Duration |
|------|----------|--------------|----------|
| Engineer | aXXXXXX | ~XK | X sec |
| SR Engineer | aXXXXXX | ~XK | X sec |
| **Total** | - | ~XK | X sec |

### PM Actions Needed
1. Update INDEX.md with metrics
2. Archive task file
3. Assign next task to engineer
```

---

## INDEX.md Recording Format

When PM records metrics in `.claude/plans/backlog/INDEX.md`:

| Column | Source | Format |
|--------|--------|--------|
| Est Tokens | Task file | `~XK` |
| Actual Tokens | Hook data | `~XK` |
| Duration | Hook data | `X sec` |
| Variance | Calculated | `+/-X%` |

**Legacy columns** (Turns, Time per phase) are preserved for historical data but no longer populated for new tasks.

---

## Token Estimation Guidelines

| Task Complexity | Token Estimate |
|-----------------|----------------|
| Trivial (config, small fix) | ~5-10K |
| Simple (single file, clear pattern) | ~15-25K |
| Standard (multi-file, integration) | ~30-50K |
| Complex (architecture, debugging) | ~80-150K |
| Large (multi-component refactor) | ~200K+ |

**SR Review Overhead (add to ALL estimates):**

| Task Complexity | SR Review Overhead |
|-----------------|-------------------|
| Trivial (docs, config) | +10-15K tokens |
| Standard (service, ui) | +15-25K tokens |
| Complex (schema, refactor) | +25-40K tokens |

---

## Validation Rules

**Task file must include:**
- [ ] Agent ID section (Engineer)
- [ ] Metrics (Auto-Captured) table with actual values
- [ ] Variance calculation

**SR Engineer will reject:**
- [ ] Missing Agent ID
- [ ] Placeholder values ("X" instead of numbers)
- [ ] Unfilled metrics tables

---

## Debugging Metrics Note

Debugging effort is captured automatically in the total tokens. The hook captures everything from agent start to completion, including:
- Initial implementation
- CI failure investigation
- Fix iterations
- Final verification

No separate tracking needed - the total reflects all work.

---

## Deprecated Sections

The following are kept for historical reference but no longer used:

<details>
<summary>Legacy: Turn-Based Estimation (Deprecated)</summary>

Previously used:
- Turns: Number of user messages/prompts
- Tokens: Estimated as Turns × 4K
- Time: Wall-clock active work time

This was inaccurate (observed ~100x variance) and replaced by auto-captured metrics.
</details>

<details>
<summary>Legacy: Phase Breakdown (Deprecated)</summary>

Previously tracked Planning/Implementation/Debugging phases separately.
Auto-captured metrics provide total only; phase breakdown is no longer required.
</details>
