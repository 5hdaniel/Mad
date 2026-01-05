# TASK-970: Fix Failing Auth Handler Integration Test

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-157
**Status:** Ready
**Estimate:** ~15K tokens
**Token Cap:** 60K

---

## Context

The auth-handlers integration test "should restore session on get-current-user" is failing after recent state machine changes.

## Problem

```
electron/__tests__/auth-handlers.integration.test.ts:431

expect(result.success).toBe(true);
Expected: true
Received: false
```

## Likely Cause

Recent changes added `databaseService.isInitialized()` check to `handleGetCurrentUser`. The test may not be properly setting up the database mock state.

## Deliverables

1. **Investigate** - Read the failing test and handler code
2. **Identify** - Determine if issue is in test setup or production code
3. **Fix** - Update test mock or fix handler logic
4. **Verify** - All 749 tests pass

## Files to Modify

- `electron/__tests__/auth-handlers.integration.test.ts`
- `electron/handlers/sessionHandlers.ts` (if needed)

## Branch

```bash
git checkout -b fix/TASK-970-auth-handler-test develop
```

## Testing

```bash
npm test -- --testPathPattern=auth-handlers
```

## Acceptance Criteria

- [ ] Test passes
- [ ] All 749 tests pass
- [ ] No production behavior changes (unless bug found)

## Engineer Metrics

**Agent ID:** _[Record immediately when Task tool returns]_

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 15K) / 15K × 100]_%
