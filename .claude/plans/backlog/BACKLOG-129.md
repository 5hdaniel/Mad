# BACKLOG-129: Create CI Troubleshooting Documentation

**Priority:** Medium
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-011 Retrospective - Pattern 1: CI Queue Congestion

---

## Problem Statement

TASK-700 (PR #249) was delayed 30+ minutes due to stuck CI:
- Pull request-triggered runs queued for 15+ minutes
- Required 4 CI retriggerings
- Ultimately required admin merge

There was no documented escalation path for stuck CI, causing engineers to waste time on ad-hoc solutions.

**Evidence from SPRINT-011 Retro:**
> "TASK-700 PR #249 took 30+ extra minutes due to lack of clear escalation path."

---

## Proposed Solution

Create CI troubleshooting documentation with clear escalation steps for common issues.

## Deliverables

1. New file: `.claude/docs/shared/ci-troubleshooting.md`
2. Update: `CLAUDE.md` - Add reference to CI troubleshooting doc

## Implementation Notes

### Proposed Content for ci-troubleshooting.md

```markdown
# CI Troubleshooting Guide

## Stuck Tests (Pending for 10+ Minutes)

### Step 1: Cancel and Retrigger
```bash
# Find the stuck run ID
gh run list --branch <your-branch> --limit 5

# Cancel the stuck run
gh run cancel <run-id>

# Push empty commit to retrigger
git commit --allow-empty -m "chore: retrigger CI" && git push
```

### Step 2: If Still Stuck After 2 Retries
```bash
# Use admin merge (requires repo admin permissions)
gh pr merge <PR-NUMBER> --merge --admin
```

**IMPORTANT:** Document admin merge in PR comments explaining why it was needed.

### Step 3: Report Recurring Issues
If CI gets stuck repeatedly on the same PR:
1. Check for test flakiness
2. Check for resource-intensive tests
3. Consider splitting large PRs
4. Report to team if systemic

---

## Common CI Failures

### TypeScript Compilation Errors
```bash
# Run locally to see full error
npm run type-check
```

### Lint Errors
```bash
# Auto-fix most issues
npm run lint -- --fix
```

### Test Failures
```bash
# Run specific test file
npm test -- --testPathPattern=<filename>

# Run with verbose output
npm test -- --verbose
```

### Native Module Errors (NODE_MODULE_VERSION mismatch)
```bash
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

---

## CI Queue Congestion

GitHub Actions free tier has limited concurrent runners.

**Symptoms:**
- Jobs queued for 10+ minutes
- Push-triggered runs complete faster than PR-triggered runs

**Mitigations:**
- Cancel stuck runs before retriggering
- Avoid pushing multiple commits in rapid succession
- Consider off-peak hours for large PR batches

---

## When to Use Admin Merge

Use `gh pr merge --admin` when:
- [ ] CI has been stuck 15+ minutes
- [ ] You've tried 2+ retrigger attempts
- [ ] The failure is CI infrastructure, not code
- [ ] You've documented the reason in PR comments

**DO NOT use admin merge when:**
- Tests are actually failing
- Type-check or lint errors exist
- You haven't tried retrigger first
```

---

## Acceptance Criteria

- [ ] ci-troubleshooting.md created with stuck test escalation steps
- [ ] Common CI failures section with solutions
- [ ] CI queue congestion explanation included
- [ ] Admin merge guidelines (when to use, when not to use)
- [ ] CLAUDE.md updated with reference to new doc

---

## Estimated Effort

- **Turns:** 2-3
- **Tokens:** ~10K
- **Time:** 15-20m

---

## References

- SPRINT-011 Retrospective: Pattern 1 (CI Queue Congestion)
- SPRINT-011-phase-retro-report.md: Proposal 2
- SPRINT-011-completion-report.md: CI Failures section
- TASK-700 (PR #249): Admin merge required after 4 retrigger attempts
