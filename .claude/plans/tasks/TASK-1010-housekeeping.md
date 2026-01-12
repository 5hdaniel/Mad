# TASK-1010: Sprint Housekeeping (Worktree & Branch Cleanup)

**Sprint:** SPRINT-028
**Phase:** Phase 0 - Housekeeping (Sprint Kickoff)
**Estimated Tokens:** ~5K
**Token Cap:** 20K

---

## Objective

Clean up orphaned git worktrees from SPRINT-027 and optionally prune stale remote branches.

---

## Context

SR Engineer identified:
- 5 orphaned worktrees from SPRINT-027 (~5GB disk space)
- 174 remote feature/fix branches (many likely stale)

---

## Part 1: Worktree Cleanup (Required)

### Orphaned Worktrees
- `Mad-task-990`
- `Mad-task-991`
- `Mad-task-992`
- `Mad-task-994`
- `Mad-task-995`

### Commands
```bash
# List current worktrees
git worktree list

# Remove each orphaned worktree
git worktree remove ../Mad-task-990 --force
git worktree remove ../Mad-task-991 --force
git worktree remove ../Mad-task-992 --force
git worktree remove ../Mad-task-994 --force
git worktree remove ../Mad-task-995 --force

# Verify cleanup
git worktree list
```

---

## Part 2: Branch Cleanup (Optional)

### Identify Stale Branches
```bash
# List remote branches merged to develop
git branch -r --merged origin/develop | grep -v 'HEAD\|main\|develop' | wc -l

# List branches older than 30 days (requires investigation)
git for-each-ref --sort=committerdate refs/remotes/ --format='%(committerdate:short) %(refname:short)'
```

### Cleanup (if approved)
```bash
# Delete merged remote branches (CAREFUL - review list first)
git branch -r --merged origin/develop | grep -v 'HEAD\|main\|develop' | sed 's/origin\///' | xargs -n 1 git push origin --delete
```

**Note:** Branch cleanup is optional and should be done carefully. Worktree cleanup is the priority.

---

## Acceptance Criteria

- [ ] All 5 orphaned worktrees removed
- [ ] `git worktree list` shows only main repo
- [ ] ~5GB disk space recovered
- [ ] (Optional) Stale branches identified and cleaned

---

## Implementation Summary

*Completed: <DATE>*

### Results

- **Worktrees Removed**: 5
- **Disk Space Recovered**: ~X GB
- **Branches Cleaned**: X (if applicable)
