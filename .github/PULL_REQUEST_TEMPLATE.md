## Summary
<!-- Brief description of what this PR does -->

## Changes
<!-- List specific changes made -->

## Task Reference
- **Task ID**: TASK-XXX
- **Sprint**:
- **Branch**:

---

## Engineer Pre-PR Checklist

**REQUIRED: Complete ALL items before requesting review**

### 1. Branch & Setup
- [ ] Created branch from `develop` (not from feature branch)
- [ ] Branch follows naming: `fix/task-XXX-*` or `feature/task-XXX-*`

### 2. Implementation
- [ ] All acceptance criteria met
- [ ] Tests pass locally: `npm test`
- [ ] Type check passes: `npm run type-check`
- [ ] Lint passes: `npm run lint`

### 3. Task File Updated
- [ ] Implementation Summary section completed in task file
- [ ] Deviations documented (if any)
- [ ] Issues encountered documented (if any)

### 4. Metrics Captured
- [ ] Agent ID recorded below
- [ ] Metrics retrieved from SubagentStop hook data
- [ ] Variance calculated

---

## Engineer Metrics: TASK-XXX

**MANDATORY: PRs without complete metrics will be rejected by CI.**

### Agent ID

**Record this when Task tool returns:**
```
Engineer Agent ID: <paste your agent_id here>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** |  |
| Duration |  seconds |
| API Calls |  |
| Input Tokens |  |
| Output Tokens |  |
| Cache Read |  |
| Cache Create |  |

**Variance:** PM Est ~XK vs Actual ~XK (X% over/under)

**Implementation Notes:**
<!-- Summary of approach, key decisions -->

---

## Test Plan
<!-- How to verify this change works -->
- [ ]

---

## SR Engineer Review Section

**DO NOT EDIT BELOW - For SR Engineer only**

### SR Engineer Checklist

**BLOCKING - Verify before reviewing code:**
- [ ] Engineer Agent ID is present (not placeholder)
- [ ] Metrics table has actual values (not "X" or empty)
- [ ] Variance is calculated
- [ ] Implementation Summary in task file is complete

**Code Review:**
- [ ] CI passes
- [ ] Code quality acceptable
- [ ] Architecture compliance verified
- [ ] No security concerns

### SR Engineer Metrics: TASK-XXX

**Agent ID:**
```
SR Engineer Agent ID: <paste your agent_id here>
```

**Metrics (Auto-Captured):**

| Metric | Value |
|--------|-------|
| **Total Tokens** |  |
| Duration |  seconds |
| API Calls |  |

**Review Notes:**
<!-- Architecture concerns, security review, approval rationale -->

---

**After SR approval and merge, PM will record metrics in INDEX.md**

---

## Automated Validation

This PR will be automatically validated by CI for:
- Presence of Engineer Metrics section
- Presence of Agent ID section
- Auto-captured metrics (Total Tokens)
- Variance comparison

PRs missing these elements will fail the PR Metrics Validation check.
