# TASK-1024: Fix Auth Handler Integration Test

**Backlog ID:** BACKLOG-157
**Sprint:** SPRINT-032
**Phase:** Phase 1 - Critical Test Fixes
**Branch:** `fix/task-1024-auth-handler-test`
**Estimated Tokens:** ~15K
**Token Cap:** 60K

---

## Objective

Fix the failing auth-handlers integration test "should restore session on get-current-user" to achieve 749/749 tests passing.

---

## Context

The auth-handlers integration test has been failing since state machine changes in SPRINT-022/023. The test verifies session restoration functionality which is critical for user experience.

### Current Error

```
electron/__tests__/auth-handlers.integration.test.ts

Test: "should restore session on get-current-user"
Expected: result.success === true
Received: result.success === false
```

### Likely Root Cause

- `handleGetCurrentUser` now checks `databaseService.isInitialized()`
- Test may not be setting up database state correctly
- Session handling was modified during state machine work

---

## Requirements

### Must Do:
1. Run the specific test to confirm current failure state
2. Investigate the test setup and handler implementation
3. Identify what changed that caused the regression
4. Fix the test setup OR the handler (whichever is wrong)
5. Verify session restoration still works in production scenario

### Must NOT Do:
- Skip or mock away the core session restoration logic
- Break session restoration in production
- Change the test to pass without fixing the underlying issue

---

## Acceptance Criteria

- [ ] "should restore session on get-current-user" test passes
- [ ] All 749 tests pass
- [ ] Session restoration works correctly in dev mode
- [ ] No changes that break session restoration in production
- [ ] Root cause documented in Implementation Summary

---

## Files to Investigate

- `electron/__tests__/auth-handlers.integration.test.ts` - The failing test
- `electron/handlers/sessionHandlers.ts` - Handler implementation
- `electron/services/databaseService.ts` - Database init check

## Files to Read (for context)

- `electron/handlers/authHandlers.ts` - Related auth handlers
- Recent SPRINT-022/023 PRs that modified session handling

---

## Testing Expectations

### Unit Tests
- **Required:** Fix existing integration test
- **New tests to write:** None expected
- **Existing tests to update:** Fix test setup if needed

### CI Requirements
- [ ] `npm test` passes (749/749)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(tests): resolve auth-handlers integration test failure`
- **Branch:** `fix/task-1024-auth-handler-test`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Investigation:
- [ ] Ran specific test to confirm failure
- [ ] Traced through handler logic
- [ ] Identified database init check issue
- [ ] Determined fix approach

Implementation:
- [ ] Fix complete
- [ ] Tests pass locally (npm test)
- [ ] Verified session restoration works in dev
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] Root cause documented below
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Root Cause Analysis

**What caused the failure:**
[Document the specific issue]

**What was changed to fix it:**
[Document the fix approach]

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The fix would require removing the database init check entirely
- Session restoration appears broken in production scenario
- You discover the test was testing wrong behavior
- Fix requires changes to state machine logic
- You encounter blockers not covered in the task file
