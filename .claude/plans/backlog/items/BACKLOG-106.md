# BACKLOG-106: Add Behavioral Tests for useAppStateMachine

## Priority: Medium

## Category: test

## Summary

TASK-614 added 41 comprehensive tests for useAppStateMachine, but these are API contract tests (verify inputs/outputs). Behavioral tests for state transitions (e.g., "when user completes onboarding, machine transitions to READY") should be added.

## Origin

SPRINT-009 Retrospective - TASK-614 completed API tests but behavioral coverage gap identified.

## Current State

After TASK-614:
- 41 tests for useAppStateMachine
- Tests verify API contracts (method calls, return values)
- Tests do NOT verify state transition sequences

## Problem

API contract tests verify:
```typescript
// "Calling initialize() returns expected shape"
expect(result.current.initialize).toBeDefined();
```

Behavioral tests would verify:
```typescript
// "Complete onboarding flow transitions state correctly"
act(() => result.current.startOnboarding());
expect(result.current.state).toBe('ONBOARDING');
act(() => result.current.completeOnboarding());
expect(result.current.state).toBe('READY');
```

## Test Cases to Add

### State Transition Sequences

1. **Fresh User Flow**
   - INITIAL -> LOADING -> ONBOARDING -> READY

2. **Returning User Flow**
   - INITIAL -> LOADING -> READY (skip onboarding)

3. **Error Recovery Flow**
   - Any state -> ERROR -> (retry) -> Previous state

4. **Logout Flow**
   - READY -> LOGGED_OUT -> LOADING -> READY

5. **Settings Navigation**
   - READY <-> SETTINGS (bidirectional)

### Edge Cases

6. **Invalid Transitions**
   - Verify machine rejects invalid state transitions
   - e.g., ONBOARDING -> SETTINGS should fail

7. **Concurrent Actions**
   - Multiple rapid state change requests

## Acceptance Criteria

- [ ] At least 5 new behavioral test cases added
- [ ] Tests verify actual state values, not just method existence
- [ ] Tests verify transition sequences (A -> B -> C)
- [ ] Invalid transitions tested and rejected
- [ ] All tests pass (`npm test`)
- [ ] No flaky tests (run 3x)

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 6-8 | Test tasks have 0% variance historically |
| Tokens | ~30K | |
| Time | ~45-60 min | |

## Dependencies

- TASK-614 (useAppStateMachine tests) - Complete

## Files to Modify

- `src/hooks/__tests__/useAppStateMachine.test.ts`

## Technical Notes

- Use React Testing Library's `renderHook` and `act`
- May need to mock database and auth services for transition triggers
- Consider XState testing utilities if machine is XState-based

## Notes

This improves test coverage quality, not just quantity. Behavioral tests catch regressions in state machine logic that API tests would miss.
