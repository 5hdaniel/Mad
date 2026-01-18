# BACKLOG-131: Fix PR Metrics Validation Shell Escaping Bug

**Priority:** Medium
**Category:** ci
**Status:** Pending
**Created:** 2026-01-02
**Source:** SPRINT-012 PR #262 - discovered during metrics validation

---

## Problem

The `pr-metrics-check.yml` workflow uses direct string interpolation for the PR body:

```yaml
- name: Validate Engineer Metrics Section
  run: |
    PR_BODY='${{ github.event.pull_request.body }}'
```

This breaks when the PR body contains:
- Single quotes (escapes the shell string)
- Parentheses (can be interpreted as subshell)
- Other special shell characters

### Error Observed

```
Try 'write --help' for more information.
##[error]Process completed with exit code 1.
```

All 5 validation checks passed, but shell parsing failed at the end.

---

## Root Cause

GitHub Actions interpolates `${{ github.event.pull_request.body }}` directly into the shell script. Characters like `'`, `(`, `)`, `;` in the PR body can break shell parsing.

---

## Fix

Use environment variables instead of direct interpolation:

```yaml
- name: Validate Engineer Metrics Section
  if: steps.skip-check.outputs.skip != 'true'
  env:
    PR_BODY: ${{ github.event.pull_request.body }}
  run: |
    echo "=== Validating PR Metrics ==="
    # Now $PR_BODY is a proper environment variable, not interpolated text
    if [[ ! "$PR_BODY" =~ "## Engineer Metrics" ]]; then
      ...
```

---

## Acceptance Criteria

- [ ] `pr-metrics-check.yml` uses env variables for PR body
- [ ] Special characters in PR body don't break validation
- [ ] All 5 validation checks still work correctly
- [ ] Test with a PR body containing: `'`, `(`, `)`, `$`, backticks

---

## Workaround

Until fixed, PRs can use:
- `ci-fix` label to skip validation
- `[skip-metrics]` in PR title

---

## References

- Affected file: `.github/workflows/pr-metrics-check.yml`
- Related PR: #262 (required `ci-fix` label as workaround)
- GitHub Actions docs: Using environment variables is safer than direct interpolation
