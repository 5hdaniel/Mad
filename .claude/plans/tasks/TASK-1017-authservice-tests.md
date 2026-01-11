# TASK-1017: Add Tests for authService.ts

**Backlog ID:** BACKLOG-191
**Sprint:** SPRINT-031
**Phase:** 1 (Sequential)
**Branch:** `test/task-1017-authservice-tests`
**Estimated Tokens:** ~25K

---

## Objective

Create comprehensive unit tests for `src/services/authService.ts` to establish test coverage for authentication business logic and create reusable mocking patterns for subsequent service tests.

---

## Context

The auth service handles critical authentication flows:
- User login/logout
- Session restoration
- Token management
- Authentication state

Currently at 0% test coverage. This task establishes the testing pattern for all service layer tests in this sprint.

---

## Requirements

### Must Do:
1. Create `src/services/__tests__/authService.test.ts`
2. Mock `window.api.auth` properly
3. Test login flow (success and error cases)
4. Test logout flow
5. Test session restoration
6. Test authentication state queries
7. Achieve >60% code coverage for authService.ts
8. Document the mocking pattern for other service tests

### Must NOT Do:
- Modify authService.ts implementation (test as-is)
- Create flaky tests (no timing dependencies)
- Skip error case testing

---

## Acceptance Criteria

- [ ] `authService.test.ts` exists and passes
- [ ] Coverage >60% for `src/services/authService.ts`
- [ ] All test cases documented in test file
- [ ] Mock pattern documented in comment block at top of file
- [ ] Tests run 3x without flakiness
- [ ] No console warnings/errors during test run

---

## Files to Modify

- `src/services/__tests__/authService.test.ts` - CREATE (new file)

## Files to Read (for context)

- `src/services/authService.ts` - Understand API surface
- `electron/preload/authBridge.ts` - Understand IPC interface
- Existing test files in `src/` - Follow patterns

---

## Implementation Guide

### Step 1: Analyze authService.ts

Review the service to identify:
- Public methods to test
- Dependencies to mock (window.api)
- Error conditions to cover

### Step 2: Set Up Mock Structure

```typescript
// src/services/__tests__/authService.test.ts

/**
 * AuthService Tests
 *
 * Mock Pattern for Service Layer Tests:
 * 1. Mock window.api at module level
 * 2. Reset mocks in beforeEach
 * 3. Configure mock return values per test
 *
 * This pattern should be reused for:
 * - transactionService.test.ts (TASK-1018)
 * - systemService.test.ts (TASK-1019)
 * - deviceService.test.ts (TASK-1020)
 */

// Mock window.api.auth
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRestoreSession = jest.fn();

Object.defineProperty(window, 'api', {
  value: {
    auth: {
      login: mockLogin,
      logout: mockLogout,
      getCurrentUser: mockGetCurrentUser,
      restoreSession: mockRestoreSession,
    },
  },
  writable: true,
});

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Tests here
});
```

### Step 3: Test Cases to Implement

| Category | Test Case | Priority |
|----------|-----------|----------|
| Login | Success with valid credentials | High |
| Login | Failure with invalid credentials | High |
| Login | Network error handling | Medium |
| Logout | Successful logout | High |
| Logout | Logout when not logged in | Medium |
| Session | Restore valid session | High |
| Session | Handle expired session | Medium |
| State | Check authentication status | High |
| State | Get current user info | High |

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** 10-15 test cases
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness
- [ ] Coverage threshold met

---

## PR Preparation

- **Title:** `test(auth): add unit tests for authService`
- **Branch:** `test/task-1017-authservice-tests`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: authService.ts at 0% coverage
- **After**: authService.ts at >60% coverage
- **Actual Tokens**: ~XK (Est: 25K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-01-10 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** test/task-1017-authservice-tests

### Execution Classification
- **Parallel Safe:** No - establishes mocking pattern for other service tests
- **Depends On:** None (first task in phase)
- **Blocks:** TASK-1018, TASK-1019, TASK-1020

### Shared File Analysis
- Files created: `src/services/__tests__/authService.test.ts`
- Conflicts with: None (creates new test file)

### Technical Considerations

**CRITICAL - Verify `__tests__` directory:**
```bash
ls -la src/services/__tests__/
# If not exists, will be created by test file
```

**Mock Pattern Notes:**
The authService exports as an object (not a class), so tests should:
1. Mock `window.api.auth` before importing service
2. Clear mocks between tests with `jest.clearAllMocks()`
3. Reference existing test patterns in `src/hooks/__tests__/useAutoRefresh.test.ts`

**API Surface to Test (18 methods - 335 lines):**
- Login: `googleLogin`, `googleCompleteLogin`, `microsoftLogin`, `microsoftCompleteLogin`, `completePendingLogin`
- Session: `logout`, `validateSession`, `getCurrentUser`, `acceptTerms`
- Mailbox: `googleConnectMailbox`, `microsoftConnectMailbox`, `googleDisconnectMailbox`, `microsoftDisconnectMailbox`
- Pending: `googleConnectMailboxPending`, `microsoftConnectMailboxPending`, `savePendingMailboxTokens`

**Coverage Strategy:**
- Each method has try/catch with consistent error handling
- Test success path + error throw for each method
- This file is straightforward - 60% coverage is achievable with ~18-20 tests

### Existing Test Pattern Reference

Reference `src/hooks/__tests__/useAutoRefresh.test.ts` for window.api mocking:
```typescript
// Setup window.api mock before tests
beforeEach(() => {
  (window as any).api = {
    auth: {
      googleLogin: mockGoogleLogin,
      // ... other methods
    },
  };
});
```

---

## Guardrails

**STOP and ask PM if:**
- authService.ts has complex dependencies not mentioned
- Mock setup doesn't work as expected
- Tests require modifying production code
- Coverage target seems unrealistic for the file
- You encounter blockers not covered in the task file
