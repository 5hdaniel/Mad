# BACKLOG-142: State Coordination Layer Overhaul

**Priority:** Critical
**Category:** refactor / architecture
**Status:** Complete
**Created:** 2026-01-03
**Completed:** 2026-01-04
**Sprints:** SPRINT-020 (Phase 1), SPRINT-021 (Phase 2), SPRINT-022 (Phase 3)

---

## Executive Summary

Replace the fragmented hook-based state coordination with a unified state machine architecture. This addresses recurring race condition bugs in the auth/onboarding flow that have been fixed 4+ times but keep returning.

### Why Now

The current state coordination has fundamental architectural problems:
- State distributed across 5+ independent hooks with no coordinator
- Each hook loads data independently with inconsistent defaults
- `useNavigationFlow` at 360 lines tries to coordinate everything via effects
- Race conditions occur when hooks load at different speeds
- Bugs like "Database not initialized" have been fixed 4+ times

### Business Impact

| Issue | Impact |
|-------|--------|
| Onboarding flicker | Poor UX for returning users |
| "Database not initialized" error | App crash requiring restart |
| Navigation infinite loops | User must force-quit app |
| React hooks order violations | Unpredictable behavior |

---

## Root Cause Analysis

### Current Architecture Problems

```
Current State (Fragmented):

useAppStateMachine (orchestrator - 422 lines)
    |
    +-- useSecureStorage (70 lines) - defaults: isCheckingSecureStorage=true, isDatabaseInitialized=false
    +-- usePhoneTypeApi (146 lines) - defaults: hasSelectedPhoneType=false, isLoadingPhoneType=true
    +-- useEmailOnboardingApi (107 lines) - defaults: hasCompletedEmailOnboarding=true (to avoid flicker!)
    +-- useAuthFlow (196 lines) - manages pendingOAuthData, pendingOnboardingData
    +-- useNavigationFlow (360 lines) - tries to coordinate via complex effects
    +-- useModalFlow, usePermissionsFlow, etc.

Problems:
1. Each hook has its own loading state and defaults (inconsistent)
2. No single source of truth for "app is ready"
3. useNavigationFlow effect has 15+ dependencies, runs on every change
4. Guards rely on multiple conditions that race against each other
5. Defaults chosen to "avoid flicker" mask real initialization issues
```

### Specific Race Conditions

| Race | Hooks Involved | Result |
|------|----------------|--------|
| Auth loads before DB | useSecureStorage, useAuthFlow | "Database not initialized" |
| Phone type loads false then true | usePhoneTypeApi, useNavigationFlow | Onboarding flicker |
| Email status loads async | useEmailOnboardingApi | Wrong screen shown |
| Multiple effects trigger | All | Navigation loops |

### Previous Fixes (All Partial)

| Sprint | Fix | Why It Wasn't Enough |
|--------|-----|---------------------|
| SPRINT-001 | Refactored UI | Explicitly kept state machine untouched |
| SPRINT-013 | Split useAppStateMachine | Didn't redesign coordination |
| SPRINT-019 | Database init gate | Added more guards, not unified |
| BACKLOG-141 | Default flip | Masks problem, doesn't solve |

---

## Proposed Solution: Unified App State Machine

### Target Architecture

```
Target State (Unified):

AppStateProvider (single context)
    |
    +-- Finite State Machine
        |
        +-- States: loading | initializing | authenticating | onboarding | ready | error
        +-- Transitions: defined, predictable, testable
        +-- Single source of truth for "what should render"
```

### Key Design Principles

1. **Single Loading Phase**: No component renders until ALL initialization complete
2. **Finite States**: App can only be in one state at a time
3. **Explicit Transitions**: State changes only via defined actions
4. **Predictable Order**: Database THEN auth THEN user data
5. **Platform Awareness**: macOS vs Windows paths built into state machine

### State Machine States

```typescript
type AppState =
  | { status: 'loading'; phase: 'checking-storage' | 'initializing-db' | 'loading-auth' | 'loading-user-data' }
  | { status: 'unauthenticated' }
  | { status: 'onboarding'; step: 'terms' | 'phone-type' | 'email' | 'drivers' | 'permissions' }
  | { status: 'ready'; user: User; platform: Platform }
  | { status: 'error'; error: AppError };

type AppAction =
  | { type: 'STORAGE_CHECKED'; hasKeyStore: boolean }
  | { type: 'DB_INITIALIZED'; success: boolean }
  | { type: 'AUTH_LOADED'; user: User | null }
  | { type: 'USER_DATA_LOADED'; phoneType: PhoneType; emailStatus: EmailStatus }
  | { type: 'ONBOARDING_STEP_COMPLETE'; step: OnboardingStep }
  | { type: 'LOGOUT' }
  | { type: 'ERROR'; error: AppError };
```

---

## Implementation Phases

### Phase 1: Foundation (SPRINT-020)

**Goal**: Create the state machine foundation without breaking existing functionality.

| Task | Description | Risk |
|------|-------------|------|
| Design state machine | Define states, transitions, types | Low |
| Create AppStateContext | New context provider alongside existing | Low |
| Implement core reducer | State transitions for loading -> ready | Medium |
| Add loading orchestrator | Coordinate initialization sequence | Medium |
| Integration tests | Verify state transitions | Low |

**Branch Strategy**: `project/state-coordination` branching from develop

### Phase 2: Migration (SPRINT-021)

**Goal**: Migrate existing hooks to use new state machine.

| Task | Description | Risk |
|------|-------------|------|
| Migrate useSecureStorage | Use state machine for DB init | Medium |
| Migrate usePhoneTypeApi | User data from state machine | Medium |
| Migrate useEmailOnboardingApi | User data from state machine | Medium |
| Update useNavigationFlow | Replace effects with state derivation | High |
| Update components | Use new context | Medium |

**Branch Strategy**: Continue on `project/state-coordination`

### Phase 3: Cleanup (SPRINT-022)

**Goal**: Remove legacy code, finalize architecture.

| Task | Description | Risk |
|------|-------------|------|
| Remove legacy hooks | Delete deprecated code | Low |
| Remove workaround guards | Clean up "belt-and-suspenders" checks | Low |
| Documentation | Update architecture docs | Low |
| Performance optimization | Memoization, selective re-renders | Low |
| End-to-end validation | Full platform testing | Medium |

**Branch Strategy**: Merge `project/state-coordination` to develop

---

## Risk Assessment

### High Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| Auth flow regression | **High** | Phase 1 runs parallel (no removal) |
| Windows platform | **Medium** | Test on Windows at each phase |
| Returning user flow | **High** | Integration tests for returning users |
| New user onboarding | **Medium** | Integration tests for new users |

### Risk Mitigation Strategy

1. **Parallel implementation**: Phase 1 adds new code, doesn't modify old
2. **Feature flag**: Can disable new state machine via localStorage
3. **Integration branch**: All work on `project/state-coordination`
4. **Platform testing**: Required at each phase for macOS and Windows
5. **Rollback plan**: Revert project branch if issues found

---

## Testing Strategy

### Unit Tests

- State machine reducer (all transitions)
- AppStateContext provider
- Loading orchestrator
- Migration adapters

### Integration Tests

| Scenario | States Covered |
|----------|----------------|
| New user signup (macOS) | loading -> onboarding -> ready |
| New user signup (Windows) | loading -> onboarding -> ready |
| Returning user login (macOS) | loading -> ready |
| Returning user login (Windows) | loading -> ready |
| OAuth error recovery | loading -> error -> unauthenticated |
| Database init failure | loading -> error |
| Terms decline | onboarding -> unauthenticated |

### Manual Testing Checklist

- [ ] macOS new user full flow
- [ ] macOS returning user (fast login)
- [ ] Windows new user full flow
- [ ] Windows returning user (fast login)
- [ ] No onboarding flicker for returning users
- [ ] No "Database not initialized" error
- [ ] No navigation loops
- [ ] Quick action during startup (stress test)

---

## Acceptance Criteria (Overall)

- [ ] Single source of truth for app state
- [ ] No race conditions in auth/onboarding flow
- [ ] "Database not initialized" error eliminated
- [ ] Onboarding flicker eliminated for returning users
- [ ] Navigation loops eliminated
- [ ] Works on both macOS and Windows
- [ ] Existing onboarding step registry preserved
- [ ] Test coverage for state transitions
- [ ] No regression in startup time

---

## Estimated Effort

| Phase | Est. Tokens | Complexity | Duration |
|-------|-------------|------------|----------|
| Phase 1 (Foundation) | ~300K | Medium | 1 sprint |
| Phase 2 (Migration) | ~400K | High | 1 sprint |
| Phase 3 (Cleanup) | ~150K | Low | 0.5 sprint |
| **Total** | **~850K** | - | **2.5 sprints** |

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| BACKLOG-139 (DB gate) | Completed | Done - provides foundation |
| BACKLOG-141 (flicker fix) | Can skip | Will be superseded |
| BACKLOG-107 (hook split) | Completed | Done - easier migration |

---

## Related Items

- BACKLOG-139: Comprehensive Database Initialization Guard (completed - provides gate)
- BACKLOG-141: Fix Onboarding Flicker (superseded by this)
- BACKLOG-107: Split useAppStateMachine (completed - enables this)
- BACKLOG-111: Migrate Components to Service Abstractions (parallel effort)

---

## Phase Completion Status

### Phase 1: Foundation (SPRINT-020) - COMPLETE

- State machine types and reducer implemented
- AppStateContext and LoadingOrchestrator created
- 49 tests (32 integration + 17 platform)
- Feature flag defaults to false for safe rollout
- PRs #287-294 merged

### Phase 2: Migration (SPRINT-021) - COMPLETE

- All hooks migrated to state machine
- useSecureStorage, usePhoneTypeApi, useEmailOnboardingApi, useNavigationFlow updated
- State derivation from machine for all components
- Feature flag enabled by default
- PRs #296-309 merged

### Phase 3: Cleanup (SPRINT-022) - COMPLETE

- State machine wired into main.tsx (TASK-957, PR #310)
- Returning user flicker fixed (TASK-950)
- Legacy code paths removed (TASK-952)
- Architecture documentation created
- BACKLOG-142 marked complete

**Architecture Documentation:** `.claude/docs/shared/state-machine-architecture.md`

---

## Changelog

- 2026-01-03: Created BACKLOG-142 for state coordination overhaul
- 2026-01-03: Phase 1 complete (SPRINT-020)
- 2026-01-03: Phase 2 complete (SPRINT-021)
- 2026-01-04: Phase 3 complete (SPRINT-022) - BACKLOG-142 COMPLETE
