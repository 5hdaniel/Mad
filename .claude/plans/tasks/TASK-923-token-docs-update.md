# TASK-923: Update Metrics Documentation for Token Clarity

**Sprint:** SPRINT-018 (Token Accounting Clarity)
**Category:** docs
**Priority:** Medium
**Depends On:** TASK-922 (billable_tokens field must exist)

---

## PM Estimate

| Metric | Value |
|--------|-------|
| **Est. Billable Tokens** | ~15K |
| **Token Cap** | 60K |
| **Category Multiplier** | 5.0x (docs - but this is straightforward) |

---

## Goal

Update documentation to explain billable vs total tokens and ensure PM estimates target billable tokens.

## Non-Goals

- Do NOT change any code
- Do NOT modify the hook (done in TASK-922)
- Do NOT add extensive new sections

## Deliverables

| File | Action |
|------|--------|
| `.claude/docs/shared/metrics-templates.md` | Add token accounting section |
| `.claude/skills/agentic-pm/modules/task-file-authoring.md` | Clarify estimates target billable |
| `.github/PULL_REQUEST_TEMPLATE.md` | Add Billable Tokens to metrics table |

## Implementation

### 1. Update metrics-templates.md

Add new section after "Overview":

```markdown
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
```

### 2. Update task-file-authoring.md

In the Estimation Guidelines section, add clarification:

```markdown
> **Token Estimates Target Billable Tokens**
>
> PM estimates (e.g., "~20K tokens") refer to **billable tokens** (output + cache_create),
> NOT total tokens. Total includes cache reads which inflate the number but don't
> represent new work.
```

### 3. Update PR Template

In the Engineer Metrics table, add Billable Tokens as the primary metric:

```markdown
| Metric | Value |
|--------|-------|
| **Billable Tokens** |  |
| Total Tokens |  |
| Duration |  seconds |
| API Calls |  |
```

## Acceptance Criteria

- [ ] metrics-templates.md has Token Accounting section
- [ ] task-file-authoring.md clarifies estimates target billable
- [ ] PR template shows Billable Tokens as primary metric
- [ ] Documentation is clear and concise
- [ ] No markdown formatting errors

## Testing

- Review documentation for clarity
- Verify PR template renders correctly on GitHub

## Stop-and-Ask Triggers

- If existing documentation structure is unclear
- If TASK-922 is not complete (need billable_tokens to exist first)

---

## Implementation Summary (Engineer-Owned)

*Completed by engineer after implementation*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: (Foreground agent - no Task tool invocation)
```

### Checklist

- [x] Read task file
- [x] Verified TASK-922 is complete (billable_tokens field exists in hook)
- [x] Created branch from develop
- [x] Updated all three files
- [x] PR created using template (PR #285)

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Billable Tokens** | (foreground - manual estimate ~8K) |
| Total Tokens | (foreground - manual estimate ~20K) |
| Duration | ~3 min |
| API Calls | ~4 |

**Variance:** PM Est ~15K billable vs Actual ~8K (estimated, -47%)

---

## SR Engineer Review (SR-Owned)

### Review Date
2026-01-03

### SR Agent ID
```
SR Engineer Agent ID: (Foreground agent - direct review)
```

### Review Metrics

| Metric | Value |
|--------|-------|
| **Billable Tokens** | ~12K (estimated) |
| Total Tokens | ~30K (estimated) |
| Duration | ~180 seconds |
| API Calls | ~6 |

### Review Decision
**APPROVED**

### Review Notes
- All acceptance criteria verified
- Documentation changes are clear, concise, and well-structured
- Token Accounting section provides excellent clarity with real SPRINT-017 example
- PR template correctly shows Billable Tokens as primary metric
- No formatting errors detected
- CI passed all checks

### Notes

**Approach taken:** Direct edits to the three files as specified in the task. Added Token Accounting section to metrics-templates.md, added billable token clarification note to task-file-authoring.md, and simplified the PR template metrics table to show Billable Tokens as primary.

**Issues encountered:** None - straightforward documentation updates.
