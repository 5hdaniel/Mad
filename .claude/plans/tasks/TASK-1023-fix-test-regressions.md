# TASK-1023: Fix Test Regressions in contact-handlers and databaseService

**Backlog ID:** BACKLOG-202
**Sprint:** SPRINT-032
**Phase:** Phase 1 - Critical Test Fixes
**Branch:** `fix/task-1023-test-regressions`
**Estimated Tokens:** ~20K
**Token Cap:** 80K

---

## Objective

Fix test regressions in `electron/__tests__/contact-handlers.test.ts` and `electron/services/__tests__/databaseService.test.ts` that are causing CI failures.

---

## Context

Test regressions have been introduced during recent development (SPRINT-027 through SPRINT-031). These tests cover critical functionality for contacts and database operations. CI is currently failing due to these regressions.

### Recent Changes That May Have Caused Regressions

- State machine changes (SPRINT-020-022)
- Database initialization gate (SPRINT-019)
- Message import features (SPRINT-027)
- Contact handling updates

---

## Requirements

### Must Do:
1. Run `npm test` to identify all failing tests
2. Investigate root cause of each failure
3. Determine if test expectations or implementation is wrong
4. Fix either the test or the underlying code
5. Ensure no other tests break as a result

### Must NOT Do:
- Skip or disable failing tests without fixing root cause
- Make changes to unrelated code
- Change test expectations without verifying correctness

---

## Acceptance Criteria

- [ ] All contact-handlers.test.ts tests pass
- [ ] All databaseService.test.ts tests pass
- [ ] Full test suite passes (`npm test`)
- [ ] Root cause documented in Implementation Summary
- [ ] No new test flakiness introduced

---

## Files to Investigate

- `electron/__tests__/contact-handlers.test.ts` - Failing contact tests
- `electron/services/__tests__/databaseService.test.ts` - Failing database tests
- `electron/handlers/contactHandlers.ts` - Contact handler implementation
- `electron/services/databaseService.ts` - Database service implementation

## Files to Read (for context)

- Recent PRs in SPRINT-027 through SPRINT-031 that touched these areas
- Similar test files for patterns (e.g., `auth-handlers.test.ts`)

---

## Testing Expectations

### Unit Tests
- **Required:** Fix existing tests
- **New tests to write:** None expected
- **Existing tests to update:** Fix failing assertions

### CI Requirements
- [ ] `npm test` passes (all tests)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(tests): resolve contact-handlers and databaseService test regressions`
- **Branch:** `fix/task-1023-test-regressions`
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
- [ ] Ran npm test to identify failures
- [ ] Identified root cause of each failure
- [ ] Determined fix approach (test vs code)

Implementation:
- [ ] Fix complete
- [ ] Tests pass locally (npm test)
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

**contact-handlers.test.ts failures:**
[Document what failed and why]

**databaseService.test.ts failures:**
[Document what failed and why]

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Root cause reveals a deeper architectural issue
- Fix would require changes to more than 5 files
- Tests appear to be testing obsolete functionality
- You cannot determine if test or code is wrong
- You encounter blockers not covered in the task file
