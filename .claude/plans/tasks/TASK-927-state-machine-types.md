# Task TASK-927: Design State Machine Types

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

Define comprehensive TypeScript types for the unified state machine that will replace fragmented hook-based state coordination. These types form the foundation for the entire state coordination overhaul (BACKLOG-142).

## Non-Goals

- Do NOT implement the reducer (TASK-928)
- Do NOT create React components or context (TASK-929)
- Do NOT implement any business logic
- Do NOT modify existing hooks or components

## Deliverables

1. New file: `src/appCore/state/machine/types.ts` - All state machine types
2. New file: `src/appCore/state/machine/index.ts` - Barrel export

## Acceptance Criteria

- [ ] All app states defined as discriminated union
- [ ] All actions defined with proper payload types
- [ ] Loading phases enumerated
- [ ] Onboarding steps match existing registry
- [ ] Context interface complete with derived selectors
- [ ] Types are re-exported from barrel
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Directory Structure

Create the `machine` directory:
```
src/appCore/state/
+-- machine/
    +-- types.ts
    +-- index.ts
```

### State Types

```typescript
// src/appCore/state/machine/types.ts

// ============================================
// LOADING PHASES
// ============================================

/**
 * Loading phases in initialization sequence.
 * MUST execute in this order.
 */
export type LoadingPhase =
  | 'checking-storage'    // Check if encryption key store exists
  | 'initializing-db'     // Initialize secure storage (may prompt on macOS)
  | 'loading-auth'        // Check authentication state
  | 'loading-user-data';  // Load phone type, email status, etc.

// ============================================
// ONBOARDING STEPS
// ============================================

/**
 * Onboarding steps - MUST match existing OnboardingFlow registry.
 * See: src/components/onboarding/OnboardingFlow.tsx
 */
export type OnboardingStep =
  | 'terms'               // Terms acceptance (shown as modal)
  | 'phone-type'          // Phone type selection screen
  | 'email'               // Email onboarding screen
  | 'apple-driver-setup'  // Windows + iPhone driver setup
  | 'android-coming-soon' // Android placeholder
  | 'permissions';        // macOS permissions

// ============================================
// PLATFORM INFO
// ============================================

export interface PlatformInfo {
  isMacOS: boolean;
  isWindows: boolean;
  /** True if user selected iPhone (affects driver setup on Windows) */
  hasIPhone: boolean;
}

// ============================================
// USER DATA
// ============================================

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface UserData {
  phoneType: 'iphone' | 'android' | null;
  hasCompletedEmailOnboarding: boolean;
  hasEmailConnected: boolean;
  needsDriverSetup: boolean;
  hasPermissions: boolean;
}

// ============================================
// ERRORS
// ============================================

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: unknown;
}

export type AppErrorCode =
  | 'STORAGE_CHECK_FAILED'
  | 'DB_INIT_FAILED'
  | 'AUTH_FAILED'
  | 'USER_DATA_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================
// APP STATES (Discriminated Union)
// ============================================

export type AppState =
  | LoadingState
  | UnauthenticatedState
  | OnboardingState
  | ReadyState
  | ErrorState;

export interface LoadingState {
  status: 'loading';
  phase: LoadingPhase;
  /** Optional progress 0-100 for long phases */
  progress?: number;
}

export interface UnauthenticatedState {
  status: 'unauthenticated';
}

export interface OnboardingState {
  status: 'onboarding';
  step: OnboardingStep;
  user: User;
  platform: PlatformInfo;
  /** Track which steps are complete */
  completedSteps: OnboardingStep[];
}

export interface ReadyState {
  status: 'ready';
  user: User;
  platform: PlatformInfo;
  userData: UserData;
}

export interface ErrorState {
  status: 'error';
  error: AppError;
  /** If true, user can retry/recover */
  recoverable: boolean;
  /** Previous state to return to on retry */
  previousState?: AppState;
}

// ============================================
// ACTIONS (Discriminated Union)
// ============================================

export type AppAction =
  | StorageCheckedAction
  | DbInitStartedAction
  | DbInitCompleteAction
  | AuthLoadedAction
  | UserDataLoadedAction
  | OnboardingStepCompleteAction
  | OnboardingSkipAction
  | AppReadyAction
  | LogoutAction
  | ErrorAction
  | RetryAction;

export interface StorageCheckedAction {
  type: 'STORAGE_CHECKED';
  hasKeyStore: boolean;
}

export interface DbInitStartedAction {
  type: 'DB_INIT_STARTED';
}

export interface DbInitCompleteAction {
  type: 'DB_INIT_COMPLETE';
  success: boolean;
  error?: string;
}

export interface AuthLoadedAction {
  type: 'AUTH_LOADED';
  user: User | null;
  isNewUser: boolean;
  platform: PlatformInfo;
}

export interface UserDataLoadedAction {
  type: 'USER_DATA_LOADED';
  data: UserData;
}

export interface OnboardingStepCompleteAction {
  type: 'ONBOARDING_STEP_COMPLETE';
  step: OnboardingStep;
}

export interface OnboardingSkipAction {
  type: 'ONBOARDING_SKIP';
  step: OnboardingStep;
}

export interface AppReadyAction {
  type: 'APP_READY';
}

export interface LogoutAction {
  type: 'LOGOUT';
}

export interface ErrorAction {
  type: 'ERROR';
  error: AppError;
  recoverable?: boolean;
}

export interface RetryAction {
  type: 'RETRY';
}

// ============================================
// CONTEXT VALUE
// ============================================

export interface AppStateContextValue {
  /** Current state */
  state: AppState;
  /** Dispatch action to update state */
  dispatch: React.Dispatch<AppAction>;

  // ============================================
  // DERIVED SELECTORS (for convenience)
  // ============================================

  /** True when status is 'loading' */
  isLoading: boolean;
  /** True when status is 'ready' */
  isReady: boolean;
  /** Current user or null */
  currentUser: User | null;
  /** Platform info or null (only available after auth loaded) */
  platform: PlatformInfo | null;
  /** Current loading phase or null */
  loadingPhase: LoadingPhase | null;
  /** Current onboarding step or null */
  onboardingStep: OnboardingStep | null;
  /** Current error or null */
  error: AppError | null;
}

// ============================================
// INITIAL STATE
// ============================================

export const INITIAL_APP_STATE: LoadingState = {
  status: 'loading',
  phase: 'checking-storage',
};
```

### Barrel Export

```typescript
// src/appCore/state/machine/index.ts

export * from './types';
```

### Important Details

- `OnboardingStep` types MUST match the existing step registry in `OnboardingFlow.tsx`
- `LoadingPhase` order is critical - phases execute sequentially
- All states use discriminated unions for type safety
- `INITIAL_APP_STATE` starts with `loading`/`checking-storage`

## Integration Notes

- Imports from: None (pure types)
- Exports to: TASK-928 (reducer), TASK-929 (context)
- Used by: All subsequent state machine tasks
- Depends on: None (first task)

## Do / Don't

### Do:

- Use discriminated unions for type safety
- Include JSDoc comments explaining each type
- Match existing naming conventions in the codebase
- Export everything from barrel

### Don't:

- Implement any logic
- Import from existing hooks
- Create React components
- Add any runtime code

## When to Stop and Ask

- If existing OnboardingFlow step names don't match proposed types
- If there's ambiguity about what states/actions are needed
- If you discover additional error codes needed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (types only, no logic)
- Verification: `npm run type-check` passes

### Coverage

- Coverage impact: N/A (no executable code)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking
- [ ] Lint / format checks

---

## SR Engineer Review Notes

**Review Date:** 2026-01-03 | **Status:** APPROVED with Recommendations

### Branch Information (SR Engineer decides)
- **Branch From:** project/state-coordination
- **Branch Name:** feature/TASK-927-state-machine-types
- **Branch Into:** project/state-coordination

### Execution Classification
- **Parallel Safe:** No (blocking foundation task)
- **Depends On:** None (first task)
- **Blocks:** TASK-928, TASK-929, TASK-930, TASK-931, TASK-932, TASK-933

### Shared File Analysis
- Files created: `types.ts`, `index.ts`
- Conflicts with: None (creates new directory)

### Technical Considerations

**CRITICAL: OnboardingStep Naming Alignment**

Before implementing, verify step names against `OnboardingFlow.tsx`:
- Existing uses: `phone-type`, `email-connect`, `apple-driver`, `android-coming-soon`, `permissions`, `secure-storage`
- Proposed uses: `phone-type`, `email`, `apple-driver-setup`, `android-coming-soon`, `permissions`

**Recommended changes:**
1. Use `email-connect` instead of `email` (matches existing)
2. Use `apple-driver` instead of `apple-driver-setup` (matches existing)
3. Add `secure-storage` step (maps to `keychain-explanation` route)
4. Clarify if `terms` is a step or modal (existing treats as modal in AppRouter)

**LoadingPhase Notes:**
- Current flow in `useSecureStorage.ts`: check keystore -> init DB -> complete login
- Ensure `loading-auth` phase aligns with `getCurrentUser()` not `getStoredSession()` (latter doesn't exist)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +10K |
| Code volume | ~200 lines | +15K |
| Complexity | Low (types only) | +5K |
| Test complexity | None | +0K |

**Confidence:** High

**Risk factors:**
- Type design may need iteration

**Similar past tasks:** TASK-905 (schema types) ~25K

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
- [ ] src/appCore/state/machine/types.ts
- [ ] src/appCore/state/machine/index.ts

Features implemented:
- [ ] LoadingPhase type
- [ ] OnboardingStep type
- [ ] AppState discriminated union
- [ ] AppAction discriminated union
- [ ] AppStateContextValue interface
- [ ] INITIAL_APP_STATE constant

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

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
**Test Coverage:** N/A (types only)

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/state-coordination
