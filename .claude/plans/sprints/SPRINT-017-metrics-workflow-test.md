# SPRINT-017: Metrics Workflow Test

**Status:** COMPLETE
**Created:** 2026-01-03
**Completed:** 2026-01-03
**Target:** develop

---

## Executive Summary

Minimal single-task sprint to validate the new auto-captured metrics workflow (BACKLOG-137/138).

### Sprint Goal

Fix a UI bug while testing that:
1. Engineer records `agent_id` when Task tool returns
2. SubagentStop hook captures metrics automatically
3. Metrics appear in `.claude/metrics/tokens.jsonl`
4. New PR template format works correctly

### Outcome

**Bug Fixed:** PR #283 merged - duplicate buttons removed from SecureStorageStep.

**Metrics Workflow:** Partially validated - hook works, but engineer used legacy PR format.

---

## Task Summary

| ID | Title | Status | PR | Est Tokens | Actual Tokens |
|----|-------|--------|----|-----------:|-------------:|
| TASK-921 | Fix duplicate Back/Continue buttons | **COMPLETE** | #283 | ~15K | ~1M (892K cache) |

---

## Metrics Workflow Validation Results

| Test | Result | Notes |
|------|--------|-------|
| SubagentStop hook capture | **PASS** | Metrics recorded in tokens.jsonl |
| Agent ID recorded | **PASS** | `a44b513` captured |
| Auto-captured data | **PASS** | Tokens, duration, API calls all captured |
| PR template format | **FAIL** | Engineer used legacy `| Phase | Turns |` format |
| CI validation | **FAIL** | Format mismatch between PR body and expected format |

### Auto-Captured Metrics (from tokens.jsonl)

**Engineer Agent (`a44b513`):**

| Metric | Value |
|--------|-------|
| Total Tokens | 1,004,331 |
| Input Tokens | 122 |
| Output Tokens | 2,233 |
| Cache Read | 892,585 |
| Cache Create | 109,391 |
| Duration | 174 seconds |
| API Calls | 31 |

**SR Engineer Agent (`a8d6d9d`):**

| Metric | Value |
|--------|-------|
| Total Tokens | ~45K (estimated) |
| Duration | ~180 seconds |

---

## Retrospective

### What Worked

1. **SubagentStop hook** - Successfully captured all agent metrics automatically
2. **tokens.jsonl storage** - Data persisted and retrievable via grep
3. **Bug fix quality** - SR Engineer caught critical issue (dontShowAgain flow) before implementation
4. **SR Engineer pre-implementation review** - Prevented broken functionality

### What Didn't Work

1. **Engineer PR format** - Used legacy `| Phase | Turns | Tokens | Time |` instead of `| Metric | Value |`
2. **CI validation** - Failed due to format mismatch
3. **Template reference gap** - Engineer.md referenced metrics-templates.md but not the PR template

### Root Cause Analysis

**Why did engineer use wrong format?**

The `engineer.md` documentation said:
```
**Metrics format:** See `.claude/docs/shared/metrics-templates.md` for the auto-captured format.
```

But did NOT say:
```
Use the PR template at .github/PULL_REQUEST_TEMPLATE.md
```

The engineer manually wrote a PR body instead of using the GitHub template.

### Fix Applied

Updated `.claude/agents/engineer.md` to explicitly require PR template usage:

```bash
gh pr create --base develop --title "..." --body "$(cat .github/PULL_REQUEST_TEMPLATE.md)"
```

Added:
- **CRITICAL** note about using template
- **DO NOT manually write** warning
- Explicit template path reference

---

## Process Improvements Identified

### Implemented This Sprint

| Improvement | File | Change |
|-------------|------|--------|
| Require PR template | `engineer.md` | Added explicit `cat .github/PULL_REQUEST_TEMPLATE.md` command |
| DO NOT manual warning | `engineer.md` | Added warning against manual PR body |

### Recommended for Future

| Item | Priority | Notes |
|------|----------|-------|
| Add PR template check to CI | Medium | Validate structure, not just keywords |
| Add engineer onboarding doc | Low | Step-by-step for new engineer agents |

---

## Estimation Analysis

| Metric | Estimated | Actual | Variance |
|--------|-----------|--------|----------|
| Engineer Tokens | ~15K | ~1M (total) / ~112K (non-cache) | +650% |
| Duration | - | 174 sec | - |

**Note:** The "Total Tokens" includes 892K cache reads. The actual "new work" tokens (output + cache create) were ~112K, still significantly higher than the 15K estimate. This suggests:
- UI tasks may need higher estimates
- Cache accounting affects total token metrics
- The ~15K estimate was based on billable tokens, not total

**Recommendation:** Future estimates should clarify "billable tokens" vs "total tokens including cache."

---

## End-of-Sprint Validation

- [x] Bug fixed and verified (PR #283 merged)
- [x] PR merged to develop
- [x] Auto-captured metrics recorded (tokens.jsonl)
- [x] Workflow documentation validated (found gap, fixed)
- [x] Retrospective complete

---

## Sprint Metrics Summary

| Role | Agent ID | Total Tokens | Duration |
|------|----------|--------------|----------|
| Engineer | a44b513 | ~1M | 174 sec |
| SR Engineer | a8d6d9d | ~45K | ~180 sec |
| **Total** | - | **~1.05M** | **~6 min** |

---

## Changelog

- 2026-01-03: Sprint created with TASK-921
- 2026-01-03: SR Engineer reviewed task, identified dontShowAgain issue
- 2026-01-03: Task file updated with correct fix approach
- 2026-01-03: Engineer completed task, PR #283 created
- 2026-01-03: SR Engineer approved, PR merged
- 2026-01-03: Retrospective completed, engineer.md updated
- 2026-01-03: Sprint closed
