# Task TASK-1933: Fix eslint-disable for Missing react-hooks Plugin

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Remove the invalid `eslint-disable-line react-hooks/exhaustive-deps` comment from `src/contexts/NotificationContext.tsx:177` that references a rule from `eslint-plugin-react-hooks` which is not installed in the project, causing a lint error.

## Non-Goals

- Do NOT install `eslint-plugin-react-hooks` as a new dependency
- Do NOT modify the `.eslintrc.js` configuration
- Do NOT refactor the NotificationContext component logic
- Do NOT add any other eslint rule changes

## Deliverables

1. Update: `src/contexts/NotificationContext.tsx` (remove invalid eslint-disable comment on line 177)

## Acceptance Criteria

- [ ] The `eslint-disable-line react-hooks/exhaustive-deps` comment is removed from line 177
- [ ] `npx eslint src/contexts/NotificationContext.tsx` returns 0 errors
- [ ] `npm run lint` passes with no new errors
- [ ] `npm run type-check` passes
- [ ] The component behavior is unchanged (the useEffect dependency array stays as-is)

## Implementation Notes

### The Problem

File: `src/contexts/NotificationContext.tsx`, line 177

The line currently looks like:
```typescript
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

The project's `.eslintrc.js` does NOT include `eslint-plugin-react-hooks` in its plugins or extends. The `react-hooks/exhaustive-deps` rule does not exist in the linting context. ESLint treats a disable comment for a non-existent rule as an error.

### The Fix

Remove the `// eslint-disable-line react-hooks/exhaustive-deps` comment. The empty dependency array `[]` is intentional (the effect should only run once on mount). Without the plugin installed, there's no rule to disable.

**Before:**
```typescript
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**After:**
```typescript
  }, []);
```

### Verification

```bash
# Before fix (should show 1 error):
npx eslint src/contexts/NotificationContext.tsx

# After fix (should show 0 errors):
npx eslint src/contexts/NotificationContext.tsx

# Full lint check:
npm run lint
```

## Integration Notes

- No other tasks depend on this change
- No imports/exports affected
- This is an isolated one-line fix

## Do / Don't

### Do:
- Remove only the eslint-disable comment text
- Keep the empty dependency array `[]` unchanged
- Verify lint passes after the change

### Don't:
- Don't add dependencies to the useEffect array
- Don't install `eslint-plugin-react-hooks`
- Don't modify any other files

## When to Stop and Ask

- If the line content at line 177 doesn't match what's described above (file may have been modified)
- If removing the comment introduces new lint warnings/errors
- If there are other `react-hooks` disable comments elsewhere that also need fixing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No -- this is a comment removal, no logic changes
- Existing tests to update: None

### Coverage

- Coverage impact: None (no logic change)

### Integration / Feature Tests

- Not applicable -- cosmetic lint fix only

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks (this is the primary validation)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(lint): remove invalid eslint-disable for react-hooks/exhaustive-deps`
- **Labels**: `cleanup`, `lint`
- **Sprint**: SPRINT-075
- **Branch**: `fix/repo-cleanup-hardening`
- **Target**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~3K (cleanup x 0.5 = ~3K from ~5K base)

**Token Cap:** 12K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +2K |
| Code volume | ~1 line change | +1K |
| Test complexity | None | +0K |

**Confidence:** High

**Risk factors:**
- Essentially zero risk -- one comment removal

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/contexts/NotificationContext.tsx

Verification:
- [ ] npx eslint src/contexts/NotificationContext.tsx passes
- [ ] npm run lint passes
- [ ] npm run type-check passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~3K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Issues encountered:**
<Document any issues>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** N/A
**Security Review:** N/A
**Test Coverage:** N/A

**Review Notes:**
<Review observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
