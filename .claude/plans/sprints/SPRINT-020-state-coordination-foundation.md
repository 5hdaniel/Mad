# SPRINT-020: State Coordination Foundation (Phase 1)

**Status:** COMPLETE ✅
**Created:** 2026-01-03
**Completed:** 2026-01-03
**Target:** project/state-coordination (integration branch)
**Final Merge:** develop (after all phases complete)

---

## Executive Summary

Create the foundation for a unified state machine architecture to replace fragmented hook-based state coordination. This is Phase 1 of a 3-phase initiative (BACKLOG-142).

### Sprint Goals

1. Design and implement core state machine types and reducer
2. Create AppStateContext provider that runs parallel to existing hooks
3. Build loading orchestrator to coordinate initialization sequence
4. Add comprehensive integration tests
5. Establish project branch for multi-sprint work

### Constraints

- **DO NOT** remove or modify existing hooks (parallel implementation)
- **DO NOT** change component behavior (consumers unchanged)
- **MUST** preserve existing onboarding step registry
- **MUST** work on both macOS and Windows

---

## Task List

| ID | Title | Category | Est Tokens | Token Cap | Parallel |
|----|-------|----------|------------|-----------|----------|
| TASK-927 | Design state machine types and transitions | schema | ~30K | 120K | - |
| TASK-928 | Implement core state machine reducer | service | ~40K | 160K | After 927 |
| TASK-929 | Create AppStateContext provider | service | ~50K | 200K | After 928 |
| TASK-930 | Build loading orchestrator | service | ~60K | 240K | After 929 |
| TASK-931 | Integration tests for state transitions | test | ~50K | 200K | After 930 |
| TASK-932 | Platform-specific initialization paths | service | ~40K | 160K | After 930 |
| TASK-933 | Feature flag and rollback mechanism | service | ~25K | 100K | After 929 |

**Total Estimated Tokens:** ~295K
**Sprint Token Budget:** ~400K (includes SR review overhead)

---

## Dependency Graph

```
TASK-927 (types) ─────────────────────────────────────────┐
    |                                                     |
    v                                                     |
TASK-928 (reducer) ───────────────────────────────────────┤
    |                                                     |
    v                                                     |
TASK-929 (context) ───────────────────────────────────────┤
    |                                                     |
    +─────────────+─────────────+                         |
    |             |             |                         |
    v             v             |                         |
TASK-930      TASK-933          |                         |
(loader)      (flag)            |                         |
    |             |             |                         |
    +─────────────+             |                         |
    |             |             |                         |
    v             v             |                         |
TASK-931      TASK-932          |                         |
(tests)       (platform)        |                         |
                                |                         |
                         All import from types.ts ────────┘
```

**Execution Order (SR Engineer Confirmed):**

| Batch | Tasks | Type | Rationale |
|-------|-------|------|-----------|
| **1** | TASK-927 | Sequential | Foundation types, all tasks depend on it |
| **2** | TASK-928 | Sequential | Reducer depends on types, context depends on reducer |
| **3** | TASK-929 | Sequential | Context depends on reducer, multiple tasks depend on context |
| **4** | TASK-930, TASK-933 | **Parallel** | Both only depend on context, no shared files between them |
| **5** | TASK-931, TASK-932 | **Parallel** | Both depend on TASK-930, minimal overlap |

**Note on Batch 5:** TASK-932 modifies `LoadingOrchestrator.tsx` created by TASK-930. TASK-931 tests it. If running in parallel, TASK-931 should use placeholder tests for platform-specific paths that TASK-932 adds.

---

## Branch Strategy

### Project Branch

All Phase 1 work goes to `project/state-coordination`:

```bash
# Create project branch
git checkout develop
git pull origin develop
git checkout -b project/state-coordination

# Task branches for each task
git checkout project/state-coordination
git checkout -b feature/TASK-927-state-machine-types
```

### Merge Flow

```
develop
    |
    +-- project/state-coordination (integration point)
           |
           +-- feature/TASK-927-state-machine-types
           +-- feature/TASK-928-state-reducer
           +-- feature/TASK-929-app-state-context
           +-- feature/TASK-930-loading-orchestrator
           +-- feature/TASK-931-integration-tests
           +-- feature/TASK-932-platform-init
           +-- feature/TASK-933-feature-flag
```

PRs merge to `project/state-coordination` during sprint.
Final merge to `develop` happens at end of Phase 3.

---

## Task Details

### TASK-927: Design State Machine Types

**Goal:** Define TypeScript types for the unified state machine.

**Deliverables:**
- `src/appCore/state/machine/types.ts` - State, Action, Context types
- `src/appCore/state/machine/index.ts` - Barrel export

**Key Types:**
```typescript
// Loading sub-phases
type LoadingPhase =
  | 'checking-storage'
  | 'initializing-db'
  | 'loading-auth'
  | 'loading-user-data';

// Onboarding steps (preserve existing)
type OnboardingStep =
  | 'terms'
  | 'phone-type'
  | 'email'
  | 'apple-driver-setup'
  | 'android-coming-soon'
  | 'permissions';

// App states
type AppState =
  | { status: 'loading'; phase: LoadingPhase; progress?: number }
  | { status: 'unauthenticated' }
  | { status: 'onboarding'; step: OnboardingStep; user: User }
  | { status: 'ready'; user: User; platform: PlatformInfo }
  | { status: 'error'; error: AppError; recoverable: boolean };

// Actions
type AppAction =
  | { type: 'STORAGE_CHECKED'; hasKeyStore: boolean }
  | { type: 'DB_INIT_STARTED' }
  | { type: 'DB_INIT_COMPLETE'; success: boolean; error?: string }
  | { type: 'AUTH_LOADED'; user: User | null; isNewUser: boolean }
  | { type: 'USER_DATA_LOADED'; data: UserData }
  | { type: 'ONBOARDING_COMPLETE'; step: OnboardingStep }
  | { type: 'ONBOARDING_SKIP'; step: OnboardingStep }
  | { type: 'APP_READY' }
  | { type: 'LOGOUT' }
  | { type: 'ERROR'; error: AppError };

// Context value
interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Derived selectors
  isLoading: boolean;
  isReady: boolean;
  currentUser: User | null;
  platform: PlatformInfo | null;
}
```

**Acceptance Criteria:**
- [ ] All states defined with discriminated unions
- [ ] All actions defined with payload types
- [ ] Context interface complete
- [ ] Types exported from barrel
- [ ] `npm run type-check` passes

**Est. Tokens:** ~30K | **Cap:** 120K

---

### TASK-928: Implement Core State Machine Reducer

**Goal:** Implement the reducer function with all state transitions.

**Deliverables:**
- `src/appCore/state/machine/reducer.ts` - State reducer
- `src/appCore/state/machine/reducer.test.ts` - Unit tests

**Key Implementation:**
```typescript
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'STORAGE_CHECKED':
      if (state.status !== 'loading') return state;
      return action.hasKeyStore
        ? { status: 'loading', phase: 'initializing-db' }
        : { status: 'loading', phase: 'checking-storage' };

    case 'DB_INIT_COMPLETE':
      if (state.status !== 'loading') return state;
      if (!action.success) {
        return { status: 'error', error: { code: 'DB_INIT_FAILED', message: action.error }, recoverable: true };
      }
      return { status: 'loading', phase: 'loading-auth' };

    // ... all transitions
  }
}
```

**Acceptance Criteria:**
- [ ] All state transitions implemented
- [ ] Invalid transitions return current state (no-op)
- [ ] Unit tests for every transition
- [ ] Edge cases covered (double-dispatch, etc.)
- [ ] Test coverage >90% for reducer

**Est. Tokens:** ~40K | **Cap:** 160K

---

### TASK-929: Create AppStateContext Provider

**Goal:** Create the React context provider that wraps the state machine.

**Deliverables:**
- `src/appCore/state/machine/AppStateContext.tsx` - Provider component
- `src/appCore/state/machine/useAppState.ts` - Consumer hook

**Key Implementation:**
```typescript
const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  // Derived values (memoized)
  const value = useMemo(() => ({
    state,
    dispatch,
    isLoading: state.status === 'loading',
    isReady: state.status === 'ready',
    currentUser: state.status === 'ready' || state.status === 'onboarding'
      ? state.user
      : null,
    platform: state.status === 'ready' ? state.platform : null,
  }), [state]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

// Consumer hook with type safety
export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
```

**Acceptance Criteria:**
- [ ] Provider wraps children correctly
- [ ] Hook throws if used outside provider
- [ ] Derived values are memoized
- [ ] No unnecessary re-renders
- [ ] Works alongside existing useAppStateMachine

**Est. Tokens:** ~50K | **Cap:** 200K

---

### TASK-930: Build Loading Orchestrator

**Goal:** Create the orchestrator that coordinates the initialization sequence.

**Deliverables:**
- `src/appCore/state/machine/LoadingOrchestrator.tsx` - Orchestrates initialization
- Integration with AppStateProvider

**Key Implementation:**
```typescript
function LoadingOrchestrator({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useAppState();

  // Phase 1: Check storage
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'checking-storage') {
      window.api.system.hasEncryptionKeyStore()
        .then(result => dispatch({ type: 'STORAGE_CHECKED', hasKeyStore: result.hasKeyStore }))
        .catch(error => dispatch({ type: 'ERROR', error: { code: 'STORAGE_CHECK_FAILED', message: error.message } }));
    }
  }, [state, dispatch]);

  // Phase 2: Initialize database
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'initializing-db') {
      dispatch({ type: 'DB_INIT_STARTED' });
      window.api.system.initializeSecureStorage()
        .then(result => dispatch({ type: 'DB_INIT_COMPLETE', success: result.success, error: result.error }))
        .catch(error => dispatch({ type: 'DB_INIT_COMPLETE', success: false, error: error.message }));
    }
  }, [state, dispatch]);

  // ... remaining phases

  // Render based on state
  if (state.status === 'loading') {
    return <LoadingScreen phase={state.phase} progress={state.progress} />;
  }

  if (state.status === 'error' && !state.recoverable) {
    return <ErrorScreen error={state.error} />;
  }

  return children;
}
```

**Acceptance Criteria:**
- [ ] All initialization phases orchestrated in order
- [ ] Each phase waits for previous to complete
- [ ] Errors handled gracefully
- [ ] Loading UI shows current phase
- [ ] Works on both macOS and Windows

**Est. Tokens:** ~60K | **Cap:** 240K

---

### TASK-931: Integration Tests for State Transitions

**Goal:** Create comprehensive integration tests for all state flows.

**Deliverables:**
- `src/appCore/state/machine/__tests__/integration.test.ts`

**Test Scenarios:**
```typescript
describe('AppState Integration', () => {
  describe('New User Flow (macOS)', () => {
    it('transitions: loading -> onboarding -> ready', async () => {});
    it('handles terms decline', async () => {});
    it('handles email skip', async () => {});
  });

  describe('New User Flow (Windows)', () => {
    it('skips keychain phase on Windows', async () => {});
  });

  describe('Returning User Flow', () => {
    it('transitions: loading -> ready (no onboarding)', async () => {});
    it('no flicker during transition', async () => {});
  });

  describe('Error Recovery', () => {
    it('handles database init failure', async () => {});
    it('allows retry from error state', async () => {});
  });
});
```

**Acceptance Criteria:**
- [ ] Test coverage for all happy paths
- [ ] Test coverage for all error paths
- [ ] Tests for both platforms
- [ ] No flaky tests
- [ ] Tests run in CI

**Est. Tokens:** ~50K | **Cap:** 200K

---

### TASK-932: Platform-Specific Initialization Paths

**Goal:** Implement platform-specific logic in the state machine.

**Deliverables:**
- Platform detection in loading orchestrator
- macOS keychain flow
- Windows DPAPI flow

**Key Differences:**
| Phase | macOS | Windows |
|-------|-------|---------|
| Storage check | Check keychain | Check DPAPI |
| DB init | May show keychain prompt | Silent DPAPI access |
| Returning user | keychain-explanation screen | Skip to loading |

**Acceptance Criteria:**
- [ ] macOS shows keychain explanation for new users
- [ ] Windows auto-initializes without prompt
- [ ] Platform detected early in loading
- [ ] Platform info available in ready state

**Est. Tokens:** ~40K | **Cap:** 160K

---

### TASK-933: Feature Flag and Rollback Mechanism

**Goal:** Add ability to disable new state machine for rollback.

**Deliverables:**
- Feature flag check in AppStateProvider
- Fallback to existing hooks if disabled
- Documentation for rollback procedure

**Implementation:**
```typescript
const USE_NEW_STATE_MACHINE = localStorage.getItem('useNewStateMachine') !== 'false';

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // Feature flag check
  if (!USE_NEW_STATE_MACHINE) {
    // Return children without wrapping - existing hooks will work
    return <>{children}</>;
  }

  // New state machine implementation
  // ...
}
```

**Acceptance Criteria:**
- [ ] Feature flag respected at runtime
- [ ] Can toggle via localStorage
- [ ] Rollback procedure documented
- [ ] No runtime errors when disabled

**Est. Tokens:** ~25K | **Cap:** 100K

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Parallel hooks cause confusion | Low | Low | Clear documentation, distinct naming |
| Feature flag adds complexity | Low | Low | Remove in Phase 3 |
| Platform edge cases | Medium | Medium | Test on both platforms at each task |
| State machine design issues | Medium | High | Design review before coding (TASK-927) |
| Breaking existing functionality | Low | High | No modifications to existing code |

---

## Testing Strategy

### Per-Task Testing

| Task | Unit Tests | Integration Tests |
|------|------------|-------------------|
| TASK-927 | Type compilation | N/A |
| TASK-928 | Reducer tests | N/A |
| TASK-929 | Provider tests | N/A |
| TASK-930 | Mock API tests | Full flow tests |
| TASK-931 | N/A | Comprehensive suite |
| TASK-932 | Platform mocks | Platform-specific flows |
| TASK-933 | Flag behavior | Fallback behavior |

### CI Requirements

All PRs must pass:
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Build on macOS and Windows

### Manual Testing

Before merging to project branch:
- [ ] macOS: Full app startup with new state machine
- [ ] Windows: Full app startup with new state machine
- [ ] Feature flag: Disable and verify fallback works

---

## End-of-Sprint Validation

- [x] All 7 tasks merged to project/state-coordination
- [x] Integration tests pass for all flows (32 tests)
- [ ] Manual testing on macOS passes
- [ ] Manual testing on Windows passes
- [x] Feature flag rollback works (default false)
- [x] No changes to existing hooks
- [x] Documentation updated

---

## Sprint Metrics

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total Tokens | ~295K | ~260K |
| Tasks Completed | 7 | 7 |
| Blocked Tasks | 0 | 0 |
| PRs Created | 7 | 8 (1 additional fix PR) |

### Task Completion Summary

| Task | PR | Tokens | Status |
|------|-----|--------|--------|
| TASK-927 | #287 | ~25K | ✅ Merged |
| TASK-928 | #288 | ~35K | ✅ Merged |
| TASK-929 | #289 | ~45K | ✅ Merged |
| TASK-930 | #291, #292 | ~55K | ✅ Merged |
| TASK-931 | #294 | ~40K | ✅ Merged |
| TASK-932 | #293 | ~35K | ✅ Merged |
| TASK-933 | #290 | ~25K | ✅ Merged |

---

## SR Engineer Technical Review

**Review Date:** 2026-01-03
**Reviewer:** SR Engineer
**Status:** **APPROVED**
**Risk Level:** MEDIUM

### Review Summary

Sprint plan is well-structured with appropriate constraints and clear deliverables. The dependency graph is correctly ordered with opportunities for parallelism in later batches.

### Key Findings

| Area | Finding | Severity |
|------|---------|----------|
| OnboardingStep Types | Names don't match existing OnboardingFlow.tsx | Medium |
| API Method | `getStoredSession()` doesn't exist, use `getCurrentUser()` | High |
| Feature Flag Default | Default `true` is risky for Phase 1 | Low |
| Token Estimates | TASK-928, TASK-930 may be underestimated | Low |

### Recommendations Applied

1. **TASK-927**: Added notes about OnboardingStep naming alignment
2. **TASK-930**: Documented API method correction requirement
3. **TASK-933**: Recommended default `false` for Phase 1 safety
4. **All tasks**: Added branch information and execution classification

### Shared File Matrix

| File | Tasks | Conflict Risk |
|------|-------|---------------|
| `machine/index.ts` | 927, 928, 929, 930, 933 | High - sequential updates |
| `machine/types.ts` | 927 creates, all import | None - read after create |
| `LoadingOrchestrator.tsx` | 930 creates, 932 modifies | Medium - coordinate |

### Pre-Implementation Checklist

Before starting TASK-927:
- [ ] Create `project/state-coordination` branch from develop
- [ ] Verify OnboardingFlow.tsx step names for alignment
- [ ] Confirm `window.api.auth.getCurrentUser()` signature

### Approval

This sprint is **APPROVED** for implementation. Engineers should:
1. Follow the confirmed execution order (Batches 1-5)
2. Pay attention to SR Engineer notes in each task file
3. Coordinate on shared files in Batch 5

---

## Sprint Retrospective

### What Went Well

1. **Parallel execution** - Batch 4 (TASK-930 + TASK-933) and Batch 5 (TASK-931 + TASK-932) ran in parallel using isolated git worktrees, reducing overall sprint time
2. **Token efficiency** - Came in under estimate (~260K vs ~295K estimated)
3. **Clean architecture** - State machine implementation follows discriminated union pattern for type safety
4. **Test coverage** - 32 integration tests + 17 platform tests provide comprehensive coverage

### What Could Be Improved

1. **Merge conflicts** - PR #293 had conflicts after PR #292 merged; coordinate shared file edits better
2. **CI stability** - Initial CI run for TASK-931 hit heap OOM; infrastructure issue resolved on retry

### Technical Notes

- The `project/state-coordination` branch contains complete Phase 1 implementation
- Feature flag defaults to `false` for safe rollout
- Manual testing on both platforms still needed before Phase 2

---

## Changelog

- 2026-01-03: Sprint COMPLETE - all 7 tasks merged to project/state-coordination
- 2026-01-03: TASK-931, TASK-932 merged (PRs #294, #293)
- 2026-01-03: TASK-930, TASK-933 merged (PRs #291, #292, #290)
- 2026-01-03: TASK-929 merged (PR #289)
- 2026-01-03: TASK-928 merged (PR #288)
- 2026-01-03: TASK-927 merged (PR #287)
- 2026-01-03: SR Engineer technical review completed - APPROVED
- 2026-01-03: Sprint created (Phase 1 of BACKLOG-142)
