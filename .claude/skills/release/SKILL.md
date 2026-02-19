---
name: release
description: Release workflow — bump version, merge develop to main, tag, and push. Ensures all PRs are merged and CI passes before releasing.
---

# Release Workflow

Use `/release` when cutting a new release from develop to main.

## Pre-Flight Checks

1. **Confirm branch:** Must be on `develop`.
   ```bash
   git branch --show-current  # Must show: develop
   ```

2. **Check for open PRs targeting develop:**
   ```bash
   gh pr list --base develop --state open
   ```
   If any are open, STOP — merge or close them first.

3. **Verify CI passes on develop:**
   ```bash
   gh run list --branch develop --limit 1
   ```

4. **Show what's new since last release:**
   ```bash
   git log main..develop --oneline
   ```
   Present the changelog to the user for review.

## Release Steps

5. **Bump version in package.json:**
   - Ask user: "What version? (current: X.Y.Z)" — offer patch, minor, major
   - Update `version` field in `package.json`
   - Commit: `chore: bump version to X.Y.Z`

6. **Push develop with version bump:**
   ```bash
   git push origin develop
   ```

7. **Merge develop into main (no fast-forward):**
   ```bash
   git checkout main
   git pull origin main
   git merge develop --no-ff -m "release: vX.Y.Z"
   ```

8. **Create git tag:**
   ```bash
   git tag vX.Y.Z
   ```

9. **Push main and tags:**
   ```bash
   git push origin main
   git push origin vX.Y.Z
   ```

10. **Verify CI/CD pipeline starts:**
    ```bash
    gh run list --branch main --limit 1
    ```

11. **Switch back to develop:**
    ```bash
    git checkout develop
    ```

## Rules

- Never commit version bumps to feature branches
- Never skip the open PR check (step 2)
- Always use `--no-ff` for the merge to create a merge commit
- Always tag on main, never on develop
- Wait for user approval before pushing (steps 6 and 9)

## Rollback

If something goes wrong after push:
```bash
# Delete the tag
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z

# Reset main to previous commit
git checkout main
git reset --hard HEAD~1
git push --force-with-lease origin main
```
Only use rollback with explicit user approval.
