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

## Solution: SR Engineer Commit Verification Protocol

### 1. Mandatory Git History Check Before Merge

**Add to PR-SOP Phase 9 (Pre-Merge Checklist):**

```bash
# REQUIRED: Check commit history for unreported debugging
git log --oneline origin/develop..HEAD | grep -E "^[a-f0-9]+ fix" | wc -l
```

| Fix Commit Count | Action |
|------------------|--------|
| 0-2 | Normal - no action needed |
| 3-5 | Flag: Request debugging metrics update if Debugging shows 0 |
| 6+ | **BLOCKER**: Major debugging occurred, require incident documentation |

### 2. Timeline Verification

```bash
# Check PR creation time vs now
gh pr view <PR> --json createdAt,url
```

| Time Open | Action |
|-----------|--------|
| <4 hours | Normal |
| 4-8 hours | Verify debugging tracked if any fix commits present |
| >8 hours | **BLOCKER**: Require explanation, likely missing debugging metrics |

### 3. Debugging Metrics Cross-Check

**SR Engineer MUST verify:**

```markdown
## Debugging Verification (MANDATORY)

1. Fix commit count: `git log --oneline develop..HEAD | grep -E "fix" | wc -l`
   Result: X commits

2. Reported debugging: [from Engineer Metrics section]
   Result: X turns, X min

3. Verification:
   - [ ] If 0 fix commits AND 0 debugging reported → PASS
   - [ ] If 3+ fix commits AND debugging > 0 → PASS
   - [ ] If 3+ fix commits AND debugging = 0 → **BLOCK: Update metrics**
   - [ ] If PR open >8h AND debugging = 0 → **BLOCK: Explain timeline**
```

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

Before merging, SR Engineer MUST verify debugging metrics are accurate:

**Step 1: Check fix commit count**
```bash
git log --oneline origin/develop..HEAD | grep -iE "^[a-f0-9]+ fix" | wc -l
```

**Step 2: Check PR timeline**
```bash
gh pr view <PR> --json createdAt --jq '.createdAt'
# Compare to current time
```

**Step 3: Cross-check with reported metrics**

| Scenario | Action |
|----------|--------|
| 0 fix commits, Debugging: 0 | ✅ PASS |
| 1-2 fix commits, Debugging: 0 | ⚠️ Verify - ask engineer if truly 0 |
| 3+ fix commits, Debugging: 0 | ❌ BLOCK - Require metrics update |
| PR open >8h, Debugging: 0 | ❌ BLOCK - Require explanation |

**Step 4: Major Incident Check**

If ANY of these are true, require Incident Report:
- [ ] Debugging >2 hours
- [ ] >5 fix commits
- [ ] PR open >8 hours
- [ ] >5 CI failures

**DO NOT MERGE if debugging appears undercounted. Send back to engineer.**
```

### Update 2: `.claude/agents/engineer.md`

Add to **Step 6: Wait for CI and Debug**:

```markdown
### CI Debugging Is Tracked Work (Non-Negotiable)

**CRITICAL:** If you create ANY commit with "fix" in the message, you MUST:
1. Count those turns in the Debugging row
2. Track the time spent debugging
3. Update your metrics before SR Engineer review

**SR Engineer will run:**
```bash
git log --oneline origin/develop..HEAD | grep -E "fix" | wc -l
```

If fix commits > 0 but Debugging = 0, **your PR will be blocked**.

### Major Incident Triggers

If ANY of these occur, document as a Major Incident:
- Debugging takes >2 hours
- You make >5 fix commits
- CI fails >5 times on the same issue
- You hit an external blocker (dependency, API, infrastructure)

**Major Incident Template:**

```markdown
## Major Incident Report

**Type:** [CI Failure | External Blocker | Scope Creep | Other]
**Duration:** X hours
**Fix Commits:** X
**CI Failures:** X

### Timeline
- [Time]: [Event]
- [Time]: [Event]

### Root Cause
[Description]

### Resolution
[What fixed it]

### Prevention
[How to avoid in future]

### Backlog Item
[If systemic, create BACKLOG-XXX]
```
```

### Update 3: `.claude/docs/shared/metrics-templates.md`

Add to **Validation Rules** section:

```markdown
## Automated Verification (SR Engineer)

Before merge, SR Engineer runs:

```bash
# Count fix commits
FIX_COUNT=$(git log --oneline origin/develop..HEAD | grep -iE "^[a-f0-9]+ fix" | wc -l)
echo "Fix commits: $FIX_COUNT"

# Check PR age
PR_CREATED=$(gh pr view --json createdAt --jq '.createdAt')
echo "PR created: $PR_CREATED"
```

**Blocking Conditions:**
- `FIX_COUNT >= 3` AND Debugging row shows 0 → BLOCK
- PR open >8 hours AND Debugging row shows 0 → BLOCK
- `FIX_COUNT >= 6` AND no Incident Report → BLOCK
```

---

## Why This Works

| Gap in TASK-704 | How This Fixes It |
|-----------------|-------------------|
| Debugging reported as 0 | SR Engineer cross-checks with git log |
| 22 fix commits not flagged | Commit count triggers blocking threshold |
| 22h timeline not questioned | PR age check flags >8h PRs |
| No incident documentation | Major Incident threshold requires report |
| Metrics not enforced | SR Engineer BLOCKS merge on discrepancy |

**Key Principle:** The verification is performed by SR Engineer using objective git data, not relying on engineer self-reporting alone.

---

## Acceptance Criteria

- [ ] PR-SOP Phase 9 includes debugging verification steps with git commands
- [ ] engineer.md explicitly states fix commits = debugging metrics required
- [ ] metrics-templates.md includes automated verification commands
- [ ] Major Incident threshold defined (>2h, >5 commits, >8h PR, >5 CI failures)
- [ ] Major Incident template provided
- [ ] SR Engineer has clear BLOCK criteria (not just warnings)

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
