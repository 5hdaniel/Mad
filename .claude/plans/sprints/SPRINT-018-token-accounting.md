# SPRINT-018: Token Accounting Clarity

**Status:** COMPLETE
**Created:** 2026-01-03
**Completed:** 2026-01-03
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

- [x] billable_tokens appears in tokens.jsonl
- [x] Documentation updated
- [x] Engineer used PR template correctly (validates SPRINT-017 fix)
- [x] PRs merged to develop

---

## Task Summary

| ID | Title | Status | PR | Est Billable | Actual Billable |
|----|-------|--------|----|--------------:|----------------:|
| TASK-922 | Add billable_tokens to hook | **COMPLETE** | #284 | ~20K | ~56K |
| TASK-923 | Update metrics documentation | **COMPLETE** | #285 | ~15K | ~60K |

---

## Auto-Captured Metrics (from tokens.jsonl)

### TASK-922: billable_tokens Hook

**Engineer Agent (`aa24846`):**

| Metric | Value |
|--------|-------|
| **Billable Tokens** | 56,469 |
| Total Tokens | 884,993 |
| Duration | 185 seconds |
| API Calls | 32 |

**SR Engineer Agent (`a25ab05`):**

| Metric | Value |
|--------|-------|
| **Billable Tokens** | 74,169 |
| Total Tokens | 868,870 |
| Duration | 176 seconds |
| API Calls | 30 |

### TASK-923: Documentation Update

**Engineer Agent (`ace0aa6`):**

| Metric | Value |
|--------|-------|
| **Billable Tokens** | 60,449 |
| Total Tokens | 987,947 |
| Duration | 196 seconds |
| API Calls | 31 |

**SR Engineer Agent (`a771f8f`):**

| Metric | Value |
|--------|-------|
| **Billable Tokens** | 63,035 |
| Total Tokens | 795,294 |
| Duration | 130 seconds |
| API Calls | 25 |

---

## Retrospective

### What Worked

1. **billable_tokens field** - Now captured automatically, provides clear distinction from total
2. **PR Template Usage** - Engineers used the template correctly (SPRINT-017 fix validated)
3. **Sequential execution** - TASK-922 first, then TASK-923 worked smoothly
4. **Hook captures metrics automatically** - No manual tracking needed

### What Didn't Work

1. **Estimates still undershot** - ~35K estimated vs ~116K Engineer actual (+231%)
2. **SR Engineer overhead** - SR reviews added ~137K billable (54% of sprint total)

### Estimation Analysis

PM estimates target **Engineer billable only** (SR Engineer tracked separately).

| Task | PM Est | Engineer Actual | Variance |
|------|--------|-----------------|----------|
| TASK-922 | ~20K | 56K | +180% |
| TASK-923 | ~15K | 60K | +300% |
| **Total** | ~35K | **116K** | **+231%** |

**SR Engineer Overhead (tracked separately):**

| Task | SR Actual | SR:Eng Ratio |
|------|-----------|--------------|
| TASK-922 | 74K | 1.3x |
| TASK-923 | 63K | 1.1x |
| **Total** | **137K** | **1.2x** |

**Key Insight:** SR Engineer adds ~1.2x overhead on top of Engineer work. This is expected (code review, verification, merge). PM estimates correctly target Engineer work only.

### Process Validation

| Item | Result |
|------|--------|
| PR template usage | **PASS** - Engineers used template correctly |
| billable_tokens capture | **PASS** - Field appears in tokens.jsonl |
| Distinction clarity | **PASS** - Total vs Billable now clearly separated |

---

## Sprint Metrics Summary

| Role | Agent ID | Billable Tokens | Total Tokens | Duration |
|------|----------|-----------------|--------------|----------|
| Engineer (922) | aa24846 | 56,469 | 884,993 | 185s |
| SR Engineer (922) | a25ab05 | 74,169 | 868,870 | 176s |
| Engineer (923) | ace0aa6 | 60,449 | 987,947 | 196s |
| SR Engineer (923) | a771f8f | 63,035 | 795,294 | 130s |
| **Total** | - | **254,122** | **3,537,104** | **~11 min** |

**Key Insight:** Total tokens (3.5M) includes ~3.3M cache reads. Billable tokens (254K) represent actual new work - only 7% of total.

---

## Changelog

- 2026-01-03: Sprint created with TASK-922 and TASK-923
- 2026-01-03: SR Engineer approved sprint plan
- 2026-01-03: TASK-922 completed, PR #284 merged
- 2026-01-03: TASK-923 completed, PR #285 merged
- 2026-01-03: Retrospective completed, sprint closed
