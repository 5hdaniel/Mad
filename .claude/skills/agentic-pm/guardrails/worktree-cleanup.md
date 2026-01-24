# Worktree Cleanup Guardrail

**MANDATORY: Run this cleanup at the end of EVERY sprint.**

## When to Run

- After all sprint PRs are merged
- Before starting a new sprint
- When worktree count exceeds 5

## Check Procedure

```bash
# 1. List all worktrees
git worktree list

# 2. If more than 1 worktree (the main repo), cleanup is needed
```

## Cleanup Procedure

```bash
# 1. List worktrees to identify stale ones
git worktree list

# 2. For each stale worktree, remove it
git worktree remove /path/to/worktree --force

# 3. Prune any orphaned worktree references
git worktree prune

# 4. Verify cleanup
git worktree list
```

## Bulk Cleanup Script

For cleaning all worktrees except main:

```bash
# List all worktree paths except the main one
git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2 | while read path; do
  if [[ "$path" != "$(git rev-parse --show-toplevel)" ]]; then
    echo "Removing: $path"
    git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
  fi
done

# Prune orphaned references
git worktree prune
```

## Why This Matters

Stale worktrees:
- Consume disk space (full repo copy each)
- Cause confusion about which directory to use
- Can have uncommitted work that gets lost
- Slow down git operations

## Failure Response

If worktrees exist from previous sprints:
1. **CHECK** each for uncommitted work: `git -C /path/to/worktree status`
2. **SAVE** any important uncommitted changes
3. **REMOVE** the worktree
4. **PRUNE** orphaned references
