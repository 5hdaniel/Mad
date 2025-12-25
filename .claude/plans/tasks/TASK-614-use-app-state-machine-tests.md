# TASK-614: useAppStateMachine Tests

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 6-8 → Actual: _ (variance: _%)
- Est Wall-Clock: 30-40 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (1.0x test) | Wall-Clock (3x) |
|--------|----------|------------------------|-----------------|
| **Turns** | 6-8 | **6-8** | - |
| **Tokens** | ~30K | ~30K | - |
| **Time** | 45-60m | **30-40 min** | **30-40 min** |

**Category:** test
**Confidence:** Medium (test writing is predictable but requires understanding complex state machine)

---

## Objective

Add comprehensive tests for `src/appCore/state/useAppStateMachine.ts` (1,115 lines) - a critical flow with no tests.

---

## Current State

`useAppStateMachine.ts` manages:
- App initialization state
- Authentication flow
- Onboarding flow
- Error handling
- State transitions

No test file exists for this critical hook.

---

## Requirements

### Must Do
1. Create test file
2. Test all state transitions
3. Test error handling
4. Test edge cases
5. Achieve >60% coverage

### Must NOT Do
- Change implementation
- Mock everything (use realistic test scenarios)

---

## Test Cases

### Initialization
- [ ] Initial state is correct
- [ ] Transitions from loading to authenticated
- [ ] Transitions from loading to unauthenticated
- [ ] Handles initialization errors

### Authentication Flow
- [ ] Login success transitions correctly
- [ ] Login failure shows error
- [ ] Logout resets state
- [ ] Session expiry handled

### Onboarding Flow
- [ ] New user enters onboarding
- [ ] Completed user skips onboarding
- [ ] Onboarding completion updates state

### Error Handling
- [ ] Network errors handled
- [ ] Auth errors handled
- [ ] Recovery from errors

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/appCore/state/__tests__/useAppStateMachine.test.ts` | Tests |

---

## Testing Requirements

1. Use React Testing Library
2. Mock IPC calls appropriately
3. Test async transitions

---

## Acceptance Criteria

- [ ] Test file created
- [ ] All major state transitions tested
- [ ] Error cases tested
- [ ] Coverage > 60%
- [ ] All tests pass

---

## Branch

```
feature/TASK-614-statemachine-tests
```
