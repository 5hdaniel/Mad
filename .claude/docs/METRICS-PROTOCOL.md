# Task Metrics Protocol

This document defines how task metrics (turns, tokens, time) are tracked, reported, and recorded across all roles in the development workflow.

---

## Overview

Every task tracks three metrics:
- **Turns**: Number of user message interactions
- **Tokens**: Approximate token usage (~4K tokens per turn average)
- **Time**: Wall-clock time spent on each phase

**Each role reports their own metrics separately.** This gives accurate data on where effort is spent.

---

## Workflow Summary

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   ENGINEER   │───►│  CI PASSES   │───►│  SR ENGINEER │───►│  PM RECORDS  │
│  Implements  │    │  Eng adds    │    │  Reviews +   │    │  INDEX.md    │
│              │    │  metrics     │    │  Commits SR  │    │              │
│              │    │              │    │  metrics +   │    │              │
│              │    │              │    │  MERGES      │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Timeline

| Step | When | Who | What |
|------|------|-----|------|
| 1. Estimate | Task creation | PM | Add estimated turns/tokens to task file |
| 2. Implement | During work | Engineer | Track own turns, tokens, time |
| 3. CI Pass | After implementation | Engineer | Wait for CI to pass |
| 4. Report | After CI passes | Engineer | Add Engineer Metrics to PR description |
| 5. Review | After Eng reports | Senior Engineer | Review code, track own metrics |
| 6. Commit + Merge | After review complete | Senior Engineer | Commit SR metrics to PR, approve, merge |
| 7. Record | After merge | PM | Update INDEX.md with both sets of metrics |

---

## Role Responsibilities

### Engineer (Implementation)

**What you track:**
- Implementation turns/tokens/time
- Debugging/fix turns/tokens/time (from CI failures or issues you find)

**Workflow:**
1. Note your start time before reading task file
2. Implement the task
3. Push PR and wait for CI to pass
4. **Add your metrics to PR description** (format below)
5. Request Senior Engineer review

**Add this to PR description AFTER CI passes:**

```markdown
---

## Engineer Metrics: TASK-XXX

**Engineer Start Time:** [when you started]
**Engineer End Time:** [when CI passed]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

**Implementation Notes:** [any context about your implementation]
```

These map to INDEX.md columns:
- `Impl Turns | Impl Tokens | Impl Time` → Implementation phase
- `Debug Turns | Debug Tokens | Debug Time` → Debugging phase

**Do NOT include:**
- Senior Engineer review metrics (they report their own as PR Turns/Tokens/Time)
- Time waiting for CI (only active work time)

---

### Senior Engineer (Review + Approve + Merge)

**You are the technical authority who approves and merges PRs.**

**What you track:**
- Code review turns/tokens/time
- Any feedback cycles with engineer

**Workflow:**
1. Note your start time when beginning review
2. Verify Engineer Metrics are present in PR description
3. Review code quality, architecture, tests
4. Request changes if needed (track this time)
5. Once satisfied:
   - **Commit your SR metrics to the PR** (add to PR description or commit a metrics file)
   - **Approve the PR**
   - **Merge the PR**

**Add this to PR description (or commit) BEFORE merging:**

```markdown
---

## Senior Engineer Metrics: TASK-XXX

**SR Review Start:** [when you started review]
**SR Review End:** [when you're merging]

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review (PR) | X | ~XK | X min |

**Review Notes:** [architecture concerns, security review, approval rationale]
```

This maps to INDEX.md columns:
- `PR Turns | PR Tokens | PR Time` → Senior Engineer review phase

**Before merging, verify:**
- [ ] CI has passed
- [ ] Engineer Metrics present in PR
- [ ] Code meets quality standards
- [ ] Your SR Metrics added (commit or description edit)

**Then approve and merge.**

---

### PM (Recording - Non-Technical)

**PM is NOT a technical approver. PM records metrics for estimation calibration.**

**After PR is merged:**

1. Open the merged PR
2. Read both metrics sections from PR description:
   - Engineer Metrics (Impl + Debug)
   - Senior Engineer Metrics (PR)
3. Update `.claude/plans/backlog/INDEX.md` with full granularity:

```markdown
| ID | Title | Est. Turns | Est. Tokens | Est. Time | Impl Turns | Impl Tokens | Impl Time | PR Turns | PR Tokens | PR Time | Debug Turns | Debug Tokens | Debug Time | Status |
|----|-------|------------|-------------|-----------|------------|-------------|-----------|----------|-----------|---------|-------------|--------------|------------|--------|
| BACKLOG-060 | Batch API | 10-15 | 40-60K | - | 8 | ~32K | 45m | 3 | ~12K | 15m | 2 | ~8K | 10m | ✅ Done |
```

**Column mapping:**
- `Est. Turns | Est. Tokens | Est. Time` → PM estimates (from task file)
- `Impl Turns | Impl Tokens | Impl Time` → Engineer Implementation phase
- `PR Turns | PR Tokens | PR Time` → Senior Engineer PR Review phase
- `Debug Turns | Debug Tokens | Debug Time` → Engineer Debugging phase

4. Update sprint plan to mark task complete
5. Note variance patterns for future estimation

---

## Complete PR Metrics Section (Final State Before Merge)

After both roles have added their metrics, the PR description should contain:

```markdown
---

## Task Completion Metrics: TASK-XXX

### Engineer Metrics

**Engineer Start:** 2:00 PM
**Engineer End:** 2:55 PM (CI passed)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation (Impl) | 8 | ~32K | 45 min |
| Debugging (Debug) | 2 | ~8K | 10 min |
| **Engineer Total** | 10 | ~40K | 55 min |

**Implementation Notes:** Used batch transaction pattern for atomicity.

---

### Senior Engineer Metrics

**SR Review Start:** 3:00 PM
**SR Review End:** 3:15 PM

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review (PR) | 3 | ~12K | 15 min |

**Review Notes:** Architecture approved. Added test for edge case.

---

### Summary for INDEX.md

| Metric | Impl | PR | Debug | **Total** |
|--------|------|----|----- -|-----------|
| Turns | 8 | 3 | 2 | **13** |
| Tokens | ~32K | ~12K | ~8K | **~52K** |
| Time | 45m | 15m | 10m | **70m** |

### Variance Notes
(Estimated: 10-15 turns, 40-60K tokens)
Within estimate range.
```

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ENGINEER                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Start timer                                                          │
│  2. Read task file                                                       │
│  3. Implement solution                                                   │
│  4. Push PR                                                              │
│  5. Wait for CI ─────────────────────────────────────────┐              │
│  6. CI passes                                             │ (not counted)│
│  7. Add ENGINEER METRICS to PR description               │              │
│  8. Request SR review ──────────────────────────────────►│              │
└─────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SENIOR ENGINEER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Start timer                                                          │
│  2. Verify Engineer Metrics present                                      │
│  3. Review code                                                          │
│  4. Request changes if needed ◄────┐                                    │
│  5. Engineer fixes ────────────────┘ (engineer updates their metrics)   │
│  6. Add SR ENGINEER METRICS (commit to PR or edit description)          │
│  7. APPROVE                                                              │
│  8. MERGE ──────────────────────────────────────────────►│              │
└─────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PM (Non-Technical)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Read merged PR description                                           │
│  2. Extract Engineer Metrics                                             │
│  3. Extract SR Engineer Metrics                                          │
│  4. Calculate totals                                                     │
│  5. Update INDEX.md                                                      │
│  6. Update sprint plan                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Metrics Definitions

### Turns

A "turn" is one user message/prompt. Each role counts only their own turns.

**Engineer counts:**
- Prompts for implementation
- Prompts for debugging/fixes
- Does NOT count SR review turns

**Senior Engineer counts:**
- Prompts during code review
- Prompts for feedback to engineer
- Does NOT count engineer's implementation turns

### Tokens

Estimate based on conversation length:
- ~4K tokens per average turn
- Long file reads add ~2-5K tokens each

**Quick estimate:** `Tokens ≈ Turns × 4K`

### Time

Wall-clock time for active work only:
- Start = when you begin working
- End = when your phase completes
- Do NOT include waiting time (CI running, waiting for other role)

---

## FAQ

**Q: What if the engineer needs to make fixes after SR review?**
A: Engineer updates their metrics (adds to Debugging/CI Fixes) and pushes again.

**Q: Who merges the PR?**
A: **Senior Engineer** merges after adding their metrics and approving.

**Q: Does PM approve PRs?**
A: No. PM is non-technical and only records metrics after merge.

**Q: What if SR Engineer finds no issues?**
A: "Feedback Cycles" row shows 0 turns, 0 tokens, 0 min.

**Q: What if I forget to track time?**
A: Estimate based on timestamps in conversation history. Approximate is fine.

**Q: Do both roles need to report before merge?**
A: Yes. SR Engineer should not merge until both metrics sections are present.

**Q: How does SR Engineer add their metrics?**
A: Either edit the PR description directly, or make a final commit with the metrics.

**Q: What if the task is blocked?**
A: Report partial metrics with status "Blocked" and note what's blocking.
