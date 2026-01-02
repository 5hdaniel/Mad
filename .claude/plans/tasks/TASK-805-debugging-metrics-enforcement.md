# Task TASK-805: Enforce Debugging Metrics with Commit Verification

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add tiered debugging metrics verification to the PR workflow so SR Engineers can cross-check reported debugging time against objective evidence (git commit history), preventing incidents where major debugging effort (e.g., 22 hours) is reported as "0".

## Non-Goals

- Do NOT create new metrics fields (Debugging row already exists)
- Do NOT change the PR template structure
- Do NOT add automated CI checks (this is SR Engineer manual verification)
- Do NOT modify task file templates beyond documentation

## Deliverables

1. Update: `.claude/docs/PR-SOP.md` - Add section 9.4 for debugging verification
2. Update: `.claude/agents/engineer.md` - Add debugging tracking requirements
3. Update: `.claude/docs/shared/metrics-templates.md` - Add validation rules section

## Acceptance Criteria

- [ ] PR-SOP Phase 9 includes tiered debugging verification (ask/block/incident thresholds)
- [ ] engineer.md states ALL debugging must be tracked (even 10 minutes)
- [ ] engineer.md explains WHY tracking helps engineer (better estimates)
- [ ] metrics-templates.md clarifies "Debugging: 0 should be rare"
- [ ] Tiered response defined: 1-2 commits = ask, 3-5 = block, 6+ = incident report
- [ ] Timeline used as signal to investigate (not automatic blocker)
- [ ] Major Incident template or reference provided
- [ ] SR Engineer verification uses git commands (objective data)
- [ ] All CI checks pass

## Implementation Notes

### PR-SOP Addition (Section 9.4)

Add after existing Phase 9 content:

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
| 0 | 0 | PASS |
| 0 | >0 | PASS (honest about investigation time) |
| 1-2 | 0 | ASK engineer: "These fix commits took 0 debugging time?" |
| 1-2 | >0 | PASS |
| 3-5 | 0 | BLOCK - Require metrics update before merge |
| 3-5 | >0 | PASS (verify roughly proportional) |
| 6+ | any | INCIDENT REPORT required |

**Step 3: Timeline as signal (not blocker)**

PR open time does not equal work time. Engineers wait for CI, answers, dependencies.

**If PR >4h AND Debugging: 0, ASK:**
- "Was there waiting time (CI, blocked, waiting for answer)?"
- "Were there any unexpected issues that required debugging?"
- "Did investigation/troubleshooting happen that didn't result in fix commits?"

**Only block if:** fix commits present + Debugging: 0 (clear discrepancy)

**Why this matters:** Without accurate debugging metrics, PM estimates appear more accurate than they are. Even 10 minutes of debugging affects estimation calibration.
```

### engineer.md Addition

Add to Step 6 (Wait for CI and Debug):

```markdown
### ALL Debugging Must Be Tracked (Non-Negotiable)

**Debugging = any work after initial implementation to fix issues.**

Track debugging if ANY of these occurred:
- CI failed and you made changes
- Type-check failed after implementation
- Tests failed and required fixes
- Lint errors beyond auto-fix
- ANY commit with "fix" in the message
- Investigation time (even if no commit resulted)

**Even small debugging counts:**
```markdown
| Debugging (Debug) | 1 | ~4K | 10 min |  <- Honest (CI lint fix)
| Debugging (Debug) | 0 | 0 | 0 |         <- Should be rare
```

**Rule:** If you committed after CI failed, Debugging > 0.

**SR Engineer will verify:**
```bash
git log --oneline origin/develop..HEAD | grep -iE "fix" | wc -l
```

**Consequences:**
- 1-2 fix commits + Debugging: 0 -> SR will ask for clarification
- 3+ fix commits + Debugging: 0 -> PR blocked until updated
- 6+ fix commits -> Incident Report required

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
```

### metrics-templates.md Addition

Add to Validation Rules section:

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
| Debugging (Debug) | 1 | ~4K | 10 min |  <- CI lint fix
| **Engineer Total** | 5 | ~20K | 35 min |
```

## SR Engineer Verification

Before merge, check for discrepancies:

```bash
FIX_COUNT=$(git log --oneline origin/develop..HEAD | grep -iE "fix" | wc -l)
PR_AGE=$(gh pr view --json createdAt --jq '.createdAt')
```

**Tiered response:**
- 1-2 fix commits + Debugging: 0 -> Ask
- 3+ fix commits + Debugging: 0 -> Block
- 6+ fix commits -> Incident Report required
- Long PR + fix commits + Debugging: 0 -> Investigate (PR time != work time)
```

## Integration Notes

- Imports from: N/A (documentation only)
- Exports to: N/A (documentation only)
- Used by: All future PR reviews
- Depends on: None

## Do / Don't

### Do:

- Copy content from BACKLOG-126 - it has been refined and approved
- Preserve existing document structure and formatting
- Add new sections at appropriate locations (not just appended)
- Cross-reference between the three updated files

### Don't:

- Rewrite existing content that is working fine
- Add redundant content already covered elsewhere
- Create new files (all updates go to existing docs)
- Add automated CI enforcement (this is manual SR verification)

## When to Stop and Ask

- If existing PR-SOP Phase 9 structure is unclear
- If engineer.md Step 6 location is ambiguous
- If metrics-templates.md validation section doesn't exist
- If any conflict with existing guidance is found

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation only)

### Coverage

- Coverage impact: None (documentation only)

### Integration / Feature Tests

- Required: No (documentation only)

### CI Requirements

This task's PR MUST pass:
- [ ] Markdown linting (if configured)
- [ ] No broken links in documentation
- [ ] Type checking (unaffected)
- [ ] Lint / format checks (unaffected)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `docs(process): add debugging metrics verification to PR workflow`
- **Labels**: `documentation`, `process`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Estimated Totals:**
- **Turns:** 2-3
- **Tokens:** ~10K-15K
- **Time:** ~15-25m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 3 existing files | +1 |
| Content provided | BACKLOG-126 has full content | +0.5 |
| Integration complexity | Append to existing sections | +0.5 |
| Cross-reference updates | Minimal | +0 |

**Confidence:** High

**Risk factors:**
- Content already exists in BACKLOG-126 (reduces risk)
- Simple documentation update

**Similar past tasks:** BACKLOG-072 (docs, actual 11 turns but that created new docs from scratch)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files modified:
- [ ] .claude/docs/PR-SOP.md (Section 9.4 added)
- [ ] .claude/agents/engineer.md (debugging tracking added)
- [ ] .claude/docs/shared/metrics-templates.md (validation added)

Content verified:
- [ ] Tiered response table is clear
- [ ] Git commands are correct
- [ ] Cross-references work
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 3 | X | +/- X | <reason> |
| Content provided | Full | X | - | <reason if changed> |
| Integration complexity | Low | X | - | <reason if changed> |

**Total Variance:** Est 2-3 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** N/A (documentation)
**Security Review:** N/A
**Test Coverage:** N/A

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
