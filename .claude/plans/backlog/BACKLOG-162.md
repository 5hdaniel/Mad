# BACKLOG-162: Fix CI Validate PR Metrics Bash Escaping

**Created**: 2026-01-05
**Priority**: Medium
**Category**: infra
**Status**: Pending

---

## Problem

The "Validate PR Metrics" CI workflow fails when PR body contains certain text patterns that bash interprets as commands.

**Error observed**:
```
built-in: command not found
Process completed with exit code 127
```

**Root Cause**: The CI script reads PR body content into a bash variable without proper escaping. When the PR body contains "Electron's built-in printToPDF", bash tries to execute "built-in" as a command.

## Reproduction

Any PR with body text containing:
- "built-in"
- Other shell-interpreted patterns

## Proposed Fix

In `.github/workflows/ci.yml`, the PR body should be:
1. Properly quoted when assigned to variable
2. Or use `printf '%s'` instead of direct assignment
3. Or use a different parsing approach (jq with proper escaping)

## Example Fix

```yaml
# Before (broken)
PR_BODY='${{ github.event.pull_request.body }}'

# After (fixed)
PR_BODY=$(cat <<'EOFBODY'
${{ github.event.pull_request.body }}
EOFBODY
)
```

## Acceptance Criteria

- [ ] CI passes when PR body contains "built-in"
- [ ] CI passes when PR body contains shell special characters
- [ ] No false positives on valid PRs

## Incident Reference

SPRINT-025: PRs #334 and #335 required `--admin` flag to merge due to this false failure.

## Estimate

~1,000 tokens (simple CI fix)
