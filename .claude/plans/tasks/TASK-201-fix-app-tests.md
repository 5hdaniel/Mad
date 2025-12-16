# TASK-201: Fix App.test.tsx Skipped Tests

**Backlog ID:** BACKLOG-059
**Sprint:** TECHDEBT-2024-01
**Phase:** 1 (Test Stabilization)
**Branch:** `fix/task-201-app-tests`
**Estimated Turns:** 20-30 (revised up based on analysis)

---

## Objective

Re-enable and fix the 14 skipped tests in `src/components/__tests__/App.test.tsx` that were disabled during the OnboardingFlow architecture refactor.

---

## Analysis Findings (2024-12-15)

### Root Cause

The skipped tests fail because of **async hook timing issues**, not incorrect mocks. The new architecture uses multiple async hooks that each have loading states:

1. **useAuth** - `isAuthLoading`
2. **useEmailOnboardingApi** - `isCheckingEmailOnboarding`
3. **usePhoneTypeApi** - `isLoadingPhoneType`
4. **useSecureStorage** - `isCheckingSecureStorage`

The routing logic in `useAppStateMachine` (line 190) waits for ALL loading states to complete:
```typescript
const isStillLoading = isAuthLoading || isCheckingSecureStorage || isLoadingPhoneType || isCheckingEmailOnboarding;
```

Until all hooks complete, the router stays in loading state and doesn't navigate to the expected screen.

### Why Simple Mocks Don't Work

Each hook makes async API calls and sets loading states:
- `useEmailOnboardingApi` calls `checkEmailOnboarding()` and `checkAllConnections()`
- `usePhoneTypeApi` calls `getPhoneType()`
- `useAuth` calls `getCurrentUser()`

Even with correct mocks, the hooks need to:
1. Initialize with `isLoading = true`
2. Make the API call
3. Process the response
4. Set `isLoading = false`

The tests timeout because the routing effect never fires while loading states are true.

### Recommended Fix Approach

**Option 1: Mock useAppStateMachine (Recommended)**
```typescript
jest.mock('../../appCore', () => ({
  ...jest.requireActual('../../appCore'),
  useAppStateMachine: jest.fn(() => ({
    currentStep: 'dashboard',
    isAuthenticated: true,
    currentUser: mockUser,
    // ... other required state
  })),
}));
```

**Option 2: Create Test Wrapper Component**
Create a wrapper that provides controlled state through context, bypassing the async hooks.

**Option 3: Add Testing Mode Flag**
Add a `TESTING_MODE` flag that makes hooks return immediately with default values.

### Tests That Should Stay Skipped

Tests that specifically test onboarding navigation (permissions screen, email onboarding flow) can remain skipped since the OnboardingFlow has its own test suite:
- `src/components/onboarding/__tests__/shell.test.tsx`
- `src/components/onboarding/__tests__/steps.test.tsx`

### Tests That Should Be Fixed

Tests that verify dashboard behavior once authenticated:
- Logout tests
- Navigation tests (profile, settings)
- User Initial Display tests

---

## Context

During the OnboardingFlow refactor (TASK-101 to TASK-116), several App.test.tsx tests were skipped because:
1. The onboarding flow changed from `OnboardingWizard` to `OnboardingFlow`
2. Navigation patterns changed
3. Component structure changed

The TODO comments in the file indicate these need updates for the "new OnboardingFlow architecture."

---

## Requirements

### Must Do:
1. Read and understand the current OnboardingFlow implementation:
   - `src/components/onboarding/OnboardingFlow.tsx`
   - `src/components/onboarding/shell/` components
   - `src/components/onboarding/steps/` components

2. For each skipped test (`describe.skip` or `it.skip`):
   - Understand what the test was originally testing
   - Determine if the behavior still exists (just moved)
   - Update mocks, selectors, and assertions to match new architecture
   - Remove `.skip` and verify test passes

3. Skipped test locations (from codebase scan):
   - Lines ~94: "renders onboarding for new users" block
   - Lines ~122: navigation tests
   - Lines ~202: describe block
   - Lines ~339: describe block
   - Lines ~509: describe block
   - Lines ~558: describe block

### Must NOT Do:
- Change actual application code (this is test-only changes)
- Delete tests that test valid behavior (update them instead)
- Add new tests (focus on fixing existing)
- Modify other test files in this task

---

## Acceptance Criteria

- [ ] All previously skipped tests in App.test.tsx are now running
- [ ] All tests pass (no failures)
- [ ] No tests are flaky (run 3x to verify)
- [ ] `npm test -- --testPathPattern=App.test.tsx` passes
- [ ] No changes to production code

---

## Testing Approach

1. Run tests before changes: `npm test -- --testPathPattern=App.test.tsx`
2. Note which tests are skipped
3. Fix one test/describe block at a time
4. Run after each fix to verify no regressions
5. Final run: ensure 0 skipped, 0 failed

---

## Files to Modify

- `src/components/__tests__/App.test.tsx` - Update skipped tests

## Files to Read (for context):

- `src/components/onboarding/OnboardingFlow.tsx`
- `src/components/onboarding/types.ts`
- `src/components/onboarding/registry.ts`
- `src/components/onboarding/flows.ts`
- `src/App.tsx`

---

## Implementation Summary Template

When complete, add this to PR description:

```markdown
## Implementation Summary

### Tests Fixed:
1. [Test name] - [What was wrong] → [How fixed]
2. ...

### Approach:
[Brief description of pattern used to update tests]

### Verified:
- [ ] Tests run 3x without flakiness
- [ ] No production code changes
```

---

## Guardrails

⚠️ **STOP and ask PM if:**
- A test appears to be testing deprecated behavior (no longer applicable)
- You discover bugs in production code while fixing tests
- More than 50% of test logic needs rewriting (may need task scope change)
