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
- Source: BACKLOG-129 (from SPRINT-011 retrospective - TASK-700 CI delays)
