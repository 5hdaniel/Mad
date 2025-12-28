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
git merge origin/<PR Target>  # develop, int/xxx, project/xxx, or main

# If conflicts exist, resolve them NOW
# Run tests locally
npm run type-check
npm test

# Then push
git push
```

**For sprint tasks:** Use the PR Target from your task file's Branch Configuration section.

**Full procedure:** See `.claude/docs/PR-SOP.md` Phase 7.5

---

## Git Worktrees (Parallel Development)

Use worktrees when you need to work on a separate branch without interrupting your current work.

### When to Use Worktrees

| Scenario | Why Worktree |
|----------|--------------|
| Quick fix while mid-task | Keep current branch untouched |
| Reviewing another PR | Test code without switching context |
| CI/build fixes | Isolate from feature work |
| Comparing branches | Side-by-side directories |

### Worktree Commands

```bash
# Create worktree for a new branch (based on develop)
git worktree add ../repo-fix develop -b fix/quick-fix

# Create worktree for an existing branch
git worktree add ../repo-feature feature/existing-branch

# List all worktrees
git worktree list

# Remove worktree when done
git worktree remove ../repo-fix

# Force remove if there are uncommitted changes
git worktree remove ../repo-fix --force
```

### Worktree Workflow Example

```bash
# You're mid-task on feature/TASK-500
# CI fix needed urgently

# 1. Create worktree for the fix
git worktree add ../Mad-ci-fix develop -b fix/ci-flaky-test

# 2. Work in the new directory
cd ../Mad-ci-fix
# ... make changes, test, commit ...
git push -u origin fix/ci-flaky-test
gh pr create --base develop

# 3. After PR merged, clean up
cd ../Mad  # back to original
git worktree remove ../Mad-ci-fix

# 4. Continue original work - branch untouched
```

### Best Practices

- **Naming:** Use descriptive directory names like `repo-fix`, `repo-review`, `repo-hotfix`
- **Cleanup:** Always remove worktrees after merging to avoid stale directories
- **Sync:** Each worktree is independent - don't forget to sync both with origin

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
