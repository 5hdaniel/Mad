# TASK-980: Fix CI Bash Escaping

**Sprint**: SPRINT-026
**Backlog**: BACKLOG-162
**Priority**: Medium
**Estimate**: 1,000 tokens
**Status**: Ready

---

## Objective

Fix the "Validate PR Metrics" CI workflow that fails when PR body contains shell-interpreted patterns like "built-in".

## Problem

```
Error: built-in: command not found
Process completed with exit code 127
```

**Root Cause**: PR body assigned to bash variable without proper escaping.

## Scope

### Must Implement

1. **Fix CI workflow** (`.github/workflows/ci.yml`)
   - Use heredoc for PR body assignment
   - Ensure shell special characters don't execute

### Out of Scope

- Other CI improvements
- Additional validation logic

## Files to Modify

| File | Action |
|------|--------|
| `.github/workflows/ci.yml` | Fix PR body escaping |

## Solution

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
- [ ] CI passes when PR body contains backticks
- [ ] CI passes when PR body contains `$()` patterns
- [ ] Existing valid PRs still pass

## Testing

1. Create test PR with body: "Test Electron's built-in printToPDF feature"
2. Verify "Validate PR Metrics" step passes
3. Verify metrics extraction still works correctly

## Branch

```
fix/TASK-980-ci-bash-escaping
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (record when Task tool returns) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |
