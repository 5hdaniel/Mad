# Task TASK-931: Integration Tests for State Transitions

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Create comprehensive integration tests that verify the complete state machine flows: new user signup, returning user login, error recovery, and platform-specific paths.

## Non-Goals

- Do NOT test the old useAppStateMachine hook
- Do NOT create UI tests (Playwright/Cypress)
- Do NOT test actual API calls (use mocks)

## Deliverables

1. New file: `src/appCore/state/machine/__tests__/integration.test.ts`
2. New file: `src/appCore/state/machine/__tests__/testUtils.ts` - Test helpers

## Acceptance Criteria

- [ ] Tests cover new user flow (macOS)
- [ ] Tests cover new user flow (Windows)
- [ ] Tests cover returning user flow
- [ ] Tests cover error recovery
- [ ] Tests cover platform-specific logic
- [ ] No flaky tests
- [ ] Tests run in CI
- [ ] `npm test` passes

## Implementation Notes

### Test Utilities

```typescript
// src/appCore/state/machine/__tests__/testUtils.ts

import React from 'react';
import { render } from '@testing-library/react';
import { AppStateProvider } from '../AppStateContext';
import type { AppState } from '../types';

// Mock window.api
export const mockApi = {
  system: {
    hasEncryptionKeyStore: jest.fn(),
    initializeSecureStorage: jest.fn(),
  },
  auth: {
    getStoredSession: jest.fn(),
  },
};

beforeEach(() => {
  (window as any).api = mockApi;
  jest.clearAllMocks();
});

// Render helper with provider
export function renderWithProvider(
  ui: React.ReactElement,
  initialState?: AppState
) {
  return render(
    <AppStateProvider initialState={initialState}>
      {ui}
    </AppStateProvider>
  );
}

// Wait for state to settle
export async function waitForState(
  getState: () => { status: string },
  expectedStatus: string,
  timeout = 5000
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (getState().status === expectedStatus) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`State did not reach ${expectedStatus} within ${timeout}ms`);
}
```

### Integration Tests

```typescript
// src/appCore/state/machine/__tests__/integration.test.ts

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AppStateProvider } from '../AppStateContext';
import { useAppState } from '../useAppState';
import { LoadingOrchestrator } from '../LoadingOrchestrator';
import { mockApi, renderWithProvider } from './testUtils';

describe('AppState Integration Tests', () => {
  describe('New User Flow (macOS)', () => {
    beforeEach(() => {
      // macOS: no keystore initially
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: false });
      mockApi.system.initializeSecureStorage.mockResolvedValue({ success: true });
      mockApi.auth.getStoredSession.mockResolvedValue(null);
    });

    it('transitions: loading -> unauthenticated for new user', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      // Initial state is loading
      expect(result.current.state.status).toBe('loading');

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.state.status).toBe('unauthenticated');
      });
    });

    it('shows onboarding after OAuth login', async () => {
      // Setup: User completes OAuth, gets pending data
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: true });
      mockApi.system.initializeSecureStorage.mockResolvedValue({ success: true });
      mockApi.auth.getStoredSession.mockResolvedValue({
        user: { id: '1', email: 'test@test.com' },
        isNewUser: true,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.status).toBe('onboarding');
      });
    });
  });

  describe('New User Flow (Windows)', () => {
    beforeEach(() => {
      // Windows: DPAPI doesn't require keystore check
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: true });
      mockApi.system.initializeSecureStorage.mockResolvedValue({ success: true });
    });

    it('skips keychain prompt on Windows', async () => {
      // This test verifies Windows auto-initializes DB
      mockApi.auth.getStoredSession.mockResolvedValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.status).toBe('unauthenticated');
      });

      // Verify initializeSecureStorage was called automatically
      expect(mockApi.system.initializeSecureStorage).toHaveBeenCalled();
    });
  });

  describe('Returning User Flow', () => {
    beforeEach(() => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: true });
      mockApi.system.initializeSecureStorage.mockResolvedValue({ success: true });
      mockApi.auth.getStoredSession.mockResolvedValue({
        user: {
          id: '1',
          email: 'returning@test.com',
          display_name: 'Returning User',
        },
        isNewUser: false,
      });
    });

    it('transitions: loading -> ready (skips onboarding)', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      expect(result.current.currentUser?.email).toBe('returning@test.com');
    });

    it('no flicker during transition', async () => {
      const stateHistory: string[] = [];

      const StateRecorder = () => {
        const { state } = useAppState();
        React.useEffect(() => {
          stateHistory.push(state.status);
        }, [state.status]);
        return null;
      };

      renderWithProvider(
        <LoadingOrchestrator>
          <StateRecorder />
        </LoadingOrchestrator>
      );

      await waitFor(() => {
        expect(stateHistory).toContain('ready');
      });

      // Should NOT have onboarding in history for returning user
      expect(stateHistory).not.toContain('onboarding');
    });
  });

  describe('Error Recovery', () => {
    it('handles database init failure', async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: true });
      mockApi.system.initializeSecureStorage.mockResolvedValue({
        success: false,
        error: 'Keychain access denied',
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      if (result.current.state.status === 'error') {
        expect(result.current.state.error.code).toBe('DB_INIT_FAILED');
        expect(result.current.state.recoverable).toBe(true);
      }
    });

    it('allows retry from error state', async () => {
      // First call fails
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: true });
      mockApi.system.initializeSecureStorage
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true });
      mockApi.auth.getStoredSession.mockResolvedValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      // Wait for error
      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      // Retry
      act(() => {
        result.current.dispatch({ type: 'RETRY' });
      });

      // Should recover
      await waitFor(() => {
        expect(result.current.state.status).not.toBe('error');
      });
    });
  });

  describe('Logout', () => {
    it('transitions to unauthenticated from ready', async () => {
      mockApi.system.hasEncryptionKeyStore.mockResolvedValue({ hasKeyStore: true });
      mockApi.system.initializeSecureStorage.mockResolvedValue({ success: true });
      mockApi.auth.getStoredSession.mockResolvedValue({
        user: { id: '1', email: 'test@test.com' },
        isNewUser: false,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppStateProvider>
          <LoadingOrchestrator>{children}</LoadingOrchestrator>
        </AppStateProvider>
      );

      const { result } = renderHook(() => useAppState(), { wrapper });

      // Wait for ready
      await waitFor(() => {
        expect(result.current.state.status).toBe('ready');
      });

      // Logout
      act(() => {
        result.current.dispatch({ type: 'LOGOUT' });
      });

      expect(result.current.state.status).toBe('unauthenticated');
    });
  });
});
```

### Important Details

- All API calls are mocked
- Test state transitions, not UI
- Use renderHook for testing hooks
- Verify no intermediate incorrect states

## Integration Notes

- Imports from: All previous TASK-927 to TASK-930
- Depends on: TASK-927, TASK-928, TASK-929, TASK-930

## Do / Don't

### Do:

- Mock all API calls
- Test complete flows
- Verify state history
- Test error cases

### Don't:

- Test actual API calls
- Create flaky tests
- Test UI rendering details

## Testing Expectations (MANDATORY)

### Test Files Created

- integration.test.ts - All flow tests
- testUtils.ts - Shared utilities

### CI Requirements

- [ ] All tests pass
- [ ] No flaky tests

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 files | +15K |
| Test cases | ~15 cases | +25K |
| Setup complexity | Medium | +10K |

**Confidence:** Medium

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] src/appCore/state/machine/__tests__/integration.test.ts
- [ ] src/appCore/state/machine/__tests__/testUtils.ts

Test coverage:
- [ ] New user flow (macOS)
- [ ] New user flow (Windows)
- [ ] Returning user flow
- [ ] Error recovery
- [ ] Logout

Verification:
- [ ] npm test passes
- [ ] No flaky tests
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~50K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merged To:** project/state-coordination
