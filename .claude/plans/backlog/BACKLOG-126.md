# BACKLOG-126: Enforce Debugging Metrics with Commit Verification

**Priority:** High
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-010 Retrospective (TASK-704 CI incident)

---

## Problem Statement

TASK-704 took **22 hours** to merge due to CI debugging, but the engineer metrics reported:
- Implementation: 4 turns, 30 min
- **Debugging: 0**

The actual debugging effort (~20 turns, ~21 hours, 22 "fix(ci):" commits) was completely invisible.

**Root Cause:** The Debugging row EXISTS in our metrics template, but:
1. Engineers can fill in "0" without verification
2. SR Engineer had no process to cross-check reported debugging against commit history
3. No threshold defined for when debugging becomes a "major incident"
4. Debugging was done in a separate branch/commit pattern that made it invisible

**Key Insight:** We don't need new fields - we need ENFORCEMENT.

---

## The TASK-704 Pattern (What to Detect)

The incident had clear signals that were missed:

| Signal | What Happened | Should Have Triggered |
|--------|---------------|----------------------|
| Many fix commits | 22 "fix(ci):" commits | >3 fix commits = debugging occurred |
| Long PR timeline | Created 08:16, merged 06:20 next day | >4h open = investigate |
| Commit pattern | Sequential fix attempts | Iterative debugging visible in history |
| Reported vs actual | Debugging: 0 vs 22h actual | Discrepancy = blocker |

---

## Solution: Tiered Debugging Verification Protocol

### Core Principle: Capture Everything, Block Intelligently

**Two separate goals:**
1. **Estimation Accuracy** - Capture ALL debugging effort, even 5 minutes
2. **Quality Gate** - Block only on clear discrepancies (evidence vs reported)

---

### 1. Engineer Responsibility: Track ALL Debugging

**Any of these = debugging occurred, MUST be recorded:**
- CI failure investigation (even if quick fix)
- Any commit with "fix" in the message
- Test failures requiring changes
- Type errors after initial implementation
- Lint fixes beyond auto-fix

**Even small debugging matters for estimation:**
```markdown
| Debugging (Debug) | 1 | ~4K | 10 min |  ← This is honest
| Debugging (Debug) | 0 | 0 | 0 |         ← This should be rare
```

**Rule:** If you made ANY commit after CI failed, Debugging > 0.

---

### 2. SR Engineer Verification: Tiered Response

**Step 1: Collect evidence**
```bash
# Count fix commits
FIX_COUNT=$(git log --oneline origin/develop..HEAD | grep -iE "fix" | wc -l)

# Count total commits
TOTAL_COMMITS=$(git log --oneline origin/develop..HEAD | wc -l)

# Check PR age
PR_AGE=$(gh pr view --json createdAt --jq '.createdAt')
```

**Step 2: Cross-check with tiered response**

| Fix Commits | Debugging Reported | Response |
|-------------|-------------------|----------|
| 0 | 0 | ✅ **PASS** - Consistent, no debugging needed |
| 0 | >0 | ✅ **PASS** - Honest about non-commit debugging (e.g., investigation) |
| 1-2 | 0 | ⚠️ **ASK** - "These fix commits required no debugging time?" |
| 1-2 | >0 | ✅ **PASS** - Consistent, small debugging captured |
| 3-5 | 0 | ❌ **BLOCK** - Clear discrepancy, require update |
| 3-5 | >0 | ✅ **PASS** - Verify proportional (3 commits ≈ 15+ min typical) |
| 6+ | any | 📋 **INCIDENT REPORT** - Major debugging, document for learning |

**Step 3: Timeline as signal (not blocker)**

PR open time ≠ work time. Engineers wait for CI, wait for answers, get blocked on dependencies.

| PR Open Time | Use As |
|--------------|--------|
| Any duration | **Signal to investigate**, not automatic block |

**If PR open >4h AND Debugging: 0, ASK:**
- "Was there waiting time (CI, blocked, waiting for answer)?"
- "Did any debugging happen during that time?"

**Only block if:** Long PR + fix commits + Debugging: 0 (clear discrepancy)

---

### 3. Why Track Even Small Debugging?

**For PM estimation calibration:**

If TASK-700 estimates "4-6 turns" and actual is:
- Implementation: 4 turns
- Debugging: 0 turns
- **Total: 4 turns** → PM thinks estimate was accurate

But if actual was:
- Implementation: 4 turns
- Debugging: 2 turns (CI lint fix, type error)
- **Total: 6 turns** → PM learns debugging overhead is real

**Without capturing small debugging, estimates appear more accurate than they are.**

---

### 4. Major Incident Threshold

An incident becomes a **Major Incident** requiring special documentation when ANY of:

| Trigger | Threshold |
|---------|-----------|
| Debugging time | >2 hours |
| Fix commits | >5 commits |
| PR timeline | >8 hours from creation to merge |
| CI failures | >5 failed CI runs |
| External blocker | Any (dependency, API, infrastructure) |
| Scope change | Task redefined mid-implementation |

**Major Incidents require:**
1. Incident Report section in PR (use template below)
2. Root cause documented
3. Prevention recommendations
4. Backlog item created for systemic issues

---

## Implementation: File Updates Required

### Update 1: `.claude/docs/PR-SOP.md`

Add to **Phase 9: Pre-Merge Checklist**:

```markdown
### 9.4 Debugging Metrics Verification (MANDATORY)

Before merging, SR Engineer MUST verify debugging metrics are accurately captured.

**Goal:** Capture ALL debugging for estimation accuracy, block only on clear discrepancies.

**Step 1: Collect evidence**
```bash
# Count fix commits
FIX_COUNT=$(git log --oneline origin/develop..HEAD | grep -iE "fix" | wc -l)
echo "Fix commits: $FIX_COUNT"

# Check PR age
gh pr view --json createdAt --jq '.createdAt'
```

**Step 2: Tiered response based on evidence vs reported**

| Fix Commits | Debugging Reported | Response |
|-------------|-------------------|----------|
| 0 | 0 | ✅ PASS |
| 0 | >0 | ✅ PASS (honest about investigation time) |
| 1-2 | 0 | ⚠️ ASK engineer: "These fix commits took 0 debugging time?" |
| 1-2 | >0 | ✅ PASS |
| 3-5 | 0 | ❌ BLOCK - Require metrics update before merge |
| 3-5 | >0 | ✅ PASS (verify roughly proportional) |
| 6+ | any | 📋 INCIDENT REPORT required |

**Step 3: Timeline as signal (not blocker)**

PR open time ≠ work time. Engineers wait for CI, answers, dependencies.

| PR Open | Debugging: 0? | Response |
|---------|---------------|----------|
| Any | Yes | **Investigate if fix commits present** |

**If PR >4h AND Debugging: 0, ASK:**
- "Was there waiting time (CI, blocked, waiting for answer)?"
- "Did any debugging happen during that time?"

**Only block if:** Long PR + fix commits + Debugging: 0 (clear discrepancy)

**Why this matters:** Without accurate debugging metrics, PM estimates appear more accurate than they are. Even 10 minutes of debugging affects estimation calibration.
```

### Update 2: `.claude/agents/engineer.md`

Add to **Step 6: Wait for CI and Debug**:

```markdown
### ALL Debugging Must Be Tracked (Non-Negotiable)

**Debugging = any work after initial implementation to fix issues.**

Track debugging if ANY of these occurred:
- CI failed and you made changes
- Type-check failed after implementation
- Tests failed and required fixes
- Lint errors beyond auto-fix
- ANY commit with "fix" in the message

**Even small debugging counts:**
```markdown
| Debugging (Debug) | 1 | ~4K | 10 min |  ← Honest (CI lint fix)
| Debugging (Debug) | 0 | 0 | 0 |         ← Should be rare
```

**Rule:** If you committed after CI failed, Debugging > 0.

**SR Engineer will verify:**
```bash
git log --oneline origin/develop..HEAD | grep -iE "fix" | wc -l
```

**Consequences:**
- 1-2 fix commits + Debugging: 0 → SR will ask for clarification
- 3+ fix commits + Debugging: 0 → PR blocked until updated
- 6+ fix commits → Incident Report required

### Why This Matters for You

Tracking debugging helps PM improve estimates. If debugging is hidden:
- PM thinks "4 turn estimate" was accurate when it took 6
- Future similar tasks get underestimated
- You get blamed for being "slow" when debugging was real work

**Accurate metrics protect your time estimates.**

### Major Incident Triggers

Document as Major Incident when ANY occur:
- Debugging takes >2 hours
- You make >5 fix commits
- CI fails >5 times on same issue
- External blocker (dependency, API, infrastructure)

[Major Incident Template - same as before]
```

### Update 3: `.claude/docs/shared/metrics-templates.md`

Add to **Validation Rules** section:

```markdown
## Debugging Metrics: Capture Everything

**Debugging is rarely 0.** Most tasks involve at least one CI fix, lint correction, or type error.

**What counts as debugging:**
- Any commit with "fix" in message
- CI investigation time (even if quick)
- Type errors after implementation
- Test fixes
- Lint fixes beyond auto-fix

**Honest example:**
```markdown
| Phase | Turns | Tokens | Active Time |
|-------|-------|--------|-------------|
| Implementation (Impl) | 4 | ~16K | 25 min |
| Debugging (Debug) | 1 | ~4K | 10 min |  ← CI lint fix
| **Engineer Total** | 5 | ~20K | 35 min |
```

## SR Engineer Verification

Before merge, check for discrepancies:

```bash
FIX_COUNT=$(git log --oneline origin/develop..HEAD | grep -iE "fix" | wc -l)
PR_AGE=$(gh pr view --json createdAt --jq '.createdAt')
```

**Tiered response:**
- 1-2 fix commits + Debugging: 0 → Ask
- 3+ fix commits + Debugging: 0 → Block
- 6+ fix commits → Incident Report required
- Long PR + fix commits + Debugging: 0 → Investigate (PR time ≠ work time)
```

---

## Why This Works

| Gap in TASK-704 | How This Fixes It |
|-----------------|-------------------|
| Debugging reported as 0 | SR Engineer cross-checks with git log |
| 22 fix commits not flagged | 6+ commits triggers incident report |
| 22h timeline not questioned | Long PR + fix commits = investigate |
| Small debugging hidden too | 1-2 fix commits prompts clarification |
| No incident documentation | Major Incident threshold requires report |
| Metrics not enforced | Tiered response: ask → block → incident |

**Key Principles:**

1. **Capture everything** - Even 1 fix commit should prompt "is debugging really 0?"
2. **Block intelligently** - Only block on clear discrepancies (3+ commits, 0 reported)
3. **Don't create friction** - Ask first for small discrepancies, block for clear ones
4. **Use objective data** - Git history and PR age, not just self-reporting

---

## Acceptance Criteria

- [ ] PR-SOP Phase 9 includes tiered debugging verification (ask/block/incident)
- [ ] engineer.md states ALL debugging must be tracked (even small)
- [ ] engineer.md explains WHY tracking helps engineer (better estimates)
- [ ] metrics-templates.md clarifies "Debugging: 0 should be rare"
- [ ] Tiered response defined: 1-2 commits = ask, 3+ = block, 6+ = incident
- [ ] Timeline used as signal to investigate (not automatic blocker)
- [ ] Major Incident template provided
- [ ] SR Engineer verification uses git commands (objective data)

---

## Estimated Effort

- **Turns:** 4-6
- **Tokens:** ~20K
- **Time:** 30-45m

---

## References

- TASK-704 CI incident (22 hours, 22 fix commits, reported as Debugging: 0)
- BACKLOG-120 (CI Testing Infrastructure Gaps - created from incident)
- SPRINT-010 Retrospective
- `.claude/docs/shared/metrics-templates.md` (already has Debugging row)
- `.claude/agents/engineer.md` (already mentions debugging tracking)

---

## Example: What TASK-704 Should Have Looked Like

If this process had been in place:

**Engineer Metrics (Correct):**
```markdown
| Phase | Turns | Tokens | Active Time |
|-------|-------|--------|-------------|
| Planning (Plan) | 1 | ~4K | 5 min |
| Implementation (Impl) | 4 | ~16K | 30 min |
| Debugging (Debug) | 20 | ~80K | 21 hours |
| **Engineer Total** | 25 | ~100K | 22 hours |

## Major Incident Report

**Type:** CI Failure
**Duration:** 21 hours
**Fix Commits:** 22
**CI Failures:** 15+

### Timeline
- 08:16: PR created, CI fails on test hang
- 09:00: Identified Jest not exiting
- 12:00: Tried --forceExit, fake timer cleanup
- 18:00: Excluded integration tests
- 06:00 next day: Narrowed to ContactSelectModal.test.tsx
- 06:11: Final fix, CI passes

### Root Cause
Mock classes using EventEmitter + setTimeout kept Node.js event loop alive.
Native modules compiled for Electron incompatible with Jest/Node.js.

### Resolution
Skip problematic tests in CI (documented in BACKLOG-120).

### Prevention
1. Created BACKLOG-120 for CI infrastructure improvement
2. Added test isolation verification to CI
```

**SR Engineer Verification Would Have Caught:**
```bash
$ git log --oneline origin/develop..HEAD | grep -E "fix" | wc -l
22  # ❌ BLOCK: 22 fix commits but Debugging: 0

$ gh pr view --json createdAt
# Created 08:16, now 06:20 next day = 22 hours
# ❌ BLOCK: PR open >8h but Debugging: 0
```
