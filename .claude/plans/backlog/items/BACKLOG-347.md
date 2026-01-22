# BACKLOG-347: Enable Branch Protection Rules on develop

**Created**: 2026-01-21
**Priority**: High
**Category**: Process
**Status**: Pending

---

## Description

Enable GitHub branch protection rules to prevent direct commits to `develop` branch. All changes should go through PR workflow.

## Source

SR Engineer review (2026-01-21): "Many commits were pushed directly to the develop branch without going through a PR review process (~20+ commits)."

CLAUDE.md states: "ALL work MUST go through a branch + PR workflow. There are NO exceptions."

## Implementation

1. Go to GitHub repo Settings > Branches
2. Add branch protection rule for `develop`:
   - Require pull request before merging
   - Require at least 1 approval (optional)
   - Require status checks to pass (CI)
   - Do not allow bypassing the above settings

## Acceptance Criteria

- [ ] Branch protection enabled on `develop`
- [ ] Direct pushes blocked
- [ ] PRs required for all changes
- [ ] CI must pass before merge

## Priority

High - Process enforcement to prevent future violations
