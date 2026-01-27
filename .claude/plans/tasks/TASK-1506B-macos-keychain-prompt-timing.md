# Task TASK-1506B: macOS Keychain Prompt Timing Fix

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-480 (extension)
**Status**: Ready for Implementation
**Execution**: Sequential (Phase 3, after TASK-1506)

---

## Summary

Fix the first-time macOS user flow so they see the Login screen BEFORE any Keychain prompt appears. Currently, when a new user starts the app on macOS, they immediately get a system Keychain prompt before even seeing the login screen. This is confusing because they don't understand what app is asking for their password.

**Goal**: Defer DB initialization (which triggers Keychain prompt) until AFTER the user:
1. Sees the Login screen
2. Successfully authenticates
3. Reaches the "Secure Storage" onboarding step which explains what's happening

---

## Mandatory Workflow (6 Steps)

**DO NOT SKIP ANY STEP. Each agent step requires recording the Agent ID.**

```
Step 1: PLAN        -> Plan Agent creates implementation plan
                       Record: Plan Agent ID

Step 2: SR REVIEW   -> SR Engineer reviews and approves plan
                       Record: SR Engineer Agent ID

Step 3: USER REVIEW -> User reviews and approves plan
                       GATE: Wait for user approval

Step 4: COMPACT     -> Context reset before implementation
                       /compact or new session

Step 5: IMPLEMENT   -> Engineer implements approved plan
                       Record: Engineer Agent ID

Step 6: PM UPDATE   -> PM updates sprint/backlog/metrics
```

**Reference:** `.claude/docs/ENGINEER-WORKFLOW.md`

---

## Branch Information

**Branch From**: `feature/task-1507-license-at-auth` (current working branch)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1506b-keychain-timing`

---

## Goal

Ensure first-time macOS users see the Login screen before any system Keychain dialog appears.

## Non-Goals

- Do NOT change the Windows flow (DPAPI is silent, no user interaction needed)
- Do NOT remove the Keychain prompt (it's required for security)
- Do NOT change the existing onboarding step order (phone-type -> secure-storage -> etc.)

---

## Estimated Tokens

**Est. Tokens**: ~20K
**Token Cap**: ~80K (4x estimate)

---

## Problem Analysis

### Current Flow (BROKEN on macOS for new users)

```
App starts
    |
    v
LoadingOrchestrator: Phase 1 "checking-storage"
    |
    v
LoadingOrchestrator: Phase 2 "initializing-db"
    |
    v
[KEYCHAIN PROMPT APPEARS HERE - User sees password dialog!]
    |
    v
LoadingOrchestrator: Phase 3 "loading-auth"
    |
    v
No user found -> Show Login screen
    |
    v
User logs in -> Onboarding starts
    |
    v
Onboarding Step 1: "phone-type"
    |
    v
Onboarding Step 2: "secure-storage" (too late - already prompted!)
```

### Desired Flow (FIXED)

```
App starts
    |
    v
LoadingOrchestrator: Phase 1 "checking-storage"
    |
    +-- hasKeyStore: true (returning user) --> Phase 2 "initializing-db" (normal flow)
    |
    +-- hasKeyStore: false (new user on macOS) --> Skip DB init for now
                                                  |
                                                  v
                                          Phase 3 "loading-auth" (will fail gracefully)
                                                  |
                                                  v
                                          No user found -> Show Login screen
                                                  |
                                                  v
                                          User logs in successfully
                                                  |
                                                  v
                                          Onboarding Step 1: "phone-type"
                                                  |
                                                  v
                                          Onboarding Step 2: "secure-storage"
                                          [KEYCHAIN PROMPT APPEARS HERE - Expected!]
                                          (User clicks Continue, we init DB)
                                                  |
                                                  v
                                          Continue with remaining onboarding
```

---

## Implementation Plan

### Step 1: Add `isFirstTimeMacOS` flag to state machine

**File:** `src/appCore/state/machine/types.ts`

Add a new loading phase and modify STORAGE_CHECKED action:

```typescript
// Add to LoadingPhase type:
export type LoadingPhase =
  | "checking-storage"
  | "awaiting-keychain"    // <- Already exists in types but not used
  | "initializing-db"
  | "loading-auth"
  | "loading-user-data";

// Modify StorageCheckedAction to include macOS flag:
export interface StorageCheckedAction {
  type: "STORAGE_CHECKED";
  hasKeyStore: boolean;
  isMacOS?: boolean;      // <- Already exists, ensure it's used
  isFirstTimeUser?: boolean;  // <- NEW: True when no key store on macOS
}
```

### Step 2: Modify reducer to skip DB init for first-time macOS users

**File:** `src/appCore/state/machine/reducer.ts`

Update the STORAGE_CHECKED case to defer DB initialization:

```typescript
case "STORAGE_CHECKED": {
  if (state.status !== "loading" || state.phase !== "checking-storage") {
    return state;
  }

  const isFirstTimeMacOS = !action.hasKeyStore && action.isMacOS;

  if (isFirstTimeMacOS) {
    // NEW: Skip DB init for first-time macOS users
    // DB will be initialized during onboarding secure-storage step
    return {
      status: "loading",
      phase: "loading-auth",  // Skip directly to auth check
      deferredDbInit: true,   // Flag to remember we need to init DB later
    };
  }

  // Existing flow for returning users or Windows
  return {
    status: "loading",
    phase: "initializing-db",
  };
}
```

### Step 3: Update LoadingOrchestrator to pass macOS flag

**File:** `src/appCore/state/machine/LoadingOrchestrator.tsx`

Ensure the STORAGE_CHECKED dispatch includes the isMacOS flag:

```typescript
// In Phase 1: Check storage useEffect
window.api.system
  .hasEncryptionKeyStore()
  .then((result) => {
    if (cancelled) return;
    const platform = platformRef.current;
    dispatch({
      type: "STORAGE_CHECKED",
      hasKeyStore: result.hasKeyStore,
      isMacOS: platform.isMacOS,  // Pass platform info
    });
  })
```

### Step 4: Handle auth loading without initialized DB

**File:** `src/appCore/state/machine/LoadingOrchestrator.tsx`

The `loading-auth` phase needs to handle the case where DB isn't initialized yet:

```typescript
// In Phase 3: Load auth state useEffect
// If we're in loading-auth but DB isn't initialized (first-time macOS),
// we can still check Supabase session (cloud-only, no local DB needed)
// If no session, show login screen. After login + onboarding secure-storage,
// DB will be initialized.
```

### Step 5: Trigger DB init from SecureStorageStep

**File:** `src/appCore/state/flows/useSecureStorage.ts`

Update `initializeSecureStorage` to actually trigger DB initialization:

```typescript
const initializeSecureStorage = async (dontShowAgain: boolean): Promise<boolean> => {
  if (dontShowAgain) {
    localStorage.setItem("skipKeychainExplanation", "true");
  }

  // NEW: Actually trigger DB initialization here for first-time macOS users
  try {
    const result = await window.api.system.initializeSecureStorage();
    if (result.success) {
      // Dispatch action to update state machine
      dispatch({ type: "DB_INIT_COMPLETE", success: true });
      return true;
    } else {
      dispatch({
        type: "DB_INIT_COMPLETE",
        success: false,
        error: result.error || "Failed to initialize secure storage",
      });
      return false;
    }
  } catch (error) {
    dispatch({
      type: "DB_INIT_COMPLETE",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
};
```

### Step 6: Update SecureStorageStep messaging

**File:** `src/components/onboarding/steps/SecureStorageStep.tsx`

Update the messaging to be clearer about what's happening:

```typescript
const bodyText = context.isNewUser
  ? "Magic Audit needs to set up secure storage on your Mac to protect your data. " +
    "When you click Continue, you'll see a system dialog asking for your Mac password. " +
    "This is a one-time setup that keeps your contacts and messages encrypted."
  : "Magic Audit needs to access your Mac's Keychain to decrypt your local database. " +
    "This keeps your contacts and messages secure.";
```

Add a new "What to expect" section:

```typescript
{/* What to expect - only for new users */}
{context.isNewUser && (
  <div className="mb-4 bg-amber-50 rounded-xl p-3 text-left">
    <p className="text-sm text-amber-700">
      <strong>What to expect:</strong> A system dialog will appear asking for your
      Mac login password. This is macOS protecting your data - not Magic Audit.
    </p>
  </div>
)}
```

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/appCore/state/machine/types.ts` | Modify | Add `isFirstTimeUser` to StorageCheckedAction, add `deferredDbInit` to LoadingState |
| `src/appCore/state/machine/reducer.ts` | Modify | Handle first-time macOS users by skipping DB init |
| `src/appCore/state/machine/LoadingOrchestrator.tsx` | Modify | Pass isMacOS flag, handle deferred DB init case |
| `src/appCore/state/flows/useSecureStorage.ts` | Modify | Actually trigger DB init when called |
| `src/components/onboarding/steps/SecureStorageStep.tsx` | Modify | Update messaging to explain Keychain prompt |

---

## Testing Requirements

### Manual Testing

1. **New macOS user flow:**
   - Delete any existing Magic Audit keychain entries
   - Start app fresh
   - Verify: Login screen appears with NO Keychain prompt
   - Log in with valid credentials
   - Verify: Phone type selection appears
   - Complete phone type selection
   - Verify: Secure Storage step appears with clear messaging
   - Click Continue
   - Verify: NOW Keychain prompt appears
   - Enter password
   - Verify: Remaining onboarding continues normally

2. **Returning macOS user flow:**
   - User with existing keychain entry starts app
   - Verify: Normal flow (keychain prompt may appear during loading, this is OK)
   - Verify: User goes directly to app (or login if session expired)

3. **Windows flow (no change expected):**
   - Verify: Windows users see no change in behavior
   - Verify: App initializes silently via DPAPI

### Unit Tests

- [ ] Test reducer handles `STORAGE_CHECKED` with `isFirstTimeMacOS=true`
- [ ] Test reducer handles `STORAGE_CHECKED` with `isFirstTimeMacOS=false`
- [ ] Test `initializeSecureStorage` triggers IPC call

---

## Acceptance Criteria

- [ ] First-time macOS users see Login screen before any Keychain prompt
- [ ] Keychain prompt appears during Secure Storage onboarding step
- [ ] Secure Storage step messaging clearly explains the Keychain prompt
- [ ] Returning macOS users experience no change
- [ ] Windows users experience no change
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Existing tests pass

---

## Do / Don't

### Do:
- Explain clearly what the Keychain prompt is for
- Handle errors gracefully if DB init fails
- Maintain backward compatibility with existing flows

### Don't:
- Don't remove the Keychain requirement (security needed)
- Don't change Windows behavior (DPAPI is already silent)
- Don't break existing returning user flows

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Unclear how to detect "first-time macOS user" vs "returning macOS user"
- Auth flow requires DB to be initialized (would break this approach)
- Supabase session check requires local storage access
- Unsure how to pass dispatch from LoadingOrchestrator to SecureStorageStep

---

## PR Preparation

**Title**: `fix(macos): defer keychain prompt until secure storage onboarding step`

**Labels**: `sprint-062`, `macos`, `ux-fix`

**PR Body Template**:
```markdown
## Summary
- Defer macOS Keychain prompt until the Secure Storage onboarding step
- First-time macOS users now see Login screen before any system dialog
- Updated SecureStorageStep messaging to explain what the Keychain prompt is

## Problem
First-time macOS users were seeing a Keychain password prompt before even seeing
the login screen. This was confusing because they didn't know what app was asking
for their password.

## Solution
Skip DB initialization for first-time macOS users (detected via `hasKeyStore=false`).
The DB is initialized later during the Secure Storage onboarding step, where the
user is properly informed about what's happening.

## Test Plan
- [ ] New macOS user: Login screen appears with NO Keychain prompt
- [ ] New macOS user: Keychain prompt appears at Secure Storage step
- [ ] Returning macOS user: Normal flow (no change)
- [ ] Windows user: Normal flow (no change)
- [ ] All existing tests pass
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | PM | (this session) | ~3K | COMPLETE |
| 2. SR Review | SR Engineer | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | **APPROVED** |
| 4. Compact | (Context reset) | N/A | N/A | Pending |
| 5. Implement | Engineer | ___________ | ___K | Pending |
| 6. PM Update | PM | ___________ | ___K | Pending |

### Step 3: User Review

- [x] User reviewed plan
- [x] User approved plan
- Date: 2026-01-26

---

## Implementation Summary

### Files Changed
- [x] `src/appCore/state/machine/types.ts` - Added `deferredDbInit` flag to LoadingState, UnauthenticatedState, and OnboardingState
- [x] `src/appCore/state/machine/reducer.ts` - Modified STORAGE_CHECKED, AUTH_LOADED, LOGIN_SUCCESS, DB_INIT_STARTED, DB_INIT_COMPLETE to handle deferred DB init flow
- [x] `src/appCore/state/machine/LoadingOrchestrator.tsx` - Pass `isMacOS` flag in STORAGE_CHECKED action
- [x] `src/appCore/state/machine/selectors/databaseSelectors.ts` - Added `selectIsDeferredDbInit` selector, updated `selectIsDatabaseInitialized` to account for deferred init
- [x] `src/appCore/state/flows/useSecureStorage.ts` - Updated `initializeSecureStorage` to actually trigger DB init for first-time macOS users
- [x] `src/components/onboarding/steps/SecureStorageStep.tsx` - Updated messaging with "What to expect" box for new users
- [x] `src/appCore/state/machine/reducer.test.ts` - Added tests for deferred DB init flow
- [x] `src/appCore/state/machine/selectors/databaseSelectors.test.ts` - Added tests for `selectIsDeferredDbInit` and deferredDbInit cases

### Approach Taken
1. Added `deferredDbInit` flag to track when DB initialization is deferred for first-time macOS users
2. Modified STORAGE_CHECKED reducer to skip to `loading-auth` phase with `deferredDbInit: true` when `!hasKeyStore && isMacOS`
3. Preserved `deferredDbInit` flag through state transitions: loading -> unauthenticated -> onboarding
4. Updated `selectIsDatabaseInitialized` to return `false` when `deferredDbInit` is true
5. Modified `initializeSecureStorage` in useSecureStorage hook to actually trigger DB init when `deferredDbInit` is true
6. Added handler for DB_INIT_COMPLETE during onboarding state to clear `deferredDbInit` flag after successful init
7. Updated SecureStorageStep UI with amber info box explaining what to expect for new users

### Testing Done
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (pre-existing error in NotificationContext.tsx unrelated to changes)
- [x] All 597 state machine tests pass
- [x] New tests added for STORAGE_CHECKED with isMacOS flag
- [x] New tests added for deferredDbInit preservation through AUTH_LOADED and LOGIN_SUCCESS
- [x] New tests added for DB_INIT_COMPLETE during onboarding
- [x] New tests added for selectIsDeferredDbInit selector

### Notes for SR Review
- The `deferredDbInit` flag is preserved through three state transitions: loading -> unauthenticated -> onboarding
- The SecureStorageStep's `shouldShow` already checks `!context.isDatabaseInitialized`, so it will naturally show for users with deferred DB init
- When user clicks Continue on SecureStorageStep, `handleKeychainExplanationContinue` calls `initializeSecureStorage` which now triggers actual DB init
- The DB_INIT_COMPLETE action is now handled during onboarding state to clear the `deferredDbInit` flag
- Windows flow is unchanged - DPAPI initialization happens silently during loading phase
