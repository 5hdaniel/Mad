# SPRINT-018: Token Accounting Clarity

**Status:** READY TO START
**Created:** 2026-01-03
**Target:** develop

---

## Executive Summary

Implement lesson learned from SPRINT-017: clarify token accounting to distinguish between "billable tokens" (actual new work) and "total tokens" (including cache reads).

### Sprint Goals

1. Add `billable_tokens` field to SubagentStop hook output
2. Update documentation to explain the difference
3. Test that engineer.md fix (PR template requirement) works

### Background

In SPRINT-017, the engineer agent showed:
- **Total Tokens:** ~1M (inflated by 892K cache reads)
- **Billable Tokens:** ~112K (output + cache_create - actual new work)

PM estimates target billable work, but metrics showed total context. This caused a misleading +650% variance.

---

## Task List

| ID | Title | Category | Est Tokens | Token Cap |
|----|-------|----------|------------|-----------|
| TASK-922 | Add billable_tokens to SubagentStop hook | tooling | ~20K | 80K |
| TASK-923 | Update metrics documentation for token clarity | docs | ~15K | 60K |

---

## TASK-922: Add billable_tokens to Hook

### Goal

Add `billable_tokens` field to the SubagentStop hook output so engineers and PM can see actual new work vs total context.

### Files to Modify

| File | Action |
|------|--------|
| `.claude/hooks/track-agent-tokens.sh` | Add billable_tokens calculation and output |

### Implementation

After line 54, add:
```bash
# Billable = actual new work (output + cache creation)
BILLABLE_TOKENS=$((TOTAL_OUTPUT + TOTAL_CACHE_CREATE))
```

Update the jq output (line 72-85) to include:
```bash
--argjson billable "$BILLABLE_TOKENS" \
```

And add to the JSON object:
```
billable_tokens: $billable
```

### Acceptance Criteria

- [ ] `billable_tokens` field appears in tokens.jsonl entries
- [ ] `billable_tokens` = output_tokens + cache_create
- [ ] `total_tokens` still calculated as before
- [ ] Hook still functions correctly (test with dummy agent)

---

## TASK-923: Update Metrics Documentation

### Goal

Update documentation to explain billable vs total tokens and clarify PM estimates should target billable tokens.

### Files to Modify

| File | Action |
|------|--------|
| `.claude/docs/shared/metrics-templates.md` | Add token accounting section |
| `.claude/skills/agentic-pm/modules/task-file-authoring.md` | Clarify estimates target billable |
| `.github/PULL_REQUEST_TEMPLATE.md` | Add billable_tokens to metrics table |

### Content to Add

**Token Accounting Explanation:**
```markdown
## Token Accounting

| Metric | Formula | Use For |
|--------|---------|---------|
| **Billable Tokens** | output + cache_create | PM estimates, cost tracking |
| **Total Tokens** | input + output + cache_read + cache_create | Context usage, debugging |

**Why the difference?**
- Cache reads are "free" - reusing cached context
- Billable = actual new work generated
- PM estimates should target billable tokens
```

### Acceptance Criteria

- [ ] metrics-templates.md explains billable vs total
- [ ] task-file-authoring.md clarifies estimates target billable
- [ ] PR template includes billable_tokens field
- [ ] `npm run type-check` passes (no code changes)

---

## Testing Plan

| Test | Method |
|------|--------|
| Hook output | Run engineer agent, check tokens.jsonl has billable_tokens |
| PR template | Verify engineer uses template (tests SPRINT-017 fix) |
| Documentation | Review for clarity |

---

## Dependency Graph

```
TASK-922 (hook) ──┐
                  ├──> TASK-923 (docs) references new field
                  │
```

**Execution:** Sequential - TASK-922 first, then TASK-923

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hook syntax error | Low | Medium | Test locally before commit |
| Wrong calculation | Low | High | Verify: billable = output + cache_create |

---

## End-of-Sprint Validation

- [ ] billable_tokens appears in tokens.jsonl
- [ ] Documentation updated
- [ ] Engineer used PR template correctly (validates SPRINT-017 fix)
- [ ] PRs merged to develop
