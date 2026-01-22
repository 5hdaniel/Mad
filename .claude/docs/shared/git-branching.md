# Git Branching Strategy

**Status:** Canonical reference for branching and merge policies
**Last Updated:** 2024-12-24

---

## Branch Structure

Magic Audit follows a GitFlow-inspired branching strategy:

```
main (production)
  │
  └── PR (traditional merge)
        │
develop (integration/staging)
  │
  └── PR (traditional merge)
        │
feature/*, fix/*, claude/* (feature branches)
```

---

## Branch Types

| Branch | Purpose | Branch From | Merge To | Protected |
|--------|---------|-------------|----------|-----------|
| `main` | Production-ready code | - | - | Yes |
| `develop` | Integration branch for next release | - | `main` | Yes |
| `feature/*` | New features | `develop` | `develop` | No |
| `fix/*` | Bug fixes | `develop` | `develop` | No |
| `hotfix/*` | Urgent production fixes | `main` | `main` AND `develop` | No |
| `claude/*` | AI-assisted development | `develop` | `develop` | No |
| `int/*` | Integration branches (multi-feature) | `develop` | `develop` | No |
| `project/*` | Multi-sprint project branches | `develop` | `develop` | No |

---

## Branch Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/dark-mode` |
| `fix/` | Bug fixes | `fix/login-crash` |
| `hotfix/` | Urgent production fixes | `hotfix/security-patch` |
| `claude/` | AI-assisted development | `claude/refactor-auth` |
| `int/` | Integration branches | `int/ai-polish` |
| `project/` | Multi-sprint projects | `project/ai-integration` |
| `refactor/` | Code refactoring | `refactor/docs-consolidation` |

For sprint tasks, include the task ID:
- `fix/task-510-database-cleanup`
- `feature/task-512-export-feature`

---

## Merge Policy

**CRITICAL: Always use traditional merges (not squash) to preserve commit history.**

```bash
# CORRECT - traditional merge
gh pr merge <PR-NUMBER> --merge

# WRONG - squash loses commit history
gh pr merge <PR-NUMBER> --squash  # DO NOT USE
```

---

## Branch Deletion Policy

**Do NOT auto-delete branches.** Branch deletion is a separate, manual step.

| Branch Type | When to Delete | How |
|-------------|----------------|-----|
| `feature/*`, `fix/*` | After merge confirmed AND no dependent work | Manual: `git branch -d branch-name` |
| `int/*` | NEVER auto-delete | May be needed for reference |
| `hotfix/*` | After merged to BOTH main and develop | Manual |
| `project/*` | After project milestone complete | Manual, with team confirmation |

**PR merge command (no auto-delete):**
```bash
gh pr merge <PR-NUMBER> --merge
# NOT: gh pr merge <PR-NUMBER> --merge --delete-branch
```

---

## Workflow Examples

### Starting New Feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# ... make changes ...
git push -u origin feature/my-feature
gh pr create --base develop --title "feat: my feature"
```

### Bug Fix

```bash
git checkout develop
git pull origin develop
git checkout -b fix/bug-description
# ... fix bug ...
git push -u origin fix/bug-description
gh pr create --base develop --title "fix: bug description"
```

### Hotfix (Production Emergency)

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. Make fix and test
# ...

# 3. Create PR to main
git push -u origin hotfix/critical-fix
gh pr create --base main --title "hotfix: critical fix"

# 4. After merge to main, also merge to develop
git checkout develop
git pull origin develop
git merge origin/main
git push origin develop
```

### Release (develop to main)

```bash
git checkout develop
git pull origin develop
# Create PR from develop to main
gh pr create --base main --head develop --title "release: v1.2.3"
# After merge, main triggers production packaging
```

---

## Integration Branch Rules

Integration branches (`int/*`) collect related feature work before merging to develop.

**Before starting any new sprint:**
```bash
git branch -a | grep "int/"
```

**If integration branches exist with unmerged work:**

| Situation | Action |
|-----------|--------|
| Existing work is related/foundational | Base new sprint on the `int/*` branch |
| Existing work is complete and tested | Merge `int/*` to develop first |
| Parallel work truly needed | Sync both branches regularly |

**Never branch new sprint work from develop when develop is behind an active `int/*` branch.**

---

## Project Branches (Multi-Sprint Work)

For related work spanning multiple sprints:

```bash
# Create project branch
git checkout develop
git checkout -b project/ai-integration

# Sprint work branches off project branch
git checkout project/ai-integration
git checkout -b feature/ai-sprint-1-task-xxx

# Merge sprint work to project branch first
# Then merge project branch to develop when milestone complete
```

---

## Branch Protection Rules

Both `main` and `develop` have protection rules:
- Required status checks must pass
- Force pushes are blocked
- Branch deletion is blocked

---

## Pre-PR Sync (Mandatory)

Before creating a PR, always sync with target branch:

```bash
git fetch origin
git merge origin/develop  # or origin/main for hotfixes

# If conflicts exist, resolve them NOW
# Run tests locally
npm run type-check
npm test

# Then push
git push
```

---

## Bug Fix Workflow Reminder

**Before investigating any reported bug:**
```bash
# Check for existing fix branches
git branch -a | grep "fix/"
```

If an existing fix branch seems related:
1. Check its commits: `git log fix/<branch-name> --oneline -5`
2. Compare to develop: `git diff develop...fix/<branch-name> --stat`
3. If it contains the fix, **merge it** instead of starting over

**After creating a fix branch:** A fix is NOT complete until merged. Don't move on until the PR is merged.

---

## Git Worktrees (Parallel Sprint Execution)

> **MANDATORY for Background Agents:** If you are running as a background agent (`run_in_background: true`) or executing parallel sprint tasks, you MUST use isolated git worktrees. This is NON-NEGOTIABLE.
>
> **Incident Reference:** BACKLOG-132 - ~18M tokens burned (~500x overrun) when two background agents worked in the same directory without worktree isolation.

When executing sprint tasks in parallel, use git worktrees to maintain multiple branches simultaneously.

### Creating Worktrees for Sprint Tasks

The `git worktree add` command with `-b` creates BOTH the branch AND the worktree directory in one step.

**Syntax:** `git worktree add <path> -b <new-branch> <base-branch>`

```bash
# Feature work (base from develop)
git worktree add ../Mad-task-701 -b feature/TASK-701-html-email develop

# Bug fix (base from develop)
git worktree add ../Mad-task-804 -b fix/TASK-804-flaky-test develop

# Documentation/refactor (base from develop)
git worktree add ../Mad-task-616 -b refactor/TASK-616-console-cleanup develop

# Hotfix (base from main - production emergency)
git worktree add ../Mad-hotfix-001 -b hotfix/critical-security-patch main
```

### Verification Steps (MANDATORY)

**Always verify worktree creation before proceeding:**

```bash
# Step 1: Verify worktree exists
git worktree list
# Expected output for each worktree:
# /Users/you/Mad-task-701  abc1234 [feature/TASK-701-html-email]

# Step 2: Verify directory is accessible
ls /Users/you/Mad-task-701
# Should show: package.json, src/, electron/, etc.

# Step 3: Verify correct branch
git -C /Users/you/Mad-task-701 branch --show-current
# Should show: feature/TASK-701-html-email
```

### Common Failure Modes and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `fatal: 'feature/TASK-XXX' already exists` | Branch name already in use | Delete: `git branch -D feature/TASK-XXX` then retry |
| `fatal: '/path/to/Mad-task-XXX' already exists` | Directory exists | Remove: `rm -rf /path/to/Mad-task-XXX` then retry |
| `fatal: not a git repository` | Running from wrong directory | Use `-C` flag: `git -C /path/to/Mad worktree add ...` |
| `Preparing worktree (new branch)` then hangs | Network issue fetching | Add `--no-track` flag, push later |
| Worktree not in `git worktree list` | Creation failed silently | Check command output, fix error, retry |

### Example Workflow: Worktree from Creation to PR

```bash
# === SETUP (from main repo) ===
cd /Users/daniel/Documents/Mad
git fetch origin
git pull origin develop

# === CREATE WORKTREE ===
git worktree add ../Mad-task-801 -b feature/TASK-801-sms-fixtures develop

# === VERIFY ===
git worktree list
ls ../Mad-task-801/package.json  # Should exist

# === WORK IN WORKTREE (always use absolute paths or -C) ===
git -C /Users/daniel/Documents/Mad-task-801 status
# ... make changes ...
git -C /Users/daniel/Documents/Mad-task-801 add -A
git -C /Users/daniel/Documents/Mad-task-801 commit -m "feat: add SMS fixtures"
git -C /Users/daniel/Documents/Mad-task-801 push -u origin feature/TASK-801-sms-fixtures

# === CREATE PR ===
gh pr create --repo 5hdaniel/Mad --head feature/TASK-801-sms-fixtures --base develop

# === CLEANUP (after PR merged) ===
git worktree remove ../Mad-task-801 --force
```

**CRITICAL:** Always use `git -C /absolute/path` or `--prefix` for npm. Never rely on `cd` to maintain context in automated workflows.

### Worktree Naming Convention

| Pattern | Example |
|---------|---------|
| `Mad-task-<NNN>` | `Mad-task-701`, `Mad-task-800` |
| Based on task ID | Matches the TASK-XXX being implemented |

### Worktree Cleanup (MANDATORY)

**Important:** Git worktrees are NOT automatically cleaned up when PRs merge. They must be explicitly removed after sprint completion.

**After sprint completion:**
```bash
# List all worktrees
git worktree list

# Remove each completed worktree
git worktree remove Mad-task-701 --force
git worktree remove Mad-task-702 --force
git worktree remove Mad-task-800 --force

# Verify cleanup
git worktree list
```

**Bulk cleanup script:**
```bash
# Remove all Mad-task-* worktrees at once
for wt in Mad-task-*; do
  if [ -d "$wt" ]; then
    git worktree remove "$wt" --force
    echo "Removed worktree: $wt"
  fi
done
```

### When to Clean Up Worktrees

| Trigger | Action |
|---------|--------|
| All sprint PRs merged | Remove all sprint worktrees |
| Sprint cancelled/abandoned | Remove associated worktrees |
| Task moved to different sprint | Remove old worktree if branch changed |

### Worktree Cleanup Responsibility

| Role | Responsibility |
|------|----------------|
| PM | Verify worktree cleanup in sprint completion checklist |
| Engineer | Clean up worktrees after their tasks merge |
| SR Engineer | Verify no orphaned worktrees during PR review |
