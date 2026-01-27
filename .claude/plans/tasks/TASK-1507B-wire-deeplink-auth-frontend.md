# Task TASK-1507B: Wire Deep Link Auth Success to Frontend

**Sprint**: SPRINT-062
**Backlog Item**: N/A (bug fix discovered during TASK-1508 testing)
**Status**: Pending
**Execution**: Sequential (Phase 3, after TASK-1507)
**Priority**: P0 (blocks all testing)

---

## Problem Statement

After successful deep link OAuth authentication, the app stays on the login screen. The backend sends `auth:deep-link-callback` event successfully, but the frontend does not transition to dashboard/onboarding.

**Error Behavior:** User completes OAuth in browser, app receives tokens, logs show success, but UI remains on login screen.

**Evidence from logs:**
```
[DeepLink] Auth complete, sending success event for user: d5283d52-...
[Login] Deep link auth success: d5283d52-...  // Received but nothing happens
```

---

## Root Cause Analysis

**Problem:** `Login.tsx` has the `onDeepLinkAuthSuccess` prop that handles the event, but `AppRouter.tsx` never passes this prop to `<Login>`.

**File 1:** `src/components/Login.tsx` (lines 68-69, 100-109)
```typescript
// Login.tsx has the prop defined:
interface LoginProps {
  // ...
  onDeepLinkAuthSuccess?: (data: DeepLinkAuthData) => void;
}

// And the handler:
const handleDeepLinkSuccess = useCallback((data: DeepLinkAuthData) => {
  console.log("[Login] Deep link auth success:", data.userId);
  // ...
  if (onDeepLinkAuthSuccess) {
    onDeepLinkAuthSuccess(data);  // <-- This never fires because prop is undefined!
  }
}, [onDeepLinkAuthSuccess]);
```

**File 2:** `src/appCore/AppRouter.tsx` (lines 76-81)
```typescript
// AppRouter.tsx does NOT pass the handler:
return (
  <Login
    onLoginSuccess={handleLoginSuccess}
    onLoginPending={handleLoginPending}
    // MISSING: onDeepLinkAuthSuccess={handleDeepLinkAuthSuccess}
  />
);
```

**The handler exists in `Login.tsx` but is never connected because:**
1. `AppRouter.tsx` doesn't pass the `onDeepLinkAuthSuccess` prop
2. The `useAuthFlow.ts` or state machine doesn't have a `handleDeepLinkAuthSuccess` handler
3. No equivalent handler exists in the `AppStateMachine` types

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1508A merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `fix/task-1507b-wire-deeplink-auth`

---

## Estimated Tokens

**Est. Tokens**: ~20K (service)
**Token Cap**: ~80K (4x estimate)

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/appCore/state/flows/useAuthFlow.ts` | Modify | Add `handleDeepLinkAuthSuccess` handler |
| `src/appCore/state/types.ts` | Modify | Add handler type to `AppStateMachine` interface |
| `src/appCore/state/returnHelpers.ts` | Modify | Include handler in return object |
| `src/appCore/AppRouter.tsx` | Modify | Pass handler to `<Login>` component |

---

## Implementation Steps

### Step 1: Add Type Definition

**File:** `src/appCore/state/types.ts`

Add to `AppStateMachine` interface:
```typescript
// Deep link auth handler (TASK-1507B)
handleDeepLinkAuthSuccess: (data: import('../../components/Login').DeepLinkAuthData) => void;
```

### Step 2: Implement Handler in useAuthFlow.ts

**File:** `src/appCore/state/flows/useAuthFlow.ts`

Create handler similar to `handleLoginSuccess`:
```typescript
/**
 * Handle successful deep link authentication (TASK-1507B)
 * Called when browser OAuth completes and returns via deep link with license validation
 */
const handleDeepLinkAuthSuccess = useCallback(async (data: DeepLinkAuthData) => {
  log.info('[useAuthFlow] Deep link auth success', { userId: data.userId });

  try {
    // Store session tokens
    if (data.accessToken && data.refreshToken) {
      await window.api.session.setTokens(data.accessToken, data.refreshToken);
    }

    // Update authenticated state
    setIsAuthenticated(true);

    // Set user data
    if (data.user) {
      setCurrentUser({
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.name || data.user.email?.split('@')[0] || 'User',
      });
    }

    // Determine next step based on whether user is new
    // New users go to onboarding, returning users go to dashboard
    const isNewUser = !data.licenseStatus || data.licenseStatus.transactionCount === 0;

    if (isNewUser) {
      // New user - go to onboarding
      dispatch({ type: 'GO_TO_STEP', step: 'phone-type-selection' });
    } else {
      // Returning user - go to dashboard
      dispatch({ type: 'LOGIN_SUCCESS' });
    }
  } catch (error) {
    log.error('[useAuthFlow] Failed to complete deep link auth', error);
    // Stay on login screen with error
  }
}, [dispatch, setIsAuthenticated, setCurrentUser]);
```

### Step 3: Export Handler in returnHelpers.ts

**File:** `src/appCore/state/returnHelpers.ts`

Add to the return object:
```typescript
handleDeepLinkAuthSuccess,
```

### Step 4: Wire Up in AppRouter.tsx

**File:** `src/appCore/AppRouter.tsx`

Update the Login component props:
```typescript
// Before (line 76-81):
return (
  <Login
    onLoginSuccess={handleLoginSuccess}
    onLoginPending={handleLoginPending}
  />
);

// After:
return (
  <Login
    onLoginSuccess={handleLoginSuccess}
    onLoginPending={handleLoginPending}
    onDeepLinkAuthSuccess={handleDeepLinkAuthSuccess}
  />
);
```

Also destructure from `app` at the top:
```typescript
const {
  // ... existing handlers
  handleDeepLinkAuthSuccess,  // Add this
} = app;
```

---

## Acceptance Criteria

- [ ] Deep link auth success transitions to onboarding (new user) or dashboard (returning user)
- [ ] User session is properly stored
- [ ] `handleDeepLinkAuthSuccess` is defined in `AppStateMachine` type
- [ ] `handleDeepLinkAuthSuccess` is exported from `useAuthFlow.ts`
- [ ] `AppRouter.tsx` passes `onDeepLinkAuthSuccess` to `<Login>`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Testing Requirements

### Manual Testing

1. **New User Flow:**
   - Clear any existing session
   - Click "Sign In with Browser"
   - Complete OAuth in browser
   - Verify app transitions to onboarding (phone type selection)

2. **Returning User Flow:**
   - Ensure user has existing transactions
   - Sign out
   - Click "Sign In with Browser"
   - Complete OAuth in browser
   - Verify app transitions directly to dashboard

3. **Error Handling:**
   - Verify errors from deep link auth show on login screen
   - Verify can retry after error

### Unit Tests

- No new unit tests required (integration test covers this)
- Ensure existing tests still pass

---

## Dependencies

- **Depends on**: TASK-1508A (URL fragment parsing) must be merged
- **Blocks**: TASK-1508 (manual test of full flow)

---

## Integration Notes

- **Imports from:** `src/components/Login.tsx` (DeepLinkAuthData type)
- **Exports to:** `AppRouter.tsx` (via AppStateMachine)
- **Related:** TASK-1507 (license validation at auth - where the event is sent)

---

## Do / Don't

### Do:
- Follow existing patterns in `handleLoginSuccess` for consistency
- Log meaningful debug info during transition
- Handle both new user and returning user paths
- Store session tokens before updating UI state

### Don't:
- Don't add complex license validation logic here (already done in main process)
- Don't modify `Login.tsx` - it already has the correct implementation
- Don't change the event channel names (`auth:deep-link-callback`)
- Don't skip type definitions

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- The `AppStateMachine` type structure differs significantly from expected
- The state machine dispatch types are unclear
- Unclear how to determine if user is "new" vs "returning"
- Session token storage mechanism is different than expected

---

## PR Preparation

**Title**: `fix: wire deep link auth success handler to frontend`

**Labels**: `sprint-062`, `bug`, `auth`, `P0`

**PR Body Template**:
```markdown
## Summary
- Fix app not transitioning after deep link auth success
- Add `handleDeepLinkAuthSuccess` handler to state machine
- Wire handler from AppRouter to Login component

## Root Cause
`Login.tsx` had `onDeepLinkAuthSuccess` prop but `AppRouter.tsx` never passed it.
The handler existed but was never connected.

## Test Plan
- [ ] New user: browser auth -> onboarding flow starts
- [ ] Returning user: browser auth -> dashboard shown
- [ ] Error case: failed auth -> error shown on login, can retry
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | PM Agent | N/A | ~3K | Complete (inline) |
| 2. Implement | Engineer Agent | ___________ | ___K | Pending |
| 3. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 4. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

*To be completed by Engineer Agent*

### Files Changed
- [ ] `src/appCore/state/types.ts`
- [ ] `src/appCore/state/flows/useAuthFlow.ts`
- [ ] `src/appCore/state/returnHelpers.ts`
- [ ] `src/appCore/AppRouter.tsx`

### Approach Taken
*To be filled in by engineer*

### Testing Done
- [ ] TypeScript type-check passes
- [ ] ESLint passes
- [ ] Unit tests pass
- [ ] Manual test: new user flow
- [ ] Manual test: returning user flow

### Notes for SR Review
*To be filled in by engineer*
