# Task TASK-928: Implement Core State Machine Reducer

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

Implement the reducer function that handles all state transitions for the unified state machine. This is the core logic that determines how the app state changes in response to actions.

## Non-Goals

- Do NOT create React context (TASK-929)
- Do NOT implement side effects or API calls
- Do NOT modify existing hooks
- Do NOT create UI components

## Deliverables

1. New file: `src/appCore/state/machine/reducer.ts` - State reducer implementation
2. New file: `src/appCore/state/machine/reducer.test.ts` - Unit tests
3. Update: `src/appCore/state/machine/index.ts` - Add export

## Acceptance Criteria

- [ ] Reducer handles all defined actions
- [ ] Invalid transitions return current state (no-op)
- [ ] Transitions follow the loading sequence
- [ ] Onboarding step progression is correct
- [ ] Error recovery transitions work
- [ ] Unit tests cover all transitions
- [ ] Test coverage >90% for reducer
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Reducer Implementation

```typescript
// src/appCore/state/machine/reducer.ts

import type {
  AppState,
  AppAction,
  LoadingState,
  OnboardingState,
  ReadyState,
  ErrorState,
  OnboardingStep,
  INITIAL_APP_STATE,
} from './types';

/**
 * Determines the next onboarding step based on completed steps and user data.
 */
function getNextOnboardingStep(
  completed: OnboardingStep[],
  platform: { isMacOS: boolean; isWindows: boolean; hasIPhone: boolean },
  userData: { needsDriverSetup: boolean; hasPermissions: boolean }
): OnboardingStep | null {
  const steps: OnboardingStep[] = [
    'terms',
    'phone-type',
    'email',
    // Conditional steps
    ...(platform.isWindows && platform.hasIPhone && userData.needsDriverSetup
      ? ['apple-driver-setup' as OnboardingStep]
      : []),
    ...(platform.isMacOS && !userData.hasPermissions
      ? ['permissions' as OnboardingStep]
      : []),
  ];

  for (const step of steps) {
    if (!completed.includes(step)) {
      return step;
    }
  }

  return null; // All steps complete
}

/**
 * Core reducer for app state machine.
 * All state transitions are explicit and predictable.
 */
export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ============================================
    // LOADING PHASE TRANSITIONS
    // ============================================

    case 'STORAGE_CHECKED': {
      if (state.status !== 'loading' || state.phase !== 'checking-storage') {
        return state; // Invalid transition
      }
      return {
        status: 'loading',
        phase: action.hasKeyStore ? 'initializing-db' : 'checking-storage',
      };
    }

    case 'DB_INIT_STARTED': {
      if (state.status !== 'loading') return state;
      // Just a progress indicator, don't change phase
      return { ...state, progress: 0 };
    }

    case 'DB_INIT_COMPLETE': {
      if (state.status !== 'loading' || state.phase !== 'initializing-db') {
        return state;
      }
      if (!action.success) {
        return {
          status: 'error',
          error: {
            code: 'DB_INIT_FAILED',
            message: action.error || 'Failed to initialize database',
          },
          recoverable: true,
          previousState: state,
        };
      }
      return { status: 'loading', phase: 'loading-auth' };
    }

    case 'AUTH_LOADED': {
      if (state.status !== 'loading' || state.phase !== 'loading-auth') {
        return state;
      }
      if (!action.user) {
        return { status: 'unauthenticated' };
      }
      // Continue to load user data
      return { status: 'loading', phase: 'loading-user-data' };
    }

    case 'USER_DATA_LOADED': {
      if (state.status !== 'loading' || state.phase !== 'loading-user-data') {
        return state;
      }
      // This action should only come after AUTH_LOADED with a user
      // We need platform and user from somewhere - this is a design issue
      // For now, assume we track them in a separate way
      // TODO: This transition needs more context
      return state;
    }

    // ============================================
    // ONBOARDING TRANSITIONS
    // ============================================

    case 'ONBOARDING_STEP_COMPLETE': {
      if (state.status !== 'onboarding') return state;

      const completedSteps = [...state.completedSteps, action.step];
      const nextStep = getNextOnboardingStep(
        completedSteps,
        state.platform,
        {
          needsDriverSetup: false, // TODO: Get from user data
          hasPermissions: false,   // TODO: Get from user data
        }
      );

      if (!nextStep) {
        // All onboarding complete
        return {
          status: 'ready',
          user: state.user,
          platform: state.platform,
          userData: {
            phoneType: null,
            hasCompletedEmailOnboarding: true,
            hasEmailConnected: false,
            needsDriverSetup: false,
            hasPermissions: state.platform.isMacOS ? true : false,
          },
        };
      }

      return {
        ...state,
        step: nextStep,
        completedSteps,
      };
    }

    case 'ONBOARDING_SKIP': {
      if (state.status !== 'onboarding') return state;
      // Treat skip same as complete for navigation
      return appStateReducer(state, {
        type: 'ONBOARDING_STEP_COMPLETE',
        step: action.step,
      });
    }

    // ============================================
    // READY STATE TRANSITIONS
    // ============================================

    case 'APP_READY': {
      // Explicit transition to ready if not already
      if (state.status === 'ready') return state;
      return state; // Invalid transition from other states
    }

    // ============================================
    // LOGOUT
    // ============================================

    case 'LOGOUT': {
      return { status: 'unauthenticated' };
    }

    // ============================================
    // ERROR HANDLING
    // ============================================

    case 'ERROR': {
      return {
        status: 'error',
        error: action.error,
        recoverable: action.recoverable ?? false,
        previousState: state,
      };
    }

    case 'RETRY': {
      if (state.status !== 'error' || !state.recoverable) {
        return state;
      }
      // Return to previous state or initial
      return state.previousState || INITIAL_APP_STATE;
    }

    default:
      return state;
  }
}
```

### Unit Tests

```typescript
// src/appCore/state/machine/reducer.test.ts

import { appStateReducer } from './reducer';
import { INITIAL_APP_STATE } from './types';
import type { AppState, AppAction } from './types';

describe('appStateReducer', () => {
  describe('Loading Phase Transitions', () => {
    it('STORAGE_CHECKED with keyStore transitions to initializing-db', () => {
      const state = INITIAL_APP_STATE;
      const action: AppAction = { type: 'STORAGE_CHECKED', hasKeyStore: true };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: 'loading',
        phase: 'initializing-db',
      });
    });

    it('DB_INIT_COMPLETE success transitions to loading-auth', () => {
      const state: AppState = { status: 'loading', phase: 'initializing-db' };
      const action: AppAction = { type: 'DB_INIT_COMPLETE', success: true };

      const result = appStateReducer(state, action);

      expect(result).toEqual({
        status: 'loading',
        phase: 'loading-auth',
      });
    });

    it('DB_INIT_COMPLETE failure transitions to error', () => {
      const state: AppState = { status: 'loading', phase: 'initializing-db' };
      const action: AppAction = {
        type: 'DB_INIT_COMPLETE',
        success: false,
        error: 'Keychain access denied',
      };

      const result = appStateReducer(state, action);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.code).toBe('DB_INIT_FAILED');
        expect(result.recoverable).toBe(true);
      }
    });
  });

  describe('Invalid Transitions', () => {
    it('returns current state for invalid action', () => {
      const state: AppState = { status: 'unauthenticated' };
      const action: AppAction = { type: 'DB_INIT_COMPLETE', success: true };

      const result = appStateReducer(state, action);

      expect(result).toBe(state);
    });
  });

  describe('Error Recovery', () => {
    it('RETRY returns to previous state if recoverable', () => {
      const previousState: AppState = { status: 'loading', phase: 'initializing-db' };
      const state: AppState = {
        status: 'error',
        error: { code: 'DB_INIT_FAILED', message: 'test' },
        recoverable: true,
        previousState,
      };

      const result = appStateReducer(state, { type: 'RETRY' });

      expect(result).toEqual(previousState);
    });
  });

  describe('Logout', () => {
    it('LOGOUT transitions to unauthenticated from any state', () => {
      const state: AppState = {
        status: 'ready',
        user: { id: '1', email: 'test@test.com' },
        platform: { isMacOS: true, isWindows: false, hasIPhone: true },
        userData: {
          phoneType: 'iphone',
          hasCompletedEmailOnboarding: true,
          hasEmailConnected: true,
          needsDriverSetup: false,
          hasPermissions: true,
        },
      };

      const result = appStateReducer(state, { type: 'LOGOUT' });

      expect(result).toEqual({ status: 'unauthenticated' });
    });
  });
});
```

### Important Details

- Reducer must be pure - no side effects
- Invalid transitions return current state unchanged
- Error states track `previousState` for retry
- Onboarding step progression is platform-aware

## Integration Notes

- Imports from: `./types` (TASK-927)
- Exports to: `./index.ts`, TASK-929 (context)
- Used by: AppStateContext, LoadingOrchestrator
- Depends on: TASK-927 (types must be complete)

## Do / Don't

### Do:

- Keep reducer pure (no side effects)
- Handle all action types
- Return current state for invalid transitions
- Test every transition path

### Don't:

- Call APIs or perform I/O
- Mutate state directly
- Throw errors (return error state instead)
- Import from existing hooks

## When to Stop and Ask

- If types from TASK-927 are incomplete
- If onboarding step progression logic is unclear
- If platform-specific logic needs clarification

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - All loading phase transitions
  - All onboarding transitions
  - Error and recovery transitions
  - Invalid transition handling
- Existing tests to update: None

### Coverage

- Coverage impact: >90% for reducer.ts

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests WILL BE REJECTED.**

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +15K |
| Code volume | ~300 lines | +15K |
| Test complexity | High (many cases) | +10K |

**Confidence:** Medium

**Risk factors:**
- State transition logic may be complex
- Tests need many cases

**Similar past tasks:** TASK-918 (service) ~30K

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
Files created:
- [ ] src/appCore/state/machine/reducer.ts
- [ ] src/appCore/state/machine/reducer.test.ts

Features implemented:
- [ ] appStateReducer function
- [ ] getNextOnboardingStep helper
- [ ] All action handlers
- [ ] Comprehensive unit tests

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Coverage >90% for reducer
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions>

**Deviations from plan:**
<None or explanation>

**Design decisions:**
<Decisions made>

**Issues encountered:**
<Issues and resolutions>

**Reviewer notes:**
<Notes for reviewer>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |

**Root cause of variance:**
<explanation>

**Suggestion for similar tasks:**
<suggestions>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

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
<observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/state-coordination
