# Task TASK-930: Build Loading Orchestrator

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Create the LoadingOrchestrator component that coordinates the initialization sequence (storage check -> DB init -> auth load -> user data load), dispatching actions to the state machine at each phase.

## Non-Goals

- Do NOT modify existing hooks
- Do NOT integrate with existing App.tsx yet
- Do NOT implement feature flag logic (TASK-933)
- Do NOT implement full error recovery UI

## Deliverables

1. New file: `src/appCore/state/machine/LoadingOrchestrator.tsx` - Orchestrator component
2. New file: `src/appCore/state/machine/components/LoadingScreen.tsx` - Loading UI
3. New file: `src/appCore/state/machine/components/ErrorScreen.tsx` - Error UI
4. Update: `src/appCore/state/machine/index.ts` - Add exports

## Acceptance Criteria

- [ ] Orchestrates all loading phases in order
- [ ] Each phase waits for previous to complete
- [ ] Dispatches correct actions at each phase
- [ ] Shows loading UI with current phase
- [ ] Shows error UI for non-recoverable errors
- [ ] Works on both macOS and Windows
- [ ] No race conditions in initialization
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### LoadingOrchestrator Component

```typescript
// src/appCore/state/machine/LoadingOrchestrator.tsx

import React, { useEffect } from 'react';
import { useAppState } from './useAppState';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import type { PlatformInfo } from './types';

interface LoadingOrchestratorProps {
  children: React.ReactNode;
}

/**
 * Orchestrates the app initialization sequence.
 * Coordinates: storage check -> DB init -> auth -> user data
 */
export function LoadingOrchestrator({ children }: LoadingOrchestratorProps) {
  const { state, dispatch } = useAppState();

  // Detect platform once at startup
  const platform: PlatformInfo = {
    isMacOS: window.navigator.platform.includes('Mac'),
    isWindows: window.navigator.platform.includes('Win'),
    hasIPhone: false, // Determined during onboarding
  };

  // ============================================
  // PHASE 1: Check storage
  // ============================================
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'checking-storage') {
      window.api.system.hasEncryptionKeyStore()
        .then(result => {
          dispatch({
            type: 'STORAGE_CHECKED',
            hasKeyStore: result.hasKeyStore,
          });
        })
        .catch(error => {
          dispatch({
            type: 'ERROR',
            error: {
              code: 'STORAGE_CHECK_FAILED',
              message: error.message || 'Failed to check storage',
            },
            recoverable: true,
          });
        });
    }
  }, [state.status, state.phase, dispatch]);

  // ============================================
  // PHASE 2: Initialize database
  // ============================================
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'initializing-db') {
      dispatch({ type: 'DB_INIT_STARTED' });

      window.api.system.initializeSecureStorage()
        .then(result => {
          dispatch({
            type: 'DB_INIT_COMPLETE',
            success: result.success,
            error: result.error,
          });
        })
        .catch(error => {
          dispatch({
            type: 'DB_INIT_COMPLETE',
            success: false,
            error: error.message || 'Database initialization failed',
          });
        });
    }
  }, [state.status, state.phase, dispatch]);

  // ============================================
  // PHASE 3: Load auth state
  // ============================================
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'loading-auth') {
      // Check if there's an existing session
      window.api.auth.getStoredSession?.()
        .then(session => {
          if (session?.user) {
            dispatch({
              type: 'AUTH_LOADED',
              user: {
                id: session.user.id,
                email: session.user.email,
                displayName: session.user.display_name,
                avatarUrl: session.user.avatar_url,
              },
              isNewUser: false,
              platform,
            });
          } else {
            dispatch({
              type: 'AUTH_LOADED',
              user: null,
              isNewUser: false,
              platform,
            });
          }
        })
        .catch(error => {
          // No session is not an error - just means user needs to login
          console.warn('[LoadingOrchestrator] No stored session:', error);
          dispatch({
            type: 'AUTH_LOADED',
            user: null,
            isNewUser: false,
            platform,
          });
        });
    }
  }, [state.status, state.phase, dispatch, platform]);

  // ============================================
  // PHASE 4: Load user data (if authenticated)
  // ============================================
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'loading-user-data') {
      // TODO: Load phone type, email status, etc.
      // This requires the user ID which we'll have after auth
      // For now, dispatch placeholder
      dispatch({
        type: 'USER_DATA_LOADED',
        data: {
          phoneType: null,
          hasCompletedEmailOnboarding: false,
          hasEmailConnected: false,
          needsDriverSetup: false,
          hasPermissions: false,
        },
      });
    }
  }, [state.status, state.phase, dispatch]);

  // ============================================
  // RENDER BASED ON STATE
  // ============================================

  // Loading states - show loading screen
  if (state.status === 'loading') {
    return <LoadingScreen phase={state.phase} progress={state.progress} />;
  }

  // Non-recoverable error - show error screen
  if (state.status === 'error' && !state.recoverable) {
    return (
      <ErrorScreen
        error={state.error}
        onRetry={() => dispatch({ type: 'RETRY' })}
      />
    );
  }

  // Recoverable error or other states - render children
  // (error recovery UI can be shown as overlay)
  return <>{children}</>;
}
```

### Loading Screen Component

```typescript
// src/appCore/state/machine/components/LoadingScreen.tsx

import React from 'react';
import type { LoadingPhase } from '../types';

interface LoadingScreenProps {
  phase: LoadingPhase;
  progress?: number;
}

const PHASE_MESSAGES: Record<LoadingPhase, string> = {
  'checking-storage': 'Checking secure storage...',
  'initializing-db': 'Initializing secure database...',
  'loading-auth': 'Loading authentication...',
  'loading-user-data': 'Loading your data...',
};

export function LoadingScreen({ phase, progress }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

        {/* Phase message */}
        <p className="text-gray-600 text-lg mb-2">
          {PHASE_MESSAGES[phase]}
        </p>

        {/* Progress bar (optional) */}
        {progress !== undefined && (
          <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

### Error Screen Component

```typescript
// src/appCore/state/machine/components/ErrorScreen.tsx

import React from 'react';
import type { AppError } from '../types';

interface ErrorScreenProps {
  error: AppError;
  onRetry?: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-4">
          {error.message}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Error code: {error.code}
        </p>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
```

### Important Details

- Effects must check BOTH status AND phase to prevent duplicate calls
- Platform detection happens once at startup
- User data loading may need to wait for auth context
- Errors should be recoverable when possible

## Integration Notes

- Imports from: `./types`, `./useAppState` (TASK-929)
- Exports to: TASK-931 (tests), TASK-933 (feature flag wrapper)
- Depends on: TASK-927, TASK-928, TASK-929

## Do / Don't

### Do:

- Guard effects with status AND phase checks
- Show meaningful loading messages
- Handle errors gracefully
- Support retry for recoverable errors

### Don't:

- Call APIs outside effects
- Race conditions between phases
- Modify existing components
- Import from existing hooks directly

## When to Stop and Ask

- If window.api methods don't exist or differ
- If auth session format is unclear
- If user data loading needs existing context

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests:
  - Phase transitions trigger correct effects
  - Loading screen shows correct phase
  - Error screen shows error info

### Integration Tests

- Required: Yes (TASK-931)
- Full flow from loading to ready

### CI Requirements

- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~60K

**Token Cap:** 240K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 files | +25K |
| Code volume | ~400 lines | +20K |
| Test complexity | Medium | +15K |

**Confidence:** Medium

**Risk factors:**
- API integration may need adjustment
- Platform-specific edge cases

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
- [ ] src/appCore/state/machine/LoadingOrchestrator.tsx
- [ ] src/appCore/state/machine/components/LoadingScreen.tsx
- [ ] src/appCore/state/machine/components/ErrorScreen.tsx

Features implemented:
- [ ] All 4 loading phases
- [ ] Loading UI with phase messages
- [ ] Error UI with retry
- [ ] Platform detection

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~60K vs Actual ~XK (X% over/under)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merged To:** project/state-coordination
