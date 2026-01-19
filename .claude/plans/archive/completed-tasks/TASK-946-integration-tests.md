# Task TASK-946: Integration Tests for Migrated Hooks

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Create comprehensive integration tests that verify all migrated hooks work correctly together with the state machine. These tests validate the complete flow from app startup through onboarding to ready state.

## Non-Goals

- Do NOT test legacy hook paths (covered by existing tests)
- Do NOT test state machine internals (covered in Phase 1)
- Do NOT modify any hooks (testing only)
- Do NOT add production code

## Deliverables

1. New file: `src/appCore/state/machine/__tests__/hookMigration.integration.test.ts`
2. New file: `src/appCore/state/machine/__tests__/fullFlow.integration.test.ts`

## Acceptance Criteria

- [ ] Tests cover new user flow (macOS)
- [ ] Tests cover new user flow (Windows)
- [ ] Tests cover returning user flow (macOS)
- [ ] Tests cover returning user flow (Windows)
- [ ] Tests verify no flicker for returning users
- [ ] Tests verify no navigation loops
- [ ] Tests verify all hooks derive correct state
- [ ] Tests verify error recovery
- [ ] Tests run in CI
- [ ] All CI checks pass

## Implementation Notes

### Test Structure

```typescript
// src/appCore/state/machine/__tests__/hookMigration.integration.test.ts

describe('Hook Migration Integration', () => {
  beforeEach(() => {
    // Enable state machine feature flag
    localStorage.setItem('useNewStateMachine', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('useNewStateMachine');
  });

  describe('useSecureStorage with state machine', () => {
    it('derives isDatabaseInitialized from state machine', async () => {
      // Render provider with mock state
      const { result } = renderHook(() => useSecureStorage(), {
        wrapper: createTestProvider({
          status: 'loading',
          phase: 'initializing-db'
        }),
      });

      expect(result.current.isDatabaseInitialized).toBe(false);
      expect(result.current.isCheckingSecureStorage).toBe(false);
    });

    it('updates when state transitions', async () => {
      const { result, rerender } = renderHook(() => useSecureStorage(), {
        wrapper: createTestProvider({
          status: 'loading',
          phase: 'loading-auth'
        }),
      });

      // After DB init, isDatabaseInitialized should be true
      expect(result.current.isDatabaseInitialized).toBe(true);
    });
  });

  describe('usePhoneTypeApi with state machine', () => {
    it('derives hasSelectedPhoneType from state machine', async () => {
      const { result } = renderHook(() => usePhoneTypeApi(), {
        wrapper: createTestProvider({
          status: 'onboarding',
          step: 'phone-type',
          user: mockUser
        }),
      });

      expect(result.current.hasSelectedPhoneType).toBe(false);
      expect(result.current.isLoadingPhoneType).toBe(false);
    });

    it('setPhoneType dispatches onboarding complete', async () => {
      const dispatchSpy = jest.fn();
      const { result } = renderHook(() => usePhoneTypeApi(), {
        wrapper: createTestProviderWithDispatch(dispatchSpy),
      });

      await result.current.setPhoneType('iphone');

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'ONBOARDING_COMPLETE',
        step: 'phone-type',
      });
    });
  });

  describe('useEmailOnboardingApi with state machine', () => {
    it('derives hasCompletedEmailOnboarding correctly', async () => {
      // Test at email step (not complete)
      const { result: beforeEmail } = renderHook(() => useEmailOnboardingApi(), {
        wrapper: createTestProvider({
          status: 'onboarding',
          step: 'email'
        }),
      });
      expect(beforeEmail.current.hasCompletedEmailOnboarding).toBe(false);

      // Test past email step (complete)
      const { result: afterEmail } = renderHook(() => useEmailOnboardingApi(), {
        wrapper: createTestProvider({
          status: 'onboarding',
          step: 'permissions'
        }),
      });
      expect(afterEmail.current.hasCompletedEmailOnboarding).toBe(true);
    });
  });

  describe('useNavigationFlow with state machine', () => {
    it('derives currentStep from state machine', async () => {
      const { result } = renderHook(() => useNavigationFlow(), {
        wrapper: createTestProvider({
          status: 'onboarding',
          step: 'terms'
        }),
      });

      expect(result.current.currentStep).toBe('terms');
    });

    it('shouldNavigateTo returns correct screen', async () => {
      const { result } = renderHook(() => useNavigationFlow(), {
        wrapper: createTestProvider({ status: 'ready', user: mockUser }),
      });

      expect(result.current.shouldNavigateTo('dashboard')).toBe(true);
      expect(result.current.shouldNavigateTo('onboarding')).toBe(false);
    });
  });
});
```

### Full Flow Integration Tests

```typescript
// src/appCore/state/machine/__tests__/fullFlow.integration.test.ts

describe('Full App Flow Integration', () => {
  describe('New User Flow (macOS)', () => {
    it('transitions loading -> onboarding -> ready', async () => {
      const { result, waitForNextUpdate } = renderHook(
        () => ({
          appState: useAppState(),
          storage: useSecureStorage(),
          phoneType: usePhoneTypeApi(),
          email: useEmailOnboardingApi(),
          navigation: useNavigationFlow(),
        }),
        { wrapper: AppStateProviderWithMocks }
      );

      // Initial: loading
      expect(result.current.appState.state.status).toBe('loading');
      expect(result.current.storage.isDatabaseInitialized).toBe(false);

      // Simulate storage check complete
      act(() => {
        result.current.appState.dispatch({
          type: 'STORAGE_CHECKED',
          hasKeyStore: true
        });
      });

      // Simulate DB init complete
      act(() => {
        result.current.appState.dispatch({
          type: 'DB_INIT_COMPLETE',
          success: true
        });
      });

      expect(result.current.storage.isDatabaseInitialized).toBe(true);

      // Simulate auth loaded (new user)
      act(() => {
        result.current.appState.dispatch({
          type: 'AUTH_LOADED',
          user: mockNewUser,
          isNewUser: true
        });
      });

      // Should be in onboarding
      expect(result.current.appState.state.status).toBe('onboarding');
      expect(result.current.navigation.currentStep).toBe('terms');

      // Complete all onboarding steps...
      // (add step completions)

      // Finally: ready
      act(() => {
        result.current.appState.dispatch({ type: 'APP_READY' });
      });

      expect(result.current.appState.state.status).toBe('ready');
      expect(result.current.navigation.shouldNavigateTo('dashboard')).toBe(true);
    });
  });

  describe('Returning User Flow', () => {
    it('skips onboarding and goes directly to ready', async () => {
      const { result } = renderHook(
        () => ({
          appState: useAppState(),
          navigation: useNavigationFlow(),
        }),
        { wrapper: AppStateProviderWithMocks }
      );

      // Simulate fast path for returning user
      act(() => {
        result.current.appState.dispatch({
          type: 'STORAGE_CHECKED',
          hasKeyStore: true
        });
      });

      act(() => {
        result.current.appState.dispatch({
          type: 'DB_INIT_COMPLETE',
          success: true
        });
      });

      act(() => {
        result.current.appState.dispatch({
          type: 'AUTH_LOADED',
          user: mockReturningUser,
          isNewUser: false
        });
      });

      // Should skip onboarding, go straight to ready
      expect(result.current.appState.state.status).toBe('ready');
      expect(result.current.navigation.currentStep).toBeNull();
    });

    it('has no flicker (no temporary onboarding state)', async () => {
      const stateHistory: string[] = [];

      const { result } = renderHook(
        () => {
          const { state } = useAppState();
          stateHistory.push(state.status);
          return state;
        },
        { wrapper: AppStateProviderWithMocks }
      );

      // Simulate returning user flow rapidly
      act(() => {
        // Fast path simulation
        result.current.dispatch({ type: 'STORAGE_CHECKED', hasKeyStore: true });
        result.current.dispatch({ type: 'DB_INIT_COMPLETE', success: true });
        result.current.dispatch({
          type: 'AUTH_LOADED',
          user: mockReturningUser,
          isNewUser: false
        });
      });

      // Verify no 'onboarding' state in history
      expect(stateHistory).not.toContain('onboarding');
    });
  });

  describe('Error Recovery', () => {
    it('handles database init failure gracefully', async () => {
      const { result } = renderHook(
        () => ({
          appState: useAppState(),
          storage: useSecureStorage(),
        }),
        { wrapper: AppStateProviderWithMocks }
      );

      act(() => {
        result.current.appState.dispatch({
          type: 'DB_INIT_COMPLETE',
          success: false,
          error: 'Encryption key not found'
        });
      });

      expect(result.current.appState.state.status).toBe('error');
      expect(result.current.storage.secureStorageError).toBe('Encryption key not found');
    });
  });
});
```

### Test Utilities

```typescript
// Test provider factory
function createTestProvider(initialState: Partial<AppState>) {
  return ({ children }: { children: React.ReactNode }) => (
    <AppStateContext.Provider value={{
      state: { ...defaultState, ...initialState },
      dispatch: jest.fn(),
      isLoading: initialState.status === 'loading',
      isReady: initialState.status === 'ready',
      currentUser: null,
      platform: null,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}
```

## Integration Notes

- Imports from: All migrated hooks (TASK-941, 942, 943, 945)
- Tests: Hook integration with state machine
- Depends on: TASK-945 (all hooks migrated)

## Do / Don't

### Do:

- Enable feature flag in each test setup
- Test all state transitions
- Verify no flicker in returning user flow
- Mock API calls appropriately

### Don't:

- Test legacy hook paths (existing tests cover this)
- Test state machine reducer (Phase 1 covered this)
- Modify production code
- Skip platform-specific tests

## When to Stop and Ask

- If hooks behave differently than expected
- If state machine actions are missing
- If integration tests reveal bugs in migrated hooks
- If unsure about test isolation

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this IS the test task)

### Coverage

- Coverage impact: Should increase overall coverage
- Target: Add meaningful coverage for hook integration

### Integration / Feature Tests

- This task creates the integration tests

### CI Requirements

This task's PR MUST pass:
- [ ] All new integration tests pass
- [ ] Type checking passes
- [ ] Lint / format checks pass
- [ ] Existing tests not broken

**Test suite must be comprehensive and reliable.**

## PR Preparation

- **Title**: `test(state): add integration tests for migrated hooks`
- **Labels**: `state-machine`, `phase-2`, `testing`
- **Branch From**: `project/state-coordination`
- **Branch Into**: `project/state-coordination`
- **Branch Name**: `feature/TASK-946-integration-tests`
- **Depends on**: TASK-945

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 test files | +20K |
| Test scenarios | ~20 test cases | +20K |
| Test utilities | Helper functions | +5K |
| Mock setup | Complex mocking | +5K |

**Confidence:** Medium

**Risk factors:**
- May uncover bugs in migrated hooks
- Mock setup complexity

**Similar past tasks:** TASK-931 (integration tests, ~50K est)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-01-03*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: (foreground agent - no agent_id)
```

### Checklist

```
Files created:
- [x] src/appCore/state/machine/__tests__/hookMigration.integration.test.tsx
- [x] src/appCore/state/machine/__tests__/fullFlow.integration.test.tsx

Test scenarios covered:
- [x] useSecureStorage with state machine (5 tests)
- [x] usePhoneTypeApi with state machine (4 tests)
- [x] useEmailOnboardingApi with state machine (4 tests)
- [x] useNavigationFlow with state machine (4 tests)
- [x] All hooks together (3 tests)
- [x] New user flow (macOS) (2 tests)
- [x] New user flow (Windows) (3 tests)
- [x] Returning user flow (macOS + Windows + no flicker + step history) (4 tests)
- [x] Error recovery (4 tests)
- [x] Logout flow (3 tests)
- [x] Concurrent operations (3 tests)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (40 new tests, 3x runs with no flakiness)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | ~35K (estimated) |
| Duration | ~15 minutes |
| API Calls | N/A (foreground) |
| Input Tokens | N/A |
| Output Tokens | N/A |
| Cache Read | N/A |
| Cache Create | N/A |

**Variance:** PM Est ~50K vs Actual ~35K (-30% under)

### Notes

**Planning notes:**
- Used existing testUtils.ts infrastructure for mocking
- Followed pattern from existing hook tests (useSecureStorage.machine.test.tsx etc.)
- Created two test files as specified: hookMigration and fullFlow

**Deviations from plan:**
- DEVIATION: Files created with .tsx extension instead of .ts (required for JSX in wrapper components)
- DEVIATION: Added additional test scenarios beyond task spec (logout flow, concurrent operations)

**Design decisions:**
1. Used `as any` cast for USER_DATA_LOADED action because the reducer expects extended context (user, platform) that the base type doesn't include
2. Mocked feature flags module to enable state machine path in all tests
3. Created comprehensive default hook options to avoid repetition
4. Tested state derivation from multiple perspectives (hooks and useAppState)

**Issues encountered:**
1. Initial file extension was .ts but JSX in test wrappers required .tsx
2. USER_DATA_LOADED action requires user/platform context that isn't in the base type - required adding context to dispatches

**Reviewer notes:**
- 40 tests total: 21 in hookMigration, 19 in fullFlow
- Tests cover all acceptance criteria from task file
- Tests verify no flicker for returning users by tracking state/step history
- All tests run in ~0.8s and pass 3x without flakiness

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~50K | ~35K | -30% |
| Duration | - | ~15 min | - |

**Root cause of variance:**
Existing test infrastructure (testUtils.ts, patterns from hook tests) accelerated implementation. No significant debugging required after fixing file extension issue.

**Suggestion for similar tasks:**
Reduce estimate for test tasks that can leverage existing test utilities and patterns. ~30-35K more appropriate for this type of test-only task.

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-03
**Status:** APPROVED

### Branch Information (SR Engineer Assigned)

- **Branch From:** `project/state-coordination`
- **Branch Into:** `project/state-coordination`
- **Branch Name:** `feature/TASK-946-integration-tests`

### Execution Classification

- **Parallel Safe:** No
- **Depends On:** TASK-945
- **Blocks:** TASK-947

### Technical Notes

Integration tests must verify all migrated hooks work together. Key test scenarios:
1. New user flow (macOS and Windows)
2. Returning user flow (no flicker)
3. Error recovery
4. Feature flag toggle behavior

### Shared File Analysis

- **Files created:** Integration test files (new)
- **Conflicts with:** None

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/state-coordination
