# BACKLOG-154: Enforce Branch Protection for All Work

## Summary

Claude committed directly to `develop` branch instead of creating a feature/fix branch with PR review. This bypasses the quality gates and review process.

## Incident

On 2026-01-04, while fixing the email connection bug (BACKLOG-153), Claude:
1. Made changes directly on `develop` branch
2. Committed without creating a feature branch
3. Pushed directly to `develop` (bypassing PR requirement)

## Why This Is a Problem

1. **No PR review** - Changes weren't reviewed by SR Engineer agent
2. **No CI validation** - Bypassed required status checks
3. **No audit trail** - No PR description, no linked task
4. **Risk of regression** - Direct commits can introduce bugs

## Required Enforcement

### 1. Update CLAUDE.md (Mandatory)

Add explicit rule in the Git Branching Strategy section:

```markdown
### CRITICAL: Never Commit Directly to develop or main

**ALL work MUST go through a branch + PR workflow:**

1. Create a branch: `git checkout -b fix/description` or `feature/description`
2. Make changes and commit
3. Push branch and create PR
4. Wait for CI + review
5. Merge via PR

**There are NO exceptions.** Even "quick fixes" must use branches.

If you find yourself about to commit to develop/main, STOP and create a branch first.
```

### 2. Add Pre-Commit Check (Optional Enhancement)

Could add a hook that prevents commits to protected branches:

```bash
# .git/hooks/pre-commit
branch=$(git symbolic-ref HEAD 2>/dev/null | cut -d"/" -f 3)
if [ "$branch" = "develop" ] || [ "$branch" = "main" ]; then
  echo "ERROR: Direct commits to $branch are not allowed."
  echo "Create a feature branch: git checkout -b fix/your-fix-name"
  exit 1
fi
```

### 3. Claude Self-Check

Before any `git commit`, Claude should:
1. Run `git branch --show-current`
2. If on `develop` or `main`, create a branch first
3. Never proceed with commit on protected branches

## Implementation Priority

- **P1**: Update CLAUDE.md with explicit rule
- **P2**: Add self-check to Claude's workflow
- **P3**: Consider pre-commit hook (may interfere with legitimate merges)

## Status

- [x] Incident documented
- [ ] CLAUDE.md updated
- [ ] Process validated in next sprint

## Related

- BACKLOG-153: The bug fix that triggered this
- CLAUDE.md: Development guide that needs updating
