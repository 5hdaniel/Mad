# Task TASK-1934: Fix Failing Test Suites (system-handlers + supabaseService)

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

Fix 2 failing test suites (11 total failing tests) in the Electron layer by updating stale mocks to match current service implementations. The tests must pass without modifying production code.

## Non-Goals

- Do NOT modify production source code to make tests pass (fix the tests, not the implementation)
- Do NOT rewrite tests from scratch -- update mocks and assertions to match current API
- Do NOT add new test cases (only fix existing failing ones)
- Do NOT modify any files outside the test files unless absolutely necessary for mock setup

## Deliverables

1. Update: `electron/__tests__/system-handlers.test.ts` -- fix import/mock issues causing entire suite to fail
2. Update: `electron/services/__tests__/supabaseService.test.ts` -- fix 10 failing tests across User Operations, Device Operations, Analytics Operations

## Acceptance Criteria

- [ ] `npx jest electron/__tests__/system-handlers.test.ts` passes (all tests in suite)
- [ ] `npx jest electron/services/__tests__/supabaseService.test.ts` passes (all tests in suite)
- [ ] `npm test` passes with 0 failing suites and 0 failing tests
- [ ] `npm run type-check` passes
- [ ] No production code was modified (only test files changed)

## Implementation Notes

### Investigation Phase (REQUIRED FIRST)

Before fixing anything, understand WHY the tests fail:

```bash
# Run system-handlers tests to see the exact error
npx jest electron/__tests__/system-handlers.test.ts --verbose 2>&1 | head -60

# Run supabaseService tests to see which tests fail and why
npx jest electron/services/__tests__/supabaseService.test.ts --verbose 2>&1 | head -100
```

### Suite 1: `electron/__tests__/system-handlers.test.ts`

**Likely issue:** Import/mock setup problem causing the entire suite to fail to load. Common causes:
- Module being mocked has changed its exports
- Import paths have changed
- Mock setup references functions/modules that no longer exist
- Jest module resolution issue

**Approach:**
1. Read the error output carefully
2. Compare mock setup against actual module exports
3. Update mock to match current module shape
4. Do NOT change the actual module -- only the test

### Suite 2: `electron/services/__tests__/supabaseService.test.ts`

**Likely issue:** 10 tests failing because mock chains (`from().select().eq()...`) no longer match the actual Supabase query patterns used in the service.

**Approach:**
1. Read each failing test's error output
2. Compare the mock chain setup with the actual service method
3. Update mock return values and chain structure to match current implementation
4. Pay attention to:
   - New fields added to queries
   - Changed method call order
   - Different return shapes
   - RPC calls that replaced direct queries

### Key Pattern: Supabase Mock Chain

The supabaseService tests use mock chains like:
```typescript
mockSupabaseClient.from.mockReturnValue({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: {...}, error: null })
    })
  })
});
```

If the actual service now calls methods in a different order or uses different methods, the mock chain must be updated to match.

### Verification

```bash
# Individual suite verification
npx jest electron/__tests__/system-handlers.test.ts --verbose
npx jest electron/services/__tests__/supabaseService.test.ts --verbose

# Full test run
npm test
```

## Integration Notes

- No other tasks depend on this change
- These test files are self-contained
- Changes are isolated to test mock setup and assertions
- TASK-1933 (lint fix) does not conflict with this task

## Do / Don't

### Do:
- Read the actual error messages first before making changes
- Compare mock shapes against actual service implementations
- Keep test intent/assertions the same -- just fix the mock wiring
- Run tests after each fix to verify progress

### Don't:
- Don't modify production code (`electron/services/supabaseService.ts`, `electron/handlers/system-handlers.ts`)
- Don't rewrite tests from scratch
- Don't change what the tests are testing -- only fix HOW they mock
- Don't skip reading error output and guessing at fixes

## When to Stop and Ask

- If fixing a test requires changing production code (not just test mocks)
- If more than 3 tests seem to need fundamentally different test approaches (not just mock updates)
- If the system-handlers test failure is caused by a missing dependency/module rather than a mock issue
- If you discover the tests were intentionally disabled or marked as skip

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes -- this IS the test fix task
- Existing tests to update:
  - `electron/__tests__/system-handlers.test.ts` (entire suite)
  - `electron/services/__tests__/supabaseService.test.ts` (10 tests across 3 describe blocks)
- New tests to write: None

### Coverage

- Coverage impact: Should improve (11 previously-failing tests now contribute to coverage)

### Integration / Feature Tests

- Not applicable -- unit test fixes only

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (primary validation -- all 11 tests must pass)
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(tests): update stale mocks in system-handlers and supabaseService test suites`
- **Labels**: `tests`, `cleanup`
- **Sprint**: SPRINT-075
- **Branch**: `fix/repo-cleanup-hardening`
- **Target**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~25K (test x 0.9 = ~25K from ~28K base)

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 test files | +5K |
| Investigation | Read errors, compare with source | +8K |
| Mock updates | 10+ mock chain updates in supabaseService | +10K |
| System-handlers fix | Import/mock resolution | +5K |

**Confidence:** Medium

**Risk factors:**
- Mock chain complexity could be higher than expected
- System-handlers failure root cause is unknown until investigation
- Some tests might need more than simple mock updates

**Similar past tasks:** Test fix tasks historically use ~20-30K tokens

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
- [ ] electron/__tests__/system-handlers.test.ts
- [ ] electron/services/__tests__/supabaseService.test.ts

Verification:
- [ ] npx jest electron/__tests__/system-handlers.test.ts passes
- [ ] npx jest electron/services/__tests__/supabaseService.test.ts passes
- [ ] npm test passes (0 failures)
- [ ] npm run type-check passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Verify mocks match actual service implementations, not just making tests pass artificially>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
