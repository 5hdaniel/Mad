# Task TASK-554: Fix Transactions.test.tsx Missing Mock

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix the failing Transactions.test.tsx by adding the missing `onSubmissionStatusChanged` mock for the `useSubmissionSync` hook.

## Non-Goals

- Do NOT refactor the test file beyond fixing this mock
- Do NOT change the useSubmissionSync hook implementation
- Do NOT add new test cases

## Deliverables

1. Update: `src/components/__tests__/Transactions.test.tsx`

## Acceptance Criteria

- [ ] Mock includes `onSubmissionStatusChanged` function
- [ ] All Transactions tests pass
- [ ] No new test warnings or errors
- [ ] CI passes
- [ ] `npm test` runs without TypeError

## Implementation Notes

### The Error

```
TypeError: transactions.onSubmissionStatusChanged is not a function
at src/hooks/useSubmissionSync.ts:66:38
```

### The Fix

In the test file's mock setup, add:

```typescript
// Find the existing mock for transactions or window.api
// Add this to the mock object:
onSubmissionStatusChanged: jest.fn().mockReturnValue(() => {}),
```

### Where to Add

Look for the mock setup pattern in the test file. It's likely one of:

1. `jest.mock('../../hooks/useSubmissionSync')` - Mock the entire hook
2. `window.api.transactions` mock - Add the missing function
3. A shared mock setup file

### Verification

```bash
# Run just the Transactions tests
npm test -- Transactions.test

# Run all tests to ensure no regressions
npm test
```

## Integration Notes

- Depends on: None
- Used by: CI pipeline

## Do / Don't

### Do:
- Match the mock return type to actual function signature
- Verify the mock is being used correctly
- Run the specific test file to verify fix

### Don't:
- Change test logic or assertions
- Modify the actual hook implementation
- Add unrelated test changes

## When to Stop and Ask

- If the mock pattern is different than expected
- If fixing this reveals other missing mocks
- If tests still fail after adding the mock

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: This IS a test fix
- All existing Transactions tests must pass

### CI Requirements

- [ ] `npm test` passes
- [ ] No test warnings

## PR Preparation

- **Title**: `test: fix Transactions.test.tsx missing onSubmissionStatusChanged mock`
- **Labels**: `test`, `fix`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~4K-6K (apply 0.9x test multiplier)

**Token Cap:** 24K (4x upper estimate)

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/components/__tests__/Transactions.test.tsx

Verification:
- [ ] npm test passes
- [ ] No test warnings
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
