# State Machine Architecture

**Status:** Production (BACKLOG-142 Complete)
**Last Updated:** 2026-01-04
**Implementation:** SPRINT-020 (Foundation), SPRINT-021 (Migration), SPRINT-022 (Cleanup)

---

## Overview

Magic Audit uses a unified state machine for app state coordination, replacing the previous fragmented hook-based approach. This architecture provides:

- **Single source of truth** for application state
- **Predictable state transitions** via a pure reducer function
- **Eliminates race conditions** that caused recurring bugs
- **Clear loading sequence** with defined phases

---

## State Diagram

```
                    +------------------+
                    |                  |
                    v                  |
+--------+     +--------+     +-----------------+
| START  |---->| loading|---->| unauthenticated |
+--------+     +--------+     +-----------------+
                    |                  |
                    |                  | LOGIN_SUCCESS
                    |                  |
                    |                  v
                    |           +--------+
                    +---------->| loading|---+
                    |           | (user  |   |
                    |           |  data) |   |
                    |           +--------+   |
                    |                  |     |
                    v                  v     |
              +-----------+     +----------+ |
              | onboarding|<----|   ready  |<+
              +-----------+     +----------+
                    |                  ^
                    +------------------+

              +--------+
              | error  |<-------- (from any state)
              +--------+
                    |
                    | RETRY
                    v
              (previous state)
```

---

## States

| State | Description | Transitions To |
|-------|-------------|----------------|
| `loading` | App initializing through phases | `unauthenticated`, `onboarding`, `ready`, `error` |
| `unauthenticated` | No user logged in | `loading` (on LOGIN_SUCCESS) |
| `onboarding` | User completing setup steps | `ready`, `error` |
| `ready` | App fully functional | `unauthenticated` (on LOGOUT) |
| `error` | Recoverable error state | Previous state (on RETRY), `loading` |

### Loading Phases

The `loading` state progresses through four phases in strict order:

```
checking-storage --> initializing-db --> loading-auth --> loading-user-data
```

| Phase | Purpose | Next Phase |
|-------|---------|------------|
| `checking-storage` | Check if encryption key store exists | `initializing-db` |
| `initializing-db` | Initialize SQLite with encryption | `loading-auth` |
| `loading-auth` | Check Supabase authentication | `loading-user-data` or `unauthenticated` |
| `loading-user-data` | Load user preferences from database | `ready` or `onboarding` |

### Onboarding Steps

Steps are conditionally included based on platform and completion status:

| Step | Condition | Description |
|------|-----------|-------------|
| `phone-type` | Always | Select iPhone or Android |
| `secure-storage` | macOS only | Keychain explanation |
| `email-connect` | Always | Email onboarding |
| `permissions` | macOS, not granted | Full Disk Access |
| `apple-driver` | Windows + iPhone, needed | Apple Mobile Device driver |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/appCore/state/machine/types.ts` | TypeScript types for states and actions |
| `src/appCore/state/machine/reducer.ts` | Pure reducer for state transitions |
| `src/appCore/state/machine/AppStateContext.tsx` | React context provider |
| `src/appCore/state/machine/LoadingOrchestrator.tsx` | Coordinates initialization sequence |

### Selectors

| File | Purpose |
|------|---------|
| `src/appCore/state/machine/selectors/appStateSelectors.ts` | Status and phase selectors |
| `src/appCore/state/machine/selectors/userDataSelectors.ts` | User data derivation |

### Hooks

| File | Purpose |
|------|---------|
| `src/appCore/state/machine/hooks/useMachineState.ts` | Required state machine access |
| `src/appCore/state/machine/hooks/useOptionalMachineState.ts` | Optional access (graceful degradation) |
| `src/appCore/state/machine/hooks/useDispatch.ts` | Dispatch actions to state machine |

---

## Actions

| Action | From States | Effect |
|--------|-------------|--------|
| `STORAGE_CHECKED` | loading (checking-storage) | Advance to initializing-db |
| `DB_INIT_STARTED` | loading (initializing-db) | Set progress indicator |
| `DB_INIT_COMPLETE` | loading (initializing-db) | Advance to loading-auth or error |
| `AUTH_LOADED` | loading (loading-auth) | Go to user-data, onboarding, or unauthenticated |
| `LOGIN_SUCCESS` | unauthenticated | Go to loading (user-data) or onboarding |
| `USER_DATA_LOADED` | loading (user-data) | Go to ready or onboarding |
| `ONBOARDING_STEP_COMPLETE` | onboarding | Advance step or go to ready |
| `ONBOARDING_SKIP` | onboarding | Same as complete |
| `LOGOUT` | any | Go to unauthenticated |
| `ERROR` | any | Go to error state |
| `RETRY` | error | Return to previous state |

---

## Usage

### Accessing State

```typescript
import { useMachineState } from '@/appCore/state/machine/hooks/useMachineState';

function MyComponent() {
  const { state, isLoading, isReady, currentUser } = useMachineState();

  if (isLoading) {
    return <LoadingSpinner phase={state.status === 'loading' ? state.phase : null} />;
  }

  if (isReady) {
    return <Dashboard user={currentUser} />;
  }

  return <LoginScreen />;
}
```

### Dispatching Actions

```typescript
import { useDispatch } from '@/appCore/state/machine/hooks/useDispatch';

function LogoutButton() {
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return <button onClick={handleLogout}>Log Out</button>;
}
```

### Using Selectors

```typescript
import { useMachineState } from '@/appCore/state/machine/hooks/useMachineState';
import { selectPhoneType, selectHasEmailConnected } from '@/appCore/state/machine/selectors/userDataSelectors';

function UserSettings() {
  const { state } = useMachineState();

  const phoneType = selectPhoneType(state);
  const hasEmail = selectHasEmailConnected(state);

  return (
    <div>
      <p>Phone: {phoneType || 'Not selected'}</p>
      <p>Email: {hasEmail ? 'Connected' : 'Not connected'}</p>
    </div>
  );
}
```

---

## Feature Flag

For emergency rollback, the state machine can be disabled:

```javascript
// In browser console or at app startup
localStorage.setItem('useNewStateMachine', 'false');

// Re-enable
localStorage.setItem('useNewStateMachine', 'true');
```

When disabled, the app falls back to legacy hook-based coordination (if legacy code is still present).

**Note:** As of SPRINT-022, legacy code paths have been removed. The feature flag remains for future use but disabling it will cause errors.

---

## Troubleshooting

### "Database not initialized" Error

**Cause:** Attempt to access database before `initializing-db` phase completes.

**Fix:**
1. Ensure all database operations wait for `isReady` state
2. Check that components using database are wrapped in appropriate guards
3. Review `AppShell.tsx` and `AppModals.tsx` for gate placement

### Onboarding Screens Flicker (Returning User)

**Cause:** State machine receives `USER_DATA_LOADED` with incomplete data.

**Fix:**
1. Verify `LoadingOrchestrator` waits for all user data to load
2. Check that `isOnboardingComplete()` logic matches actual requirements
3. Review `usePhoneTypeApi` and `useEmailOnboardingApi` for correct state derivation

### Infinite Navigation Loop

**Cause:** Multiple effects triggering navigation simultaneously.

**Fix:**
1. Navigation should derive from state, not trigger state changes
2. Check `useNavigationFlow` for effect dependencies
3. Ensure only one component dispatches navigation-related actions

### State Machine Not Updating

**Cause:** Invalid action dispatched for current state.

**Debug:**
```typescript
// In development, add logging to reducer
console.log('State:', state.status, 'Action:', action.type);
```

**Common Issues:**
- Dispatching `USER_DATA_LOADED` when not in `loading/loading-user-data` phase
- Dispatching `ONBOARDING_STEP_COMPLETE` when not in `onboarding` state
- Missing required action payload (user, platform, data)

### Stuck in Loading State

**Cause:** A phase never completes.

**Debug:**
1. Check `LoadingOrchestrator` phase completion dispatch
2. Verify IPC handlers are responding
3. Check for unhandled errors in phase executors

**Recovery:**
```javascript
// Force state reset (development only)
window.__resetStateMachine?.();
```

---

## Architecture Principles

1. **Single Source of Truth**: All app state lives in the state machine
2. **Predictable Transitions**: Reducer is pure; same state + action = same result
3. **Explicit Phases**: Loading happens in defined order, not racing
4. **Derived State**: UI derives display from state; doesn't store duplicate state
5. **Error Recovery**: Error states preserve previous state for retry

---

## Testing

### Unit Tests

Test the reducer directly:

```typescript
import { appStateReducer } from './reducer';
import { INITIAL_APP_STATE } from './types';

describe('appStateReducer', () => {
  it('transitions from checking-storage to initializing-db', () => {
    const result = appStateReducer(INITIAL_APP_STATE, {
      type: 'STORAGE_CHECKED',
      hasKeyStore: true,
    });
    expect(result.status).toBe('loading');
    expect(result.phase).toBe('initializing-db');
  });
});
```

### Integration Tests

Test hook behavior with mock providers:

```typescript
import { renderHook } from '@testing-library/react';
import { AppStateProvider } from './AppStateContext';
import { useMachineState } from './hooks/useMachineState';

describe('useMachineState', () => {
  it('provides initial loading state', () => {
    const { result } = renderHook(() => useMachineState(), {
      wrapper: AppStateProvider,
    });
    expect(result.current.isLoading).toBe(true);
  });
});
```

---

## Related Documentation

- [Effect Safety Patterns](./effect-safety-patterns.md) - Patterns for React effects
- [Architecture Guardrails](./architecture-guardrails.md) - Entry file line budgets
- [BACKLOG-142](../plans/backlog/BACKLOG-142.md) - Original backlog item

---

## Version History

| Date | Change | Sprint |
|------|--------|--------|
| 2026-01-03 | Foundation implemented | SPRINT-020 |
| 2026-01-03 | Migration to state machine complete | SPRINT-021 |
| 2026-01-04 | Legacy code removed, architecture finalized | SPRINT-022 |
