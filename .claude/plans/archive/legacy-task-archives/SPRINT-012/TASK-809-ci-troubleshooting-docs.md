# Task TASK-809: Create CI Troubleshooting Documentation

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

Create CI troubleshooting documentation with clear escalation steps for common CI issues like stuck tests, queue congestion, and when to use admin merge, based on patterns observed in SPRINT-011 where TASK-700 was delayed 30+ minutes due to unclear escalation paths.

## Non-Goals

- Do NOT modify CI workflows
- Do NOT add automated CI fixes
- Do NOT create CI monitoring dashboards
- Do NOT modify GitHub Actions configuration

## Deliverables

1. New file: `.claude/docs/shared/ci-troubleshooting.md`
2. Update: `CLAUDE.md` - Add reference to CI troubleshooting doc in Shared References table

## Acceptance Criteria

- [ ] ci-troubleshooting.md created with stuck test escalation steps
- [ ] Common CI failures section with solutions included
- [ ] CI queue congestion explanation included
- [ ] Admin merge guidelines (when to use, when not to use)
- [ ] CLAUDE.md updated with reference to new doc
- [ ] All CI checks pass

## Implementation Notes

### ci-troubleshooting.md Content

Create new file at `.claude/docs/shared/ci-troubleshooting.md`:

```markdown
# CI Troubleshooting Guide

**Status:** Shared reference for CI issues
**Last Updated:** 2026-01-01

---

## Overview

This guide provides escalation steps for common CI issues. Use it when CI is stuck, failing unexpectedly, or experiencing queue congestion.

---

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
1. Check for test flakiness (same test failing intermittently)
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

**Common causes:**
- Missing type imports
- Incorrect interface properties
- Enum value mismatches

### Lint Errors

```bash
# Auto-fix most issues
npm run lint -- --fix

# Check specific files
npm run lint -- path/to/file.ts
```

### Test Failures

```bash
# Run specific test file
npm test -- --testPathPattern=<filename>

# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- -t "test name"
```

### Native Module Errors (NODE_MODULE_VERSION mismatch)

**Symptoms:**
```
Error: The module was compiled against a different Node.js version
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 133.
```

**Fix:**
```bash
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

**See:** `.claude/docs/shared/native-module-fixes.md` for detailed troubleshooting.

---

## CI Queue Congestion

GitHub Actions free tier has limited concurrent runners.

**Symptoms:**
- Jobs queued for 10+ minutes
- Push-triggered runs complete faster than PR-triggered runs
- Multiple jobs pending for the same repository

**Mitigations:**
1. Cancel stuck runs before retriggering
2. Avoid pushing multiple commits in rapid succession
3. Consider off-peak hours for large PR batches
4. Batch small changes into fewer PRs

---

## When to Use Admin Merge

Use `gh pr merge --admin` when ALL of these are true:

- [ ] CI has been stuck 15+ minutes
- [ ] You've tried 2+ retrigger attempts
- [ ] The failure is CI infrastructure, not code
- [ ] You've documented the reason in PR comments

**Example PR comment:**
```markdown
## Admin Merge Justification

CI stuck for 25+ minutes. Actions:
1. Canceled run #1234 (stuck at 15m)
2. Retriggered, run #1235 also stuck
3. Verified code passes locally: `npm run type-check && npm run lint && npm test`
4. Using admin merge due to GitHub Actions queue congestion.
```

**DO NOT use admin merge when:**
- Tests are actually failing
- Type-check or lint errors exist
- You haven't tried retrigger first
- The failure might be real code issues

---

## Escalation Timeline

| Time Stuck | Action |
|------------|--------|
| 0-10 min | Wait (normal queue time) |
| 10-15 min | Cancel and retrigger once |
| 15-20 min | Retrigger second time |
| 20+ min | Consider admin merge (document in PR) |

---

## References

- Native module fixes: `.claude/docs/shared/native-module-fixes.md`
- CI workflow configuration: `.github/workflows/ci.yml`
- GitHub Actions documentation: https://docs.github.com/en/actions
```

### CLAUDE.md Update

Add to the "Shared References (Canonical Sources)" table:

```markdown
| CI Troubleshooting | `.claude/docs/shared/ci-troubleshooting.md` |
```

## Integration Notes

- Imports from: N/A (documentation only)
- Exports to: N/A (documentation only)
- Used by: All engineers when CI issues occur
- Depends on: None

## Do / Don't

### Do:

- Include copy-paste ready bash commands
- Reference existing docs (native-module-fixes.md)
- Keep escalation timeline clear and actionable
- Document when admin merge is acceptable

### Don't:

- Create CI automation in this task
- Modify GitHub Actions workflows
- Add complex troubleshooting flows
- Duplicate content from native-module-fixes.md

## When to Stop and Ask

- If shared docs directory structure is unclear
- If CLAUDE.md table format is different than expected
- If similar CI documentation already exists

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation only)

### Coverage

- Coverage impact: None (documentation only)

### Integration / Feature Tests

- Required: No (documentation only)

### CI Requirements

This task's PR MUST pass:
- [ ] No broken links in documentation
- [ ] Markdown formatting valid

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `docs(shared): add CI troubleshooting guide`
- **Labels**: `documentation`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~6K-8K
- **Time:** ~10-15m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 1 new file | +0.5 |
| Files to modify | 1 existing file (CLAUDE.md) | +0.5 |
| Content provided | BACKLOG-129 has full content | +0 |
| Integration complexity | Simple reference addition | +0 |

**Confidence:** High

**Risk factors:**
- Content already defined in backlog item
- Simple file creation and reference update

**Similar past tasks:** Documentation creation typically completes in 1-2 turns

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
Files created:
- [ ] .claude/docs/shared/ci-troubleshooting.md

Files modified:
- [ ] CLAUDE.md (added reference)

Content verified:
- [ ] Escalation steps are clear
- [ ] Bash commands are correct
- [ ] Admin merge guidelines are complete
- [ ] Reference in CLAUDE.md works
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
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 1 | X | +/- X | <reason> |
| Files to modify | 1 | X | +/- X | <reason> |

**Total Variance:** Est 1-2 turns -> Actual X turns (X% over/under)

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
