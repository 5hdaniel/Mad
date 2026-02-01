# Task TASK-1512: Fix Deferred DB Init Never Triggers During Onboarding

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-556
**Status**: Ready for Implementation
**Execution**: Sequential (Critical - blocking fresh user testing)
**Priority**: P0 (Blocks ALL first-time macOS users on packaged app)

---

## Summary

First-time macOS users on the packaged DMG cannot complete onboarding. The deferred DB initialization (implemented in TASK-1506B) is never actually triggered during the secure-storage step, causing email connect to fail with "No user found in database".

**Goal**: Ensure the deferred DB initialization actually completes before advancing past the secure-storage step, and that the pending deep link user is synced to the local DB.

---

## Root Cause Analysis

### The Bug

The `SECURE_STORAGE_SETUP` action handling has a **race condition**:

1. In `OnboardingFlow.tsx:112-114`:
   ```typescript
   case "SECURE_STORAGE_SETUP":
     app.handleKeychainExplanationContinue(action.dontShowAgain);  // ASYNC - not awaited
     break;
   ```

2. In `useOnboardingFlow.ts:277-279`:
   ```typescript
   case "SECURE_STORAGE_SETUP":
     goToNext();  // SYNC - called immediately, doesn't wait for DB init
     break;
   ```

3. **Result**: `goToNext()` is called synchronously while `handleKeychainExplanationContinue()` (which triggers DB init) is still running. The flow advances to `email-connect` **before** the DB is initialized.

### Flow Breakdown (Current - Broken)

```
User on secure-storage step
    |
    v
Clicks "Continue" -> dispatches SECURE_STORAGE_SETUP action
    |
    +-- OnboardingFlow.handleAction() calls app.handleKeychainExplanationContinue() [ASYNC, NOT AWAITED]
    |       |
    |       v
    |   initializeSecureStorage() starts...
    |       |
    |       v
    |   Keychain prompt appears (or not, depending on timing)
    |
    +-- SIMULTANEOUSLY: useOnboardingFlow.handleAction() calls goToNext() [SYNC]
            |
            v
        User sees email-connect step
            |
            v
        User clicks "Connect with Google/Microsoft"
            |
            v
        ERROR: "No user found in database"
        (Because DB init is still in progress or completed without syncing user)
```

### Why the Pending User Never Gets Synced

1. Deep link auth stores pending user in `electron/main.ts:setPendingDeepLinkUser()`
2. The pending user is supposed to be synced in `system-handlers.ts:initializeSecureStorage()` via `getAndClearPendingDeepLinkUser()`
3. But `initializeSecureStorage()` is async and the flow advances before it completes
4. Even if it completes, the user in onboarding state is never updated with the synced user ID

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/onboarding/OnboardingFlow.tsx` | **MODIFY** | Await handleKeychainExplanationContinue, don't call goToNext until DB init succeeds |
| `src/components/onboarding/hooks/useOnboardingFlow.ts` | **MODIFY** | Make SECURE_STORAGE_SETUP handler async, wait for DB init |
| `src/components/onboarding/types/actions.ts` | **MODIFY** | Document that SECURE_STORAGE_SETUP should wait for DB init |
| `src/components/onboarding/steps/SecureStorageStep.tsx` | **MODIFY** | Add loading state for when DB init is in progress |

---

## Implementation Plan

### Recommended Approach: Option A - Handle in OnboardingFlow

Make the action handling async-aware so it waits for DB init before advancing.

### Step 1: Make SECURE_STORAGE_SETUP handling async in OnboardingFlow

**File:** `src/components/onboarding/OnboardingFlow.tsx`

The key insight is that `handleAction` callback is called by `useOnboardingFlow` hook BEFORE it handles navigation. We need to:
1. Make `handleKeychainExplanationContinue` call awaited
2. Only call `goToNext()` after DB init succeeds

**Current code (line 112-114):**
```typescript
case "SECURE_STORAGE_SETUP":
  app.handleKeychainExplanationContinue(action.dontShowAgain);
  break;
```

**Fixed code:**
```typescript
case "SECURE_STORAGE_SETUP":
  // Don't navigate here - navigation is handled specially for this action
  // to wait for async DB initialization
  app.handleKeychainExplanationContinue(action.dontShowAgain);
  break;
```

### Step 2: Make useOnboardingFlow SECURE_STORAGE_SETUP handler async

**File:** `src/components/onboarding/hooks/useOnboardingFlow.ts`

The `handleAction` function needs to be async-aware for SECURE_STORAGE_SETUP.

**Current code (line 277-279):**
```typescript
case "SECURE_STORAGE_SETUP":
  goToNext();
  break;
```

**Fixed code:**
```typescript
case "SECURE_STORAGE_SETUP":
  // Don't goToNext() here - it's handled by the async flow
  // The SecureStorageStep will trigger goToNext after successful DB init
  // via a new callback or state change
  break;
```

### Step 3: Update SecureStorageStep to handle async flow with loading state

**File:** `src/components/onboarding/steps/SecureStorageStep.tsx`

The step needs to:
1. Show loading state while DB init is in progress
2. Call `goToNext` only after successful init
3. Handle errors gracefully

**Changes:**
1. Accept `isLoading` prop to show spinner during DB init
2. Accept `onInitComplete` callback to advance after success
3. The parent (OnboardingFlow) will provide these based on DB init state

**Key insight:** We need to pass `isDatabaseInitialized` from the app state machine to the SecureStorageStep, and use an effect to advance when it becomes true after clicking Continue.

### Step 4: Wire up the async flow in OnboardingFlow

**File:** `src/components/onboarding/OnboardingFlow.tsx`

Add state tracking for when we're waiting for DB init to complete:

```typescript
// Track if we're waiting for DB init to complete after SECURE_STORAGE_SETUP
const [waitingForDbInit, setWaitingForDbInit] = useState(false);

// When DB becomes initialized while waiting, advance to next step
useEffect(() => {
  if (waitingForDbInit && appState.isDatabaseInitialized) {
    setWaitingForDbInit(false);
    flow.goToNext();
  }
}, [waitingForDbInit, appState.isDatabaseInitialized, flow]);

// In handleAction:
case "SECURE_STORAGE_SETUP":
  // If DB is already initialized (returning user), just advance
  if (appState.isDatabaseInitialized) {
    app.handleKeychainExplanationContinue(action.dontShowAgain);
    // Let useOnboardingFlow handle navigation
  } else {
    // First-time macOS user - need to wait for DB init
    setWaitingForDbInit(true);
    app.handleKeychainExplanationContinue(action.dontShowAgain);
    // Don't advance yet - the effect above will do it when DB is ready
  }
  break;
```

And update `useOnboardingFlow` to not auto-advance:

```typescript
case "SECURE_STORAGE_SETUP":
  // Navigation is handled by OnboardingFlow based on DB init state
  // Only advance if DB is already initialized (returning user scenario)
  if (context.isDatabaseInitialized) {
    goToNext();
  }
  // For first-time macOS users, OnboardingFlow handles the async wait
  break;
```

### Step 5: Pass isLoading to SecureStorageStep

**File:** `src/components/onboarding/OnboardingFlow.tsx`

The SecureStorageStep already accepts `isLoading` prop. We need to pass it based on `waitingForDbInit` state:

```typescript
<currentStep.Content
  key={currentStep.meta.id}
  context={context}
  onAction={handleStepAction}
  isLoading={currentStep.meta.id === 'secure-storage' && waitingForDbInit}
/>
```

---

## Detailed Code Changes

### File 1: `src/components/onboarding/OnboardingFlow.tsx`

```typescript
// Add import for useState and useEffect (already imported)

// Inside OnboardingFlow component, after useMemo for appState:

// Track if we're waiting for DB init to complete after clicking Continue on secure-storage
const [waitingForDbInit, setWaitingForDbInit] = useState(false);

// When DB becomes initialized while we're waiting, advance to next step
// This handles the async nature of macOS keychain initialization
useEffect(() => {
  if (waitingForDbInit && appState.isDatabaseInitialized) {
    setWaitingForDbInit(false);
    flow.goToNext();
  }
}, [waitingForDbInit, appState.isDatabaseInitialized, flow]);

// Update handleAction for SECURE_STORAGE_SETUP case:
case "SECURE_STORAGE_SETUP":
  if (!appState.isDatabaseInitialized) {
    // First-time macOS user - start DB init and wait for completion
    setWaitingForDbInit(true);
  }
  app.handleKeychainExplanationContinue(action.dontShowAgain);
  break;

// Update the render to pass isLoading for SecureStorageStep:
// Find where currentStep.Content is rendered and update:
{currentStep.meta.id === 'secure-storage' ? (
  <currentStep.Content
    key={currentStep.meta.id}
    context={context}
    onAction={handleStepAction}
    isLoading={waitingForDbInit}
  />
) : (
  <currentStep.Content
    key={currentStep.meta.id}
    context={context}
    onAction={handleStepAction}
  />
)}
```

### File 2: `src/components/onboarding/hooks/useOnboardingFlow.ts`

```typescript
// Update the SECURE_STORAGE_SETUP case in handleAction:
case "SECURE_STORAGE_SETUP":
  // For first-time macOS users, navigation is handled by OnboardingFlow
  // which waits for DB init to complete before calling goToNext()
  // Only advance immediately if DB is already initialized
  if (context.isDatabaseInitialized) {
    goToNext();
  }
  // Otherwise, OnboardingFlow's effect will handle navigation
  break;
```

### File 3: `src/components/onboarding/steps/SecureStorageStep.tsx`

No changes needed - it already handles `isLoading` prop correctly.

---

## Verification Steps

### Manual Testing (CRITICAL)

1. **Fresh macOS DMG install:**
   ```bash
   # Clean slate
   rm -rf ~/Library/Application\ Support/magic-audit
   # Remove keychain entry
   security delete-generic-password -s "magic-audit Safe Storage" 2>/dev/null || true

   # Open DMG
   open dist/MagicAudit-*.dmg
   ```

2. **Verify Login screen appears WITHOUT Keychain prompt** (TASK-1506B fix)

3. **Complete OAuth login via browser**

4. **Verify phone-type step appears**

5. **Complete phone-type step**

6. **Verify secure-storage step appears**

7. **Click "Continue":**
   - [ ] Loading spinner appears
   - [ ] Keychain prompt appears (system dialog)
   - [ ] Enter Mac password
   - [ ] Loading spinner disappears
   - [ ] Flow advances to email-connect

8. **Verify email-connect step works:**
   - [ ] Click "Connect with Google" or "Connect with Microsoft"
   - [ ] NO ERROR: "No user found in database"
   - [ ] OAuth flow starts in browser

9. **Complete email connection and verify rest of onboarding**

### Unit Tests

- [ ] Test that SECURE_STORAGE_SETUP with `isDatabaseInitialized=false` does NOT call goToNext immediately
- [ ] Test that SECURE_STORAGE_SETUP with `isDatabaseInitialized=true` calls goToNext immediately
- [ ] Test that waitingForDbInit effect advances flow when isDatabaseInitialized becomes true

---

## Acceptance Criteria

- [ ] First-time macOS users see loading state after clicking Continue on secure-storage
- [ ] Keychain prompt appears during the loading state
- [ ] Flow advances to email-connect only AFTER DB init completes
- [ ] Pending deep link user is synced to local DB before email-connect
- [ ] Email connect step works without "No user found" error
- [ ] Returning macOS users (with key store) experience no change
- [ ] Windows users experience no change
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Existing tests pass

---

## Do / Don't

### Do:
- Wait for async DB initialization before advancing
- Show loading state while waiting
- Preserve the existing flow for returning users
- Handle errors gracefully

### Don't:
- Don't break the Windows flow (DPAPI is silent)
- Don't break the returning macOS user flow
- Don't change the step order
- Don't block indefinitely - have timeout/error handling

---

## Risk Assessment

**Risk Level:** Medium

**Risks:**
1. Infinite wait if DB init fails silently
2. Race condition if user clicks Continue multiple times
3. State inconsistency if component unmounts during wait

**Mitigations:**
1. Add timeout with error handling
2. Disable Continue button while loading
3. Clean up state in effect cleanup

---

## Related Items

- **TASK-1506B**: Original implementation of deferred DB init (partially working)
- **BACKLOG-556**: This bug report
- **BACKLOG-554**: Device registration testing (depends on this fix)
- **BACKLOG-555**: Offline grace period testing (depends on this fix)

---

## Branch Information

**Branch From**: `develop` or current integration branch
**Branch Into**: `develop`
**Branch Name**: `fix/task-1512-deferred-db-init`

---

## Estimated Effort

**Est. Tokens**: ~15K
**Token Cap**: ~60K (4x estimate)
**Est. Time**: 1-2 hours

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Investigation | SR Engineer | ___________ | ___K | COMPLETE (this session) |
| 2. Plan | SR Engineer | ___________ | ___K | COMPLETE (this session) |
| 3. Implement | Engineer | ___________ | ___K | Pending |
| 4. SR Review | SR Engineer | ___________ | ___K | Pending |
| 5. PM Update | PM | ___________ | ___K | Pending |

---

## Notes

This is a race condition bug that slipped through because TASK-1506B was tested in dev mode where the timing is different. The packaged DMG exposed the issue because:
1. The app starts faster in production mode
2. There's no hot-reload delays
3. The async operations have different timing characteristics

The fix is straightforward once the race condition is understood: don't advance the flow until the async operation completes.
