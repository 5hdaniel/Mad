# BACKLOG-122: Improve Engineer Agent Worktree Instructions

**Priority:** Medium
**Category:** docs
**Created:** 2025-12-31
**Completed:** 2026-01-01
**Source:** SPRINT-011 Retrospective
**Status:** Completed

---

## Problem Statement

During SPRINT-011, engineer agents sometimes struggled with git worktree setup when instructed to use worktrees for parallel development:
- Repeated failed commands trying to access worktree directories
- Confusion about which directory to work in
- Falling back to main directory instead of worktree

## Proposed Solution

Update the engineer agent prompts and documentation with clearer worktree instructions:

1. **Explicit worktree creation command** with expected output
2. **Verification step** to confirm worktree exists before proceeding
3. **Absolute path usage** throughout the task
4. **Fallback guidance** if worktree creation fails

## Deliverables

1. Update: `.claude/agents/engineer.md` - Add worktree section
2. Update: `.claude/docs/shared/git-branching.md` - Add worktree best practices

## Acceptance Criteria

- [x] Engineer agent prompt includes worktree creation template
- [x] Verification command documented (`git worktree list`)
- [x] Common failure modes documented with solutions
- [x] Example workflow from branch creation to PR

## Implementation Notes

### Worktree Creation Template

```bash
# 1. Create worktree
git worktree add ../Mad-task-XXX -b feature/TASK-XXX-description develop

# 2. Verify creation
git worktree list
# Expected: /path/to/Mad-task-XXX  abc1234 [feature/TASK-XXX-description]

# 3. Change to worktree (if needed)
cd ../Mad-task-XXX

# 4. Verify you're in the right place
pwd && git branch --show-current
```

### Common Failures

| Issue | Cause | Solution |
|-------|-------|----------|
| "already exists" | Branch name conflict | Use unique branch name |
| "not a git repository" | Wrong parent directory | Verify git repo location |
| Directory not accessible | Permission or path issue | Use absolute paths |

## Estimated Effort

- **Turns:** 2-3
- **Tokens:** ~10K
- **Time:** 20-30m

---

## References

- TASK-801, TASK-803 implementation issues (SPRINT-011)
- Engineer agent getting stuck in loops trying to access worktree
